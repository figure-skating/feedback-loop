# 🔬 Skeleton Data & Rotation Analysis

This directory contains tools for extracting skeleton data from figure skating videos and testing rotation counting algorithms.

## 📁 Files

- **`extract-skeletons.html`** - Extract skeleton data from sample videos
- **`rotation-algorithms.js`** - Various algorithms for counting rotations
- **`test-algorithms.html`** - Test and compare algorithm performance
- **`README.md`** - This file

## 🚀 Workflow

### Step 1: Extract Skeleton Data
1. Navigate to `/extract-skeletons.html` in your browser
2. Click "Process All Videos" or individual video buttons
3. Wait for MediaPipe to analyze each frame
4. Download the generated JSON files

### Step 2: Save Skeleton Data
Place the downloaded JSON files in this directory with these exact names:
- `skeleton_data_axel.json` (1.5 rotations)
- `skeleton_data_double.json` (2.5 rotations) 
- `skeleton_data_quad.json` (4.5 rotations)

### Step 3: Test Algorithms
1. Navigate to `/skeleton-data/test-algorithms.html`
2. Run tests on individual videos or all at once
3. Compare algorithm accuracy and performance

## 🧮 Available Algorithms

### 1. Shoulder Rotation Analysis
- **Method**: Tracks shoulder line angle changes
- **Pros**: Stable landmarks, clear rotation signal
- **Cons**: May be affected by arm movements

### 2. Hip Rotation Analysis
- **Method**: Tracks hip line angle changes  
- **Pros**: Core body rotation, less arm interference
- **Cons**: Sometimes occluded during jumps

### 3. World Coordinates Analysis
- **Method**: Uses 3D world landmarks for rotation in X-Z plane
- **Pros**: True 3D rotation, more accurate
- **Cons**: Requires good depth estimation

### 4. Combined Approach
- **Method**: Weighted average of shoulder and hip analysis
- **Pros**: More robust, handles occlusions better
- **Cons**: More complex computation

## 📊 Expected Results

| Video | Expected Rotations | Challenge |
|-------|-------------------|-----------|
| Axel | 1.5 | Single rotation + half turn |
| Double Axel+ | 2.5 | Fast rotation, ~2.5 turns |
| Quad Axel | 4.5 | Very fast, 4.5 turns |

## 🔧 Algorithm Development

To create new algorithms:

1. **Add function to `rotation-algorithms.js`**:
```javascript
function analyzeNewMethod(frames) {
    const jumpFrames = frames.filter(f => f.isJumpFrame && f.landmarks);
    // Your algorithm logic here
    return {
        rotations: calculatedRotations,
        confidence: confidenceScore,
        method: 'your_method_name',
        debug: debugData
    };
}
```

2. **Add to test suite**:
```javascript
const algorithms = [
    // ... existing algorithms
    { name: 'Your Method', fn: analyzeNewMethod }
];
```

3. **Test and refine** using the test interface

## 🎯 Optimization Tips

- **Focus on jump frames**: Only analyze frames between takeoff and landing
- **Handle missing data**: Check landmark visibility/confidence
- **Smooth angle transitions**: Handle 180°/-180° wraparound
- **Consider frame rate**: Sample videos are 30fps
- **Validate with ground truth**: Use known rotation counts to tune parameters

## 📈 Performance Metrics

- **Accuracy**: How close to expected rotation count
- **Confidence**: Percentage of frames with valid pose data
- **Robustness**: Performance across different jump types
- **Speed**: Processing time (for real-time applications)

## 🐛 Debugging

Use the debug data returned by algorithms to:
- Visualize angle changes over time
- Identify problematic frames
- Tune parameters for better accuracy
- Understand failure cases

---

*This system allows rapid iteration on rotation detection algorithms using real figure skating data.*