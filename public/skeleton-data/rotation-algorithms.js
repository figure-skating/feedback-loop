/**
 * Rotation Analysis Algorithms for Figure Skating Jumps
 * 
 * This file contains various algorithms to compute rotation count from skeleton data.
 * Use this to test different approaches on pre-extracted skeleton data from sample videos.
 * 
 * Expected rotations:
 * - axel.json: 1.5 rotations (single axel)
 * - double.json: 2.5 rotations (towards double axel)
 * - quad.json: 4.5 rotations (quad axel)
 */

// MediaPipe pose landmark indices
const POSE_LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1,
    LEFT_EYE: 2,
    LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4,
    RIGHT_EYE: 5,
    RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7,
    RIGHT_EAR: 8,
    MOUTH_LEFT: 9,
    MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11,
    RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13,
    RIGHT_ELBOW: 14,
    LEFT_WRIST: 15,
    RIGHT_WRIST: 16,
    LEFT_PINKY: 17,
    RIGHT_PINKY: 18,
    LEFT_INDEX: 19,
    RIGHT_INDEX: 20,
    LEFT_THUMB: 21,
    RIGHT_THUMB: 22,
    LEFT_HIP: 23,
    RIGHT_HIP: 24,
    LEFT_KNEE: 25,
    RIGHT_KNEE: 26,
    LEFT_ANKLE: 27,
    RIGHT_ANKLE: 28,
    LEFT_HEEL: 29,
    RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31,
    RIGHT_FOOT_INDEX: 32
};

/**
 * Algorithm 1: Shoulder Rotation Analysis
 * Uses the shoulder line angle to detect rotations
 */
function analyzeShoulderRotation(frames) {
    const jumpFrames = frames.filter(f => f.isJumpFrame && f.landmarks);
    if (jumpFrames.length < 2) return { rotations: 0, confidence: 0, debug: [] };
    
    const angles = [];
    const debug = [];
    
    jumpFrames.forEach((frame, i) => {
        const leftShoulder = frame.landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = frame.landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        
        if (leftShoulder && rightShoulder) {
            // Calculate shoulder line angle
            const dx = rightShoulder.x - leftShoulder.x;
            const dy = rightShoulder.y - leftShoulder.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            angles.push(angle);
            debug.push({
                frame: frame.frame,
                angle: angle,
                leftShoulder: leftShoulder,
                rightShoulder: rightShoulder
            });
        }
    });
    
    // Count full rotations by tracking angle changes
    let totalRotation = 0;
    let lastAngle = angles[0];
    
    for (let i = 1; i < angles.length; i++) {
        let angleDiff = angles[i] - lastAngle;
        
        // Handle angle wraparound (crossing -180/180 boundary)
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        totalRotation += angleDiff;
        lastAngle = angles[i];
    }
    
    const rotations = Math.abs(totalRotation) / 360;
    
    return {
        rotations: rotations,
        confidence: angles.length / jumpFrames.length, // How many frames had valid data
        method: 'shoulder_rotation',
        debug: debug,
        totalAngleChange: totalRotation
    };
}

/**
 * Algorithm 2: Hip Rotation Analysis  
 * Uses hip line rotation to detect turns
 */
function analyzeHipRotation(frames) {
    const jumpFrames = frames.filter(f => f.isJumpFrame && f.landmarks);
    if (jumpFrames.length < 2) return { rotations: 0, confidence: 0, debug: [] };
    
    const angles = [];
    const debug = [];
    
    jumpFrames.forEach((frame, i) => {
        const leftHip = frame.landmarks[POSE_LANDMARKS.LEFT_HIP];
        const rightHip = frame.landmarks[POSE_LANDMARKS.RIGHT_HIP];
        
        if (leftHip && rightHip) {
            const dx = rightHip.x - leftHip.x;
            const dy = rightHip.y - leftHip.y;
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            
            angles.push(angle);
            debug.push({
                frame: frame.frame,
                angle: angle,
                leftHip: leftHip,
                rightHip: rightHip
            });
        }
    });
    
    let totalRotation = 0;
    let lastAngle = angles[0];
    
    for (let i = 1; i < angles.length; i++) {
        let angleDiff = angles[i] - lastAngle;
        
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        totalRotation += angleDiff;
        lastAngle = angles[i];
    }
    
    const rotations = Math.abs(totalRotation) / 360;
    
    return {
        rotations: rotations,
        confidence: angles.length / jumpFrames.length,
        method: 'hip_rotation',
        debug: debug,
        totalAngleChange: totalRotation
    };
}

/**
 * Algorithm 3: World Coordinates Analysis
 * Uses 3D world landmarks for more accurate rotation detection
 */
