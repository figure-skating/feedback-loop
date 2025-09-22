import { poseDetector } from './mediapipe/poseDetector';
import { useAnalysisStore } from '../store/analysisStore';
import { jumpMetricsService } from './jumpMetricsService';
import { angleAnalysisService } from './angleAnalysisService';

export class VideoAnalysisService {
  private isAnalyzing = false;
  private abortController: AbortController | null = null;

  async analyzeVideo(
    videoElement: HTMLVideoElement,
    type: 'reference' | 'user',
    fps: number = 30 // Match video frame rate to capture every frame
  ): Promise<void> {
    const store = useAnalysisStore.getState();

    // Wait for video to be ready
    if (videoElement.readyState < 2) {
      await new Promise<void>((resolve) => {
        const onCanPlay = () => {
          videoElement.removeEventListener('canplay', onCanPlay);
          resolve();
        };
        videoElement.addEventListener('canplay', onCanPlay);
      });
    }

    const duration = videoElement.duration;

    try {
      // Initialize analysis data structure
      store.initializeVideoAnalysis(type, duration, fps);

      // Ensure MediaPipe is initialized
      if (!poseDetector.initialized) {
        await poseDetector.initialize();
      }
      
      // Use slow natural playback for better detection with temporal consistency
      await this.analyzeWithSlowPlayback(videoElement, type, fps, duration);

      // Analysis completed successfully

    } catch (error) {
      // Video analysis failed
      throw error;
    }
  }

  /**
   * Analyze video using natural playback with slower speed for better MediaPipe tracking
   * Maintains temporal consistency for improved pose detection in fast movements
   */
  private async analyzeWithSlowPlayback(
    videoElement: HTMLVideoElement,
    type: 'reference' | 'user',
    fps: number,
    duration: number
  ): Promise<void> {
    const store = useAnalysisStore.getState();
    const totalFrames = Math.floor(duration * fps);
    const frameInterval = 1000 / fps; // ms between frames at normal speed

    // Slower playback for better detection
    // 0.25 = 25% speed (very slow, best detection)
    // 0.5 = 50% speed (balanced)
    // 1.0 = normal speed (fastest, may miss poses)
    const PLAYBACK_RATE = 0.25; // Using 25% speed for maximum accuracy

    let frameIndex = 0;

    console.log(`🎬 Starting slow playback analysis: ${totalFrames} frames at ${fps}fps (${PLAYBACK_RATE}x speed)`);

    return new Promise((resolve, reject) => {
      // Reset video to start
      videoElement.currentTime = 0;
      videoElement.playbackRate = PLAYBACK_RATE; // Set slower playback

      // Process frames during natural playback
      const processFrame = async () => {
        if (this.abortController?.signal.aborted) {
          cleanup();
          resolve();
          return;
        }

        const currentTime = videoElement.currentTime * 1000; // Convert to ms

        // Capture frame based on expected timing (accounting for playback rate)
        if (currentTime >= (frameIndex * frameInterval)) {
          try {
            // Process with MediaPipe - no force needed, natural flow maintains context
            const results = await poseDetector.detectPose(videoElement);
            const landmarks = results?.landmarks[0] || null;
            const worldLandmarks = results?.worldLandmarks?.[0] || null;

            // Store frame data
            store.updateFrameAnalysisWithTimestamp(
              type,
              frameIndex,
              landmarks,
              videoElement.currentTime,
              worldLandmarks
            );

            frameIndex++;

            // Progress update
            if (frameIndex % 10 === 0 || frameIndex === totalFrames) {
              const progress = (frameIndex / totalFrames) * 100;
              console.log(`⏳ ${type}: Frame ${frameIndex}/${totalFrames} (${progress.toFixed(1)}%) - Time: ${(currentTime/1000).toFixed(2)}s`);
            }

          } catch (error) {
            // Frame detection failed
            store.updateFrameAnalysisWithTimestamp(
              type,
              frameIndex,
              null,
              videoElement.currentTime,
              null
            );
            frameIndex++;
          }
        }

        // Continue if video is still playing and we haven't captured all frames
        if (!videoElement.ended && !videoElement.paused && frameIndex < totalFrames) {
          requestAnimationFrame(processFrame);
        } else if (frameIndex >= totalFrames) {
          cleanup();
          store.completeAnalysis(type);
          console.log(`✅ Completed ${type} video analysis: ${frameIndex} frames processed`);
          resolve();
        }
      };

      // Event handlers
      const onPlaying = () => {
        requestAnimationFrame(processFrame);
      };

      const onEnded = () => {
        cleanup();
        store.completeAnalysis(type);
        console.log(`✅ Video ended - ${type} analysis: ${frameIndex}/${totalFrames} frames processed`);
        resolve();
      };

      const onError = (_error: Event) => {
        cleanup();
        reject(new Error('Video playback failed during analysis'));
      };

      const cleanup = () => {
        videoElement.removeEventListener('playing', onPlaying);
        videoElement.removeEventListener('ended', onEnded);
        videoElement.removeEventListener('error', onError);
        videoElement.pause();
        videoElement.playbackRate = 1.0; // Reset to normal speed
      };

      // Set up event listeners
      videoElement.addEventListener('playing', onPlaying);
      videoElement.addEventListener('ended', onEnded);
      videoElement.addEventListener('error', onError);

      // Start playback
      videoElement.play().catch((error) => {
        cleanup();
        reject(new Error(`Failed to start video playback: ${error.message}`));
      });
    });
  }

