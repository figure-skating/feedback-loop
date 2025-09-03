import { useState, useEffect } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';

interface TimelineWithMarkersProps {
  className?: string;
}

export default function TimelineWithMarkers({ className = '' }: TimelineWithMarkersProps) {
  const { 
    referenceVideo, 
    userVideo, 
    manualMarkers,
    referenceVideoPadding,
    userVideoPadding,
    virtualTimelineDuration,
    isAnalyzing,
    setCurrentTime: setStoreCurrentTime 
  } = useAnalysisStore();
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Get video elements from DOM
  const getReferenceVideo = () => {
    return document.querySelector('[data-video-type="reference"]') as HTMLVideoElement;
  };

  const getUserVideo = () => {
    return document.querySelector('[data-video-type="user"]') as HTMLVideoElement;
  };

  // Update duration when videos load
  useEffect(() => {
    const refVideo = getReferenceVideo();
    const userVideo = getUserVideo();
    
    if (refVideo && userVideo) {
      const maxDuration = virtualTimelineDuration || Math.max(refVideo.duration || 0, userVideo.duration || 0);
      if (maxDuration > 0) {
        setDuration(maxDuration);
      }
    }
  }, [referenceVideo, userVideo]);

  // Track current time (but not during analysis)
  useEffect(() => {
    const updateTime = () => {
      // Don't update timeline during analysis to keep it static
      if (isAnalyzing) return;
      
      const refVideo = getReferenceVideo();
      if (refVideo && !refVideo.paused) {
        setCurrentTime(refVideo.currentTime);
        setStoreCurrentTime(refVideo.currentTime);
      }
    };

    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, [setStoreCurrentTime, isAnalyzing]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const virtualTime = parseFloat(e.target.value);
    const refVideo = getReferenceVideo();
    const userVideo = getUserVideo();
    
    if (refVideo && userVideo) {
      // Snap to nearest frame for frame-accurate seeking
      const fps = 30;
      const frameTime = 1 / fps;
      const snappedVirtualTime = Math.round(virtualTime / frameTime) * frameTime;
      
      // Calculate actual video times by subtracting padding
      const refVideoTime = Math.max(0, snappedVirtualTime - referenceVideoPadding);
      const userVideoTime = Math.max(0, snappedVirtualTime - userVideoPadding);
      
      // Set video positions
      refVideo.currentTime = Math.min(refVideoTime, refVideo.duration);
      userVideo.currentTime = Math.min(userVideoTime, userVideo.duration);
      
      setCurrentTime(snappedVirtualTime);
      setStoreCurrentTime(snappedVirtualTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  // Calculate marker positions as percentages on virtual timeline
  const getMarkerPosition = (time: number | null, isUserMarker: boolean = false) => {
    if (!time || !duration) return 0;
    // Add padding to get virtual timeline position
    const virtualTime = time + (isUserMarker ? userVideoPadding : referenceVideoPadding);
    return (virtualTime / duration) * 100;
  };

  // Calculate air time region on virtual timeline
  const getAirTimeRegion = (takeoffTime: number | null, landingTime: number | null, isUserRegion: boolean = false) => {
    if (!takeoffTime || !landingTime || !duration) return null;
    
    // Add padding to get virtual timeline positions
    const padding = isUserRegion ? userVideoPadding : referenceVideoPadding;
    const virtualTakeoff = takeoffTime + padding;
    const virtualLanding = landingTime + padding;
    
    const startPercent = (virtualTakeoff / duration) * 100;
    const endPercent = (virtualLanding / duration) * 100;
    
    return {
      left: startPercent,
      width: endPercent - startPercent
    };
  };

  if (!referenceVideo || !userVideo) {
    return null;
  }

  const refAirRegion = manualMarkers ? getAirTimeRegion(
    manualMarkers.reference.takeoffTime,
    manualMarkers.reference.landingTime
  ) : null;

  const userAirRegion = manualMarkers ? getAirTimeRegion(
    manualMarkers.user.takeoffTime,
    manualMarkers.user.landingTime,
    true // isUserRegion
  ) : null;

  return (
    <div className={`bg-gray-800 rounded-xl border border-gray-700 p-3 ${className}`}>
      {/* Time labels - increased spacing to avoid overlap with T markers */}
      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>0:00</span>
        <span className="font-mono">{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Timeline track */}
      <div className="relative">
        {/* Background track */}
        <input
          type="range"
          min="0"
          max={duration || 0}
          step={0.033333} // 1/30 second for frame-accurate control at 30fps
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider relative z-20"
          style={{
            background: `linear-gradient(to right, #5DADE2 0%, #5DADE2 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
          }}
        />

        {/* Reference air time region */}
        {refAirRegion && (
          <div
            className="absolute top-0 h-2 bg-purple-500 bg-opacity-40 rounded pointer-events-none z-10"
            style={{
              left: `${refAirRegion.left}%`,
              width: `${refAirRegion.width}%`
            }}
          />
        )}

        {/* User air time region */}
        {userAirRegion && (
          <div
            className="absolute top-0 h-2 bg-blue-500 bg-opacity-40 rounded pointer-events-none z-10"
            style={{
              left: `${userAirRegion.left}%`,
              width: `${userAirRegion.width}%`
            }}
          />
        )}

        {/* Takeoff markers */}
        {manualMarkers?.reference.takeoffTime && (
          <div
            className="absolute top-[-4px] w-0.5 h-4 bg-purple-400 pointer-events-none z-15"
            style={{ left: `${getMarkerPosition(manualMarkers.reference.takeoffTime)}%` }}
          >
            <div className="absolute top-[-16px] left-[-8px] text-xs text-purple-400 font-bold">T</div>
          </div>
        )}

        {manualMarkers?.user.takeoffTime && (
          <div
            className="absolute top-[-4px] w-0.5 h-4 bg-blue-400 pointer-events-none z-15"
            style={{ left: `${getMarkerPosition(manualMarkers.user.takeoffTime, true)}%` }}
          >
            <div className="absolute top-[-16px] left-[-8px] text-xs text-blue-400 font-bold">T</div>
          </div>
        )}

        {/* Landing markers */}
        {manualMarkers?.reference.landingTime && (
          <div
            className="absolute top-[-4px] w-0.5 h-4 bg-purple-400 pointer-events-none z-15"
            style={{ left: `${getMarkerPosition(manualMarkers.reference.landingTime)}%` }}
          >
            <div className="absolute top-[-16px] left-[-8px] text-xs text-purple-400 font-bold">L</div>
          </div>
        )}

        {manualMarkers?.user.landingTime && (
          <div
            className="absolute top-[-4px] w-0.5 h-4 bg-blue-400 pointer-events-none z-15"
            style={{ left: `${getMarkerPosition(manualMarkers.user.landingTime, true)}%` }}
          >
            <div className="absolute top-[-16px] left-[-8px] text-xs text-blue-400 font-bold">L</div>
          </div>
        )}
      </div>

    </div>
  );
}