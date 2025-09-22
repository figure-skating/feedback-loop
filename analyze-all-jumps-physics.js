/**
 * Compare physics analysis across single axel, double axel, and quad axel
 * - Conservation of angular momentum
 * - Biomechanical limits
 * - AI model tracking quality
 * - Takeoff-landing anchor analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeJumpPhysics(filename, jumpName) {
  try {
    const dataPath = path.join(__dirname, 'public', 'skeleton-data', filename);
    const rawData = fs.readFileSync(dataPath, 'utf8');
    const skeletonData = JSON.parse(rawData);

    console.log(`\n🏆 === ${jumpName.toUpperCase()} ANALYSIS ===`);
    console.log('Expected rotations:', skeletonData.videoInfo.rotations);
    console.log('Jump duration:', skeletonData.videoInfo.landingFrame - skeletonData.videoInfo.takeoffFrame + 1, 'frames');

    const takeoffFrame = skeletonData.videoInfo.takeoffFrame;
    const landingFrame = skeletonData.videoInfo.landingFrame;

    // Filter jump frames with valid worldLandmarks
    const jumpFrames = skeletonData.frames.filter(frame => {
      return frame.frame >= takeoffFrame &&
             frame.frame <= landingFrame &&
             frame.worldLandmarks &&
             frame.worldLandmarks.length > 0;
    });

    console.log('Jump frames with pose data:', jumpFrames.length);

    // Get shoulder angle function
    function getShoulderAngle(frame) {
      const leftShoulder = frame.worldLandmarks[11];
      const rightShoulder = frame.worldLandmarks[12];
      if (!leftShoulder || !rightShoulder) return null;

      const dx = rightShoulder.x - leftShoulder.x;
      const dz = rightShoulder.z - leftShoulder.z;
      return Math.atan2(dz, dx) * (180 / Math.PI);
    }

    // Calculate takeoff-landing anchor analysis
    const takeoffFrameData = jumpFrames.find(f => f.frame === takeoffFrame);
    const landingFrameData = jumpFrames.find(f => f.frame === landingFrame);

    let anchorAnalysis = null;
    if (takeoffFrameData && landingFrameData) {
      const takeoffAngle = getShoulderAngle(takeoffFrameData);
      const landingAngle = getShoulderAngle(landingFrameData);

      if (takeoffAngle !== null && landingAngle !== null) {
        let rawDiff = landingAngle - takeoffAngle;
        if (rawDiff > 180) rawDiff -= 360;
        if (rawDiff < -180) rawDiff += 360;

        const expectedTotalRotation = skeletonData.videoInfo.rotations * 360;
        const anchorTotalRotation = Math.abs(rawDiff) + (Math.floor(skeletonData.videoInfo.rotations) * 360);

        anchorAnalysis = {
          takeoffAngle,
          landingAngle,
          rawDiff,
          anchorTotalRotation,
          expectedTotalRotation,
          anchorError: Math.abs(anchorTotalRotation - expectedTotalRotation)
        };
      }
    }

    // Calculate frame data with physics
    const frameData = [];
    jumpFrames.forEach((frame, index) => {
      const angle = getShoulderAngle(frame);
      if (angle !== null) {
        const timeSeconds = (frame.frame - takeoffFrame) / skeletonData.videoInfo.fps;
        frameData.push({
          frameIndex: index,
          frameNumber: frame.frame,
          timeSeconds,
          angle,
          angularVelocity: null,
          angularAcceleration: null
        });
      }
    });

    // Calculate angular velocities
    for (let i = 1; i < frameData.length; i++) {
      const curr = frameData[i];
      const prev = frameData[i-1];

      let angleDiff = curr.angle - prev.angle;
      if (angleDiff > 180) angleDiff -= 360;
      if (angleDiff < -180) angleDiff += 360;

      const timeDiff = curr.timeSeconds - prev.timeSeconds;
      curr.angularVelocity = angleDiff / timeDiff;
    }

    // Calculate angular accelerations
    for (let i = 2; i < frameData.length; i++) {
      const curr = frameData[i];
      const prev = frameData[i-1];

      if (curr.angularVelocity !== null && prev.angularVelocity !== null) {
        const velocityDiff = curr.angularVelocity - prev.angularVelocity;
        const timeDiff = curr.timeSeconds - prev.timeSeconds;
        curr.angularAcceleration = velocityDiff / timeDiff;
      }
    }

    // Physics analysis
    const validVelocities = frameData.filter(f => f.angularVelocity !== null).map(f => f.angularVelocity);
    const validAccelerations = frameData.filter(f => f.angularAcceleration !== null).map(f => f.angularAcceleration);

    const avgVelocity = validVelocities.reduce((sum, v) => sum + Math.abs(v), 0) / validVelocities.length;
    const maxVelocity = Math.max(...validVelocities.map(Math.abs));
    const velocityStdDev = Math.sqrt(validVelocities.reduce((sum, v) => sum + (Math.abs(v) - avgVelocity)**2, 0) / validVelocities.length);

    const avgAcceleration = validAccelerations.reduce((sum, a) => sum + Math.abs(a), 0) / validAccelerations.length;
    const maxAcceleration = Math.max(...validAccelerations.map(Math.abs));

    // Expected physics
    const jumpDurationSeconds = (landingFrame - takeoffFrame) / skeletonData.videoInfo.fps;
    const expectedVelocity = (skeletonData.videoInfo.rotations * 360) / jumpDurationSeconds;

    // Biomechanical limits
    const maxHumanRotationVel = 2000; // deg/s
    const maxHumanRotationAcc = 10000; // deg/s²
    const velocityViolations = validVelocities.filter(v => Math.abs(v) > maxHumanRotationVel).length;
    const accelerationViolations = validAccelerations.filter(a => Math.abs(a) > maxHumanRotationAcc).length;

    // Tracking quality (detect AI fixes)
    let aiFixCount = 0;
    for (let i = 1; i < frameData.length; i++) {
      const prev = frameData[i-1];
      const curr = frameData[i];

      if (curr.angularVelocity && Math.abs(curr.angularVelocity) > avgVelocity * 3) {
        let angleDiff = curr.angle - prev.angle;
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;

        if (Math.abs(angleDiff) > 90) { // Sudden large jump
          aiFixCount++;
        }
      }
    }

    // Results
    const results = {
      jumpName,
      expectedRotations: skeletonData.videoInfo.rotations,
      frameCount: frameData.length,
      jumpDurationSeconds,

      // Anchor analysis
      anchorWorks: anchorAnalysis ? anchorAnalysis.anchorError < 50 : false,
      anchorError: anchorAnalysis ? anchorAnalysis.anchorError : null,

      // Physics quality
      avgVelocity: avgVelocity.toFixed(1),
      expectedVelocity: expectedVelocity.toFixed(1),
      velocityDeficit: ((expectedVelocity - avgVelocity) / expectedVelocity * 100).toFixed(1),
      velocityConsistency: (velocityStdDev / avgVelocity * 100).toFixed(1), // Lower is better

      // Violations
      velocityViolations,
      accelerationViolations,
      maxVelocity: maxVelocity.toFixed(0),
      maxAcceleration: maxAcceleration.toFixed(0),

      // Tracking quality
      aiFixCount,
      trackingQuality: frameData.length / ((landingFrame - takeoffFrame) + 1) * 100 // % of frames with good tracking
    };

    // Print summary
    console.log('\n📊 PHYSICS SUMMARY:');
    console.log('Anchor method works:', results.anchorWorks ? '✅' : '❌');
    console.log('Velocity consistency (CV%):', results.velocityConsistency, '(lower=better)');
    console.log('Velocity deficit:', results.velocityDeficit + '%');
    console.log('Biomechanical violations:', results.velocityViolations + results.accelerationViolations);
    console.log('AI fixes detected:', results.aiFixCount);
    console.log('Tracking coverage:', results.trackingQuality.toFixed(1) + '%');

    return results;

  } catch (error) {
    console.error(`Error analyzing ${jumpName}:`, error.message);
    return null;
  }
}

async function compareAllJumps() {
  console.log('🔬 COMPARATIVE PHYSICS ANALYSIS');
  console.log('=====================================');

  const jumps = [
    { filename: 'skeleton_data_axel.json', name: 'Single Axel' },
    { filename: 'skeleton_data_double.json', name: 'Double Axel' },
    { filename: 'skeleton_data_quad.json', name: 'Quad Axel' }
  ];

  const results = [];

  for (const jump of jumps) {
    const result = await analyzeJumpPhysics(jump.filename, jump.name);
    if (result) results.push(result);
  }

  console.log('\n\n🏆 COMPARATIVE SUMMARY TABLE');
  console.log('=====================================');
  console.log('Jump Type      | Anchor | Velocity | Bio Viol | AI Fixes | Tracking');
  console.log('               | Works  | Consist% |          |          | Coverage%');
  console.log('---------------|--------|----------|----------|----------|----------');

  results.forEach(r => {
    const anchorIcon = r.anchorWorks ? '✅' : '❌';
    console.log(
      `${r.jumpName.padEnd(14)} | ${anchorIcon.padEnd(6)} | ${r.velocityConsistency.padStart(7)}% | ${(r.velocityViolations + r.accelerationViolations).toString().padStart(8)} | ${r.aiFixCount.toString().padStart(8)} | ${r.trackingQuality.toFixed(1).padStart(8)}%`
    );
  });

  console.log('\n🎯 KEY INSIGHTS:');
  console.log('- Lower Velocity Consistency% = Better physics (more realistic)');
  console.log('- Higher Tracking Coverage% = Better pose detection');
  console.log('- Fewer AI Fixes = More stable tracking');
  console.log('- Fewer Bio Violations = More realistic motion');

  return results;
}

compareAllJumps();