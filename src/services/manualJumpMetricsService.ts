import { ManualMarkers } from '../store/analysisStore';
import { JumpMetrics } from './jumpMetricsService';
import { VideoAnalysis } from '../store/analysisStore';

class ManualJumpMetricsService {
  /**
   * Calculate jump metrics using manual markers instead of auto-detection
   */
  computeJumpMetrics(markers: ManualMarkers, videoType: 'reference' | 'user', analysis?: VideoAnalysis): JumpMetrics {
    const videoMarkers = videoType === 'reference' ? markers.reference : markers.user;
    
    if (!videoMarkers.takeoffTime || !videoMarkers.landingTime || 
        !videoMarkers.takeoffFrame || !videoMarkers.landingFrame) {
      return {
        airTime: null,
        takeoffFrame: null,
        landingFrame: null,
        rotations: null,
        maxHeight: null
      };
    }

    // Calculate air time from manual markers
    const airTime = videoMarkers.landingTime - videoMarkers.takeoffTime;
    
    // Calculate jump height using physics formula
    const maxHeight = this.calculateJumpHeight(airTime);
    
    // Calculate rotation count if we have analysis data
    let rotations: number | null = null;
    if (analysis && analysis.isComplete) {
      rotations = this.calculateRotations(analysis, videoMarkers.takeoffFrame, videoMarkers.landingFrame);
    }

    return {
      airTime,
      takeoffFrame: videoMarkers.takeoffFrame,
      landingFrame: videoMarkers.landingFrame,
      rotations,
      maxHeight
    };
  }

  /**
   * Calculate rotation count during manually marked air time
   */
  private calculateRotations(analysis: VideoAnalysis, takeoffFrame: number, landingFrame: number): number | null {
    const airTimeFrames = analysis.frames.slice(
      Math.max(0, takeoffFrame),
      Math.min(analysis.frames.length, landingFrame + 1)
    ).filter(frame => frame.processed && frame.worldLandmarks);
    
    if (airTimeFrames.length < 5) {
      return null;
    }
    
    // Extract shoulder orientations during air time
    const shoulderAngles = this.extractShoulderAngles(airTimeFrames);
    
    if (shoulderAngles.length < 3) {
      return null;
    }
    
    // Count rotations using unwrapped angle progression (most reliable method)
    return this.countRotationsUnwrapped(shoulderAngles);
  }

  /**
   * Extract shoulder angle orientation for each frame
   */
  private extractShoulderAngles(frames: any[]): number[] {
    const angles = [];
    
    for (const frame of frames) {
      if (!frame.worldLandmarks) continue;
      
      const leftShoulder = frame.worldLandmarks[11];  // Left shoulder
      const rightShoulder = frame.worldLandmarks[12]; // Right shoulder
      
      if (!leftShoulder || !rightShoulder) continue;
      
      // Calculate angle of shoulder line relative to horizontal
      const deltaX = rightShoulder.x - leftShoulder.x;
      const deltaZ = rightShoulder.z - leftShoulder.z; // Use Z for forward/back rotation
      
      // Calculate angle in XZ plane (top-down view for rotations)
      let angle = Math.atan2(deltaZ, deltaX) * 180 / Math.PI;
      
      // Normalize angle to 0-360 range
      if (angle < 0) angle += 360;
      
      angles.push(angle);
    }
    
    return angles;
  }

  /**
   * Count rotations using unwrapped angle progression
   */
  private countRotationsUnwrapped(angles: number[]): number | null {
    if (angles.length < 3) return null;
    
    // Unwrap angles to handle 0/360 transitions
    let totalRotation = 0;
    
    for (let i = 1; i < angles.length; i++) {
      let diff = angles[i] - angles[i - 1];
      
      // Handle wrap-around
      if (diff > 180) {
        diff -= 360;
      } else if (diff < -180) {
        diff += 360;
      }
      
      totalRotation += diff;
    }
    
    const rotations = Math.abs(totalRotation) / 360;
    
    // Round to nearest quarter rotation for figure skating
    return Math.round(rotations * 4) / 4;
  }

  /**
   * Calculate jump height using physics formula: h = (g * t²) / 8
   * Where g = 9.81 m/s² (gravity) and t = air time in seconds
   */
  private calculateJumpHeight(airTime: number): number | null {
    if (airTime <= 0) {
      return null;
    }

    // Physics formula for maximum height during projectile motion
    // h = (1/2) * g * (t/2)² = g * t² / 8
    const gravity = 9.81; // m/s²
    const height = (gravity * airTime * airTime) / 8;
    
    return height;
  }

  /**
   * Compare two jump metrics and return comparison data
   */
  compareMetrics(referenceMetrics: JumpMetrics, userMetrics: JumpMetrics) {
    const comparison = {
      airTime: {
        reference: referenceMetrics.airTime,
        user: userMetrics.airTime,
        difference: null as number | null,
        improvement: null as 'better' | 'worse' | 'same' | null
      },
      rotations: {
        reference: referenceMetrics.rotations,
        user: userMetrics.rotations,
        difference: null as number | null,
        improvement: null as 'better' | 'worse' | 'same' | null
      },
      height: {
        reference: referenceMetrics.maxHeight,
        user: userMetrics.maxHeight,
        difference: null as number | null,
        improvement: null as 'better' | 'worse' | 'same' | null
      }
    };

    // Calculate differences and improvements
    if (referenceMetrics.airTime && userMetrics.airTime) {
      comparison.airTime.difference = userMetrics.airTime - referenceMetrics.airTime;
      comparison.airTime.improvement = 
        comparison.airTime.difference > 0.05 ? 'better' :
        comparison.airTime.difference < -0.05 ? 'worse' : 'same';
    }

    if (referenceMetrics.rotations && userMetrics.rotations) {
      comparison.rotations.difference = userMetrics.rotations - referenceMetrics.rotations;
      comparison.rotations.improvement = 
        comparison.rotations.difference > 0.1 ? 'better' :
        comparison.rotations.difference < -0.1 ? 'worse' : 'same';
    }

    if (referenceMetrics.maxHeight && userMetrics.maxHeight) {
      comparison.height.difference = userMetrics.maxHeight - referenceMetrics.maxHeight;
      comparison.height.improvement = 
        comparison.height.difference > 0.02 ? 'better' :
        comparison.height.difference < -0.02 ? 'worse' : 'same';
    }

    return comparison;
  }
}

export const manualJumpMetricsService = new ManualJumpMetricsService();