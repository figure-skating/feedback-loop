import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface PoseLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface PoseResults {
  landmarks: PoseLandmark[][];
  worldLandmarks?: PoseLandmark[][];
}

class PoseDetectorService {
  private poseLandmarker: PoseLandmarker | null = null;
  private isInitialized = false;
  private isInitializing = false;
  private lastVideoTime = -1;

  async initialize(): Promise<void> {
    if (this.isInitialized || this.isInitializing) {
      return;
    }

    this.isInitializing = true;

    try {
      // Try a simpler CDN approach with the specific version that works
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      // Add timeout to prevent hanging
      const createPoseLandmarker = PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.3,
        minPosePresenceConfidence: 0.3,
        minTrackingConfidence: 0.3,
        outputSegmentationMasks: false
      });
      
      // Add 30 second timeout
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('MediaPipe initialization timeout (30s)')), 30000)
      );
      
      this.poseLandmarker = await Promise.race([createPoseLandmarker, timeoutPromise]) as PoseLandmarker;

      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize MediaPipe Pose Landmarker:', error);
      this.isInitialized = false;
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async detectPose(videoElement: HTMLVideoElement): Promise<PoseResults | null> {
    if (!this.isInitialized || !this.poseLandmarker) {
      return null;
    }

    try {
      // Use performance.now() for monotonically increasing timestamps
      const timestamp = performance.now();
      
      // Skip if video hasn't progressed (to avoid processing same frame)
      const currentVideoTime = videoElement.currentTime;
      if (currentVideoTime === this.lastVideoTime) {
        return null;
      }
      this.lastVideoTime = currentVideoTime;
      
      const results = this.poseLandmarker.detectForVideo(videoElement, timestamp);
      
      if (results.landmarks && results.landmarks.length > 0) {
        return {
          landmarks: results.landmarks,
          worldLandmarks: results.worldLandmarks
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ Pose detection error:', error);
      return null;
    }
  }

  drawPose(
    canvas: HTMLCanvasElement,
    landmarks: PoseLandmark[],
    color: string = '#A855F7'
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !landmarks || landmarks.length === 0) return;

    ctx.save();
    
    // Set drawing style - make it very visible
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 6;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 2;

    const width = canvas.width;
    const height = canvas.height;

    // Define pose connections (MediaPipe pose model connections)
    const connections = [
      // Face outline
      [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8],
      // Shoulders and arms
      [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
      [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
      // Torso
      [11, 23], [12, 24], [23, 24],
      // Left Leg
      [23, 25], [25, 27], [27, 29], [27, 31], [29, 31],
      // Right Leg
      [24, 26], [26, 28], [28, 30], [28, 32], [30, 32]
    ];

    // Draw connections - no visibility check for now
    ctx.beginPath();
    connections.forEach(([startIdx, endIdx]) => {
      const startLandmark = landmarks[startIdx];
      const endLandmark = landmarks[endIdx];
      
      if (startLandmark && endLandmark) {
        ctx.moveTo(startLandmark.x * width, startLandmark.y * height);
        ctx.lineTo(endLandmark.x * width, endLandmark.y * height);
      }
    });
    ctx.stroke();

    // Draw landmark points - bigger and no visibility check
    landmarks.forEach((landmark) => {
      ctx.beginPath();
      ctx.arc(
        landmark.x * width,
        landmark.y * height,
        6,
        0,
        2 * Math.PI
      );
      ctx.fill();
    });

    ctx.restore();
  }

  dispose(): void {
    if (this.poseLandmarker) {
      this.poseLandmarker.close();
      this.poseLandmarker = null;
    }
    this.isInitialized = false;
  }

  get initialized(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const poseDetector = new PoseDetectorService();