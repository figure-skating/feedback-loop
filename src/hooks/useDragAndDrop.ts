import { useState, useCallback, DragEvent } from 'react';

interface DragState {
  isDragOver: boolean;
  isDragActive: boolean;
}

export function useDragAndDrop(
  onFileDrop: (file: File) => void,
  accept?: string[]
) {
  const [dragState, setDragState] = useState<DragState>({
    isDragOver: false,
    isDragActive: false,
  });

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState(prev => ({
      ...prev,
      isDragActive: true,
    }));
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState(prev => ({
      ...prev,
      isDragOver: true,
    }));
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only reset if we're leaving the drop zone entirely
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragState({
        isDragOver: false,
        isDragActive: false,
      });
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDragState({
      isDragOver: false,
      isDragActive: false,
    });

    const files = Array.from(e.dataTransfer.files);
    const file = files[0];

    if (!file) return;

    // Check file type if accept filter is provided
    if (accept && accept.length > 0) {
      const isAccepted = accept.some(acceptedType => {
        if (acceptedType.endsWith('/*')) {
          const baseType = acceptedType.replace('/*', '');
          return file.type.startsWith(baseType);
        }
        return file.type === acceptedType;
      });

      if (!isAccepted) {
        // File type not accepted
        return;
      }
    }

    onFileDrop(file);
  }, [onFileDrop, accept]);

  const dragHandlers = {
    onDragEnter: handleDragEnter,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
  };

  return {
    ...dragState,
    dragHandlers,
  };
}