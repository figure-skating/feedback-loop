import { PoseLandmark } from "./mediapipe/poseDetector";
import { VideoAnalysis } from "../store/analysisStore";

export interface AngleData {
  timestamp: number;
  frameIndex: number;
  angle: number;
}

export interface AngleAnalysis {
  leftKneeFlexion: AngleData[];
  rightKneeFlexion: AngleData[];
  hipFlexion: AngleData[];
  headHipAlignment: AngleData[];
  weightBearingHipAngle: AngleData[];
  shoulderAngleToIce: AngleData[];
  shoulderRotation: AngleData[]; // New: shoulder rotation for jump analysis
  shoulderCumulativeRotation: AngleData[]; // New: cumulative rotation progress
}

class AngleAnalysisService {
  // MediaPipe landmark indices
  private readonly NOSE = 0;
  private readonly LEFT_HIP = 23;
  private readonly RIGHT_HIP = 24;
  private readonly LEFT_KNEE = 25;
  private readonly RIGHT_KNEE = 26;
  private readonly LEFT_ANKLE = 27;
  private readonly RIGHT_ANKLE = 28;
  private readonly LEFT_SHOULDER = 11;
  private readonly RIGHT_SHOULDER = 12;

  /**
   * Analyze all biomechanical angles for a video analysis
   */
  analyzeAngles(analysis: VideoAnalysis): AngleAnalysis {
    const frames = analysis.frames.filter(
      (f) => f.processed && f.worldLandmarks
    );

    // Angle Analysis Debug: filtering frames with world landmarks

    const angleAnalysis: AngleAnalysis = {
      leftKneeFlexion: [],
      rightKneeFlexion: [],
      hipFlexion: [],
      headHipAlignment: [],
      weightBearingHipAngle: [],
      shoulderAngleToIce: [],
      shoulderRotation: [],
      shoulderCumulativeRotation: [],
    };

    for (const frame of frames) {
      if (!frame.worldLandmarks) continue;

      const frameIndex = analysis.frames.indexOf(frame);
      const landmarks = frame.worldLandmarks;

      try {
        // Calculate each angle
        const leftKneeAngle = this.calculateLeftKneeFlexion(landmarks);
        const rightKneeAngle = this.calculateRightKneeFlexion(landmarks);
        const hipAngle = this.calculateHipFlexion(landmarks);
        const headHipAngle = this.calculateHeadHipAlignment(landmarks);
        const weightBearingAngle =
          this.calculateWeightBearingHipAngle(landmarks);
        const shoulderAngle = this.calculateShoulderAngleToIce(landmarks);
        const shoulderRotationAngle = this.calculateShoulderRotation(landmarks);

        // Only add data if we have valid calculations
        if (leftKneeAngle !== null) {
          angleAnalysis.leftKneeFlexion.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: leftKneeAngle,
          });
        }

        if (rightKneeAngle !== null) {
          angleAnalysis.rightKneeFlexion.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: rightKneeAngle,
          });
        }

        if (hipAngle !== null) {
          angleAnalysis.hipFlexion.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: hipAngle,
          });
        }

        if (headHipAngle !== null) {
          angleAnalysis.headHipAlignment.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: headHipAngle,
          });
        }

        if (weightBearingAngle !== null) {
          angleAnalysis.weightBearingHipAngle.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: weightBearingAngle,
          });
        }

        if (shoulderAngle !== null) {
          angleAnalysis.shoulderAngleToIce.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: shoulderAngle,
          });
        }

        if (shoulderRotationAngle !== null) {
          angleAnalysis.shoulderRotation.push({
            timestamp: frame.timestamp,
            frameIndex,
            angle: shoulderRotationAngle,
          });
        }
      } catch (error) {
        // Error calculating angles for frame
      }
    }

    // Fill gaps in angle data to prevent missing values
    angleAnalysis.leftKneeFlexion = this.fillAngleDataGaps(
      angleAnalysis.leftKneeFlexion,
      frames
    );
    angleAnalysis.rightKneeFlexion = this.fillAngleDataGaps(
      angleAnalysis.rightKneeFlexion,
      frames
    );
    angleAnalysis.hipFlexion = this.fillAngleDataGaps(
      angleAnalysis.hipFlexion,
      frames
    );
    angleAnalysis.headHipAlignment = this.fillAngleDataGaps(
      angleAnalysis.headHipAlignment,
      frames
    );
    angleAnalysis.weightBearingHipAngle = this.fillAngleDataGaps(
      angleAnalysis.weightBearingHipAngle,
      frames
    );
    angleAnalysis.shoulderAngleToIce = this.fillAngleDataGaps(
      angleAnalysis.shoulderAngleToIce,
      frames
    );
    angleAnalysis.shoulderRotation = this.fillAngleDataGaps(
      angleAnalysis.shoulderRotation,
      frames
    );

    // Calculate cumulative rotation from shoulder rotation data
    angleAnalysis.shoulderCumulativeRotation = this.calculateCumulativeRotation(
      angleAnalysis.shoulderRotation
    );

    // Angle analysis complete

    return angleAnalysis;
  }

  /**
   * Calculate left knee flexion angle (sagittal plane) - Kinesiology Standard
   * Angle between hip-knee and knee-ankle vectors
   * 0° = straight leg (full extension), 135-150° = full flexion
   */
  private calculateLeftKneeFlexion(landmarks: PoseLandmark[]): number | null {
    const hip = landmarks[this.LEFT_HIP];
    const knee = landmarks[this.LEFT_KNEE];
    const ankle = landmarks[this.LEFT_ANKLE];

    if (!hip || !knee || !ankle) {
      return null;
    }

    // Debug logging removed - variable commented out for potential future use
    // const debugLog = Math.random() < 0.1; // 10% of frames

    // Debug logging for left knee landmarks (removed)

    // Vector from knee to hip (thigh)
    const thighVector = {
      x: hip.x - knee.x,
      y: hip.y - knee.y,
      z: (hip.z || 0) - (knee.z || 0),
    };

    // Vector from knee to ankle (shin)
    const shinVector = {
      x: ankle.x - knee.x,
      y: ankle.y - knee.y,
      z: (ankle.z || 0) - (knee.z || 0),
    };

    // Debug logging for left knee vectors (removed)

    // Calculate angle between vectors (this gives the interior angle)
    const angle = this.calculateAngleBetweenVectors(thighVector, shinVector);

    // Convert to kinesiology standard: 0° = straight, ~135-150° = fully bent
    // When leg is straight, vectors are nearly opposite (angle ≈ 180°)
    // When leg is bent, vectors form acute angle (angle ≈ 30-45°)
    const kneeFlexion = 180 - angle;

    // Debug logging for left knee angle result (removed)

    // Kinesiology standard: 0° = straight leg, 135-150° = full flexion
    return Math.max(0, kneeFlexion); // Ensure non-negative
  }

  /**
   * Calculate right knee flexion angle (sagittal plane) - Kinesiology Standard
   * Angle between hip-knee and knee-ankle vectors
   * 0° = straight leg (full extension), 135-150° = full flexion
   */
  private calculateRightKneeFlexion(landmarks: PoseLandmark[]): number | null {
    const hip = landmarks[this.RIGHT_HIP];
    const knee = landmarks[this.RIGHT_KNEE];
    const ankle = landmarks[this.RIGHT_ANKLE];

    if (!hip || !knee || !ankle) return null;

    // Vector from knee to hip (thigh)
    const thighVector = {
      x: hip.x - knee.x,
      y: hip.y - knee.y,
      z: (hip.z || 0) - (knee.z || 0),
    };

    // Vector from knee to ankle (shin)
    const shinVector = {
      x: ankle.x - knee.x,
      y: ankle.y - knee.y,
      z: (ankle.z || 0) - (knee.z || 0),
    };

    // Calculate angle between vectors (this gives the interior angle)
    const angle = this.calculateAngleBetweenVectors(thighVector, shinVector);

    // Convert to kinesiology standard: 0° = straight, ~135-150° = fully bent
    // When leg is straight, vectors are nearly opposite (angle ≈ 180°)
    // When leg is bent, vectors form acute angle (angle ≈ 30-45°)
    const kneeFlexion = 180 - angle;

    // Kinesiology standard: 0° = straight leg, 135-150° = full flexion
    return Math.max(0, kneeFlexion); // Ensure non-negative
  }

  /**
   * Calculate hip flexion angle (sagittal plane)
   * Angle between torso and thigh
   */
  private calculateHipFlexion(landmarks: PoseLandmark[]): number | null {
    // Use shoulder-hip for torso vector and hip-knee for thigh vector
    const shoulder = landmarks[this.LEFT_SHOULDER];
    const hip = landmarks[this.LEFT_HIP];
    const knee = landmarks[this.LEFT_KNEE];

    if (!shoulder || !hip || !knee) return null;

    // Vector from hip to shoulder (torso)
    const torsoVector = {
      x: shoulder.x - hip.x,
      y: shoulder.y - hip.y,
      z: (shoulder.z || 0) - (hip.z || 0),
    };

    // Vector from hip to knee (thigh)
    const thighVector = {
      x: knee.x - hip.x,
      y: knee.y - hip.y,
      z: (knee.z || 0) - (hip.z || 0),
    };

    return this.calculateAngleBetweenVectors(torsoVector, thighVector);
  }

  /**
   * Calculate head-hip alignment angle (sagittal plane)
   * Deviation from vertical alignment
   */
  private calculateHeadHipAlignment(landmarks: PoseLandmark[]): number | null {
    const nose = landmarks[this.NOSE];
    const leftHip = landmarks[this.LEFT_HIP];
    const rightHip = landmarks[this.RIGHT_HIP];

    if (!nose || !leftHip || !rightHip) return null;

    // Calculate hip center
    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      z: ((leftHip.z || 0) + (rightHip.z || 0)) / 2,
    };

    // Vector from hip center to nose
    const headHipVector = {
      x: nose.x - hipCenter.x,
      y: nose.y - hipCenter.y,
      z: (nose.z || 0) - hipCenter.z,
    };

    // Vertical reference vector (negative Y in MediaPipe world coords)
    const verticalVector = { x: 0, y: -1, z: 0 };

    // Calculate angle from vertical
    return this.calculateAngleBetweenVectors(headHipVector, verticalVector);
  }

  /**
   * Calculate weight-bearing hip angle (frontal plane)
   * Hip drop/elevation relative to horizontal
   */
  private calculateWeightBearingHipAngle(
    landmarks: PoseLandmark[]
  ): number | null {
    const leftHip = landmarks[this.LEFT_HIP];
    const rightHip = landmarks[this.RIGHT_HIP];

    if (!leftHip || !rightHip) return null;

    // Vector between hips
    const hipVector = {
      x: rightHip.x - leftHip.x,
      y: rightHip.y - leftHip.y,
      z: (rightHip.z || 0) - (leftHip.z || 0),
    };

    // Horizontal reference vector (X-axis in world coords)
    const horizontalVector = { x: 1, y: 0, z: 0 };

    // Calculate angle from horizontal
    return this.calculateAngleBetweenVectors(hipVector, horizontalVector);
  }

  /**
   * Calculate shoulder angle to ice (frontal plane)
   * Shoulder line relative to horizontal
   */
  private calculateShoulderAngleToIce(
    landmarks: PoseLandmark[]
  ): number | null {
    const leftShoulder = landmarks[this.LEFT_SHOULDER];
    const rightShoulder = landmarks[this.RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) return null;

    // Vector between shoulders
    const shoulderVector = {
      x: rightShoulder.x - leftShoulder.x,
      y: rightShoulder.y - leftShoulder.y,
      z: (rightShoulder.z || 0) - (leftShoulder.z || 0),
    };

    // Horizontal reference vector (X-axis in world coords)
    const horizontalVector = { x: 1, y: 0, z: 0 };

    // Calculate angle from horizontal
    return this.calculateAngleBetweenVectors(shoulderVector, horizontalVector);
  }

  /**
   * Calculate shoulder rotation angle (transverse plane)
   * Used for jump rotation analysis - shows rotation around vertical axis
   * Returns angle in degrees (0-360°) representing shoulder orientation
   */
  private calculateShoulderRotation(landmarks: PoseLandmark[]): number | null {
    const leftShoulder = landmarks[this.LEFT_SHOULDER];
    const rightShoulder = landmarks[this.RIGHT_SHOULDER];

    if (!leftShoulder || !rightShoulder) return null;

    // Calculate rotation in world space (X-Z plane for top-down view)
    const dx = rightShoulder.x - leftShoulder.x;
    const dz = (rightShoulder.z || 0) - (leftShoulder.z || 0);

    // Use atan2 to get angle in -180° to +180° range
    const angleRadians = Math.atan2(dz, dx);
    let angleDegrees = angleRadians * (180 / Math.PI);

    // Convert to 0-360° range for easier visualization
    if (angleDegrees < 0) {
      angleDegrees += 360;
    }

    return angleDegrees;
  }

  /**
   * Calculate angle between two 3D vectors in degrees
   */
  private calculateAngleBetweenVectors(
    vector1: { x: number; y: number; z: number },
    vector2: { x: number; y: number; z: number }
  ): number {
    // Calculate dot product
    const dot =
      vector1.x * vector2.x + vector1.y * vector2.y + vector1.z * vector2.z;

    // Calculate magnitudes
    const mag1 = Math.sqrt(
      vector1.x * vector1.x + vector1.y * vector1.y + vector1.z * vector1.z
    );
    const mag2 = Math.sqrt(
      vector2.x * vector2.x + vector2.y * vector2.y + vector2.z * vector2.z
    );

    if (mag1 === 0 || mag2 === 0) return 0;

    // Calculate cosine of angle
    const cosAngle = dot / (mag1 * mag2);

    // Clamp to valid range to avoid NaN from floating point errors
    const clampedCos = Math.max(-1, Math.min(1, cosAngle));

    // Convert to degrees
    const angleRadians = Math.acos(clampedCos);
    return (angleRadians * 180) / Math.PI;
  }

  /**
   * Fill gaps in angle data with interpolated values to prevent missing data points
   */
  private fillAngleDataGaps(
    angleData: AngleData[],
    allFrames: any[]
  ): AngleData[] {
    if (angleData.length === 0) return angleData;

    // Create a complete timeline based on all processed frames
    const completeData: AngleData[] = [];

    for (const frame of allFrames) {
      const frameIndex = allFrames.indexOf(frame);
      const timestamp = frame.timestamp;

      // Check if we have angle data for this exact timestamp
      const exactMatch = angleData.find(
        (data) => Math.abs(data.timestamp - timestamp) < 0.01 // 10ms tolerance
      );

      if (exactMatch) {
        completeData.push(exactMatch);
      } else {
        // Fill gap with interpolated value
        const interpolatedAngle = this.interpolateAngleValue(
          angleData,
          timestamp
        );
        if (interpolatedAngle !== null) {
          completeData.push({
            timestamp,
            frameIndex,
            angle: interpolatedAngle,
          });
        }
      }
    }

    return completeData.length > angleData.length ? completeData : angleData;
  }

  /**
   * Interpolate angle value for missing timestamps
   */
  private interpolateAngleValue(
    angleData: AngleData[],
    timestamp: number
  ): number | null {
    if (angleData.length === 0) return null;
    if (angleData.length === 1) return angleData[0].angle;

    // Find surrounding data points
    let beforeData: AngleData | null = null;
    let afterData: AngleData | null = null;

    for (let i = 0; i < angleData.length; i++) {
      if (angleData[i].timestamp <= timestamp) {
        beforeData = angleData[i];
      }
      if (angleData[i].timestamp >= timestamp && !afterData) {
        afterData = angleData[i];
        break;
      }
    }

    // If we're before the first data point, use the first value
    if (!beforeData && afterData) return afterData.angle;

    // If we're after the last data point, use the last value
    if (beforeData && !afterData) return beforeData.angle;

    // If we have both surrounding points, interpolate
    if (beforeData && afterData && beforeData !== afterData) {
      const timeDiff = afterData.timestamp - beforeData.timestamp;
      const angleProgress = (timestamp - beforeData.timestamp) / timeDiff;
      return (
        beforeData.angle + (afterData.angle - beforeData.angle) * angleProgress
      );
    }

    return beforeData?.angle || null;
  }

  /**
   * Smooth angle data using moving average
   */
  smoothAngleData(angleData: AngleData[], windowSize: number = 3): AngleData[] {
    if (angleData.length < windowSize) return angleData;

    const smoothed: AngleData[] = [];

    for (let i = 0; i < angleData.length; i++) {
      const start = Math.max(0, i - Math.floor(windowSize / 2));
      const end = Math.min(
        angleData.length,
        i + Math.floor(windowSize / 2) + 1
      );
      const window = angleData.slice(start, end);

      const avgAngle =
        window.reduce((sum, data) => sum + data.angle, 0) / window.length;

      smoothed.push({
        ...angleData[i],
        angle: avgAngle,
      });
    }

    return smoothed;
  }

  // Threshold for distinguishing noise from actual rotation
  // Movements smaller than this are not forced to match primary direction
  private readonly ROTATION_NOISE_THRESHOLD = 20; // degrees

  /**
   * Calculate cumulative rotation from shoulder rotation angle data
   * Uses two-pass algorithm:
   * Pass 1: Determine overall rotation direction (CW or CCW)
   * Pass 2: Force all angle differences to match the primary direction
   * Result: CCW jumps show positive cumulative, CW jumps show negative cumulative
   */
  private calculateCumulativeRotation(shoulderRotationData: AngleData[]): AngleData[] {
    if (shoulderRotationData.length < 2) return [];

    // Pass 1: Determine overall rotation direction
    let netRotation = 0;
    for (let i = 1; i < shoulderRotationData.length; i++) {
      const currentAngle = shoulderRotationData[i].angle;
      const previousAngle = shoulderRotationData[i - 1].angle;

      let angleDiff = currentAngle - previousAngle;

      // Apply standard wraparound for direction detection
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      netRotation += angleDiff;
    }

    // Determine primary direction based on net rotation
    const isCCW = netRotation > 0;  // Positive = counterclockwise
    const isCW = netRotation < 0;   // Negative = clockwise

    // Pass 2: Calculate cumulative rotation with forced direction consistency
    const cumulativeData: AngleData[] = [];
    let cumulativeRotation = 0;

    // First frame starts at 0° cumulative rotation
    cumulativeData.push({
      timestamp: shoulderRotationData[0].timestamp,
      frameIndex: shoulderRotationData[0].frameIndex,
      angle: 0,
    });

    for (let i = 1; i < shoulderRotationData.length; i++) {
      const currentAngle = shoulderRotationData[i].angle;
      const previousAngle = shoulderRotationData[i - 1].angle;

      let angleDiff = currentAngle - previousAngle;

      // NO standard wraparound here - we want the raw difference
      // Then force it to match the expected direction

      if (isCCW) {
        // For CCW rotation, we want all positive angle differences (0 to 360)
        // Only force direction for movements larger than noise threshold
        if (angleDiff < -this.ROTATION_NOISE_THRESHOLD) {
          angleDiff = angleDiff + 360;  // Convert negative to positive continuation
        }
        // Small negative movements (noise) are left as-is
      } else if (isCW) {
        // For CW rotation, we want all negative angle differences (0 to -360)
        // Only force direction for movements larger than noise threshold
        if (angleDiff > this.ROTATION_NOISE_THRESHOLD) {
          angleDiff = angleDiff - 360;  // Convert positive to negative continuation
        }
        // Small positive movements (noise) are left as-is
      }

      // Accumulate the rotation (positive for CCW, negative for CW)
      cumulativeRotation += angleDiff;

      // Store cumulative rotation progress
      cumulativeData.push({
        timestamp: shoulderRotationData[i].timestamp,
        frameIndex: shoulderRotationData[i].frameIndex,
        angle: cumulativeRotation,  // Positive for CCW, negative for CW
      });
    }

    return cumulativeData;
  }
}

export const angleAnalysisService = new AngleAnalysisService();
