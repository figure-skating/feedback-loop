import { useState, useCallback } from 'react';

export interface VideoFile {
  file: File | null;
  url: string;
  name: string;
  size: number;
  duration?: number;
}

interface UploadState {
  isUploading: boolean;
  progress: number;
  error: string | null;
  video: VideoFile | null;
}

const ACCEPTED_FORMATS = ['video/mp4', 'video/mov', 'video/quicktime', 'video/webm', 'video/avi'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function useVideoUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    video: null,
  });

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_FORMATS.includes(file.type)) {
      return 'Please upload a video file (MP4, MOV, WEBM, or AVI)';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB`;
    }
    
    return null;
  }, []);

  const uploadVideo = useCallback(async (file: File): Promise<VideoFile | null> => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState(prev => ({ ...prev, error: validationError }));
      return null;
    }

    setUploadState({
      isUploading: true,
      progress: 0,
      error: null,
      video: null,
    });

    try {
      // Create object URL for the video
      const url = URL.createObjectURL(file);
      
      // Simulate upload progress for better UX
      for (let progress = 0; progress <= 100; progress += 10) {
        setUploadState(prev => ({ ...prev, progress }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Get video duration
      const duration = await getVideoDuration(url);

      const videoFile: VideoFile = {
        file,
        url,
        name: file.name,
        size: file.size,
        duration,
      };

      setUploadState({
        isUploading: false,
        progress: 100,
        error: null,
        video: videoFile,
      });

      return videoFile;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setUploadState({
        isUploading: false,
        progress: 0,
        error: errorMessage,
        video: null,
      });
      return null;
    }
  }, [validateFile]);

  const clearVideo = useCallback(() => {
    if (uploadState.video?.url) {
      URL.revokeObjectURL(uploadState.video.url);
    }
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null,
      video: null,
    });
  }, [uploadState.video?.url]);

  const clearError = useCallback(() => {
    setUploadState(prev => ({ ...prev, error: null }));
  }, []);

  const restoreVideo = useCallback((videoFile: VideoFile) => {
    setUploadState({
      isUploading: false,
      progress: 100,
      error: null,
      video: videoFile,
    });
  }, []);

  return {
    ...uploadState,
    uploadVideo,
    clearVideo,
    clearError,
    validateFile,
    restoreVideo,
  };
}

// Helper function to get video duration
function getVideoDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      resolve(video.duration);
    };
    
    video.onerror = () => {
      reject(new Error('Could not load video metadata'));
    };
    
    video.src = url;
  });
}