  async analyzeBothVideos(
    referenceVideo: HTMLVideoElement,
    userVideo: HTMLVideoElement,
    fps: number = 30 // Match typical video frame rate
  ): Promise<void> {
    if (this.isAnalyzing) {
      throw new Error('Analysis already in progress');
    }

    this.isAnalyzing = true;
    this.abortController = new AbortController();
    
    const store = useAnalysisStore.getState();
    
    try {
      store.startAnalysis();
      
      // Analyze first video (reference)
      await this.analyzeVideo(referenceVideo, 'reference', fps);
      // Progress will be automatically updated by getAnalysisProgress() during frame processing
      
      // Check if analysis was aborted
      if (this.abortController?.signal.aborted) {
        return;
      }
      
      // Small delay between videos to ensure clean state
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Analyze second video (user)
      await this.analyzeVideo(userVideo, 'user', fps);
      // Progress will be automatically updated by getAnalysisProgress() during frame processing
      
      // Compute metrics and angles for both videos
      const state = useAnalysisStore.getState();
      const referenceAnalysis = state.referenceAnalysis;
      const userAnalysis = state.userAnalysis;
      const manualMarkers = state.manualMarkers; // Get manual markers from store
      
      if (referenceAnalysis && manualMarkers) {
        // First calculate angle analysis (including rotation data)
        const referenceAngles = angleAnalysisService.analyzeAngles(referenceAnalysis);
        store.setReferenceAngles(referenceAngles);

        // Then calculate metrics using the angle data
        try {
          const referenceMetrics = jumpMetricsService.computeJumpMetrics(referenceAnalysis, manualMarkers, 'reference', referenceAngles);
          store.setReferenceMetrics(referenceMetrics);
        } catch {
          // Failed to compute reference metrics - create empty metrics
          store.setReferenceMetrics({
            airTime: null,
            takeoffFrame: null,
            landingFrame: null,
            rotations: null,
            maxHeight: null
          });
        }
      }

      if (userAnalysis && manualMarkers) {
        // First calculate angle analysis (including rotation data)
        const userAngles = angleAnalysisService.analyzeAngles(userAnalysis);
        store.setUserAngles(userAngles);

        // Then calculate metrics using the angle data
        try {
          const userMetrics = jumpMetricsService.computeJumpMetrics(userAnalysis, manualMarkers, 'user', userAngles);
          store.setUserMetrics(userMetrics);
        } catch {
          // Failed to compute user metrics - create empty metrics
          store.setUserMetrics({
            airTime: null,
            takeoffFrame: null,
            landingFrame: null,
            rotations: null,
            maxHeight: null
          });
        }
      }
      
      // Final progress update
      store.setAnalysisProgress(100);
      
    } catch (error) {
      // Batch analysis failed
      store.setAnalysisError(`Analysis failed: ${error}`);
      throw error;
    } finally {
      this.isAnalyzing = false;
      this.abortController = null;
      store.stopAnalysis();
    }
  }

  abortAnalysis(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    
    const store = useAnalysisStore.getState();
    store.stopAnalysis();
  }

  /**
   * Get optimal frame rate for analysis based on video characteristics
   */
  getOptimalFrameRate(_videoElement: HTMLVideoElement): number {
    // For rotation analysis precision, we want the highest possible frame rate
    // Most figure skating videos are shot at 30fps or 60fps
    // Use 60fps for maximum precision in rotation detection
    return 60;
  }

  get isRunning(): boolean {
    return this.isAnalyzing;
  }
}

// Export singleton instance
export const videoAnalysisService = new VideoAnalysisService();