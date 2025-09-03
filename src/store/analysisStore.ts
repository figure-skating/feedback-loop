import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { PoseLandmark } from '../services/mediapipe/poseDetector';
import { JumpMetrics } from '../services/jumpMetricsService';
import { AngleAnalysis } from '../services/angleAnalysisService';
import { videoStorageService } from '../services/videoStorageService';
import { stateStorageService } from '../services/stateStorageService';

export interface FrameAnalysis {
  timestamp: number; // video time in seconds
  landmarks: PoseLandmark[] | null; // pose landmarks for this frame (screen coordinates)
  worldLandmarks: PoseLandmark[] | null; // world landmarks for this frame (3D coordinates)
  processed: boolean; // whether this frame has been analyzed
}

export interface VideoAnalysis {
  frames: FrameAnalysis[];
  totalFrames: number;
  processedFrames: number;
  duration: number; // video duration in seconds
  fps: number; // frames per second for analysis
  isComplete: boolean;
}

export type DisplayMode = 'video' | 'skeleton' | 'both';

export interface ManualMarkers {
  reference: {
    takeoffFrame: number | null;
    takeoffTime: number | null;
    landingFrame: number | null;
    landingTime: number | null;
  };
  user: {
    takeoffFrame: number | null;
    takeoffTime: number | null;
    landingFrame: number | null;
    landingTime: number | null;
  };
}

interface AnalysisState {
  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number; // 0-100
  analysisError: string | null;
  
  // Video data
  referenceVideo: { name: string; url: string; duration: number; file?: File } | null;
  userVideo: { name: string; url: string; duration: number; file?: File } | null;
  
  // Stored analysis results
  referenceAnalysis: VideoAnalysis | null;
  userAnalysis: VideoAnalysis | null;
  
  // Manual frame markers
  manualMarkers: ManualMarkers | null;
  
  // Playback state
  currentTime: number;
  isPlaying: boolean;
  isSynced: boolean;
  
  // Takeoff alignment - Virtual timeline approach
  referenceVideoPadding: number; // Blank time added to start of reference video
  userVideoPadding: number; // Blank time added to start of user video
  virtualTimelineDuration: number; // Total duration of aligned timeline
  
  // Display mode
  displayMode: DisplayMode;
  
  // Jump metrics
  referenceMetrics: JumpMetrics | null;
  userMetrics: JumpMetrics | null;
  
  // Angle analysis
  referenceAngles: AngleAnalysis | null;
  userAngles: AngleAnalysis | null;
}

interface AnalysisActions {
  // Video management
  setReferenceVideo: (video: { name: string; url: string; duration: number; file?: File } | null, clearAnalysis?: boolean) => void;
  setUserVideo: (video: { name: string; url: string; duration: number; file?: File } | null, clearAnalysis?: boolean) => void;
  clearVideos: () => void;
  
  // Analysis control
  startAnalysis: () => void;
  stopAnalysis: () => void;
  setAnalysisProgress: (progress: number) => void;
  setAnalysisError: (error: string | null) => void;
  
  // Frame analysis results
  initializeVideoAnalysis: (type: 'reference' | 'user', duration: number, fps?: number) => void;
  updateFrameAnalysis: (type: 'reference' | 'user', frameIndex: number, landmarks: PoseLandmark[] | null, worldLandmarks?: PoseLandmark[] | null) => void;
  updateFrameAnalysisWithTimestamp: (type: 'reference' | 'user', frameIndex: number, landmarks: PoseLandmark[] | null, actualTimestamp: number, worldLandmarks?: PoseLandmark[] | null) => void;
  completeAnalysis: (type: 'reference' | 'user') => void;
  
  // Playback control
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsSynced: (synced: boolean) => void;
  
  // Takeoff alignment
  setVideoAlignment: (refPadding: number, userPadding: number, virtualDuration: number) => void;
  
  // Display mode control
  setDisplayMode: (mode: DisplayMode) => void;
  
