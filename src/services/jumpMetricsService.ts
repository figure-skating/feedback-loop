import { VideoAnalysis, ManualMarkers } from '../store/analysisStore';
import { AngleAnalysis } from './angleAnalysisService';

export interface JumpMetrics {
  airTime: number | null; // in seconds
  takeoffFrame: number | null;
  landingFrame: number | null;
  rotations: number | null;
  maxHeight: number | null; // in pixels for now
}


export interface FrameVelocity {
  frameIndex: number;
  timestamp: number;
  ankleVelocity: number;
  hipVelocity: number;
}

class JumpMetricsService {
  // Number of frames to add before takeoff and after landing for rotation analysis
  // This captures the natural shoulder rotation that begins before leaving ice
  // and continues briefly after landing
  private readonly ROTATION_PADDING_FRAMES = 2;

  /**
   * Compute all jump metrics from video analysis and manual markers
   * Manual markers are required - no auto-detection is performed
   * @param videoType - Specifies which video's markers to use ('reference' or 'user')
   * @param angleAnalysis - Pre-computed angle analysis containing rotation data
   */
  computeJumpMetrics(analysis: VideoAnalysis, manualMarkers: ManualMarkers, videoType: 'reference' | 'user', angleAnalysis?: AngleAnalysis): JumpMetrics {
    if (!analysis || !analysis.isComplete) {
      throw new Error('Analysis must be complete to compute jump metrics');
    }

    if (!manualMarkers) {
      throw new Error('Manual markers are required to compute jump metrics');
    }

    // Get frames from manual markers for the specific video type
    const markers = manualMarkers[videoType];
    const rawTakeoffFrame = markers.takeoffFrame;
    const rawLandingFrame = markers.landingFrame;

    if (rawTakeoffFrame === null || rawLandingFrame === null) {
      throw new Error('Both takeoff and landing frames must be specified in manual markers');
    }

    // Convert frame numbers to timestamps (sample videos are 30fps)
    const sampleVideoFps = 30;
    const takeoffTime = rawTakeoffFrame / sampleVideoFps; // Convert to seconds
    const landingTime = rawLandingFrame / sampleVideoFps; // Convert to seconds

    // Find closest analysis frames to these timestamps
    const takeoffFrame = this.findClosestFrameByTime(analysis.frames, takeoffTime);
    const landingFrame = this.findClosestFrameByTime(analysis.frames, landingTime);

    if (takeoffFrame === null || landingFrame === null) {
      throw new Error('Could not find analysis frames for takeoff/landing times');
    }

    // Debug logging
    console.log('🎯 Rotation Debug:', {
      rawTakeoffFrame,
      rawLandingFrame,
      takeoffTime,
      landingTime,
      analysisFrames: analysis.frames.length,
      mappedTakeoffFrame: takeoffFrame,
      mappedLandingFrame: landingFrame,
      airTimeFrames: landingFrame - takeoffFrame + 1,
      rotationFrames: `${Math.max(0, takeoffFrame - this.ROTATION_PADDING_FRAMES)} to ${Math.min(analysis.frames.length - 1, landingFrame + this.ROTATION_PADDING_FRAMES)}` + ` (${Math.min(analysis.frames.length - 1, landingFrame + this.ROTATION_PADDING_FRAMES) - Math.max(0, takeoffFrame - this.ROTATION_PADDING_FRAMES) + 1} frames)`
    })

    // Ensure takeoff comes before landing
    if (takeoffFrame >= landingFrame) {
      throw new Error(`Invalid frame sequence: takeoff (${takeoffFrame}) must be before landing (${landingFrame})`);
    }

    // Calculate air time (using exact takeoff/landing frames)
    const airTime = analysis.frames[landingFrame].timestamp - analysis.frames[takeoffFrame].timestamp;

    // Get rotation count from angle analysis (calculated once, used everywhere)
    const rotations = this.extractRotationFromAngleAnalysis(angleAnalysis, takeoffFrame, landingFrame);

    // Calculate maximum jump height using physics
    const maxHeight = this.calculateJumpHeight(airTime);

    return {
      airTime,
      takeoffFrame,
      landingFrame,
      rotations,
      maxHeight
    };
  }


















