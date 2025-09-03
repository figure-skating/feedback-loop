import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

export interface PoseCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
}

interface PoseCanvasProps {
  width?: number;
  height?: number;
  className?: string;
}

export const PoseCanvas = forwardRef<PoseCanvasRef, PoseCanvasProps>(
  ({ width = 640, height = 480, className = '' }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useImperativeHandle(ref, () => ({
      getCanvas: () => canvasRef.current,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;

      // Clear canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, width, height);
      }
    }, [width, height]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`absolute inset-0 pointer-events-none z-10 ${className}`}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
      />
    );
  }
);

PoseCanvas.displayName = 'PoseCanvas';