  // Manual markers
  setManualMarkers: (markers: ManualMarkers) => void;
  clearManualMarkers: () => void;
  hasValidMarkers: () => boolean;
  restoreManualMarkersFromStorage: () => void;
  
  // Jump metrics
  setReferenceMetrics: (metrics: JumpMetrics) => void;
  setUserMetrics: (metrics: JumpMetrics) => void;
  
  // Angle analysis
  setReferenceAngles: (angles: AngleAnalysis) => void;
  setUserAngles: (angles: AngleAnalysis) => void;
  
  // Utility
  getLandmarksAtTime: (type: 'reference' | 'user', time: number) => PoseLandmark[] | null;
  getAnalysisProgress: () => number;
  hasValidAnalysis: () => boolean;
  clearAnalysis: () => void;
  
  // Video persistence
  restoreVideosFromStorage: () => Promise<void>;
  clearVideoStorage: () => Promise<void>;
  
  // State persistence
  saveState: () => Promise<void>;
  restoreState: () => Promise<boolean>;
  clearStoredState: () => Promise<void>;
}

type AnalysisStore = AnalysisState & AnalysisActions;

export const useAnalysisStore = create<AnalysisStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isAnalyzing: false,
    analysisProgress: 0,
    analysisError: null,
    
    referenceVideo: null,
    userVideo: null,
    
    referenceAnalysis: null,
    userAnalysis: null,
    
    manualMarkers: null,
    
    currentTime: 0,
    isPlaying: false,
    isSynced: false,
    referenceVideoPadding: 0,
    userVideoPadding: 0,
    virtualTimelineDuration: 0,
    displayMode: 'both' as DisplayMode,
    referenceMetrics: null,
    userMetrics: null,
    referenceAngles: null,
    userAngles: null,
    
    // Actions
    setReferenceVideo: (video, clearAnalysis = true) => {
      set({ referenceVideo: video });
      
      // Handle persistence
      if (video?.file && clearAnalysis) {
        // Save to IndexedDB when uploading new video
        videoStorageService.saveVideo(video.file, 'reference').catch(console.error);
      } else if (video === null) {
        // Delete from IndexedDB when video is removed
        videoStorageService.deleteVideo('reference').catch(console.error);
      }
      
      // Option A: Clear ALL metrics when ANY video is replaced
      if (clearAnalysis) {
        const state = get();
        const currentMarkers = state.manualMarkers;
        
        // Preserve markers for wizard but clear ALL metrics
        if (currentMarkers && currentMarkers.user.takeoffTime !== null && currentMarkers.user.landingTime !== null) {
          // Preserve user markers for wizard, reset reference markers
          const preservedMarkers: ManualMarkers = {
            reference: {
              takeoffFrame: null,
              takeoffTime: null,
              landingFrame: null,
              landingTime: null
            },
            user: {
              takeoffFrame: currentMarkers.user.takeoffFrame,
              takeoffTime: currentMarkers.user.takeoffTime,
              landingFrame: currentMarkers.user.landingFrame,
              landingTime: currentMarkers.user.landingTime
            }
          };
          
          // Option A: Clearing ALL metrics when reference video replaced
          // Preserving user markers for wizard
          
          set({ 
            // Clear all analysis data
            referenceAnalysis: null,
            userAnalysis: null,
            manualMarkers: preservedMarkers,
            // Clear ALL metrics (both reference and user)
            referenceMetrics: null,
            userMetrics: null,
            referenceAngles: null,
            userAngles: null,
            // Reset alignment
            referenceVideoPadding: 0,
            userVideoPadding: 0,
            virtualTimelineDuration: 0
          });
        } else {
          // No user markers to preserve, clear everything
          // Option A: Clearing ALL metrics when reference video replaced (no markers to preserve)
          set({ 
            referenceAnalysis: null,
            userAnalysis: null,
            manualMarkers: null,
            referenceMetrics: null,
            userMetrics: null,
            referenceAngles: null,
            userAngles: null,
            referenceVideoPadding: 0,
            userVideoPadding: 0,
            virtualTimelineDuration: 0
          });
        }
      }
    },
    
    setUserVideo: (video, clearAnalysis = true) => {
      set({ userVideo: video });
      
      // Handle persistence
      if (video?.file && clearAnalysis) {
        // Save to IndexedDB when uploading new video
        videoStorageService.saveVideo(video.file, 'user').catch(console.error);
      } else if (video === null) {
        // Delete from IndexedDB when video is removed
        videoStorageService.deleteVideo('user').catch(console.error);
      }
      
      // Option A: Clear ALL metrics when ANY video is replaced
      if (clearAnalysis) {
        const state = get();
        const currentMarkers = state.manualMarkers;
        
        // Preserve markers for wizard but clear ALL metrics
        if (currentMarkers && currentMarkers.reference.takeoffTime !== null && currentMarkers.reference.landingTime !== null) {
          // Preserve reference markers for wizard, reset user markers
          const preservedMarkers: ManualMarkers = {
            reference: {
              takeoffFrame: currentMarkers.reference.takeoffFrame,
              takeoffTime: currentMarkers.reference.takeoffTime,
              landingFrame: currentMarkers.reference.landingFrame,
              landingTime: currentMarkers.reference.landingTime
            },
            user: {
              takeoffFrame: null,
              takeoffTime: null,
              landingFrame: null,
              landingTime: null
            }
          };
          
          // Option A: Clearing ALL metrics when user video replaced
          // Preserving reference markers for wizard
          
          set({ 
            // Clear all analysis data
            referenceAnalysis: null,
            userAnalysis: null,
            manualMarkers: preservedMarkers,
            // Clear ALL metrics (both reference and user)
            referenceMetrics: null,
            userMetrics: null,
            referenceAngles: null,
            userAngles: null,
            // Reset alignment
            referenceVideoPadding: 0,
            userVideoPadding: 0,
            virtualTimelineDuration: 0
          });
        } else {
          // No reference markers to preserve, clear everything
          // Option A: Clearing ALL metrics when user video replaced (no markers to preserve)
          set({ 
            referenceAnalysis: null,
            userAnalysis: null,
            manualMarkers: null,
            referenceMetrics: null,
            userMetrics: null,
            referenceAngles: null,
            userAngles: null,
            referenceVideoPadding: 0,
            userVideoPadding: 0,
            virtualTimelineDuration: 0
          });
        }
      }
    },
    
    clearVideos: () => {
      set({
        referenceVideo: null,
        userVideo: null,
        referenceAnalysis: null,
        userAnalysis: null,
        isAnalyzing: false,
        analysisProgress: 0,
        analysisError: null,
      });
    },
    
    startAnalysis: () => {
      set({
        isAnalyzing: true,
        analysisProgress: 0,
        analysisError: null,
      });
    },
    
    stopAnalysis: () => {
      set({
        isAnalyzing: false,
        analysisError: null,
      });
    },
    
    setAnalysisProgress: (progress) => {
      set({ analysisProgress: Math.min(100, Math.max(0, progress)) });
    },
    
    setAnalysisError: (error) => {
      set({ 
        analysisError: error,
        isAnalyzing: false,
      });
    },
    
    initializeVideoAnalysis: (type, duration, fps = 10) => {
      const totalFrames = Math.ceil(duration * fps);
      const frames: FrameAnalysis[] = Array.from({ length: totalFrames }, (_, i) => ({
        timestamp: i / fps,
        landmarks: null,
        worldLandmarks: null,
        processed: false,
      }));
      
      const analysis: VideoAnalysis = {
        frames,
        totalFrames,
        processedFrames: 0,
        duration,
        fps,
        isComplete: false,
      };
      
      if (type === 'reference') {
        set({ referenceAnalysis: analysis });
      } else {
        set({ userAnalysis: analysis });
      }
    },
    
    updateFrameAnalysis: (type, frameIndex, landmarks, worldLandmarks = null) => {
      const state = get();
      const analysis = type === 'reference' ? state.referenceAnalysis : state.userAnalysis;
      
      if (!analysis || frameIndex >= analysis.frames.length) return;
      
      const updatedFrames = [...analysis.frames];
      const frame = updatedFrames[frameIndex];
      
      if (!frame.processed) {
        updatedFrames[frameIndex] = {
          ...frame,
          landmarks,
          worldLandmarks,
          processed: true,
        };
        
        const updatedAnalysis: VideoAnalysis = {
          ...analysis,
          frames: updatedFrames,
          processedFrames: analysis.processedFrames + 1,
        };
        
        if (type === 'reference') {
          set({ referenceAnalysis: updatedAnalysis });
        } else {
          set({ userAnalysis: updatedAnalysis });
        }
        
        // Update overall progress
        const totalProgress = get().getAnalysisProgress();
        set({ analysisProgress: totalProgress });
      }
    },

    updateFrameAnalysisWithTimestamp: (type, frameIndex, landmarks, actualTimestamp, worldLandmarks = null) => {
      const state = get();
      const analysis = type === 'reference' ? state.referenceAnalysis : state.userAnalysis;
      
      if (!analysis || frameIndex >= analysis.frames.length) return;
      
      const updatedFrames = [...analysis.frames];
      const frame = updatedFrames[frameIndex];
      
      if (!frame.processed) {
        updatedFrames[frameIndex] = {
          ...frame,
          timestamp: actualTimestamp, // Use actual video timestamp for better sync
          landmarks,
          worldLandmarks,
          processed: true,
        };
        
        const updatedAnalysis: VideoAnalysis = {
          ...analysis,
          frames: updatedFrames,
          processedFrames: analysis.processedFrames + 1,
        };
        
        if (type === 'reference') {
          set({ referenceAnalysis: updatedAnalysis });
        } else {
          set({ userAnalysis: updatedAnalysis });
        }
        
        // Update overall progress
        const totalProgress = get().getAnalysisProgress();
        set({ analysisProgress: totalProgress });
      }
    },
    
    completeAnalysis: (type) => {
      const state = get();
      const analysis = type === 'reference' ? state.referenceAnalysis : state.userAnalysis;
      
      if (!analysis) return;
      
      const completedAnalysis: VideoAnalysis = {
        ...analysis,
        isComplete: true,
      };
      
      if (type === 'reference') {
        set({ referenceAnalysis: completedAnalysis });
      } else {
        set({ userAnalysis: completedAnalysis });
      }
    },
    
    setCurrentTime: (time) => {
      set({ currentTime: time });
    },
    
    setIsPlaying: (playing) => {
      set({ isPlaying: playing });
    },
    
    setIsSynced: (synced) => {
      set({ isSynced: synced });
    },
    
    setVideoAlignment: (refPadding, userPadding, virtualDuration) => {
      set({ 
        referenceVideoPadding: refPadding,
        userVideoPadding: userPadding,
        virtualTimelineDuration: virtualDuration
      });
    },
    
    setDisplayMode: (mode) => {
      set({ displayMode: mode });
    },
    
    setManualMarkers: (markers) => {
      set({ manualMarkers: markers });
      
      // Calculate virtual timeline alignment with padding
      if (markers.reference.takeoffTime !== null && markers.user.takeoffTime !== null) {
        const refTakeoff = markers.reference.takeoffTime;
        const userTakeoff = markers.user.takeoffTime;
        
        // Determine which video needs padding to align takeoffs
        const refPadding = Math.max(0, userTakeoff - refTakeoff);
        const userPadding = Math.max(0, refTakeoff - userTakeoff);
        
        // Get video durations from state
        const state = get();
        const refDuration = state.referenceVideo?.duration || 0;
        const userDuration = state.userVideo?.duration || 0;
        
        // Calculate virtual timeline duration (longest video + its padding)
        const virtualDuration = Math.max(
          refDuration + refPadding,
          userDuration + userPadding
        );
        
        // Virtual Timeline Alignment calculated with takeoff synchronization
        
        set({ 
          referenceVideoPadding: refPadding,
          userVideoPadding: userPadding,
          virtualTimelineDuration: virtualDuration
        });
      } else {
        set({ 
          referenceVideoPadding: 0,
          userVideoPadding: 0,
          virtualTimelineDuration: 0
        });
      }
      
      // Persist to localStorage
      try {
        localStorage.setItem('manual-markers', JSON.stringify(markers));
      } catch (error) {
        console.warn('Failed to save manual markers to localStorage:', error);
      }
    },
    
    clearManualMarkers: () => {
      set({ 
        manualMarkers: null, 
        referenceVideoPadding: 0,
        userVideoPadding: 0,
        virtualTimelineDuration: 0
      });
      // Remove from localStorage
      try {
        localStorage.removeItem('manual-markers');
      } catch (error) {
        console.warn('Failed to remove manual markers from localStorage:', error);
      }
    },
    
    hasValidMarkers: () => {
      const state = get();
      const markers = state.manualMarkers;
      if (!markers) return false;
      
      return (
        markers.reference.takeoffTime !== null && 
        markers.reference.landingTime !== null &&
        markers.user.takeoffTime !== null && 
        markers.user.landingTime !== null
      );
    },
    
    setReferenceMetrics: (metrics) => {
      set({ referenceMetrics: metrics });
    },
    
    setUserMetrics: (metrics) => {
      set({ userMetrics: metrics });
    },
    
    setReferenceAngles: (angles) => {
      set({ referenceAngles: angles });
    },
    
    setUserAngles: (angles) => {
      set({ userAngles: angles });
    },
    
    getLandmarksAtTime: (type, time) => {
      const state = get();
      const analysis = type === 'reference' ? state.referenceAnalysis : state.userAnalysis;
      
      if (!analysis) return null;
      
      // Use binary search for better performance with large frame arrays
      const frames = analysis.frames.filter(f => f.processed && f.landmarks);
      if (frames.length === 0) return null;
      
      // Binary search to find closest frame
      let left = 0;
      let right = frames.length - 1;
      let closestFrame = frames[0];
      let minTimeDiff = Math.abs(frames[0].timestamp - time);
      
      while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        const frame = frames[mid];
        const timeDiff = Math.abs(frame.timestamp - time);
        
        if (timeDiff < minTimeDiff) {
          minTimeDiff = timeDiff;
          closestFrame = frame;
        }
        
        if (frame.timestamp < time) {
          left = mid + 1;
        } else if (frame.timestamp > time) {
          right = mid - 1;
        } else {
          // Exact match
          return frame.landmarks;
        }
      }
      
      // Add timing compensation - slight lookahead to account for processing delays
      const compensatedTime = time + 0.033; // ~30ms lookahead
      
      // Try to find frame closer to compensated time
      for (const frame of frames) {
        const compensatedDiff = Math.abs(frame.timestamp - compensatedTime);
        if (compensatedDiff < minTimeDiff && compensatedDiff < 0.1) { // Max 100ms lookahead
          closestFrame = frame;
          minTimeDiff = compensatedDiff;
        }
      }
      
      return closestFrame?.landmarks || null;
    },
    
    getAnalysisProgress: () => {
      const state = get();
      const refAnalysis = state.referenceAnalysis;
      const userAnalysis = state.userAnalysis;
      
      if (!refAnalysis && !userAnalysis) return 0;
      
      let progress = 0;
      
      // First video contributes 0-50% of total progress
      if (refAnalysis) {
        const refProgress = refAnalysis.totalFrames > 0 
          ? (refAnalysis.processedFrames / refAnalysis.totalFrames) * 50 
          : 0;
        progress += refProgress;
      }
      
      // Second video contributes 50-100% of total progress
      if (userAnalysis) {
        const userProgress = userAnalysis.totalFrames > 0 
          ? (userAnalysis.processedFrames / userAnalysis.totalFrames) * 50 
          : 0;
        progress += userProgress;
      }
      
      return Math.round(progress);
    },
    
    hasValidAnalysis: () => {
      const state = get();
      return !!(state.referenceAnalysis?.isComplete && 
                state.userAnalysis?.isComplete && 
                state.referenceVideo && 
                state.userVideo);
    },
    
    clearAnalysis: () => {
      set({
        referenceAnalysis: null,
        userAnalysis: null,
        manualMarkers: null,
        referenceMetrics: null,
        userMetrics: null,
        referenceAngles: null,
        userAngles: null,
        isAnalyzing: false,
        analysisProgress: 0,
        analysisError: null,
      });
      
      // Also clear manual markers from localStorage and stored state
      try {
        localStorage.removeItem('manual-markers');
        stateStorageService.clearState();
      } catch (error) {
        console.warn('Failed to clear persisted data:', error);
      }
    },

    // Manual markers persistence
    restoreManualMarkersFromStorage: () => {
      try {
        const stored = localStorage.getItem('manual-markers');
        if (stored) {
          const markers = JSON.parse(stored);
          
          // Use setManualMarkers to restore, which will recalculate alignment
          const actions = get();
          actions.setManualMarkers(markers);
        }
      } catch (error) {
        console.warn('Failed to restore manual markers from localStorage:', error);
      }
    },

    // Video persistence methods
    restoreVideosFromStorage: async () => {
      try {
        const [referenceFile, userFile] = await Promise.all([
          videoStorageService.getVideo('reference'),
          videoStorageService.getVideo('user')
        ]);

        const { setReferenceVideo, setUserVideo } = get();

        if (referenceFile) {
          const url = URL.createObjectURL(referenceFile);
          const duration = await new Promise<number>((resolve) => {
            const video = document.createElement('video');
            video.onloadedmetadata = () => resolve(video.duration);
            video.src = url;
          });

          setReferenceVideo({
            name: referenceFile.name,
            url,
            duration,
            file: referenceFile
          }, false); // Don't clear analysis when restoring
        }

        if (userFile) {
          const url = URL.createObjectURL(userFile);
          const duration = await new Promise<number>((resolve) => {
            const video = document.createElement('video');
            video.onloadedmetadata = () => resolve(video.duration);
            video.src = url;
          });

          setUserVideo({
            name: userFile.name,
            url,
            duration,
            file: userFile
          }, false); // Don't clear analysis when restoring
        }

        // Videos restored from IndexedDB if available
      } catch (error) {
        console.error('Failed to restore videos from storage:', error);
      }
    },

    clearVideoStorage: async () => {
      try {
        await videoStorageService.clearAllVideos();
      } catch (error) {
        console.error('Failed to clear video storage:', error);
      }
    },

    // State persistence methods
    saveState: async () => {
      try {
        const state = get();
        await stateStorageService.saveState({
          manualMarkers: state.manualMarkers,
          referenceAnalysis: state.referenceAnalysis,
          userAnalysis: state.userAnalysis,
          referenceMetrics: state.referenceMetrics,
          userMetrics: state.userMetrics,
          referenceAngles: state.referenceAngles,
          userAngles: state.userAngles,
          referenceVideoPadding: state.referenceVideoPadding,
          userVideoPadding: state.userVideoPadding,
          virtualTimelineDuration: state.virtualTimelineDuration,
        });
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    },

    restoreState: async () => {
      try {
        const storedState = await stateStorageService.loadState();
        if (storedState && stateStorageService.isStateValid(storedState)) {
          const { 
            manualMarkers,
            referenceAnalysis,
            userAnalysis,
            referenceMetrics,
            userMetrics,
            referenceAngles,
            userAngles,
            referenceVideoPadding,
            userVideoPadding,
            virtualTimelineDuration
          } = storedState;

          set({
            manualMarkers,
            referenceAnalysis,
            userAnalysis,
            referenceMetrics,
            userMetrics,
            referenceAngles,
            userAngles,
            referenceVideoPadding,
            userVideoPadding,
            virtualTimelineDuration
          });

          return true; // State restored successfully
        }
        return false; // No valid state found
      } catch (error) {
        console.error('Failed to restore state:', error);
        return false;
      }
    },

    clearStoredState: async () => {
      try {
        await stateStorageService.clearState();
      } catch (error) {
        console.error('Failed to clear stored state:', error);
      }
    },
  }))
);