  /**
   * Extract rotation count from pre-computed angle analysis data
   * Uses the shoulder cumulative rotation data with padding frames for complete rotation
   *
   * @param angleAnalysis - Pre-computed angle analysis containing shoulderCumulativeRotation
   * @param takeoffFrame - Takeoff frame index
   * @param landingFrame - Landing frame index
   */
  private extractRotationFromAngleAnalysis(angleAnalysis: AngleAnalysis | undefined, takeoffFrame: number, landingFrame: number): number | null {
    if (!angleAnalysis || !angleAnalysis.shoulderCumulativeRotation || angleAnalysis.shoulderCumulativeRotation.length === 0) {
      return null;
    }

    // Find the rotation data that corresponds to our jump window (with padding)
    const rotationStartFrame = Math.max(0, takeoffFrame - this.ROTATION_PADDING_FRAMES);
    const rotationEndFrame = landingFrame + this.ROTATION_PADDING_FRAMES;

    // Find cumulative rotation values at start and end of jump window
    const startRotationData = angleAnalysis.shoulderCumulativeRotation.find(
      data => data.frameIndex >= rotationStartFrame
    );

    const endRotationData = angleAnalysis.shoulderCumulativeRotation
      .slice()
      .reverse()
      .find(data => data.frameIndex <= rotationEndFrame);

    if (!startRotationData || !endRotationData) {
      return null;
    }

    // Calculate total rotation during the jump (including padding)
    const totalRotationDegrees = Math.abs(endRotationData.angle - startRotationData.angle);
    const rotations = totalRotationDegrees / 360;

    return rotations;
  }

