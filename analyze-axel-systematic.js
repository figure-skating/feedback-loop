/**
 * Systematic frame-by-frame analysis of single axel
 * - Track exact angle progression
 * - Monitor rotation direction consistency
 * - Document rotation speed evolution
 * - Identify any anomalies or patterns
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeAxelSystematic() {
  try {
    // Read the single axel skeleton data
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', 'skeleton_data_axel.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log('🔬 SYSTEMATIC SINGLE AXEL ANALYSIS');
    console.log('===================================');
    console.log('Expected rotations:', skeletonData.videoInfo.rotations);
    console.log('Takeoff frame:', skeletonData.videoInfo.takeoffFrame);
    console.log('Landing frame:', skeletonData.videoInfo.landingFrame);
    console.log('Duration:', skeletonData.videoInfo.landingFrame - skeletonData.videoInfo.takeoffFrame + 1, 'frames');
    console.log('FPS:', skeletonData.videoInfo.fps);

    const takeoffFrame = skeletonData.videoInfo.takeoffFrame;
    const landingFrame = skeletonData.videoInfo.landingFrame;

    // Get shoulder angle function
    function getShoulderAngle(frame) {
      const leftShoulder = frame.worldLandmarks[11];
      const rightShoulder = frame.worldLandmarks[12];
      if (!leftShoulder || !rightShoulder) return null;

      const dx = rightShoulder.x - leftShoulder.x;
      const dz = rightShoulder.z - leftShoulder.z;
      return Math.atan2(dz, dx) * (180 / Math.PI);
    }

    // Filter and process all jump frames
    const jumpFrames = skeletonData.frames.filter(frame => {
      return frame.frame >= takeoffFrame &&
             frame.frame <= landingFrame &&
             frame.worldLandmarks &&
             frame.worldLandmarks.length > 0;
    });

    console.log('\n📊 FRAME DATA EXTRACTION:');
    console.log('Jump frames with pose data:', jumpFrames.length);
    console.log('Coverage:', jumpFrames.length / ((landingFrame - takeoffFrame) + 1) * 100, '% of expected frames');

    // Extract detailed frame data
    const frameData = [];
    jumpFrames.forEach((frame, index) => {
      const angle = getShoulderAngle(frame);
      if (angle !== null) {
        const timeSeconds = (frame.frame - takeoffFrame) / skeletonData.videoInfo.fps;
        frameData.push({
          index,
          frameNumber: frame.frame,
          timeSeconds: timeSeconds.toFixed(3),
          angle: angle.toFixed(2),
          angleRaw: angle,
          angleDiff: null,
          angularVelocity: null,
          rotationDirection: null,
          cumulativeRotation: 0
        });
      }
    });

    // Calculate frame-by-frame differences and velocities
    let cumulativeRotation = 0;

    for (let i = 1; i < frameData.length; i++) {
      const curr = frameData[i];
      const prev = frameData[i-1];

      // Calculate angle difference with wraparound handling
      let angleDiff = curr.angleRaw - prev.angleRaw;

      // Handle wraparound (-180° to +180° boundary)
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      curr.angleDiff = angleDiff.toFixed(2);

      // Accumulate rotation
      cumulativeRotation += angleDiff;
      curr.cumulativeRotation = cumulativeRotation.toFixed(1);

      // Calculate angular velocity (degrees per second)
      const timeDiff = curr.timeSeconds - prev.timeSeconds;
      const velocity = angleDiff / timeDiff;
      curr.angularVelocity = velocity.toFixed(1);

      // Determine rotation direction
      if (Math.abs(angleDiff) > 5) { // Ignore small noise
        curr.rotationDirection = angleDiff > 0 ? 'CCW' : 'CW ';
      } else {
        curr.rotationDirection = '---';
      }
    }

    console.log('\n🎬 FRAME-BY-FRAME ANALYSIS:');
    console.log('Frame | Time(s) | Angle(°) | Diff(°) | Velocity(°/s) | Direction | Cumulative(°)');
    console.log('------|---------|----------|---------|---------------|-----------|-------------');

    frameData.forEach(data => {
      console.log(
        `${data.frameNumber.toString().padStart(5)} | ${data.timeSeconds.padStart(7)} | ${data.angle.padStart(8)} | ${(data.angleDiff || '0.00').padStart(7)} | ${(data.angularVelocity || '0.0').padStart(13)} | ${data.rotationDirection || '---'} | ${data.cumulativeRotation.toString().padStart(11)}`
      );
    });

    console.log('\n🌪️ ROTATION ANALYSIS:');

    // Direction consistency
    const directionChanges = frameData.filter(f => f.rotationDirection).slice(1);
    let directionSwitches = 0;
    let primaryDirection = null;

    directionChanges.forEach((frame, i) => {
      if (i === 0) {
        primaryDirection = frame.rotationDirection;
      } else if (frame.rotationDirection !== '---' && frame.rotationDirection !== primaryDirection) {
        directionSwitches++;
        primaryDirection = frame.rotationDirection; // Update primary
      }
    });

    console.log('Direction consistency:');
    console.log('- Primary direction:', primaryDirection || 'Unknown');
    console.log('- Direction switches:', directionSwitches);
    console.log('- Consistency:', directionSwitches === 0 ? '✅ Perfect' : `❌ ${directionSwitches} switches`);

    // Speed evolution
    const velocities = frameData.filter(f => f.angularVelocity).map(f => parseFloat(f.angularVelocity));
    const avgVelocity = velocities.reduce((sum, v) => sum + Math.abs(v), 0) / velocities.length;
    const maxVelocity = Math.max(...velocities.map(Math.abs));
    const minVelocity = Math.min(...velocities.map(v => Math.abs(v)));

    console.log('\nSpeed evolution:');
    console.log('- Average speed:', avgVelocity.toFixed(1), '°/s');
    console.log('- Peak speed:', maxVelocity.toFixed(1), '°/s');
    console.log('- Minimum speed:', minVelocity.toFixed(1), '°/s');
    console.log('- Speed variation (max/avg):', (maxVelocity / avgVelocity).toFixed(2));

    // Total rotation calculation
    const finalCumulative = parseFloat(frameData[frameData.length - 1].cumulativeRotation);
    const calculatedRotations = Math.abs(finalCumulative) / 360;

    console.log('\nTotal rotation:');
    console.log('- Cumulative angle change:', finalCumulative.toFixed(1), '°');
    console.log('- Calculated rotations:', calculatedRotations.toFixed(3));
    console.log('- Expected rotations:', skeletonData.videoInfo.rotations);
    console.log('- Accuracy:', (calculatedRotations / skeletonData.videoInfo.rotations * 100).toFixed(1), '%');

    // Physics check
    const jumpDurationSeconds = (landingFrame - takeoffFrame) / skeletonData.videoInfo.fps;
    const expectedVelocity = (skeletonData.videoInfo.rotations * 360) / jumpDurationSeconds;

    console.log('\nPhysics check:');
    console.log('- Jump duration:', jumpDurationSeconds.toFixed(3), 's');
    console.log('- Expected avg velocity:', expectedVelocity.toFixed(1), '°/s');
    console.log('- Actual avg velocity:', avgVelocity.toFixed(1), '°/s');
    console.log('- Velocity match:', (avgVelocity / expectedVelocity * 100).toFixed(1), '%');

    // Look for anomalies
    console.log('\n🚨 ANOMALY DETECTION:');

    const largeJumps = frameData.filter(f => f.angleDiff && Math.abs(parseFloat(f.angleDiff)) > 45);
    const speedOutliers = frameData.filter(f => f.angularVelocity && Math.abs(parseFloat(f.angularVelocity)) > avgVelocity * 2);

    console.log('Large angle jumps (>45°):', largeJumps.length);
    if (largeJumps.length > 0) {
      largeJumps.forEach(frame => {
        console.log(`  Frame ${frame.frameNumber}: ${frame.angleDiff}° jump`);
      });
    }

    console.log('Speed outliers (>2x avg):', speedOutliers.length);
    if (speedOutliers.length > 0) {
      speedOutliers.forEach(frame => {
        console.log(`  Frame ${frame.frameNumber}: ${frame.angularVelocity}°/s (${(parseFloat(frame.angularVelocity)/avgVelocity).toFixed(1)}x avg)`);
      });
    }

    console.log('\n✅ SUMMARY:');
    console.log('Direction: ' + (directionSwitches === 0 ? 'Consistent' : 'Inconsistent'));
    console.log('Speed: ' + (speedOutliers.length < 3 ? 'Reasonable' : 'Variable'));
    console.log('Tracking: ' + (largeJumps.length < 2 ? 'Smooth' : 'Jumpy'));
    console.log('Accuracy: ' + ((calculatedRotations / skeletonData.videoInfo.rotations * 100).toFixed(1)) + '%');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeAxelSystematic();