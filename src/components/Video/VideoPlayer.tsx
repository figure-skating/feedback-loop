import { useRef, useEffect, forwardRef, useImperativeHandle, useState } from 'react';
import { PoseCanvas, PoseCanvasRef } from './PoseCanvas';
import { useAnalysisStore } from '../../store/analysisStore';
import { poseDetector } from '../../services/mediapipe/poseDetector';

export interface VideoPlayerRef {
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getVideoElement: () => HTMLVideoElement | null;
}

interface VideoPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onLoadedMetadata?: (duration: number) => void;
  onEnded?: () => void;
  muted?: boolean;
  playsInline?: boolean;
  poseColor?: string;
  videoType: 'reference' | 'user';
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ 
    src, 
    className = '', 
    onTimeUpdate, 
    onLoadedMetadata, 
    onEnded,
    muted: _muted = true,
    playsInline = true,
    poseColor = '#A855F7',
    videoType
  }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<PoseCanvasRef>(null);
    const [isPaused, setIsPaused] = useState(true);
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [posterUrl, setPosterUrl] = useState<string>('');
    
    const { 
      getLandmarksAtTime, 
      hasValidAnalysis, 
      displayMode,
      referenceAnalysis,
      userAnalysis,
      isAnalyzing
    } = useAnalysisStore();


    // Generate poster image from first frame
    const generatePoster = (video: HTMLVideoElement) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Seek to first frame and draw it
      const originalTime = video.currentTime;
      video.currentTime = 0;
      
      // Wait a bit for seek to complete, then capture frame
      setTimeout(() => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const posterDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPosterUrl(posterDataUrl);
        
        // Restore original time
        video.currentTime = originalTime;
      }, 100);
    };

    useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seekTo: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      getVideoElement: () => {
        return videoRef.current;
      },
    }));

    // Draw overlay - TEST MODE and pose data
    useEffect(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current?.getCanvas();
      
      if (!video || !canvas) return;

      const updateOverlay = () => {
        const currentTime = video.currentTime;
        
        // Update canvas size to match video dimensions
        if (video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Clear canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw pose if we have analysis data
          if (hasValidAnalysis()) {
            const landmarks = getLandmarksAtTime(videoType, currentTime);
            if (landmarks && landmarks.length > 0) {
              poseDetector.drawPose(canvas, landmarks, poseColor);
            }
          }
        }
      };

      // Update overlay on time update
      video.addEventListener('timeupdate', updateOverlay);
      
      // Also update on seek and play
      video.addEventListener('seeked', updateOverlay);
      video.addEventListener('play', updateOverlay);
      
      // Initial draw
      updateOverlay();

      return () => {
        video.removeEventListener('timeupdate', updateOverlay);
        video.removeEventListener('seeked', updateOverlay);
        video.removeEventListener('play', updateOverlay);
      };
    }, [videoType, getLandmarksAtTime, hasValidAnalysis, poseColor, referenceAnalysis, userAnalysis, isAnalyzing]);

    // Force pose overlay update when analysis completes
    useEffect(() => {
      // When analysis just completed (isAnalyzing changed from true to false and we have valid analysis)
      if (!isAnalyzing && hasValidAnalysis()) {
        const video = videoRef.current;
        const canvas = canvasRef.current?.getCanvas();
        
        if (video && canvas) {
          // Force immediate overlay update at current time
          const currentTime = video.currentTime;
          const landmarks = getLandmarksAtTime(videoType, currentTime);
          
          if (landmarks && landmarks.length > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              poseDetector.drawPose(canvas, landmarks, poseColor);
              // Pose overlay displayed immediately after analysis completion
            }
          }
        }
      }
    }, [isAnalyzing, hasValidAnalysis, videoType, getLandmarksAtTime, poseColor]);

    // Basic video event handlers
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleTimeUpdate = () => {
        onTimeUpdate?.(video.currentTime);
        
      };

      const handleLoadedMetadata = () => {
        onLoadedMetadata?.(video.duration);
        
        // Update canvas size to match video
        const canvas = canvasRef.current?.getCanvas();
        if (canvas && video.videoWidth && video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
        
        // Generate poster from first frame
        generatePoster(video);
      };

      const handleEnded = () => {
        onEnded?.();
      };

      const handlePlay = () => {
        setIsPaused(false);
      };

      const handlePause = () => {
        setIsPaused(true);
      };

      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);

      return () => {
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
      };
    }, [onTimeUpdate, onLoadedMetadata, onEnded]);

    // Cleanup poster URL on unmount
    useEffect(() => {
      return () => {
        if (posterUrl) {
          URL.revokeObjectURL(posterUrl);
        }
      };
    }, [posterUrl]);

    return (
      <div 
        className="relative w-full h-full bg-black group"
        onMouseEnter={() => setShowPlayButton(true)}
        onMouseLeave={() => setShowPlayButton(false)}
      >
        <video
          ref={videoRef}
          src={src}
          data-video-type={videoType}
          className={`w-full h-full object-contain cursor-pointer ${className} ${displayMode === 'skeleton' ? 'opacity-0' : 'opacity-100'}`}
          muted={true}
          playsInline={playsInline}
          controls={false}
          preload="metadata"
          poster={posterUrl}
          onClick={(e) => {
            e.preventDefault();
            const video = videoRef.current;
            if (video) {
              if (video.paused) {
                video.play();
              } else {
                video.pause();
              }
            }
          }}
        />
        
        {/* Pose detection canvas overlay - visibility based on display mode */}
        <PoseCanvas 
          ref={canvasRef}
          className={`absolute inset-0 pointer-events-none z-10 ${displayMode === 'video' ? 'opacity-0' : 'opacity-100'}`}
        />
        
        
        {/* Play button overlay - shows on hover when paused */}
        {(isPaused && showPlayButton) && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="w-16 h-16 bg-black bg-opacity-60 rounded-full flex items-center justify-center backdrop-blur-sm">
              <div className="w-0 h-0 border-l-[12px] border-l-white border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent ml-1"></div>
            </div>
          </div>
        )}
        
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';