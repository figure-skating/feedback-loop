import { JumpMetrics } from "./jumpMetricsService";

export interface VideoExportOptions {
  userVideoElement: HTMLVideoElement;
  metrics: JumpMetrics;
  takeoffFrame: number;
  landingFrame: number;
  fps?: number;
  quality?: number;
  slowMotionFactor?: number; // How much to slow down the jump (e.g., 0.3 = 30% speed)
}

class VideoExportService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private logoImage: HTMLImageElement | null = null;

  /**
   * Export user jump video with metrics overlay and jump indicators
   */
  async exportJumpVideo(options: VideoExportOptions): Promise<Blob | null> {
    const {
      userVideoElement,
      metrics,
      takeoffFrame,
      landingFrame,
      fps = 60,
      quality: _quality = 0.8, // Currently unused, reserved for future enhancement
      slowMotionFactor = 0.3, // Default to 30% speed for dramatic effect
    } = options;

    try {
      // Setup canvas for video processing
      this.setupCanvas(userVideoElement);
      if (!this.canvas || !this.ctx) {
        throw new Error("Failed to setup canvas");
      }

      // Calculate export duration (focus on jump sequence with slow motion)
      const jumpTiming = this.calculateJumpDuration(
        userVideoElement,
        takeoffFrame,
        landingFrame,
        slowMotionFactor
      );

      // Export parameters: takeoffFrame, landingFrame, duration, startTime, endTime, fps

      // Start recording
      const chunks: Blob[] = [];
      const stream = this.canvas.captureStream(fps);

      // Use MP4 with the best supported codec
      const mp4Options = [
        "video/mp4;codecs=avc1.42E01E", // Works on your Mac
        "video/mp4;codecs=avc1.64001E", 
        "video/mp4;codecs=h264",
        "video/mp4"
      ];
      
      let mimeType = "";
      
      // Find the best MP4 option
      for (const option of mp4Options) {
        if (MediaRecorder.isTypeSupported(option)) {
          mimeType = option;
          break;
        }
      }
      
      // Throw error if no MP4 support (shouldn't happen based on your logs)
      if (!mimeType) {
        throw new Error("MP4 recording not supported by this browser");
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      // Return promise that resolves when recording is complete
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder) {
          reject(new Error("MediaRecorder not initialized"));
          return;
        }

        this.mediaRecorder.onstop = () => {
          // Create MP4 blob with proper MIME type
          const blob = new Blob(chunks, { type: "video/mp4" });
          
          // Ensure proper MP4 file extension for downloads
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (blob as any).suggestedName = "jump-analysis.mp4";
          
          resolve(blob);
        };

        this.mediaRecorder.onerror = (error) => {
          // MediaRecorder error
          reject(error);
        };

        // Start recording
        this.mediaRecorder.start();

        // Process video frames
        this.processVideoFrames(
          userVideoElement,
          metrics,
          takeoffFrame,
          landingFrame,
          jumpTiming,
          fps,
          slowMotionFactor
        )
          .then(() => {
            this.mediaRecorder?.stop();
          })
          .catch(reject);
      });
    } catch (error) {
      // Video export failed
      return null;
    }
  }

  /**
   * Setup canvas for video processing
   */
  private setupCanvas(videoElement: HTMLVideoElement): void {
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
    }

    // Set canvas size to match video
    this.canvas.width = videoElement.videoWidth || 640;
    this.canvas.height = videoElement.videoHeight || 480;

    this.ctx = this.canvas.getContext("2d");

    if (!this.ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Set high quality rendering
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
  }

  /**
   * Calculate focused jump duration with slow motion - show more of the video
   */
  private calculateJumpDuration(
    videoElement: HTMLVideoElement,
    takeoffFrame: number,
    landingFrame: number,
    slowMotionFactor: number = 0.3
  ): { duration: number; startTime: number; endTime: number; jumpStartTime: number; jumpEndTime: number } {
    const fps = 15; // Analysis FPS used in the app

    // Convert frames to time
    const takeoffTime = takeoffFrame / fps;
    const landingTime = landingFrame / fps;

    // Add more padding for a complete jump sequence view
    const preJumpTime = 1.0; // 1 second before takeoff
    const postJumpTime = 1.0; // 1 second after landing

    const startTime = Math.max(0, takeoffTime - preJumpTime);
    const endTime = Math.min(videoElement.duration, landingTime + postJumpTime);

    // Calculate jump duration in slow motion
    const jumpDuration = landingTime - takeoffTime;
    const slowJumpDuration = jumpDuration / slowMotionFactor;
    const normalDuration = (endTime - startTime) - jumpDuration;

    return {
      duration: normalDuration + slowJumpDuration,
      startTime,
      endTime,
      jumpStartTime: takeoffTime,
      jumpEndTime: landingTime,
    };
  }

  /**
   * Process video frames with overlays and variable speed
   */
  private async processVideoFrames(
    videoElement: HTMLVideoElement,
    metrics: JumpMetrics,
    takeoffFrame: number,
    landingFrame: number,
    jumpTiming: { duration: number; startTime: number; endTime: number; jumpStartTime: number; jumpEndTime: number },
    fps: number,
    slowMotionFactor: number
  ): Promise<void> {
    const totalFrames = Math.ceil(jumpTiming.duration * fps);
    const frameInterval = 1000 / fps; // ms per frame

    let currentFrame = 0;
    const startTime = performance.now();

    return new Promise((resolve, reject) => {
      const processFrame = async () => {
        try {
          if (currentFrame >= totalFrames) {
            resolve();
            return;
          }

          // Calculate video time based on export progress with variable speed
          const exportProgress = currentFrame / fps; // Time in export
          const absoluteVideoTime = this.calculateVideoTimeForExportTime(
            exportProgress,
            jumpTiming,
            slowMotionFactor
          );

          // Seek video to current time
          await this.seekVideoToTime(videoElement, absoluteVideoTime);

          // Draw frame to canvas
          await this.drawFrameWithOverlays(
            videoElement,
            metrics,
            currentFrame,
            takeoffFrame,
            landingFrame,
            jumpTiming,
            totalFrames,
            absoluteVideoTime
          );

          currentFrame++;

          // Schedule next frame
          const expectedTime = startTime + currentFrame * frameInterval;
          const now = performance.now();
          const delay = Math.max(0, expectedTime - now);

          setTimeout(processFrame, delay);
        } catch (error) {
          reject(error);
        }
      };

      processFrame();
    });
  }

  /**
   * Calculate actual video time based on export progress with slow motion
   */
  private calculateVideoTimeForExportTime(
    exportProgress: number,
    jumpTiming: { startTime: number; jumpStartTime: number; jumpEndTime: number },
    slowMotionFactor: number
  ): number {
    const preJumpDuration = jumpTiming.jumpStartTime - jumpTiming.startTime;
    const jumpDuration = jumpTiming.jumpEndTime - jumpTiming.jumpStartTime;
    const slowJumpDurationInExport = jumpDuration / slowMotionFactor;

    if (exportProgress <= preJumpDuration) {
      // Before jump: normal speed
      return jumpTiming.startTime + exportProgress;
    } else if (exportProgress <= preJumpDuration + slowJumpDurationInExport) {
      // During jump: slow motion
      const jumpExportProgress = exportProgress - preJumpDuration;
      const actualJumpProgress = jumpExportProgress * slowMotionFactor;
      return jumpTiming.jumpStartTime + actualJumpProgress;
    } else {
      // After jump: normal speed
      const postJumpExportProgress = exportProgress - preJumpDuration - slowJumpDurationInExport;
      return jumpTiming.jumpEndTime + postJumpExportProgress;
    }
  }

  /**
   * Seek video to specific time with better handling
   */
  private async seekVideoToTime(
    videoElement: HTMLVideoElement,
    time: number
  ): Promise<void> {
    return new Promise((resolve) => {
      const targetTime = Math.max(
        0.1,
        Math.min(time, videoElement.duration - 0.1)
      );

      const handleSeeked = () => {
        videoElement.removeEventListener("seeked", handleSeeked);
        // Add small delay to ensure frame is ready
        setTimeout(resolve, 50);
      };

      const handleLoadedData = () => {
        videoElement.removeEventListener("loadeddata", handleLoadedData);
        setTimeout(resolve, 50);
      };

      // If already at the target time (within 0.1s), don't seek
      if (Math.abs(videoElement.currentTime - targetTime) < 0.1) {
        resolve();
        return;
      }

      videoElement.addEventListener("seeked", handleSeeked);
      videoElement.addEventListener("loadeddata", handleLoadedData);
      videoElement.currentTime = targetTime;

      // Fallback timeout
      setTimeout(() => {
        videoElement.removeEventListener("seeked", handleSeeked);
        videoElement.removeEventListener("loadeddata", handleLoadedData);
        resolve();
      }, 200);
    });
  }

  /**
   * Draw frame with overlays to canvas
   */
  private async drawFrameWithOverlays(
    videoElement: HTMLVideoElement,
    metrics: JumpMetrics,
    _currentFrame: number,
    takeoffFrame: number,
    landingFrame: number,
    _jumpTiming: { duration: number; startTime: number; endTime: number; jumpStartTime: number; jumpEndTime: number },
    _totalFrames: number,
    currentVideoTime: number
  ): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    const ctx = this.ctx;
    const canvas = this.canvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw video frame
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    // Show metrics overlay throughout the entire video
    await this.drawMetricsOverlay(ctx, canvas, metrics);

    // Use the actual video time passed from the caller (accounts for slow motion)
    const takeoffTime = takeoffFrame / 15; // Analysis FPS is 15
    const landingTime = landingFrame / 15;

    // Show jump indicators based on actual video time (not export time)
    if (Math.abs(currentVideoTime - takeoffTime) < 0.05) {
      this.drawJumpIndicator(ctx, canvas, "TAKEOFF", "green");
    } else if (Math.abs(currentVideoTime - landingTime) < 0.05) {
      this.drawJumpIndicator(ctx, canvas, "LANDING", "blue");
    }
  }

  /**
   * Load logo image if not already loaded
   */
  private async loadLogo(): Promise<void> {
    if (this.logoImage) return;

    return new Promise((resolve, _reject) => {
      const img = new Image();
      img.onload = () => {
        this.logoImage = img;
        resolve();
      };
      img.onerror = () => {
        // If logo fails to load, continue without it
        resolve();
      };
      img.src = `${import.meta.env.BASE_URL}Logo1.png`;
    });
  }

  /**
   * Draw metrics overlay with logo integration - clean design
   */
  private async drawMetricsOverlay(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    metrics: JumpMetrics
  ): Promise<void> {
    // Load logo first
    await this.loadLogo();
    // Removed unused variables - using fixed sizing now

    // Perfect card size - balanced spacing
    const cardWidth = 800; // Sweet spot between 700 and 1000
    const cardHeight = 200;
    const cardX = canvas.width - cardWidth - 40;
    const cardY = 40;

    // Draw clean white background
    ctx.fillStyle = "rgba(255, 255, 255, 1.0)";
    ctx.fillRect(cardX, cardY, cardWidth, cardHeight);

    // Draw subtle border
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
    ctx.lineWidth = 1;
    ctx.strokeRect(cardX, cardY, cardWidth, cardHeight);

    // Metrics data
    const airTime = metrics.airTime ? `${metrics.airTime.toFixed(2)}s` : "--";
    const rotations = metrics.rotations
      ? `${metrics.rotations.toFixed(2)}`
      : "--";
    const height = metrics.maxHeight
      ? `${metrics.maxHeight.toFixed(2)}m`
      : "--";

    // Draw metrics starting from left edge with wider column spacing
    const metricsStartX = cardX + 60; // Increased gap to 60px from left edge
    const col1X = metricsStartX;
    const col2X = metricsStartX + 220; // Back to 220px spacing
    const col3X = metricsStartX + 440; // Back to 440px spacing (220 + 220)
    const labelY = cardY + 60;
    const valueY = cardY + 130;

    // Draw logo on the right side like a postal stamp - 2x bigger, closer to HEIGHT
    if (this.logoImage) {
      const logoSize = 140;
      const logoX = cardX + cardWidth - logoSize - 15; // Reduced spacing from 30 to 15
      const logoY = cardY + 30;

      // Save current context state
      ctx.save();

      // Set logo opacity to 0.8 for a subtle watermark effect
      ctx.globalAlpha = 1.0;

      // Draw the logo
      ctx.drawImage(this.logoImage, logoX, logoY, logoSize, logoSize);

      // Restore context state
      ctx.restore();
    }

    // Air Time Column - dark gray text on white
    ctx.fillStyle = "#6B7280"; // Medium gray for labels
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText("AIR TIME", col1X, labelY);

    ctx.fillStyle = "#1F2937"; // Dark gray for values
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillText(airTime, col1X, valueY);

    // Rotations Column
    ctx.fillStyle = "#6B7280";
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText("ROTATIONS", col2X, labelY);

    ctx.fillStyle = "#1F2937";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillText(rotations, col2X, valueY);

    // Height Column
    ctx.fillStyle = "#6B7280";
    ctx.font = "28px Arial, sans-serif";
    ctx.fillText("HEIGHT", col3X, labelY);

    ctx.fillStyle = "#1F2937";
    ctx.font = "bold 44px Arial, sans-serif";
    ctx.fillText(height, col3X, valueY);
  }

  /**
   * Draw jump indicator with app-matching button style
   */
  private drawJumpIndicator(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    text: string,
    colorType: "green" | "blue"
  ): void {
    const baseSize = Math.min(canvas.width, canvas.height);
    const indicatorWidth = Math.max(200, baseSize * 0.35);
    const indicatorHeight = Math.max(60, baseSize * 0.08);
    const borderRadius = indicatorHeight / 2; // Rounded corners

    const x = (canvas.width - indicatorWidth) / 2;
    const y = canvas.height * 0.75; // Position towards bottom

    // Create gradient matching app button styles
    const gradient = ctx.createLinearGradient(0, y, 0, y + indicatorHeight);
    if (colorType === "green") {
      // Green gradient for takeoff
      gradient.addColorStop(0, "#A855F7"); // from-purple-500
      gradient.addColorStop(1, "#059669"); // to-green-600
    } else {
      // Blue gradient for landing
      gradient.addColorStop(0, "#3B82F6"); // from-blue-500
      gradient.addColorStop(1, "#2563EB"); // to-blue-600
    }

    // Draw rounded rectangle background (with fallback for older browsers)
    ctx.fillStyle = gradient;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, indicatorWidth, indicatorHeight, borderRadius);
    } else {
      // Fallback for older browsers - simple rectangle
      ctx.rect(x, y, indicatorWidth, indicatorHeight);
    }
    ctx.fill();

    // Add subtle border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, indicatorWidth, indicatorHeight, borderRadius);
    } else {
      ctx.rect(x, y, indicatorWidth, indicatorHeight);
    }
    ctx.stroke();

    // Add shadow effect
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    // Text
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${Math.max(
      16,
      baseSize * 0.035
    )}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(text, canvas.width / 2, y + indicatorHeight / 2 + 6);

    // Reset shadow and text alignment
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.textAlign = "left";
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.canvas = null;
    this.ctx = null;
    this.logoImage = null;
  }
}

export const videoExportService = new VideoExportService();
