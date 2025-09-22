/**
 * Test the rotation algorithm on pre-extracted quad skeleton data
 * This will help us understand what the algorithm should return vs what we're getting
 */

// Load the skeleton data (would need to copy the analyzeWorldRotation function here)
// For now, let's just check the frame count and structure

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testQuadRotation() {
  try {
    // Read the pre-extracted skeleton data
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', 'skeleton_data_quad.json');
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log('📊 Quad Skeleton Data Analysis:');
    console.log('Video Info:', skeletonData.videoInfo);
    console.log('Total frames:', skeletonData.frames.length);

    // Find jump frames (takeoff to landing)
    const takeoffFrame = skeletonData.videoInfo.takeoffFrame;
    const landingFrame = skeletonData.videoInfo.landingFrame;

    console.log(`Jump frames: ${takeoffFrame} to ${landingFrame} (${landingFrame - takeoffFrame + 1} frames)`);

    // Filter frames that have worldLandmarks and are jump frames
    const jumpFrames = skeletonData.frames.filter(frame => {
      return frame.frame >= takeoffFrame &&
             frame.frame <= landingFrame &&
             frame.worldLandmarks &&
             frame.worldLandmarks.length > 0;
    });

    console.log('Jump frames with worldLandmarks:', jumpFrames.length);

    if (jumpFrames.length > 0) {
      console.log('First jump frame:', jumpFrames[0].frame);
      console.log('Last jump frame:', jumpFrames[jumpFrames.length - 1].frame);

      // Check shoulder landmarks (11 = left shoulder, 12 = right shoulder)
      let validShoulderFrames = 0;
      jumpFrames.forEach(frame => {
        const leftShoulder = frame.worldLandmarks[11];
        const rightShoulder = frame.worldLandmarks[12];
        if (leftShoulder && rightShoulder) {
          validShoulderFrames++;
        }
      });

      console.log('Frames with valid shoulder landmarks:', validShoulderFrames);

      // Simple rotation calculation (matching our algorithm)
      const angles = [];
      jumpFrames.forEach((frame, index) => {
        const leftShoulder = frame.worldLandmarks[11];
        const rightShoulder = frame.worldLandmarks[12];

        if (leftShoulder && rightShoulder) {
          const dx = rightShoulder.x - leftShoulder.x;
          const dz = rightShoulder.z - leftShoulder.z;
          const angle = Math.atan2(dz, dx) * (180 / Math.PI);
          angles.push(angle);

          // Debug: Show angle progression for first and last few frames
          if (index < 5 || index >= jumpFrames.length - 5) {
            console.log(`Frame ${frame.frame}: angle = ${angle.toFixed(2)}°`);
          }
        }
      });

      if (angles.length >= 2) {
        let totalRotation = 0;
        let lastAngle = angles[0];

        for (let i = 1; i < angles.length; i++) {
          let angleDiff = angles[i] - lastAngle;

          // Handle angle wraparound
          if (angleDiff > 180) angleDiff -= 360;
          if (angleDiff < -180) angleDiff += 360;

          totalRotation += angleDiff;
          lastAngle = angles[i];
        }

        const rotations = Math.abs(totalRotation) / 360;

        console.log('🔄 Rotation Analysis Results:');
        console.log('Angles extracted:', angles.length);
        console.log('First angle:', angles[0].toFixed(2), '°');
        console.log('Last angle:', angles[angles.length-1].toFixed(2), '°');
        console.log('Raw angle difference:', (angles[angles.length-1] - angles[0]).toFixed(2), '°');
        console.log('Total rotation (degrees):', totalRotation);
        console.log('Calculated rotations:', rotations.toFixed(3));
        console.log('Expected rotations:', skeletonData.videoInfo.rotations);
        console.log('Difference:', (skeletonData.videoInfo.rotations - rotations).toFixed(3));
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testQuadRotation();