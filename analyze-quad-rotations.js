/**
 * Analyze quad axel to detect individual full rotations and their speeds
 * - Identify each complete 360° rotation
 * - Calculate time/speed for each detected rotation
 * - Detect missing rotations based on speed patterns
 * - Determine if we should add one full rotation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeQuadRotations() {
  try {
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', 'skeleton_data_quad.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log('🎯 QUAD AXEL - INDIVIDUAL ROTATION ANALYSIS');
    console.log('==========================================');
    console.log('Expected rotations:', skeletonData.videoInfo.rotations);
    console.log('Expected: 4.5 full rotations (4 complete + 0.5 partial)');

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

    // Filter jump frames
    const jumpFrames = skeletonData.frames.filter(frame => {
      return frame.frame >= takeoffFrame &&
             frame.frame <= landingFrame &&
             frame.worldLandmarks &&
             frame.worldLandmarks.length > 0;
    });

    console.log('\n📊 DATA PREPARATION:');
    console.log('Jump frames with pose data:', jumpFrames.length);
    console.log('Jump duration:', ((landingFrame - takeoffFrame) / skeletonData.videoInfo.fps).toFixed(3), 's');

    // Extract frame data with cumulative tracking
    const frameData = [];
    let cumulativeRotation = 0;
    let unwrappedAngle = null;

    jumpFrames.forEach((frame, index) => {
      const angle = getShoulderAngle(frame);
      if (angle !== null) {
        const timeSeconds = (frame.frame - takeoffFrame) / skeletonData.videoInfo.fps;

        // Initialize unwrapped angle tracking
        if (unwrappedAngle === null) {
          unwrappedAngle = angle;
        } else {
          // Handle angle wraparound and track cumulative rotation
          let angleDiff = angle - frameData[frameData.length - 1].rawAngle;

          // Correct for wraparound
          if (angleDiff > 180) angleDiff -= 360;
          if (angleDiff < -180) angleDiff += 360;

          cumulativeRotation += angleDiff;
          unwrappedAngle += angleDiff;
        }

        frameData.push({
          index,
          frameNumber: frame.frame,
          timeSeconds: timeSeconds.toFixed(3),
          rawAngle: angle,
          unwrappedAngle: unwrappedAngle.toFixed(2),
          cumulativeRotation: cumulativeRotation.toFixed(2),
          fullRotationsCompleted: Math.floor(Math.abs(cumulativeRotation) / 360)
        });
      }
    });

    // Detect individual full rotations
    console.log('\n🔄 DETECTING INDIVIDUAL FULL ROTATIONS:');

    const rotations = [];
    let currentRotationStart = 0;
    let lastFullRotationCount = 0;

    frameData.forEach((frame, index) => {
      const currentFullRotations = frame.fullRotationsCompleted;

      // New full rotation completed
      if (currentFullRotations > lastFullRotationCount) {
        const rotationNumber = currentFullRotations;
        const startFrame = frameData[currentRotationStart];
        const endFrame = frame;

        const duration = parseFloat(endFrame.timeSeconds) - parseFloat(startFrame.timeSeconds);
        const rotationSpeed = duration > 0 ? 1 / duration : 0; // rotations per second

        rotations.push({
          rotationNumber,
          startFrame: startFrame.frameNumber,
          endFrame: endFrame.frameNumber,
          startTime: parseFloat(startFrame.timeSeconds),
          endTime: parseFloat(endFrame.timeSeconds),
          duration: duration.toFixed(3),
          rotationsPerSecond: rotationSpeed.toFixed(2),
          degreesPerSecond: (360 / duration).toFixed(0)
        });

        // Update for next rotation
        currentRotationStart = index;
        lastFullRotationCount = currentFullRotations;
      }
    });

    console.log('Detected full rotations:', rotations.length);
    console.log('Expected full rotations: 4 (plus 0.5 partial)');

    if (rotations.length > 0) {
      console.log('\nIndividual Rotation Analysis:');
      console.log('Rot# | Start→End Frame | Duration(s) | Speed(rot/s) | Speed(°/s)');
      console.log('-----|-----------------|-------------|--------------|----------');

      rotations.forEach(rot => {
        console.log(
          `  ${rot.rotationNumber}  | ${rot.startFrame.toString().padStart(4)}→${rot.endFrame.toString().padEnd(4)}       | ${rot.duration.padStart(10)} | ${rot.rotationsPerSecond.padStart(11)} | ${rot.degreesPerSecond.padStart(8)}`
        );
      });

      // Speed analysis
      const speeds = rotations.map(r => parseFloat(r.rotationsPerSecond));
      const avgSpeed = speeds.reduce((sum, s) => sum + s, 0) / speeds.length;
      const speedVariation = Math.max(...speeds) / Math.min(...speeds);

      console.log('\n📈 SPEED ANALYSIS:');
      console.log('Average rotation speed:', avgSpeed.toFixed(2), 'rotations/s');
      console.log('Fastest rotation:', Math.max(...speeds).toFixed(2), 'rotations/s');
      console.log('Slowest rotation:', Math.min(...speeds).toFixed(2), 'rotations/s');
      console.log('Speed variation (max/min):', speedVariation.toFixed(2));
      console.log('Speed consistency:', speedVariation < 1.5 ? '✅ Good' : '⚠️ Variable');

      // Estimate total rotation time and missing rotations
      const totalDetectedTime = rotations[rotations.length - 1].endTime - rotations[0].startTime;
      const jumpDurationSeconds = (landingFrame - takeoffFrame) / skeletonData.videoInfo.fps;

      console.log('\n🕐 TIME ANALYSIS:');
      console.log('Time for detected rotations:', totalDetectedTime.toFixed(3), 's');
      console.log('Total jump duration:', jumpDurationSeconds.toFixed(3), 's');
      console.log('Unaccounted time:', (jumpDurationSeconds - totalDetectedTime).toFixed(3), 's');

      // Estimate missing rotations based on average speed
      const expectedRotationsWith_5 = 4.5;
      const expectedTimeFor4_5 = expectedRotationsWith_5 / avgSpeed;
      const missingRotations = (jumpDurationSeconds * avgSpeed) - rotations.length;

      console.log('\n🔮 MISSING ROTATION ESTIMATION:');
      console.log('Expected time for 4.5 rotations at avg speed:', expectedTimeFor4_5.toFixed(3), 's');
      console.log('Actual jump time:', jumpDurationSeconds.toFixed(3), 's');
      console.log('Time-based estimated total rotations:', (jumpDurationSeconds * avgSpeed).toFixed(2));
      console.log('Detected full rotations:', rotations.length);
      console.log('Estimated missing rotations:', missingRotations.toFixed(2));

      console.log('\n💡 RECOMMENDATION:');
      if (missingRotations >= 0.8) {
        console.log('✅ SHOULD ADD 1 FULL ROTATION');
        console.log('Evidence: Time analysis suggests', (missingRotations).toFixed(1), 'missing rotations');
        console.log('This would give us:', rotations.length + 1, '+ 0.5 =', (rotations.length + 1.5), 'total rotations');
      } else if (missingRotations >= 0.3) {
        console.log('⚠️ POSSIBLY MISSING ROTATION');
        console.log('Evidence suggests', missingRotations.toFixed(1), 'missing rotations (borderline)');
      } else {
        console.log('❌ NO MISSING ROTATION');
        console.log('Time analysis suggests we detected most rotations');
      }

    } else {
      console.log('❌ Could not detect individual rotations - pose tracking too poor');
    }

    // Show final frames for reference
    console.log('\n📋 FINAL TRACKING STATE:');
    const finalFrame = frameData[frameData.length - 1];
    console.log('Final cumulative rotation:', finalFrame.cumulativeRotation, '°');
    console.log('Algorithm calculated rotations:', (Math.abs(parseFloat(finalFrame.cumulativeRotation)) / 360).toFixed(3));
    console.log('Expected rotations: 4.5');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeQuadRotations();