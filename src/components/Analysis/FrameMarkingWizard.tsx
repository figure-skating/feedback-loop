import { useState, useEffect, useRef } from 'react';
import { useAnalysisStore, ManualMarkers } from '../../store/analysisStore';

interface FrameMarkingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (markers: ManualMarkers) => void;
}

interface WizardStep {
  id: string;
  title: string;
  instruction: string;
  videoType: 'reference' | 'user';
  markerType: 'takeoff' | 'landing';
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'ref-takeoff',
    title: 'Mark Reference Takeoff',
    instruction: 'Find the frame where the reference skater leaves the ice',
    videoType: 'reference',
    markerType: 'takeoff'
  },
  {
    id: 'ref-landing', 
    title: 'Mark Reference Landing',
    instruction: 'Find the frame where the reference skater touches down',
    videoType: 'reference',
    markerType: 'landing'
  },
  {
    id: 'user-takeoff',
    title: 'Mark Your Takeoff', 
    instruction: 'Find the frame where you leave the ice',
    videoType: 'user',
    markerType: 'takeoff'
  },
  {
    id: 'user-landing',
    title: 'Mark Your Landing',
    instruction: 'Find the frame where you touch down',
    videoType: 'user', 
    markerType: 'landing'
  }
];

export default function FrameMarkingWizard({ isOpen, onClose: _onClose, onComplete }: FrameMarkingWizardProps) {
  const { referenceVideo, userVideo, manualMarkers } = useAnalysisStore();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Smart wizard initialization - skip steps based on existing markers
  useEffect(() => {
    if (isOpen) {
      // Wizard opening, checking existing markers
      
      const hasReferenceMarkers = manualMarkers && 
        manualMarkers.reference.takeoffTime !== null && 
        manualMarkers.reference.landingTime !== null;
      
      const hasUserMarkers = manualMarkers && 
        manualMarkers.user.takeoffTime !== null && 
        manualMarkers.user.landingTime !== null;
      
      // Checking marker status
      
      if (hasReferenceMarkers && !hasUserMarkers) {
        // Reference markers exist, need user markers - start at step 3/4 (user takeoff)
        setCurrentStepIndex(2);
        // Starting wizard at step 3/4 - reference markers exist, need user markers
      } else if (hasUserMarkers && !hasReferenceMarkers) {
        // User markers exist, need reference markers - start at step 1/4 (reference takeoff)
        setCurrentStepIndex(0);
        // Starting wizard at step 1/4 - user markers exist, need reference markers
      } else if (hasReferenceMarkers && hasUserMarkers) {
        // Both exist - this shouldn't happen in normal flow, but start from beginning
        setCurrentStepIndex(0);
        // Starting wizard at step 1/4 - both markers exist (unexpected)
      } else {
        // No markers exist - start from beginning
        setCurrentStepIndex(0);
        // Starting wizard at step 1/4 - no existing markers
      }
    }
  }, [isOpen, manualMarkers]);
  // Initialize markers state
  const [markers, setMarkers] = useState<ManualMarkers>({
    reference: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null },
    user: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null }
  });

  // Update markers when wizard opens or when manualMarkers changes in store
  useEffect(() => {
    if (isOpen && manualMarkers) {
      const hasReferenceMarkers = manualMarkers.reference.takeoffTime !== null && manualMarkers.reference.landingTime !== null;
      const hasUserMarkers = manualMarkers.user.takeoffTime !== null && manualMarkers.user.landingTime !== null;
      
      if (hasReferenceMarkers && !hasUserMarkers) {
        // Loading existing reference markers into wizard
        setMarkers(prev => ({
          ...prev,
          reference: manualMarkers.reference
        }));
      } else if (hasUserMarkers && !hasReferenceMarkers) {
        // Loading existing user markers into wizard
        setMarkers(prev => ({
          ...prev,
          user: manualMarkers.user
        }));
      } else if (hasReferenceMarkers && hasUserMarkers) {
        // Loading both existing markers into wizard
        setMarkers(manualMarkers);
      } else {
        // Reset markers when opening wizard with no existing markers
        setMarkers({
          reference: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null },
          user: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null }
        });
      }
    } else if (isOpen) {
      // Reset markers when opening wizard with no manualMarkers
      setMarkers({
        reference: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null },
        user: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null }
      });
    }
  }, [isOpen, manualMarkers]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [maxFrames, setMaxFrames] = useState(0);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<number>();
  const timeoutRef = useRef<number>();
  const currentStep = WIZARD_STEPS[currentStepIndex];

  // Update video source when step changes
  useEffect(() => {
    if (!isOpen || !videoRef.current || !currentStep) return;

    const videoData = currentStep.videoType === 'reference' ? referenceVideo : userVideo;
    if (videoData) {
      // Reset state first
      setCurrentFrame(0);
      setMaxFrames(0);
      setVideoLoaded(false);
      
      videoRef.current.src = videoData.url;
      videoRef.current.currentTime = 0;
      videoRef.current.load();
    }
  }, [currentStepIndex, isOpen, referenceVideo, userVideo, currentStep]);

  // Calculate optimal starting frame for each step
  const getOptimalStartingFrame = () => {
    switch (currentStepIndex) {
      case 0: // Step 1: Reference takeoff - start from frame 0
        return 0;
      case 1: // Step 2: Reference landing - start from reference takeoff frame
        return markers.reference.takeoffFrame || 0;
      case 2: // Step 3: User takeoff - start from frame 0  
        return 0;
      case 3: // Step 4: User landing - start from user takeoff frame
        return markers.user.takeoffFrame || 0;
      default:
        return 0;
    }
  };

  // Update max frames when video loads
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      const fps = 30; // Assume 30fps for frame counting
      const totalFrames = Math.floor(video.duration * fps);
      const optimalStartFrame = getOptimalStartingFrame();
      
      setMaxFrames(totalFrames);
      setCurrentFrame(optimalStartFrame);
      
      // Seek to optimal starting frame
      const startTime = optimalStartFrame / fps;
      video.currentTime = Math.min(startTime, video.duration);
      setVideoLoaded(true);
      
      // Video loaded with frame data
    };

    const handleCanPlayThrough = () => {
      // Extra safety - ensure video is really ready
      if (video.duration > 0 && !videoLoaded) {
        handleLoadedMetadata();
      }
    };

    // Multiple event listeners for better compatibility
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('loadeddata', handleCanPlayThrough);
    
    // Check if metadata is already loaded (for restored videos)
    if (video.duration && video.duration > 0) {
      handleLoadedMetadata();
    } else if (video.src) {
      // Force reload if video has src but no metadata
      video.load();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('loadeddata', handleCanPlayThrough);
    };
  }, [currentStepIndex, videoLoaded]);


  // Fallback check for video readiness (for restored videos that might not fire events)
  useEffect(() => {
    if (!isOpen || videoLoaded) return;

    const checkVideoReady = () => {
      const video = videoRef.current;
      if (video && video.duration > 0 && video.src && !videoLoaded) {
        // Fallback: Video ready detected
        const fps = 30;
        const totalFrames = Math.floor(video.duration * fps);
        const optimalStartFrame = getOptimalStartingFrame();
        
        setMaxFrames(totalFrames);
        setCurrentFrame(optimalStartFrame);
        
        // Seek to optimal starting frame
        const startTime = optimalStartFrame / fps;
        video.currentTime = Math.min(startTime, video.duration);
        setVideoLoaded(true);
        
        // Fallback loaded with frame data
      }
    };

    // Check immediately
    checkVideoReady();
    
    // Then check every 500ms until loaded
    const interval = setInterval(checkVideoReady, 500);
    
    return () => clearInterval(interval);
  }, [isOpen, videoLoaded, currentStepIndex]);

  const seekToFrame = (frameNumber: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;

    const fps = 30; // Assume 30fps
    const clampedFrame = Math.max(0, Math.min(frameNumber, maxFrames - 1));
    const time = clampedFrame / fps;
    const clampedTime = Math.min(Math.max(0, time), video.duration);
    
    // Set the frame state immediately for responsive UI
    setCurrentFrame(clampedFrame);
    
    // Use requestVideoFrameCallback if available for frame-accurate seeking
    if ('requestVideoFrameCallback' in video) {
      video.currentTime = clampedTime;
      (video as any).requestVideoFrameCallback(() => {
        // Frame has been rendered, update if needed
        const actualFrame = Math.round(video.currentTime * fps);
        if (actualFrame !== clampedFrame) {
          setCurrentFrame(actualFrame);
        }
      });
    } else {
      // Fallback: Set time slightly ahead then back for better frame accuracy
      (video as HTMLVideoElement).currentTime = clampedTime + 0.001;
      setTimeout(() => {
        const videoEl = videoRef.current;
        if (videoEl) {
          videoEl.currentTime = clampedTime;
        }
      }, 0);
    }
  };

  const handlePreviousFrame = () => {
    if (currentFrame > 0) {
      seekToFrame(currentFrame - 1);
    }
  };

  const handleNextFrame = () => {
    if (currentFrame < maxFrames - 1) {
      seekToFrame(currentFrame + 1);
    }
  };

  // Fast navigation when holding buttons - more responsive like prototype
  const startFastNavigation = (direction: 'prev' | 'next') => {
    if (intervalRef.current) return; // Prevent multiple intervals
    
    let step = 1;
    let iterations = 0;
    
    const navigate = () => {
      // Get current frame at time of execution to avoid stale closure
      const current = videoRef.current?.currentTime ? Math.floor(videoRef.current.currentTime * 30) : currentFrame;
      
      if (direction === 'prev' && current > 0) {
        seekToFrame(Math.max(0, current - step));
      } else if (direction === 'next' && current < maxFrames - 1) {
        seekToFrame(Math.min(maxFrames - 1, current + step));
      }
      
      // Progressive acceleration: starts at 1 frame, quickly ramps up
      iterations++;
      if (iterations > 5 && iterations <= 15) {
        step = 2; // 2 frames per step after 5 iterations
      } else if (iterations > 15 && iterations <= 30) {
        step = 3; // 3 frames per step
      } else if (iterations > 30) {
        step = 5; // Fast scrubbing at 5 frames per step
      }
    };
    
    // DON'T navigate immediately - wait for delay to avoid interfering with single clicks
    timeoutRef.current = window.setTimeout(() => {
      navigate();
      intervalRef.current = window.setInterval(navigate, 50) as any;
    }, 250) as any; // 250ms delay before starting fast navigation
  };

  const stopFastNavigation = () => {
    // Clear both timeout and interval
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
    };
  }, []);

  const handleMarkFrame = () => {
    const video = videoRef.current;
    if (!video || !currentStep) return;

    const currentTime = video.currentTime;
    const newMarkers = { ...markers };
    
    if (currentStep.videoType === 'reference') {
      if (currentStep.markerType === 'takeoff') {
        newMarkers.reference.takeoffFrame = currentFrame;
        newMarkers.reference.takeoffTime = currentTime;
      } else {
        newMarkers.reference.landingFrame = currentFrame;
        newMarkers.reference.landingTime = currentTime;
      }
    } else {
      if (currentStep.markerType === 'takeoff') {
        newMarkers.user.takeoffFrame = currentFrame;
        newMarkers.user.takeoffTime = currentTime;
      } else {
        newMarkers.user.landingFrame = currentFrame;
        newMarkers.user.landingTime = currentTime;
      }
    }
    
    setMarkers(newMarkers);

    // Smart completion logic - complete when we've reached the last NEEDED step
    const shouldCompleteWizard = () => {
      // Determine what we initially needed to fill
      const initialMarkers = manualMarkers || { 
        reference: { takeoffTime: null, landingTime: null }, 
        user: { takeoffTime: null, landingTime: null } 
      };
      
      const initiallyNeededReference = initialMarkers.reference.takeoffTime === null || initialMarkers.reference.landingTime === null;
      const initiallyNeededUser = initialMarkers.user.takeoffTime === null || initialMarkers.user.landingTime === null;
      
      // Check current completion status
      const hasCompleteReferenceMarkers = newMarkers.reference.takeoffTime !== null && newMarkers.reference.landingTime !== null;
      const hasCompleteUserMarkers = newMarkers.user.takeoffTime !== null && newMarkers.user.landingTime !== null;
      
      // Complete only if we've filled what we needed AND we're at the end of that section
      if (initiallyNeededReference && !initiallyNeededUser) {
        // Only needed reference markers - complete after reference landing (step 2)
        return currentStep.videoType === 'reference' && currentStep.markerType === 'landing' && hasCompleteReferenceMarkers;
      } else if (initiallyNeededUser && !initiallyNeededReference) {
        // Only needed user markers - complete after user landing (step 4)  
        return currentStep.videoType === 'user' && currentStep.markerType === 'landing' && hasCompleteUserMarkers;
      } else {
        // Needed both or starting fresh - complete when everything is done
        return hasCompleteReferenceMarkers && hasCompleteUserMarkers;
      }
    };
    
    // Move to next step or complete
    if (shouldCompleteWizard()) {
      // Wizard complete - finished required markers section
      onComplete(newMarkers);
    } else if (currentStepIndex < WIZARD_STEPS.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      // Shouldn't happen in normal flow, but safety fallback
      // Reached end of steps - completing wizard
      onComplete(newMarkers);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border border-gray-700">
        {/* Step indicator - exactly like prototype */}
        <div className="text-ice-blue-400 text-xs font-semibold uppercase tracking-wide mb-4 text-center">
          Step {currentStepIndex + 1} of 4
        </div>

        {/* Title - exactly like prototype */}
        <h2 className="text-white text-xl font-semibold mb-3 text-center">
          {currentStep.title}
        </h2>

        {/* Instruction - exactly like prototype */}
        <p className="text-gray-300 text-sm leading-relaxed mb-6 text-center">
          {currentStep.instruction}
        </p>

        {/* Video Preview - clean, no overlays like prototype */}
        <div className="w-full h-48 bg-black rounded-xl mb-5 overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
        </div>

        {/* Frame controls - exactly like prototype */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <button
            onClick={handlePreviousFrame}
            onMouseDown={() => startFastNavigation('prev')}
            onMouseUp={stopFastNavigation}
            onMouseLeave={stopFastNavigation}
            disabled={!videoLoaded || currentFrame <= 0}
            className="w-9 h-9 bg-white bg-opacity-10 hover:bg-opacity-20 disabled:bg-opacity-5 disabled:opacity-50 border-none rounded-lg text-white cursor-pointer flex items-center justify-center transition-all duration-200"
          >
            ◀
          </button>
          
          <span className="text-white text-sm font-mono min-w-20 text-center tabular-nums">
            Frame {currentFrame}
          </span>
          
          <button
            onClick={handleNextFrame}
            onMouseDown={() => startFastNavigation('next')}
            onMouseUp={stopFastNavigation}
            onMouseLeave={stopFastNavigation}
            disabled={!videoLoaded || currentFrame >= maxFrames - 1}
            className="w-9 h-9 bg-white bg-opacity-10 hover:bg-opacity-20 disabled:bg-opacity-5 disabled:opacity-50 border-none rounded-lg text-white cursor-pointer flex items-center justify-center transition-all duration-200"
          >
            ▶
          </button>
        </div>

        {/* Instruction text - exactly like prototype */}
        <div className="text-center mb-5">
          <p className="text-gray-400 text-sm">
            Tap once or hold to speed up
          </p>
        </div>

        {/* Single action button - exactly like prototype */}
        <button
          onClick={handleMarkFrame}
          disabled={!videoLoaded}
          className="w-full py-4 px-4 bg-gradient-to-br from-ice-blue-400 to-blue-600 hover:from-ice-blue-500 hover:to-blue-700 border-none rounded-xl text-white text-base font-semibold cursor-pointer transition-all duration-300 uppercase tracking-wide transform hover:-translate-y-0.5 hover:shadow-lg hover:shadow-ice-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          Mark This Frame
        </button>
      </div>
    </div>
  );
}