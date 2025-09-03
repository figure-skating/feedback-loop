import { useAnalysisStore } from '../../store/analysisStore';

interface DisplayModeToggleProps {
  className?: string;
}

export default function DisplayModeToggle({ className = '' }: DisplayModeToggleProps) {
  const { displayMode, setDisplayMode, hasValidAnalysis } = useAnalysisStore();
  
  // Don't show the toggle if analysis isn't ready
  if (!hasValidAnalysis()) {
    return null;
  }

  // Determine which toggles are active based on display mode
  const showVideo = displayMode === 'video' || displayMode === 'both';
  const showPose = displayMode === 'skeleton' || displayMode === 'both';

  const handleToggle = (type: 'video' | 'pose') => {
    if (type === 'video') {
      if (showVideo && showPose) {
        // Both on, turning off video -> skeleton only
        setDisplayMode('skeleton');
      } else if (showVideo && !showPose) {
        // Only video on, turning it off -> turn on skeleton instead
        setDisplayMode('skeleton');
      } else {
        // Video off, turning it on
        setDisplayMode(showPose ? 'both' : 'video');
      }
    } else {
      // type === 'pose'
      if (showPose && showVideo) {
        // Both on, turning off pose -> video only
        setDisplayMode('video');
      } else if (showPose && !showVideo) {
        // Only pose on, turning it off -> turn on video instead
        setDisplayMode('video');
      } else {
        // Pose off, turning it on
        setDisplayMode(showVideo ? 'both' : 'skeleton');
      }
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        onClick={() => handleToggle('video')}
        className={`
          px-3 py-1.5 text-xs font-medium rounded-md transition-all
          ${showVideo
            ? 'bg-gray-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
          }
        `}
      >
        Video
      </button>
      <button
        onClick={() => handleToggle('pose')}
        className={`
          px-3 py-1.5 text-xs font-medium rounded-md transition-all
          ${showPose
            ? 'bg-gray-600 text-white'
            : 'bg-gray-700 text-gray-400 hover:text-gray-300'
          }
        `}
      >
        Pose
      </button>
    </div>
  );
}