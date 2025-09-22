import { useState, useEffect } from 'react';
import { VideoFile } from '../../hooks/useVideoUpload';

interface SampleVideo {
  id: string;
  filename: string;
  title: string;
  description: string;
  jumpType: string;
  rotations: number;
  markers: {
    takeoff: {
      frame: number;
      timestamp?: number;
    };
    landing: {
      frame: number;
      timestamp?: number;
    };
  };
  analysis?: {
    airTime?: number;
    jumpHeight?: number;
    rotationSpeed?: number;
    landingStability?: number;
  };
}

interface SampleVideoSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoSelect: (video: VideoFile, sampleData: SampleVideo) => void;
}

export default function SampleVideoSelector({ isOpen, onClose, onVideoSelect }: SampleVideoSelectorProps) {
  const [sampleVideos, setSampleVideos] = useState<SampleVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && sampleVideos.length === 0) {
      loadSampleData();
    }
  }, [isOpen]);

  const loadSampleData = async () => {
    setLoading(true);
    setError(null);

    try {
      const basePath = import.meta.env.BASE_URL;
      const response = await fetch(`${basePath}sample-videos/sample-data.json`);
      if (!response.ok) throw new Error('Failed to load sample data');

      const data = await response.json();
      setSampleVideos(data.videos);
    } catch (err) {
      setError('Failed to load sample videos');
      // Error loading sample data
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = async (video: SampleVideo) => {
    try {
      // Create a VideoFile object from the sample video
      const basePath = import.meta.env.BASE_URL;
      const videoFile: VideoFile = {
        file: null, // Sample videos don't have original file
        url: `${basePath}sample-videos/${video.filename}`,
        name: video.filename,
        size: 0, // Size will be determined when loaded
        duration: 0 // Duration will be determined when loaded
      };

      onVideoSelect(videoFile, video);
      onClose();
    } catch (err) {
      // Error selecting sample video
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-md">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-8 h-8 bg-white bg-opacity-10 rounded-full flex items-center justify-center text-white hover:bg-opacity-20 transition-colors"
        >
          ✕
        </button>

        {/* Content */}
        <div className="bg-gray-900 rounded-2xl p-6 max-h-[70vh] overflow-y-auto">
          <h2 className="text-white text-lg font-semibold mb-5 text-center">
            Choose Sample Video
          </h2>

          {loading && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-3 border-ice-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 mt-2">Loading samples...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-600 bg-opacity-20 border border-red-600 rounded-lg p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-3">
              {sampleVideos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => handleVideoSelect(video)}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-ice-blue-500 rounded-xl p-4 text-left transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-medium group-hover:text-ice-blue-400 transition-colors">
                        {video.title}
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        {video.description}
                      </p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs bg-ice-blue-600 bg-opacity-20 text-ice-blue-400 px-2 py-1 rounded">
                          {video.rotations} rotations
                        </span>
                        <span className="text-xs text-gray-500">
                          Frames: {video.markers.takeoff.frame} → {video.markers.landing.frame}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3 text-gray-400 group-hover:text-ice-blue-400 transition-colors">
                      →
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs text-center">
              Sample videos include pre-analyzed markers for immediate comparison
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}