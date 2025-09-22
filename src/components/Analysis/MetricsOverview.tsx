import { useAnalysisStore } from '../../store/analysisStore';

export default function MetricsOverview() {
  const { referenceMetrics, userMetrics, manualMarkers, referenceVideo, userVideo } = useAnalysisStore();
  
  // Calculate comparison values
  const airTimeDiff = (userMetrics?.airTime && referenceMetrics?.airTime)
    ? userMetrics.airTime - referenceMetrics.airTime
    : null;
  
  const rotationsDiff = (userMetrics && userMetrics.rotations !== null && referenceMetrics && referenceMetrics.rotations !== null) 
    ? userMetrics.rotations - referenceMetrics.rotations 
    : null;
  
  const heightDiff = (userMetrics?.maxHeight && referenceMetrics?.maxHeight) 
    ? userMetrics.maxHeight - referenceMetrics.maxHeight 
    : null;

  const formatTime = (time: number | null) => {
    if (time === null) return '--';
    return `${time.toFixed(2)}s`;
  };

  const formatRotations = (rotations: number | null) => {
    if (rotations === null) return '--';
    return rotations.toFixed(1);
  };

  const formatHeight = (height: number | null) => {
    if (height === null) return '--';
    return `${(height * 100).toFixed(0)}cm`; // Convert meters to cm
  };

  const formatDiff = (diff: number | null, unit: string, decimals: number = 2) => {
    if (diff === null) return null;
    const sign = diff > 0 ? '+' : '';
    if (unit === 'cm') {
      return `${sign}${(diff * 100).toFixed(0)}${unit}`;
    }
    return `${sign}${diff.toFixed(decimals)}${unit}`;
  };

  const getChangeClass = (diff: number | null) => {
    if (diff === null) return '';
    return diff > 0 ? 'text-green-400' : diff < 0 ? 'text-red-400' : 'text-gray-400';
  };

  // Only show metrics if we have manual markers and both videos
  if (!manualMarkers || !userMetrics || !referenceVideo || !userVideo) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📊</span>
          <span className="text-white text-base font-semibold">Jump Analysis</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">AIR TIME</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">ROTATIONS</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
          <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
            <div className="text-gray-400 text-xs mb-1">HEIGHT</div>
            <div className="text-white text-2xl font-bold">--</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-4 border border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📊</span>
        <span className="text-white text-base font-semibold">Jump Analysis</span>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {/* Air Time */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">Air Time</div>
          <div className="text-white text-xl font-bold">
            {formatTime(userMetrics.airTime)}
          </div>
          {airTimeDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(airTimeDiff)}`}>
              {formatDiff(airTimeDiff, 's')}
            </div>
          )}
        </div>

        {/* Rotations */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">Rotations</div>
          <div className="text-white text-xl font-bold">
            {formatRotations(userMetrics.rotations)}
          </div>
          {rotationsDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(rotationsDiff)}`}>
              {formatDiff(rotationsDiff, '', 1)}
            </div>
          )}
        </div>

        {/* Height */}
        <div className="bg-black bg-opacity-40 rounded-xl p-3 text-center">
          <div className="text-gray-400 text-xs mb-1">Height</div>
          <div className="text-white text-xl font-bold">
            {formatHeight(userMetrics.maxHeight)}
          </div>
          {heightDiff !== null && (
            <div className={`text-xs mt-1 font-semibold ${getChangeClass(heightDiff)}`}>
              {formatDiff(heightDiff, 'cm')}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}