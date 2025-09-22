/**
 * Analyze physics constraints in quad skeleton data
 * - Conservation of angular momentum
 * - Biomechanical rotation acceleration limits
 * - Identify anomalies that could indicate missing tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeQuadPhysics() {
  try {
    // Read the pre-extracted skeleton data
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', 'skeleton_data_quad.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log('🧪 Physics Analysis of Quad Skeleton Data');
    console.log('Expected rotations:', skeletonData.videoInfo.rotations);
    console.log('Jump duration:', skeletonData.videoInfo.landingFrame - skeletonData.videoInfo.takeoffFrame + 1, 'frames');
    console.log('FPS:', skeletonData.videoInfo.fps);

    const takeoffFrame = skeletonData.videoInfo.takeoffFrame;
    const landingFrame = skeletonData.videoInfo.landingFrame;

    // Filter jump frames with valid worldLandmarks
    const jumpFrames = skeletonData.frames.filter(frame => {
      return frame.frame >= takeoffFrame &&
             frame.frame <= landingFrame &&
             frame.worldLandmarks &&
             frame.worldLandmarks.length > 0;
    });

    console.log('\n📊 Data Quality:');
    console.log('Jump frames with pose data:', jumpFrames.length);
    console.log('Frame coverage:', `${jumpFrames[0].frame} to ${jumpFrames[jumpFrames.length-1].frame}`);

    // Calculate shoulder angles and velocities
    const frameData = [];
    jumpFrames.forEach((frame, index) => {
      const leftShoulder = frame.worldLandmarks[11];
      const rightShoulder = frame.worldLandmarks[12];

      if (leftShoulder && rightShoulder) {
        const dx = rightShoulder.x - leftShoulder.x;
        const dz = rightShoulder.z - leftShoulder.z;
        const angle = Math.atan2(dz, dx) * (180 / Math.PI);

        // Calculate frame time (30fps)
        const timeSeconds = (frame.frame - takeoffFrame) / skeletonData.videoInfo.fps;

        frameData.push({
          frameIndex: index,
          frameNumber: frame.frame,
          timeSeconds,
          angle,
          angularVelocity: null, // Will calculate next
          angularAcceleration: null // Will calculate next
        });
      }
    });

    // Calculate angular velocities and accelerations
    for (let i = 1; i < frameData.length; i++) {
      const curr = frameData[i];
      const prev = frameData[i-1];

      // Calculate angular velocity (degrees per second)
      let angleDiff = curr.angle - prev.angle;
      // Handle wraparound
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const timeDiff = curr.timeSeconds - prev.timeSeconds;
      curr.angularVelocity = angleDiff / timeDiff; // deg/s
    }

    // Calculate angular accelerations
    for (let i = 2; i < frameData.length; i++) {
      const curr = frameData[i];
      const prev = frameData[i-1];

      if (curr.angularVelocity !== null && prev.angularVelocity !== null) {
        const velocityDiff = curr.angularVelocity - prev.angularVelocity;
        const timeDiff = curr.timeSeconds - prev.timeSeconds;
        curr.angularAcceleration = velocityDiff / timeDiff; // deg/s²
      }
    }

    console.log('\n🌪️ Angular Velocity Analysis:');
    const validVelocities = frameData.filter(f => f.angularVelocity !== null).map(f => f.angularVelocity);
    const avgVelocity = validVelocities.reduce((sum, v) => sum + Math.abs(v), 0) / validVelocities.length;
    const maxVelocity = Math.max(...validVelocities.map(Math.abs));
    const minVelocity = Math.min(...validVelocities.map(Math.abs));

    console.log('Average angular velocity:', avgVelocity.toFixed(1), 'deg/s');
    console.log('Max angular velocity:', maxVelocity.toFixed(1), 'deg/s');
    console.log('Min angular velocity:', minVelocity.toFixed(1), 'deg/s');
    console.log('Velocity variation (max/min):', (maxVelocity/minVelocity).toFixed(2));

    // Expected velocity for 4.5 rotations
    const jumpDurationSeconds = (landingFrame - takeoffFrame) / skeletonData.videoInfo.fps;
    const expectedVelocity = (4.5 * 360) / jumpDurationSeconds;
    console.log('Expected velocity for 4.5 rotations:', expectedVelocity.toFixed(1), 'deg/s');
    console.log('Velocity deficit:', ((expectedVelocity - avgVelocity) / expectedVelocity * 100).toFixed(1), '%');

    console.log('\n⚡ Angular Acceleration Analysis:');
    const validAccelerations = frameData.filter(f => f.angularAcceleration !== null).map(f => f.angularAcceleration);
    const avgAcceleration = validAccelerations.reduce((sum, a) => sum + Math.abs(a), 0) / validAccelerations.length;
    const maxAcceleration = Math.max(...validAccelerations.map(Math.abs));

    console.log('Average angular acceleration:', avgAcceleration.toFixed(0), 'deg/s²');
    console.log('Max angular acceleration:', maxAcceleration.toFixed(0), 'deg/s²');

    // Biomechanical limits (rough estimates based on sports science)
    const maxHumanRotationVel = 2000; // deg/s (very rough estimate)
    const maxHumanRotationAcc = 10000; // deg/s² (very rough estimate)

    console.log('\n🏃 Biomechanical Analysis:');
    console.log('Velocities exceeding human limits:', validVelocities.filter(v => Math.abs(v) > maxHumanRotationVel).length);
    console.log('Accelerations exceeding human limits:', validAccelerations.filter(a => Math.abs(a) > maxHumanRotationAcc).length);

    // Look for gaps or anomalies that suggest missing tracking
    console.log('\n🔍 Tracking Quality Analysis:');
    const velocityOutliers = validVelocities.filter(v => Math.abs(v) > avgVelocity * 3);
    const accelerationOutliers = validAccelerations.filter(a => Math.abs(a) > avgAcceleration * 3);

    console.log('Velocity outliers (>3x average):', velocityOutliers.length);
    console.log('Acceleration outliers (>3x average):', accelerationOutliers.length);

    // Conservation of angular momentum check
    console.log('\n⚖️ Angular Momentum Conservation:');
    console.log('Expected: Relatively constant velocity during air phase');
    console.log('Actual velocity standard deviation:', Math.sqrt(validVelocities.reduce((sum, v) => sum + (v - avgVelocity)**2, 0) / validVelocities.length).toFixed(1), 'deg/s');
    console.log('Coefficient of variation:', (Math.sqrt(validVelocities.reduce((sum, v) => sum + (v - avgVelocity)**2, 0) / validVelocities.length) / avgVelocity * 100).toFixed(1), '%');

    // Show time series for visual inspection
    console.log('\n📈 Time Series (first 10 and last 5 frames):');
    console.log('Frame | Time(s) | Angle(°) | Velocity(°/s) | Acceleration(°/s²)');
    console.log('------|---------|----------|---------------|------------------');

    frameData.forEach((data, i) => {
      if (i < 10 || i >= frameData.length - 5) {
        console.log(
          `${data.frameNumber.toString().padStart(5)} | ${data.timeSeconds.toFixed(3).padStart(7)} | ${data.angle.toFixed(1).padStart(8)} | ${(data.angularVelocity || 0).toFixed(1).padStart(13)} | ${(data.angularAcceleration || 0).toFixed(0).padStart(16)}`
        );
      }
    });

    // Physics-based rotation estimation
    console.log('\n🎯 Physics-Based Estimation:');
    console.log('If we assume constant average velocity...');
    const physicsRotations = (avgVelocity * jumpDurationSeconds) / 360;
    console.log('Estimated rotations:', physicsRotations.toFixed(3));
    console.log('vs Algorithm result: 3.096');
    console.log('vs Expected: 4.5');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeQuadPhysics();