/**
 * Analyze takeoff-to-landing rotation using clear frames as anchors
 * - Use stable takeoff/landing frames to determine total rotation
 * - Detect AI model "instantaneous fixes" during blurry phases
 * - Test adding full rotations to compensate for missed tracking
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeTakeoffLanding() {
  try {
    // Read the pre-extracted skeleton data
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', 'skeleton_data_quad.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log('🎯 Takeoff-Landing Anchor Analysis');
    console.log('Expected rotations:', skeletonData.videoInfo.rotations);

    const takeoffFrame = skeletonData.videoInfo.takeoffFrame;
    const landingFrame = skeletonData.videoInfo.landingFrame;

    // Get takeoff and landing frame data
    const takeoffFrameData = skeletonData.frames.find(f => f.frame === takeoffFrame);
    const landingFrameData = skeletonData.frames.find(f => f.frame === landingFrame);

    if (!takeoffFrameData?.worldLandmarks || !landingFrameData?.worldLandmarks) {
      console.error('Missing pose data for takeoff or landing frame');
      return;
    }

    // Calculate shoulder angles for takeoff and landing
    function getShoulderAngle(frameData) {
      const leftShoulder = frameData.worldLandmarks[11];
      const rightShoulder = frameData.worldLandmarks[12];
      if (!leftShoulder || !rightShoulder) return null;

      const dx = rightShoulder.x - leftShoulder.x;
      const dz = rightShoulder.z - leftShoulder.z;
      return Math.atan2(dz, dx) * (180 / Math.PI);
    }

    const takeoffAngle = getShoulderAngle(takeoffFrameData);
    const landingAngle = getShoulderAngle(landingFrameData);

    console.log('\n📐 Anchor Frame Analysis:');
    console.log('Takeoff frame:', takeoffFrame, '- Angle:', takeoffAngle?.toFixed(2), '°');
    console.log('Landing frame:', landingFrame, '- Angle:', landingAngle?.toFixed(2), '°');

    if (takeoffAngle !== null && landingAngle !== null) {
      // Raw angle difference
      let rawDifference = landingAngle - takeoffAngle;
      console.log('Raw angle difference:', rawDifference.toFixed(2), '°');

      // Handle wraparound for the basic difference
      if (rawDifference > 180) rawDifference -= 360;
      if (rawDifference < -180) rawDifference += 360;
      console.log('Wrapped difference:', rawDifference.toFixed(2), '°');

      // Determine possible rotation counts
      console.log('\n🔄 Rotation Possibilities:');
      const baseDifference = Math.abs(rawDifference);
      const possibleRotations = [];

      // Test 0.5, 1.5, 2.5, 3.5, 4.5 rotations
      for (let n = 0.5; n <= 5.5; n += 1.0) {
        const expectedDiff = n * 360 + baseDifference;
        const actualDiff = n * 360 + Math.abs(rawDifference);
        possibleRotations.push({
          rotations: n,
          expectedAngleDiff: expectedDiff,
          error: Math.abs(expectedDiff - (4.5 * 360))  // Error vs expected 4.5
        });
      }

      possibleRotations.forEach(p => {
        console.log(`${p.rotations} rotations: ${p.expectedAngleDiff.toFixed(1)}° (error: ${p.error.toFixed(1)}°)`);
      });

      // Find best match for 4.5 rotations
      const expected4_5 = 4.5 * 360; // 1620°
      const bestMatch = possibleRotations.reduce((best, curr) =>
        curr.error < best.error ? curr : best
      );

      console.log('\nBest match for expected rotation:', bestMatch.rotations, 'rotations');

      // Now analyze the journey between takeoff and landing
      console.log('\n🛣️ Journey Analysis (detecting AI fixes):');

      const allFrames = skeletonData.frames.filter(frame => {
        return frame.frame >= takeoffFrame &&
               frame.frame <= landingFrame &&
               frame.worldLandmarks &&
               frame.worldLandmarks.length > 0;
      });

      const angles = [];
      const frameNumbers = [];

      allFrames.forEach(frame => {
        const angle = getShoulderAngle(frame);
        if (angle !== null) {
          angles.push(angle);
          frameNumbers.push(frame.frame);
        }
      });

      // Look for instantaneous jumps (AI model fixes)
      console.log('Detecting sudden angle jumps (AI fixes):');
      let jumpCount = 0;
      let totalMissedRotation = 0;

      for (let i = 1; i < angles.length; i++) {
        let angleDiff = angles[i] - angles[i-1];

        // Normalize
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        const absJump = Math.abs(angleDiff);

        // Detect suspiciously large jumps (likely AI fixes)
        if (absJump > 90) { // More than quarter rotation between frames
          const framesGap = frameNumbers[i] - frameNumbers[i-1];
          const expectedMaxJump = 60 * framesGap; // Reasonable max rotation per frame

          if (absJump > expectedMaxJump) {
            console.log(`Frame ${frameNumbers[i-1]} → ${frameNumbers[i]}: Jump ${absJump.toFixed(1)}° (${framesGap} frames apart)`);
            jumpCount++;

            // Estimate missed rotation
            const missedRotation = Math.floor(absJump / 360);
            if (missedRotation > 0) {
              console.log(`  → Likely missed ${missedRotation} full rotation(s)`);
              totalMissedRotation += missedRotation;
            }
          }
        }
      }

      console.log('\nSummary:');
      console.log('Suspicious AI fixes detected:', jumpCount);
      console.log('Estimated missed rotations:', totalMissedRotation);

      // Test adding missed rotations
      console.log('\n🧪 Compensation Test:');
      const currentAlgorithm = 3.096; // From previous test
      const withCompensation = currentAlgorithm + totalMissedRotation;
      console.log('Current algorithm result:', currentAlgorithm);
      console.log('With compensation (+' + totalMissedRotation + '):', withCompensation);
      console.log('Expected:', 4.5);
      console.log('Improvement:', ((withCompensation - currentAlgorithm) / (4.5 - currentAlgorithm) * 100).toFixed(1) + '%');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

analyzeTakeoffLanding();