function analyzeWorldRotation(frames) {
    const jumpFrames = frames.filter(f => f.isJumpFrame && f.worldLandmarks);
    if (jumpFrames.length < 2) return { rotations: 0, confidence: 0, debug: [] };
    
    const angles = [];
    const debug = [];
    
    jumpFrames.forEach((frame, i) => {
        const leftShoulder = frame.worldLandmarks[POSE_LANDMARKS.LEFT_SHOULDER];
        const rightShoulder = frame.worldLandmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
        
        if (leftShoulder && rightShoulder) {
            // Calculate rotation in world space (X-Z plane)
            const dx = rightShoulder.x - leftShoulder.x;
            const dz = rightShoulder.z - leftShoulder.z;
            const angle = Math.atan2(dz, dx) * (180 / Math.PI);
            
            angles.push(angle);
            debug.push({
                frame: frame.frame,
                angle: angle,
                leftShoulder: leftShoulder,
                rightShoulder: rightShoulder
            });
        }
    });
    
    let totalRotation = 0;
    let lastAngle = angles[0];
    
    for (let i = 1; i < angles.length; i++) {
        let angleDiff = angles[i] - lastAngle;
        
        if (angleDiff > 180) angleDiff -= 360;
        if (angleDiff < -180) angleDiff += 360;
        
        totalRotation += angleDiff;
        lastAngle = angles[i];
    }
    
    const rotations = Math.abs(totalRotation) / 360;
    
    return {
        rotations: rotations,
        confidence: angles.length / jumpFrames.length,
        method: 'world_rotation',
        debug: debug,
        totalAngleChange: totalRotation
    };
}

/**
 * Algorithm 4: Combined Shoulder-Hip Analysis
 * Uses both shoulder and hip data for more robust detection
 */
function analyzeCombinedRotation(frames) {
    const shoulderResult = analyzeShoulderRotation(frames);
    const hipResult = analyzeHipRotation(frames);
    
    if (shoulderResult.confidence === 0 && hipResult.confidence === 0) {
        return { rotations: 0, confidence: 0, debug: [] };
    }
    
    // Weighted average based on confidence
    const totalConfidence = shoulderResult.confidence + hipResult.confidence;
    const combinedRotations = (
        (shoulderResult.rotations * shoulderResult.confidence) +
        (hipResult.rotations * hipResult.confidence)
    ) / totalConfidence;
    
    return {
        rotations: combinedRotations,
        confidence: Math.max(shoulderResult.confidence, hipResult.confidence),
        method: 'combined_shoulder_hip',
        shoulderResult: shoulderResult,
        hipResult: hipResult,
        debug: {
            shoulder: shoulderResult.debug,
            hip: hipResult.debug
        }
    };
}

/**
 * Test all algorithms on a dataset
 */
function testAllAlgorithms(skeletonData) {
    const { videoInfo, frames } = skeletonData;
    const expectedRotations = videoInfo.rotations;
    
    console.log(`\n=== Testing ${videoInfo.name} (Expected: ${expectedRotations} rotations) ===`);
    
    const algorithms = [
        { name: 'Shoulder Rotation', fn: analyzeShoulderRotation },
        { name: 'Hip Rotation', fn: analyzeHipRotation },
        { name: 'World Coordinates', fn: analyzeWorldRotation },
        { name: 'Combined', fn: analyzeCombinedRotation }
    ];
    
    const results = [];
    
    algorithms.forEach(({ name, fn }) => {
        const result = fn(frames);
        const error = Math.abs(result.rotations - expectedRotations);
        const accuracy = Math.max(0, 1 - (error / expectedRotations)) * 100;
        
        console.log(`${name}:`);
        console.log(`  Detected: ${result.rotations.toFixed(2)} rotations`);
        console.log(`  Error: ${error.toFixed(2)}`);
        console.log(`  Accuracy: ${accuracy.toFixed(1)}%`);
        console.log(`  Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        
        results.push({
            algorithm: name,
            detected: result.rotations,
            expected: expectedRotations,
            error: error,
            accuracy: accuracy,
            confidence: result.confidence,
            result: result
        });
    });
    
    return results;
}

/**
 * Load and test skeleton data from JSON file
 */
async function loadAndTest(filename) {
    try {
        const response = await fetch(`/skeleton-data/${filename}`);
        const data = await response.json();
        return testAllAlgorithms(data);
    } catch (error) {
        console.error(`Error loading ${filename}:`, error);
        return null;
    }
}

/**
 * Run complete test suite on all sample videos
 */
async function runTestSuite() {
    console.log('🔬 Running Rotation Algorithm Test Suite');
    console.log('==========================================');
    
    const testFiles = [
        'skeleton_data_axel.json',
        'skeleton_data_double.json', 
        'skeleton_data_quad.json'
    ];
    
    const allResults = [];
    
    for (const filename of testFiles) {
        const results = await loadAndTest(filename);
        if (results) {
            allResults.push(...results);
        }
    }
    
    // Summary statistics
    console.log('\n=== SUMMARY STATISTICS ===');
    const algorithmStats = {};
    
    allResults.forEach(result => {
        if (!algorithmStats[result.algorithm]) {
            algorithmStats[result.algorithm] = {
                totalError: 0,
                totalAccuracy: 0,
                count: 0
            };
        }
        
        algorithmStats[result.algorithm].totalError += result.error;
        algorithmStats[result.algorithm].totalAccuracy += result.accuracy;
        algorithmStats[result.algorithm].count++;
    });
    
    Object.entries(algorithmStats).forEach(([name, stats]) => {
        const avgError = stats.totalError / stats.count;
        const avgAccuracy = stats.totalAccuracy / stats.count;
        
        console.log(`${name}:`);
        console.log(`  Average Error: ${avgError.toFixed(3)} rotations`);
        console.log(`  Average Accuracy: ${avgAccuracy.toFixed(1)}%`);
    });
    
    return allResults;
}

// Export functions for use in browser or Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzeShoulderRotation,
        analyzeHipRotation,
        analyzeWorldRotation,
        analyzeCombinedRotation,
        testAllAlgorithms,
        loadAndTest,
        runTestSuite,
        POSE_LANDMARKS
    };
}