import { useRef, useEffect, useState } from 'react';
import { useAnalysisStore } from '../../store/analysisStore';
import { AngleData } from '../../services/angleAnalysisService';

export type AnalysisPlane = 'sagittal' | 'frontal' | 'transverse';

interface AngleChartProps {
  title: string;
  selectedPlane: AnalysisPlane;
  className?: string;
}

export default function AngleChart({ title, selectedPlane, className = '' }: AngleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    referenceAngles, 
    userAngles, 
    currentTime, 
    userAnalysis, 
    referenceAnalysis,
    virtualTimelineDuration,
    referenceVideoPadding,
    userVideoPadding
  } = useAnalysisStore();
  const [currentAngleValue, setCurrentAngleValue] = useState<number | null>(null);

  // Get real angle data based on the chart type and plane
  const getAngleData = (): { referenceData: number[]; userData: number[] } => {
    if (!referenceAngles || !userAngles) {
      // No angle data available - return fallback data
      return { 
        referenceData: Array(50).fill(0).map((_, i) => 90 + Math.sin(i / 5) * 20),
        userData: Array(50).fill(0).map((_, i) => 85 + Math.sin(i / 4.5) * 25)
      };
    }

    let referenceAngleData: AngleData[] = [];
    let userAngleData: AngleData[] = [];

    // Map chart titles to angle data
    if (selectedPlane === 'sagittal') {
      if (title === 'Left Knee Flexion') {
        referenceAngleData = referenceAngles.leftKneeFlexion;
        userAngleData = userAngles.leftKneeFlexion;
      } else if (title === 'Right Knee Flexion') {
        referenceAngleData = referenceAngles.rightKneeFlexion;
        userAngleData = userAngles.rightKneeFlexion;
      } else if (title === 'Hip Flexion') {
        referenceAngleData = referenceAngles.hipFlexion;
        userAngleData = userAngles.hipFlexion;
      } else if (title === 'Head-Hip Alignment') {
        referenceAngleData = referenceAngles.headHipAlignment;
        userAngleData = userAngles.headHipAlignment;
      }
    } else {
      if (title === 'Weight-Bearing Hip Angle') {
        referenceAngleData = referenceAngles.weightBearingHipAngle;
        userAngleData = userAngles.weightBearingHipAngle;
      } else if (title === 'Shoulder Angle to Ice') {
        referenceAngleData = referenceAngles.shoulderAngleToIce;
        userAngleData = userAngles.shoulderAngleToIce;
      }
    }

    // If we have real data, use it
    if (referenceAngleData.length > 0 && userAngleData.length > 0) {
      // Create chart data with exact angle values mapped to virtual timeline
      const targetLength = 50;
      const referenceChartData = createExactAngleChartData(referenceAngleData, referenceVideoPadding, targetLength);
      const userChartData = createExactAngleChartData(userAngleData, userVideoPadding, targetLength);
      
      return {
        referenceData: referenceChartData,
        userData: userChartData
      };
    }

    // Fall back to mock data if no real data available
    return { 
      referenceData: Array(50).fill(0).map((_, i) => 90 + Math.sin(i / 5) * 20),
      userData: Array(50).fill(0).map((_, i) => 85 + Math.sin(i / 4.5) * 25)
    };
  };

  // Create chart data with exact angle values mapped to virtual timeline
  const createExactAngleChartData = (angleData: AngleData[], paddingDuration: number, targetLength: number): number[] => {
    if (angleData.length === 0) return Array(targetLength).fill(90); // Default angle if no data
    
    // Calculate the virtual timeline duration
    const videoDuration = userAnalysis?.duration || referenceAnalysis?.duration || 1;
    const totalVirtualDuration = virtualTimelineDuration || (videoDuration + Math.max(referenceVideoPadding, userVideoPadding));
    
    const result: number[] = [];
    const firstAngle = angleData[0]?.angle || 90;
    
    // For each chart point, calculate what virtual time it represents
    for (let i = 0; i < targetLength; i++) {
      const virtualTime = (i / (targetLength - 1)) * totalVirtualDuration;
      const actualVideoTime = virtualTime - paddingDuration;
      
      if (actualVideoTime < 0) {
        // In padding area - use first angle (flat line)
        result.push(firstAngle);
      } else if (actualVideoTime > videoDuration) {
        // Past video end - use last angle
        result.push(angleData[angleData.length - 1]?.angle || firstAngle);
      } else {
        // In actual video - find closest angle data by timestamp
        const closestAngleData = angleData.reduce((closest, current) => 
          Math.abs(current.timestamp - actualVideoTime) < Math.abs(closest.timestamp - actualVideoTime)
            ? current : closest
        );
        result.push(closestAngleData.angle);
      }
    }
    
    // Exact angle chart data calculated
    return result;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.fillStyle = '#374151'; // gray-700
    ctx.fillRect(0, 0, width, height);

    // Get real angle data or fallback to mock data
    const { referenceData, userData } = getAngleData();
    
    // Calculate current angle value - use the same logic as chart curve for consistency
    if (userAnalysis && userAngles && userData.length > 0) {
      // Check if we're in the padding area or actual video
      const actualVideoTime = Math.max(0, currentTime - userVideoPadding);
      const userDuration = userAnalysis.duration || 0;
      
      // Only show angle if we're in the actual video (not padding)
      if (actualVideoTime >= 0 && actualVideoTime <= userDuration && currentTime >= userVideoPadding) {
        // Use the same chart curve logic to ensure consistency
        const videoDuration = virtualTimelineDuration || Math.max(
          (referenceAnalysis?.duration || 0) + referenceVideoPadding,
          (userAnalysis?.duration || 0) + userVideoPadding
        );
        
        const timeProgress = Math.min(Math.max(currentTime / videoDuration, 0), 1);
        const curveIndex = Math.round(timeProgress * (userData.length - 1));
        const curveAngle = userData[Math.min(curveIndex, userData.length - 1)];
        
        // Only set if we have a valid angle value
        if (curveAngle !== undefined && !isNaN(curveAngle)) {
          setCurrentAngleValue(Math.round(curveAngle));
        } else {
          setCurrentAngleValue(null);
        }
      } else {
        // In padding area - show no angle value
        setCurrentAngleValue(null);
      }
    } else {
      setCurrentAngleValue(null);
    }
    
    const padding = 20;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    
    // Find data range for scaling
    const allData = [...referenceData, ...userData];
    const minValue = Math.min(...allData);
    const maxValue = Math.max(...allData);
    const range = maxValue - minValue;
    
    // Chart scaling calculated based on data range

    // Helper function to scale data points
    const scaleY = (value: number) => {
      return height - padding - ((value - minValue) / range) * chartHeight;
    };
    
    const scaleX = (index: number) => {
      return padding + (index / (referenceData.length - 1)) * chartWidth;
    };

    // Draw grid lines
    ctx.strokeStyle = '#4B5563'; // gray-600
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding + (i / 4) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
    }
    
    // Vertical grid lines
    for (let i = 0; i <= 4; i++) {
      const x = padding + (i / 4) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding);
      ctx.lineTo(x, height - padding);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw reference curve (purple)
    ctx.strokeStyle = '#A855F7'; // purple-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    referenceData.forEach((value, index) => {
      const x = scaleX(index);
      const y = scaleY(value);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw user curve (blue)
    ctx.strokeStyle = '#3B82F6'; // blue-500
    ctx.lineWidth = 2;
    ctx.beginPath();
    userData.forEach((value, index) => {
      const x = scaleX(index);
      const y = scaleY(value);
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw legend
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    
    // Reference legend
    ctx.fillStyle = '#A855F7';
    ctx.fillRect(padding, padding - 15, 10, 2);
    ctx.fillStyle = '#D1D5DB'; // gray-300
    ctx.fillText('Reference', padding + 15, padding - 8);
    
    // User legend
    ctx.fillStyle = '#3B82F6';
    ctx.fillRect(padding + 80, padding - 15, 10, 2);
    ctx.fillStyle = '#D1D5DB';
    ctx.fillText('Your Jump', padding + 95, padding - 8);

    // Draw current time indicator (vertical line) - RED like in reference
    if (userAnalysis && referenceData.length > 0) {
      // Use virtual timeline duration that includes padding
      const videoDuration = virtualTimelineDuration || Math.max(
        (referenceAnalysis?.duration || 0) + referenceVideoPadding,
        (userAnalysis?.duration || 0) + userVideoPadding
      );
      
      const timeProgress = Math.min(Math.max(currentTime / videoDuration, 0), 1);
      
      // Convert to chart position
      const indicatorX = padding + timeProgress * chartWidth;
      
      // Draw vertical line - RED like in the reference image
      ctx.strokeStyle = '#EF4444'; // red-500 - match reference screenshot
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(indicatorX, padding);
      ctx.lineTo(indicatorX, height - padding);
      ctx.stroke();
      
      // Draw circle at current position on user curve following the exact curve
      if (userData.length > 0) {
        // Find the corresponding point on the chart curve based on timeline position
        const curveIndex = Math.round(timeProgress * (userData.length - 1));
        const curveAngle = userData[Math.min(curveIndex, userData.length - 1)];
        const currentY = scaleY(curveAngle);
        
        // Draw filled circle at current position on the curve
        ctx.fillStyle = '#3B82F6'; // blue-500 matching user curve
        ctx.beginPath();
        ctx.arc(indicatorX, currentY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // White border for visibility
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

  }, [title, selectedPlane, referenceAngles, userAngles, currentTime, userAnalysis, virtualTimelineDuration, referenceVideoPadding, userVideoPadding]);

  return (
    <div className={`bg-gray-800 rounded-lg border border-gray-600 p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white text-sm font-medium">{title}</h3>
        {currentAngleValue !== null && (
          <div className="text-2xl font-bold text-white">
            {currentAngleValue}°
          </div>
        )}
      </div>
      <div className="h-full">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ width: '100%', height: 'calc(100% - 3rem)' }}
        />
      </div>
    </div>
  );
}