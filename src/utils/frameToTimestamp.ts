/**
 * Convert a frame number to a timestamp in seconds
 * @param frameNumber - The frame number (0-indexed)
 * @param fps - Frames per second (default 30)
 * @returns Timestamp in seconds
 */
export function frameToTimestamp(frameNumber: number, fps: number = 30): number {
  return frameNumber / fps;
}

/**
 * Convert a timestamp in seconds to a frame number
 * @param timestamp - The timestamp in seconds
 * @param fps - Frames per second (default 30)
 * @returns Frame number (0-indexed)
 */
export function timestampToFrame(timestamp: number, fps: number = 30): number {
  return Math.round(timestamp * fps);
}