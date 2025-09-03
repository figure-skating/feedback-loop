import { PoseLandmark } from './mediapipe/poseDetector';
import { VideoAnalysis } from '../store/analysisStore';

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
  private readonly ANKLE_LEFT = 27;
  private readonly ANKLE_RIGHT = 28;
  private readonly HIP_LEFT = 23;
  private readonly HIP_RIGHT = 24;
  // private readonly SHOULDER_LEFT = 11;
  // private readonly SHOULDER_RIGHT = 12;
  
  private loggedCoordinates = false;

  /**
   * Compute all jump metrics from video analysis
   */
  computeJumpMetrics(analysis: VideoAnalysis): JumpMetrics {
    if (!analysis || !analysis.isComplete) {
      return {
        airTime: null,
        takeoffFrame: null,
        landingFrame: null,
        rotations: null,
        maxHeight: null
      };
    }

    // Detect takeoff and landing frames
    const { takeoffFrame, landingFrame } = this.detectAirTime(analysis);
    
    // Calculate air time
    const airTime = takeoffFrame !== null && landingFrame !== null
      ? (analysis.frames[landingFrame].timestamp - analysis.frames[takeoffFrame].timestamp)
      : null;

    // Calculate rotation count during air time
    const rotations = takeoffFrame !== null && landingFrame !== null 
      ? this.calculateRotations(analysis, takeoffFrame, landingFrame)
      : null;
    
    // Calculate maximum jump height using physics
    const maxHeight = airTime !== null 
      ? this.calculateJumpHeight(airTime)
      : null;

    return {
      airTime,
      takeoffFrame,
      landingFrame,
      rotations,
      maxHeight
    };
  }

  /**
   * Advanced jump detection using multiple signals and validation
   */
  private detectAirTime(analysis: VideoAnalysis): { takeoffFrame: number | null; landingFrame: number | null } {
    const signals = this.extractSignals(analysis);
    
    if (signals.ankleHeights.length < 10) {
      return { takeoffFrame: null, landingFrame: null };
    }

    // Apply signal smoothing
    const smoothedSignals = this.smoothSignals(signals);
    
    // Multi-method detection
    const candidates = {
      velocity: this.velocityBasedDetection(smoothedSignals),
      acceleration: this.accelerationBasedDetection(smoothedSignals),
      height: this.heightBasedDetection(smoothedSignals),
      groundContact: this.groundContactDetection(smoothedSignals)
    };
    
    // Fuse detections with validation
    const result = this.fuseDetections(candidates, smoothedSignals);
    
    return result;
  }

  /**
   * Extract multiple signals for advanced analysis
   */
  private extractSignals(analysis: VideoAnalysis) {
    const frames = analysis.frames.filter(f => f.processed && f.worldLandmarks);
    
    const signals = {
      ankleHeights: [] as number[],
      hipHeights: [] as number[],
      headHeights: [] as number[],
      shoulderHeights: [] as number[],
      kneeAngles: [] as number[],
      centerOfMass: [] as number[],
      frameIndices: [] as number[],
      timestamps: [] as number[]
    };

    for (const frame of frames) {
      if (!frame.worldLandmarks) continue;
      
      const ankleY = this.getAverageAnkleVertical(frame.worldLandmarks);
      const hipY = this.getAverageHipY(frame.worldLandmarks);
      const headY = this.getHeadHeight(frame.worldLandmarks);
      const shoulderY = this.getAverageShoulderY(frame.worldLandmarks);
      const kneeAngle = this.calculateKneeAngle(frame.worldLandmarks);
      const comY = this.estimateCenterOfMass(frame.worldLandmarks);
      
      if (ankleY !== null && hipY !== null && headY !== null && shoulderY !== null) {
        signals.ankleHeights.push(ankleY);
        signals.hipHeights.push(hipY);
        signals.headHeights.push(headY);
        signals.shoulderHeights.push(shoulderY);
        signals.kneeAngles.push(kneeAngle);
        signals.centerOfMass.push(comY);
        signals.frameIndices.push(analysis.frames.indexOf(frame));
        signals.timestamps.push(frame.timestamp);
      }
    }

    return signals;
  }

  /**
   * Smooth signals using simple moving average (JavaScript equivalent of Gaussian filter)
   */
  private smoothSignals(signals: any) {
    const windowSize = 3; // Small window for real-time feel
    
    return {
      ...signals,
      ankleHeights: this.movingAverage(signals.ankleHeights, windowSize),
      hipHeights: this.movingAverage(signals.hipHeights, windowSize),
      centerOfMass: this.movingAverage(signals.centerOfMass, windowSize),
      velocities: this.calculateGradient(this.movingAverage(signals.ankleHeights, windowSize), signals.timestamps),
      accelerations: this.calculateSecondDerivative(signals.ankleHeights, signals.timestamps)
    };
  }

  /**
   * Velocity-based detection (improved version)
   */
  private velocityBasedDetection(signals: any) {
    const velocities = signals.velocities;
    const threshold = this.calculateDynamicThreshold(velocities.slice(0, 30), 2); // 2 std devs
    
    let takeoffFrame = null;
    let landingFrame = null;
    
    // Find takeoff: first sustained upward velocity
    for (let i = 5; i < velocities.length - 3; i++) {
      const current = velocities[i];
      const next = velocities[i + 1];
      const next2 = velocities[i + 2];
      
      if (current < -threshold && next < -threshold && next2 < -threshold) {
        takeoffFrame = signals.frameIndices[i];
        break;
      }
    }
    
    // Find landing: return to near-zero after falling
    if (takeoffFrame !== null) {
      const takeoffIdx = signals.frameIndices.indexOf(takeoffFrame);
      const searchStart = takeoffIdx + 8; // Min air time
      
      for (let i = searchStart; i < velocities.length - 2; i++) {
        const current = velocities[i];
        const next = velocities[i + 1];
        
        if (current > threshold && Math.abs(next) < threshold * 0.5) {
          landingFrame = signals.frameIndices[i + 1];
          break;
        }
      }
    }
    
    return {
      takeoffFrame,
      landingFrame,
      confidence: takeoffFrame && landingFrame ? 0.8 : 0.3
    };
  }

  /**
   * Acceleration-based detection
   */
  private accelerationBasedDetection(signals: any) {
    const accelerations = signals.accelerations;
    const accelThreshold = this.calculateDynamicThreshold(accelerations, 2.5);
    
    let takeoffFrame = null;
    let landingFrame = null;
    
    // Find takeoff: large positive acceleration (upward)
    for (let i = 0; i < accelerations.length; i++) {
      if (accelerations[i] < -accelThreshold) {
        takeoffFrame = signals.frameIndices[i];
        break;
      }
    }
    
    // Find landing: large negative acceleration (impact)
    if (takeoffFrame !== null) {
      const takeoffIdx = signals.frameIndices.indexOf(takeoffFrame);
      const searchStart = takeoffIdx + 8;
      
      for (let i = searchStart; i < accelerations.length; i++) {
        if (accelerations[i] > accelThreshold) {
          landingFrame = signals.frameIndices[i];
          break;
        }
      }
    }
    
    return {
      takeoffFrame,
      landingFrame,
      confidence: takeoffFrame && landingFrame ? 0.7 : 0.2
    };
  }

  /**
   * Height-based detection using ground plane estimation
   */
  private heightBasedDetection(signals: any) {
    const heights = signals.ankleHeights;
    const groundLevel = this.percentile(heights, 10); // 10th percentile as ground
    const contactThreshold = 0.02; // 2cm threshold
    
    const contactStates = heights.map((h: number) => (h - groundLevel) < contactThreshold);
    
    let takeoffFrame = null;
    let landingFrame = null;
    
    // Find state transitions
    for (let i = 1; i < contactStates.length; i++) {
      // Takeoff: ground contact to airborne
      if (contactStates[i - 1] && !contactStates[i] && takeoffFrame === null) {
        takeoffFrame = signals.frameIndices[i];
      }
      
      // Landing: airborne to ground contact
      if (!contactStates[i - 1] && contactStates[i] && takeoffFrame !== null && landingFrame === null) {
        landingFrame = signals.frameIndices[i];
        break;
      }
    }
    
    return {
      takeoffFrame,
      landingFrame,
      confidence: takeoffFrame && landingFrame ? 0.9 : 0.4
    };
  }

  /**
   * Ground contact detection using foot positions
   */
  private groundContactDetection(_signals: any) {
    // This method would use foot landmarks (31, 32) instead of ankles
    // For now, return lower confidence placeholder
    return {
      takeoffFrame: null,
      landingFrame: null,
      confidence: 0.1
    };
  }

  /**
   * Fuse multiple detection methods with validation
   */
  private fuseDetections(candidates: any, signals: any) {
    const validCandidates = Object.entries(candidates)
      .filter(([_, result]: [string, any]) => result.takeoffFrame !== null && result.landingFrame !== null)
      .map(([method, result]: [string, any]) => ({ method, ...result }));
    
    if (validCandidates.length === 0) {
      return { takeoffFrame: null, landingFrame: null };
    }
    
    // Weighted fusion based on confidence
    const takeoffVotes = validCandidates.map(c => ({ frame: c.takeoffFrame, weight: c.confidence }));
    const landingVotes = validCandidates.map(c => ({ frame: c.landingFrame, weight: c.confidence }));
    
    const takeoffFrame = this.weightedAverage(takeoffVotes);
    const landingFrame = this.weightedAverage(landingVotes);
    
    // Validate the fused result
    const validation = this.validateJumpDetection(takeoffFrame, landingFrame, signals);
    
    if (validation.isValid) {
      return { takeoffFrame, landingFrame };
    } else {
      return { takeoffFrame: null, landingFrame: null };
    }
  }

  // Helper methods for signal processing
  private movingAverage(data: number[], windowSize: number): number[] {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
      const window = data.slice(start, end);
      const avg = window.reduce((sum, val) => sum + val, 0) / window.length;
      result.push(avg);
    }
    return result;
  }

  private calculateGradient(data: number[], timestamps: number[]): number[] {
    const gradient = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        gradient.push((data[i + 1] - data[i]) / (timestamps[i + 1] - timestamps[i]));
      } else if (i === data.length - 1) {
        gradient.push((data[i] - data[i - 1]) / (timestamps[i] - timestamps[i - 1]));
      } else {
        const dt1 = timestamps[i] - timestamps[i - 1];
        const dt2 = timestamps[i + 1] - timestamps[i];
        const dy1 = data[i] - data[i - 1];
        const dy2 = data[i + 1] - data[i];
        gradient.push((dy1 / dt1 + dy2 / dt2) / 2);
      }
    }
    return gradient;
  }

  private calculateSecondDerivative(data: number[], timestamps: number[]): number[] {
    const firstDerivative = this.calculateGradient(data, timestamps);
    return this.calculateGradient(firstDerivative, timestamps);
  }

  private calculateDynamicThreshold(data: number[], stdMultiplier: number): number {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const stdDev = Math.sqrt(variance);
    return Math.abs(stdDev * stdMultiplier);
  }

  private percentile(data: number[], p: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
  }

  private weightedAverage(votes: { frame: number; weight: number }[]): number {
    const totalWeight = votes.reduce((sum, vote) => sum + vote.weight, 0);
    const weightedSum = votes.reduce((sum, vote) => sum + vote.frame * vote.weight, 0);
    return Math.round(weightedSum / totalWeight);
  }

  private validateJumpDetection(takeoffFrame: number, landingFrame: number, signals: any) {
    const flightFrames = landingFrame - takeoffFrame;
    const fps = signals.timestamps.length > 1 ? 
      signals.timestamps.length / (signals.timestamps[signals.timestamps.length - 1] - signals.timestamps[0]) : 60;
    const flightTime = flightFrames / fps;
    
    // Validation checks
    if (flightTime < 0.1) {
      return { isValid: false, reason: 'Flight time too short', confidence: 0 };
    }
    
    if (flightTime > 1.5) {
      return { isValid: false, reason: 'Flight time too long for figure skating', confidence: 0 };
    }
    
    // Check for height increase during flight
    const takeoffIdx = signals.frameIndices.indexOf(takeoffFrame);
    const landingIdx = signals.frameIndices.indexOf(landingFrame);
    const apexIdx = Math.floor((takeoffIdx + landingIdx) / 2);
    
    if (apexIdx < signals.hipHeights.length) {
      const preJumpHeight = takeoffIdx > 5 ? signals.hipHeights[takeoffIdx - 5] : signals.hipHeights[0];
      const apexHeight = signals.hipHeights[apexIdx];
      
      if (apexHeight <= preJumpHeight) {
        return { isValid: false, reason: 'No height increase detected', confidence: 0 };
      }
    }
    
    // Calculate confidence based on flight time (optimal range 0.3-0.8s for figure skating)
    let confidence = 0.5;
    if (flightTime >= 0.3 && flightTime <= 0.8) {
      confidence = 0.9;
    } else if (flightTime >= 0.2 && flightTime <= 1.0) {
      confidence = 0.7;
    }
    
    return { isValid: true, reason: 'Valid jump detected', confidence };
  }

  private calculateKneeAngle(landmarks: PoseLandmark[]): number {
    // Calculate knee flexion angle using hip-knee-ankle points
    const leftHip = landmarks[this.HIP_LEFT];
    const leftKnee = landmarks[25]; // Left knee
    const leftAnkle = landmarks[this.ANKLE_LEFT];
    
    if (!leftHip || !leftKnee || !leftAnkle) return 180; // Default to straight
    
    // Vector from knee to hip
    const hipVector = { x: leftHip.x - leftKnee.x, y: leftHip.y - leftKnee.y };
    // Vector from knee to ankle  
    const ankleVector = { x: leftAnkle.x - leftKnee.x, y: leftAnkle.y - leftKnee.y };
    
    // Calculate angle between vectors
    const dot = hipVector.x * ankleVector.x + hipVector.y * ankleVector.y;
    const hipMag = Math.sqrt(hipVector.x * hipVector.x + hipVector.y * hipVector.y);
    const ankleMag = Math.sqrt(ankleVector.x * ankleVector.x + ankleVector.y * ankleVector.y);
    
    const cosAngle = dot / (hipMag * ankleMag);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))); // Clamp to valid range
    
    return angle * 180 / Math.PI; // Convert to degrees
  }

  private estimateCenterOfMass(landmarks: PoseLandmark[]): number {
    // Simple center of mass approximation using key body points
    const hip = this.getAverageHipY(landmarks);
    const shoulder = (landmarks[11]?.y + landmarks[12]?.y) / 2;
    
    if (hip === null || !shoulder) return hip || 0;
    
    // Weighted average (hips have more mass)
    return (hip * 0.7 + shoulder * 0.3);
  }

  /**
   * Calculate number of rotations during air time
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
    
    // Smooth the angle data to reduce noise
    const smoothedAngles = this.smoothAngles(shoulderAngles);
    
    // Count rotations using multiple methods
    const rotationMethods = {
      unwrapped: this.countRotationsUnwrapped(smoothedAngles),
      zeroCrossing: this.countRotationsZeroCrossing(smoothedAngles),
      cumulative: this.countRotationsCumulative(smoothedAngles)
    };
    
    // Use the most reliable method or average if they agree
    return this.fuseRotationDetections(rotationMethods);
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
  /**
   * Get the vertical coordinate of ankles (determines which axis is vertical)
   */
  private getAverageAnkleVertical(landmarks: PoseLandmark[]): number | null {
    const leftAnkle = landmarks[this.ANKLE_LEFT];
    const rightAnkle = landmarks[this.ANKLE_RIGHT];

    if (!leftAnkle || !rightAnkle) {
      return null;
    }
    
    // Track coordinate system (for reference, no logging)
    if (!this.loggedCoordinates) {
      // In MediaPipe world coordinates:
      // X: left/right (horizontal)
      // Y: up/down (vertical) - NEGATIVE Y is UP
      // Z: forward/backward (depth)
      this.loggedCoordinates = true;
    }

    // Use Y coordinate as vertical axis
    const leftValid = leftAnkle.y !== undefined && !isNaN(leftAnkle.y) && isFinite(leftAnkle.y);
    const rightValid = rightAnkle.y !== undefined && !isNaN(rightAnkle.y) && isFinite(rightAnkle.y);
    
    if (!leftValid && !rightValid) return null;

    let totalY = 0;
    let count = 0;

    if (leftValid) {
      totalY += leftAnkle.y;
      count++;
    }
    if (rightValid) {
      totalY += rightAnkle.y;
      count++;
    }

    return count > 0 ? totalY / count : null;
  }


  /**
   * Debug method to expose internal detection signals for visualization
   */
  getDebugData(analysis: VideoAnalysis) {
    if (!analysis || !analysis.isComplete) {
      return null;
    }

    // Extract signals
    const signals = this.extractSignals(analysis);
    
    if (signals.ankleHeights.length < 10) {
      return null;
    }

    // Apply signal smoothing
    const smoothedSignals = this.smoothSignals(signals);
    
    // Multi-method detection candidates
    const detectionCandidates = {
      velocity: this.velocityBasedDetection(smoothedSignals),
      acceleration: this.accelerationBasedDetection(smoothedSignals),
      height: this.heightBasedDetection(smoothedSignals)
    };
    
    // Calculate ground level
    const groundLevel = this.percentile(signals.ankleHeights, 10);
    
    return {
      signals,
      smoothedSignals,
      detectionCandidates,
      groundLevel
    };
  }

  /**
   * Get head height using nose landmark
   */
  private getHeadHeight(landmarks: PoseLandmark[]): number | null {
    const nose = landmarks[0]; // Nose is landmark 0
    
    if (!nose || nose.y === undefined || isNaN(nose.y) || !isFinite(nose.y)) {
      return null;
    }
    
    return nose.y;
  }

  /**
   * Get average Y position of both shoulders
   */
  private getAverageShoulderY(landmarks: PoseLandmark[]): number | null {
    const leftShoulder = landmarks[11]; // Left shoulder
    const rightShoulder = landmarks[12]; // Right shoulder

    if (!leftShoulder || !rightShoulder) return null;
    
    // Check if coordinates exist and are reasonable
    const leftValid = leftShoulder.y !== undefined && !isNaN(leftShoulder.y) && isFinite(leftShoulder.y);
    const rightValid = rightShoulder.y !== undefined && !isNaN(rightShoulder.y) && isFinite(rightShoulder.y);
    
    if (!leftValid && !rightValid) return null;

    let totalY = 0;
    let count = 0;

    if (leftValid) {
      totalY += leftShoulder.y;
      count++;
    }
    if (rightValid) {
      totalY += rightShoulder.y;
      count++;
    }

    return count > 0 ? totalY / count : null;
  }

  /**
   * Get average Y position of both hips
   */
  private getAverageHipY(landmarks: PoseLandmark[]): number | null {
    const leftHip = landmarks[this.HIP_LEFT];
    const rightHip = landmarks[this.HIP_RIGHT];

    if (!leftHip || !rightHip) return null;
    
    // Check if coordinates exist and are reasonable
    const leftValid = leftHip.y !== undefined && !isNaN(leftHip.y) && isFinite(leftHip.y);
    const rightValid = rightHip.y !== undefined && !isNaN(rightHip.y) && isFinite(rightHip.y);
    
    if (!leftValid && !rightValid) return null;

    let totalY = 0;
    let count = 0;

    if (leftValid) {
      totalY += leftHip.y;
      count++;
    }
    if (rightValid) {
      totalY += rightHip.y;
      count++;
    }

    return count > 0 ? totalY / count : null;
  }
}

export const jumpMetricsService = new JumpMetricsService();