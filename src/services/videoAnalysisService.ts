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
    fps: number = 30 // Reduced from 60 for better performance with natural playback
  ): Promise<void> {
    const store = useAnalysisStore.getState();
    const duration = videoElement.duration;

    try {
      // Initialize analysis data structure
      store.initializeVideoAnalysis(type, duration, fps);

      // Ensure MediaPipe is initialized
      if (!poseDetector.initialized) {
        await poseDetector.initialize();
      }
      
      // Use natural video playback with MediaPipe tracking
      await this.analyzeWithNaturalPlayback(videoElement, type, fps, duration);

      // Analysis completed successfully

    } catch (error) {
      console.error(`❌ ${type} video analysis failed:`, error);
      throw error;
    }
  }

  /**
   * Analyze video using natural playback for optimal MediaPipe tracking
   */
  private async analyzeWithNaturalPlayback(
    videoElement: HTMLVideoElement,
    type: 'reference' | 'user',
    fps: number,
    _duration: number
  ): Promise<void> {
    const store = useAnalysisStore.getState();
    const frameInterval = 1000 / fps; // ms between frames
    let frameIndex = 0;
    let lastProcessTime = 0;

    return new Promise((resolve, reject) => {
      // Reset video to start
      videoElement.currentTime = 0;
      videoElement.playbackRate = 1.0; // Normal speed
      
      // Set up frame processing during playback
      const processFrame = async () => {
        if (this.abortController?.signal.aborted) {
          cleanup();
          resolve();
          return;
        }

        const currentTime = videoElement.currentTime * 1000; // Convert to ms
        
        // Process frame if enough time has passed (based on target fps)
        if (currentTime - lastProcessTime >= frameInterval) {
          try {
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
            lastProcessTime = currentTime;
            
          } catch (error) {
            console.warn(`⚠️ Frame ${frameIndex}: Detection failed`, error);
            // Store frame with null data
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

        // Continue processing if video is still playing
        if (!videoElement.ended && !videoElement.paused) {
          requestAnimationFrame(processFrame);
        }
      };

      // Event handlers
      const onLoadedData = async () => {
        try {
          // Start playback for natural frame progression
          const playPromise = videoElement.play();
          await playPromise; // Wait for play to succeed
          requestAnimationFrame(processFrame);
        } catch (error) {
          console.error(`❌ ${type} video play failed:`, error);
          reject(new Error(`Failed to start ${type} video playback: ${error instanceof Error ? error.message : String(error)}`));
        }
      };

      const onEnded = () => {
        cleanup();
        
        // Mark analysis as complete
        store.completeAnalysis(type);
        resolve();
      };

      const onError = (error: Event) => {
        console.error('❌ Video playback error:', error);
        cleanup();
        reject(new Error('Video playback failed during analysis'));
      };

      const cleanup = () => {
        videoElement.removeEventListener('loadeddata', onLoadedData);
        videoElement.removeEventListener('ended', onEnded);
        videoElement.removeEventListener('error', onError);
        videoElement.pause();
      };

      // Set up event listeners
      videoElement.addEventListener('loadeddata', onLoadedData);
      videoElement.addEventListener('ended', onEnded);
      videoElement.addEventListener('error', onError);
      
      // Give video a moment to stabilize after currentTime reset, then check readyState
      setTimeout(() => {
        if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
          onLoadedData();
        }
      }, 100); // 100ms delay to let video stabilize
    });
  }

  async analyzeBothVideos(
    referenceVideo: HTMLVideoElement,
    userVideo: HTMLVideoElement,
    fps: number = 30
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
      
      if (referenceAnalysis) {
        const referenceMetrics = jumpMetricsService.computeJumpMetrics(referenceAnalysis);
        store.setReferenceMetrics(referenceMetrics);
        
        const referenceAngles = angleAnalysisService.analyzeAngles(referenceAnalysis);
        store.setReferenceAngles(referenceAngles);
      }
      
      if (userAnalysis) {
        const userMetrics = jumpMetricsService.computeJumpMetrics(userAnalysis);
        store.setUserMetrics(userMetrics);
        
        const userAngles = angleAnalysisService.analyzeAngles(userAnalysis);
        store.setUserAngles(userAngles);
      }
      
      // Final progress update
      store.setAnalysisProgress(100);
      
    } catch (error) {
      console.error('❌ Batch analysis failed:', error);
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
  getOptimalFrameRate(videoElement: HTMLVideoElement): number {
    const duration = videoElement.duration;
    
    // For jump analysis, 30fps is usually sufficient and more performant
    // Higher frame rates can be used for shorter videos or higher precision needs
    if (duration < 2) return 30; // Short clips
    if (duration < 10) return 30; // Medium clips  
    return 30; // Longer clips - consistent 30fps
  }

  get isRunning(): boolean {
    return this.isAnalyzing;
  }
}

// Export singleton instance
export const videoAnalysisService = new VideoAnalysisService();