  /**
   * Extract shoulder angle orientation for each frame
   * NOTE: Replaced by inline calculation in optimized rotation detection
   */
  // @ts-ignore - Legacy method kept for reference
  private extractShoulderAngles(frames: any[]): number[] {
    const angles = [];
    
    for (const frame of frames) {
      if (!frame.worldLandmarks) continue;
      
      const leftShoulder = frame.worldLandmarks[11];  // Left shoulder
      const rightShoulder = frame.worldLandmarks[12]; // Right shoulder
      
      if (!leftShoulder || !rightShoulder) continue;
      
      // Calculate angle of shoulder line relative to horizontal
      // Using world coordinates (X = left/right, Y = up/down, Z = forward/back)
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
   * Smooth angle data with circular average (handles 0/360 degree wrap-around)
   */
  // @ts-ignore - Legacy method kept for reference
  private smoothAngles(angles: number[], windowSize: number = 3): number[] {
    const smoothed = [];
    
    for (let i = 0; i < angles.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(angles.length, i + Math.floor(windowSize / 2) + 1);
      const window = angles.slice(start, end);
      
      // Convert angles to unit vectors and average
      let sumX = 0, sumY = 0;
      for (const angle of window) {
        const rad = angle * Math.PI / 180;
        sumX += Math.cos(rad);
        sumY += Math.sin(rad);
      }
      
      // Convert back to angle
      let avgAngle = Math.atan2(sumY, sumX) * 180 / Math.PI;
      if (avgAngle < 0) avgAngle += 360;
      
      smoothed.push(avgAngle);
    }
    
    return smoothed;
  }

  /**
   * Count rotations using unwrapped angle progression
   */
  // @ts-ignore - Legacy method kept for reference
  private countRotationsUnwrapped(angles: number[]): number | null {
    if (angles.length < 3) return null;
    
    // Unwrap angles to handle 0/360 transitions
    const unwrapped = [angles[0]];
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
      unwrapped.push(unwrapped[i - 1] + diff);
    }
    
    const rotations = Math.abs(totalRotation) / 360;
    
    return rotations;
  }

  /**
   * Count rotations by detecting zero crossings (angle transitions)
   */
  // @ts-ignore - Legacy method kept for reference
  private countRotationsZeroCrossing(angles: number[]): number | null {
    if (angles.length < 5) return null;
    
    // Track which quadrant we're in (0°-90°-180°-270°-360°)
    const getQuadrant = (angle: number) => Math.floor(angle / 90);
    
    let prevQuadrant = getQuadrant(angles[0]);
    let quadrantTransitions = 0;
    
    for (let i = 1; i < angles.length; i++) {
      const currentQuadrant = getQuadrant(angles[i]);
      
      if (currentQuadrant !== prevQuadrant) {
        // Check if it's a valid transition (not jumping across quadrants)
        const quadrantDiff = Math.abs(currentQuadrant - prevQuadrant);
        if (quadrantDiff === 1 || quadrantDiff === 3) { // 3 means 0<->3 transition
          quadrantTransitions++;
        }
        prevQuadrant = currentQuadrant;
      }
    }
    
    const rotations = quadrantTransitions / 4; // 4 quadrant transitions = 1 rotation
    
    return rotations;
  }

  /**
   * Count rotations using cumulative angle change
   */
  // @ts-ignore - Legacy method kept for reference
  private countRotationsCumulative(angles: number[]): number | null {
    if (angles.length < 3) return null;
    
    let cumulativeChange = 0;
    let direction = 0; // 1 for clockwise, -1 for counter-clockwise
    
    for (let i = 1; i < angles.length; i++) {
      let angleDiff = angles[i] - angles[i - 1];
      
      // Normalize difference to [-180, 180]
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;
      
      // Determine primary rotation direction
      if (Math.abs(angleDiff) > 5) { // Ignore small movements
        if (direction === 0) {
          direction = angleDiff > 0 ? 1 : -1;
        }
        
        // Only count changes in the primary direction
        if ((direction > 0 && angleDiff > 0) || (direction < 0 && angleDiff < 0)) {
          cumulativeChange += Math.abs(angleDiff);
        }
      }
    }
    
    const rotations = cumulativeChange / 360;
    
    return rotations;
  }


  /**
   * Combine multiple rotation detection methods
   */
  // @ts-ignore - Legacy method kept for reference
  private fuseRotationDetections(methods: any): number | null {
    const validMethods = Object.entries(methods)
      .filter(([_, value]: [string, any]) => value !== null && value !== undefined && !isNaN(value))
      .map(([name, value]: [string, any]) => ({ name, value }));
    
    if (validMethods.length === 0) {
      return null;
    }
    
    // If methods agree within 0.3 rotations, average them
    const values = validMethods.map(m => m.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    if (max - min <= 0.3) {
      const average = values.reduce((sum, val) => sum + val, 0) / values.length;
      return Math.round(average * 4) / 4; // Round to nearest quarter rotation
    }
    
    // Use the most conservative (lowest) estimate if they disagree
    const conservative = Math.min(...values);
    return Math.round(conservative * 4) / 4;
  }

  /**
   * Find the closest analysis frame to a given timestamp
   */
  private findClosestFrameByTime(frames: any[], targetTime: number): number | null {
    if (frames.length === 0) return null;

    let closestIndex = 0;
    let minTimeDiff = Math.abs(frames[0].timestamp - targetTime);

    for (let i = 1; i < frames.length; i++) {
      const timeDiff = Math.abs(frames[i].timestamp - targetTime);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestIndex = i;
      }
    }

    return closestIndex;
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
    // where t/2 is time to reach maximum height (half of total air time)
    const gravity = 9.81; // m/s² (Earth's gravity)
    const height = (gravity * airTime * airTime) / 8;

    return height;
  }

  /**
   * Get average Y position of both ankles
   */





}

export const jumpMetricsService = new JumpMetricsService();