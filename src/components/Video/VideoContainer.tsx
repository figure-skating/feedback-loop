import { useRef, useEffect, useState } from 'react';
import { useVideoUpload, VideoFile } from '../../hooks/useVideoUpload';
import { useDragAndDrop } from '../../hooks/useDragAndDrop';
import { VideoPlayer } from './VideoPlayer';
import { useAnalysisStore } from '../../store/analysisStore';
import VideoUploadMenu from './VideoUploadMenu';
import SampleVideoSelector from './SampleVideoSelector';
import { frameToTimestamp } from '../../utils/frameToTimestamp';

interface VideoContainerProps {
  label: string;
  type: 'reference' | 'user';
  onVideoUploaded?: (video: VideoFile) => void;
  onVideoRemoved?: () => void;
  showCloseButton?: boolean;
  onSampleVideoLoading?: (loading: boolean) => void;
}

export default function VideoContainer({ 
  label, 
  type, 
  onVideoUploaded,
  onVideoRemoved,
  showCloseButton = true,
  onSampleVideoLoading
}: VideoContainerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { video, isUploading, progress, error, uploadVideo, clearVideo, clearError, restoreVideo } = useVideoUpload();
  const { referenceVideo, userVideo, setReferenceVideo, setUserVideo, setManualMarkers } = useAnalysisStore();
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [showSampleSelector, setShowSampleSelector] = useState(false);
  
  // Restore video state from global store when component mounts
  useEffect(() => {
    const storedVideo = type === 'reference' ? referenceVideo : userVideo;
    if (storedVideo && !video) {
      // Restore the video state from the store
      restoreVideo({
        file: null, // We don't have the original file, but we have the URL
        url: storedVideo.url,
        name: storedVideo.name,
        size: 0, // We don't have the original size
        duration: storedVideo.duration,
      });
    }
  }, [type, referenceVideo, userVideo, video, restoreVideo]);
  
  const handleFileDrop = async (file: File) => {
    const uploadedVideo = await uploadVideo(file);
    if (uploadedVideo) {
      onVideoUploaded?.(uploadedVideo);
    }
  };

  const { isDragOver, isDragActive, dragHandlers } = useDragAndDrop(
    handleFileDrop,
    ['video/*']
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const uploadedVideo = await uploadVideo(file);
      if (uploadedVideo) {
        onVideoUploaded?.(uploadedVideo);
      }
    }
  };

  const handleClick = () => {
    if (!video && !isUploading) {
      setShowUploadMenu(true);
    }
  };

  const handleSampleSelect = async (sampleVideo: VideoFile, sampleData: any) => {
    // Set loading flag to prevent wizard
    onSampleVideoLoading?.(true);
    
    // Restore the sample video
    await restoreVideo(sampleVideo);
    
    // Store the video in the global store with sample metadata
    const videoData = {
      name: sampleVideo.name,
      url: sampleVideo.url,
      duration: sampleVideo.duration || 0,
      isSample: true,
      sampleData: sampleData
    };
    
    if (type === 'reference') {
      setReferenceVideo(videoData, false);
    } else {
      setUserVideo(videoData, false);
    }
    
    // Store sample data for later use when video loads
    window[`${type}SampleData`] = sampleData;
    
    // Set manual markers from sample data
    const currentMarkers = useAnalysisStore.getState().manualMarkers || {
      reference: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null },
      user: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null }
    };
    
    const updatedMarkers = {
      ...currentMarkers,
      [type]: {
        takeoffFrame: sampleData.markers.takeoff.frame,
        takeoffTime: sampleData.markers.takeoff.timestamp || null,
        landingFrame: sampleData.markers.landing.frame,
        landingTime: sampleData.markers.landing.timestamp || null
      }
    };
    
    setManualMarkers(updatedMarkers);
    // Set manual markers
    
    onVideoUploaded?.(sampleVideo);
  };

  const handleVideoClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent file upload dialog when clicking on video
  };

  const handleClearVideo = () => {
    clearVideo();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Clear the video from the global store  
    if (type === 'reference') {
      setReferenceVideo(null);
      // For reference video removal: setReferenceVideo(null) handles smart marker preservation
      // Don't call clearAnalysis() here as it would override the smart preservation
    } else {
      setUserVideo(null);
      // For user video removal: setUserVideo(null) handles smart marker preservation
      // Don't call clearAnalysis() here as it would override the smart preservation
    }
    
    // Notify parent that video was removed (for tab reset)
    onVideoRemoved?.();
  };

  const labelColors = {
    reference: 'bg-gradient-to-r from-purple-600 to-purple-700',
    user: 'bg-gradient-to-r from-blue-600 to-blue-700'
  };

  const borderClass = isDragOver 
    ? 'border-ice-blue-400 bg-ice-blue-900 bg-opacity-20' 
    : video 
    ? 'border-gray-600' 
    : 'border-gray-700 hover:border-gray-600';

  return (
    <div className="flex-1 flex flex-col">
      {/* Header with label and controls */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className={`${labelColors[type]} px-3 py-1 ipad:px-4 ipad:py-2 rounded-full text-xs ipad:text-sm font-semibold text-white shadow-lg`}>
          {label}
        </div>
        
        {video && showCloseButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClearVideo();
            }}
            className="w-7 h-7 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center text-white text-xs transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Video Container */}
      <div 
        className={`flex-1 bg-gray-800 rounded-xl relative overflow-hidden border-2 transition-all cursor-pointer ${borderClass}`}
        onClick={handleClick}
        {...dragHandlers}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Video Player */}
        {video && (
          <div 
            className="absolute inset-0"
            onClick={handleVideoClick}
          >
            <VideoPlayer
            src={video.url}
            videoType={type}
            className="rounded-xl"
            muted
            playsInline
            poseColor={type === 'reference' ? '#A855F7' : '#3B82F6'}
            onLoadedMetadata={(duration) => {
              // Update the store with video duration
              const videoData = {
                name: video.name,
                url: video.url,
                duration: duration
              };
              
              if (type === 'reference') {
                setReferenceVideo(videoData, false); // Don't clear analysis when restoring
              } else {
                setUserVideo(videoData, false); // Don't clear analysis when restoring
              }
              
              // If this is a sample video, set the pre-analyzed markers with timestamps
              const sampleData = window[`${type}SampleData`];
              if (sampleData && sampleData.markers) {
                const fps = 30; // Sample videos are 30fps
                const takeoffTime = frameToTimestamp(sampleData.markers.takeoff.frame, fps);
                const landingTime = frameToTimestamp(sampleData.markers.landing.frame, fps);
                
                // Get existing markers or create new ones
                const currentMarkers = useAnalysisStore.getState().manualMarkers || {
                  reference: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null },
                  user: { takeoffFrame: null, takeoffTime: null, landingFrame: null, landingTime: null }
                };
                
                // Update markers for the current video type
                const updatedMarkers = {
                  ...currentMarkers,
                  [type]: {
                    takeoffFrame: sampleData.markers.takeoff.frame,
                    takeoffTime: takeoffTime,
                    landingFrame: sampleData.markers.landing.frame,
                    landingTime: landingTime
                  }
                };
                
                setManualMarkers(updatedMarkers);
                
                // Clear the sample data from window
                delete window[`${type}SampleData`];
                
                // Clear loading flag after markers are set
                onSampleVideoLoading?.(false);
              }
            }}
            />
          </div>
        )}

        {/* Upload States */}
        {!video && (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          {isUploading ? (
            // Upload Progress
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-ice-blue-600 rounded-full flex items-center justify-center mb-3 relative">
                <div 
                  className="absolute inset-0 border-4 border-transparent border-t-ice-blue-400 rounded-full animate-spin"
                  style={{ 
                    background: `conic-gradient(from 0deg, transparent ${360 - (progress * 3.6)}deg, #5dade2 ${360 - (progress * 3.6)}deg)`,
                    WebkitMask: 'radial-gradient(circle, transparent 50%, black 50%)',
                    mask: 'radial-gradient(circle, transparent 50%, black 50%)'
                  }}
                />
                <span className="text-sm font-bold text-ice-blue-400">{progress}%</span>
              </div>
              <span className="text-gray-400 text-sm font-medium">Uploading...</span>
            </div>
          ) : (
            // Upload Placeholder
            <div className="flex flex-col items-center group-hover:scale-105 transition-transform">
              <div className={`w-16 h-16 border-3 rounded-full flex items-center justify-center mb-3 transition-colors ${
                isDragOver ? 'border-ice-blue-400 bg-ice-blue-400 bg-opacity-20' : 'border-gray-600 group-hover:border-ice-blue-400'
              }`}>
                <span className="text-2xl">
                  {isDragActive ? '📤' : '📹'}
                </span>
              </div>
              <span className="text-gray-400 text-sm font-medium text-center px-4">
                {isDragActive ? 'Drop video here' : 'Tap to upload video'}
              </span>
              {isDragActive && (
                <span className="text-xs text-ice-blue-400 mt-1">
                  or drag & drop
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-x-0 bottom-0 bg-red-600 bg-opacity-90 text-white text-xs p-2 text-center">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                clearError();
              }}
              className="ml-2 text-white hover:text-gray-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      
      </div>

      {/* Upload Menu */}
      <VideoUploadMenu
        isOpen={showUploadMenu}
        onClose={() => setShowUploadMenu(false)}
        onSelectSample={() => {
          setShowUploadMenu(false);
          setShowSampleSelector(true);
        }}
        onSelectFile={() => {
          setShowUploadMenu(false);
          fileInputRef.current?.click();
        }}
      />

      {/* Sample Video Selector */}
      <SampleVideoSelector
        isOpen={showSampleSelector}
        onClose={() => setShowSampleSelector(false)}
        onVideoSelect={handleSampleSelect}
      />
    </div>
  );
}