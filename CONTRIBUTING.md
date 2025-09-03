# Contributing to Feedback Loop

Thank you for your interest in contributing to Feedback Loop! This project aims to help figure skaters and coaches improve technique through AI-powered video analysis.

## 🌟 Ways to Contribute

### 🏆 For Sports Enthusiasts
- Test with real figure skating videos and provide feedback
- Suggest new metrics or analysis features
- Help identify common jumping technique issues to address
- Contribute domain expertise about figure skating biomechanics

### 💻 For Developers
- Improve UI/UX and mobile responsiveness
- Enhance video processing performance
- Add new visualization features
- Fix bugs and improve code quality

### 🤖 For AI/ML Engineers
- Optimize MediaPipe pose detection accuracy
- Develop new biomechanical metrics algorithms
- Improve frame synchronization and timing
- Add support for different sports or movements

### 📱 For Mobile Developers
- Test and optimize mobile experience
- Improve touch interactions and gestures
- Add PWA features for offline functionality
- Optimize for different screen sizes and devices

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Git for version control
- Modern browser with WebGL support
- Basic understanding of React and TypeScript (for code contributions)

### Development Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/yourusername/feedback-loop.git
   cd feedback-loop
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:5173`

### Making Changes

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Test thoroughly**:
   ```bash
   npm run type-check  # Check TypeScript
   npm run build       # Test production build
   ```

4. **Commit with clear messages**:
   ```bash
   git commit -m "Add: clear description of what you added"
   ```

5. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request** on GitHub

## 📋 Code Standards

### TypeScript
- Use strict TypeScript settings
- Define interfaces for all props and data structures
- Avoid `any` types - use proper typing
- Use meaningful variable and function names

### React Components
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use proper error boundaries for robustness

### Code Style
- Follow existing naming conventions
- Use consistent indentation (2 spaces)
- Add comments for complex algorithms
- Keep functions small and focused

### Performance
- Optimize for mobile devices
- Use React.memo for expensive renders
- Implement proper cleanup in useEffect
- Consider memory usage with large video files

## 🧪 Testing Guidelines

### Manual Testing
- Test on both desktop and mobile devices
- Verify video upload with different formats
- Test the complete analysis workflow
- Check performance with real skating videos

### Code Testing
- Test TypeScript compilation: `npm run type-check`
- Test production build: `npm run build`
- Verify no console errors in browser
- Test offline functionality (PWA features)

## 📝 Pull Request Process

### Before Submitting
- [ ] Code follows project standards
- [ ] Changes work on both desktop and mobile
- [ ] TypeScript compilation passes
- [ ] No new console errors or warnings
- [ ] Performance impact considered

### PR Description Template
```markdown
## What does this PR do?
Brief description of changes and motivation.

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Performance improvement
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested on desktop browser
- [ ] Tested on mobile device
- [ ] TypeScript checks pass
- [ ] Production build works

## Screenshots (if UI changes)
[Add screenshots or GIFs showing the changes]
```

### Review Process
1. Maintainers will review your PR within a few days
2. Address any feedback or requested changes
3. Once approved, your PR will be merged
4. Your contribution will be credited in releases

## 🐛 Bug Reports

### Before Reporting
- Check if the issue already exists
- Test on the latest version
- Gather reproduction steps

### Bug Report Template
```markdown
**Describe the bug**
Clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- Device: [e.g. iPhone 12, Desktop]
- Browser: [e.g. Safari, Chrome]
- Version: [e.g. iOS 15.1]
```

## 💡 Feature Requests

We welcome feature suggestions! Please include:

- **Problem**: What problem does this solve?
- **Solution**: Your proposed solution
- **Alternatives**: Alternative solutions considered
- **Use Case**: Real-world scenarios where this helps
- **Priority**: How important is this feature?

## 🏗️ Project Architecture

### Key Files
- `src/store/analysisStore.ts` - Main state management
- `src/services/videoAnalysisService.ts` - Video processing
- `src/components/Video/VideoPlayer.tsx` - Video playback with overlays
- `src/services/mediapipe/poseDetector.ts` - AI pose detection

### Understanding the Codebase
- **Store**: Zustand for reactive state management
- **MediaPipe**: AI pose detection with Canvas rendering
- **Video**: HTML5 Video API with synchronized overlays
- **Mobile**: Touch-optimized responsive design

## 🤔 Questions?

- **General Questions**: Open a [Discussion](https://github.com/figure-skating/feedback-loop/discussions)
- **Bug Reports**: Create an [Issue](https://github.com/figure-skating/feedback-loop/issues)
- **Feature Ideas**: Start with a Discussion, then create an Issue

## 🎯 Current Priority Areas

We're especially looking for help with:

1. **Real-world Testing**: Using actual figure skating videos
2. **Mobile Optimization**: iOS Safari and Android Chrome testing
3. **Performance**: Optimizing MediaPipe processing speed
4. **New Metrics**: Additional biomechanical analysis features
5. **Documentation**: User guides and technical documentation

## 📜 Code of Conduct

### Our Commitment
We're committed to providing a welcoming and inclusive experience for everyone, regardless of background or experience level.

### Expected Behavior
- Be respectful and inclusive in communications
- Focus on constructive feedback and solutions
- Help others learn and grow in the community
- Celebrate diversity of perspectives and approaches

### Unacceptable Behavior
- Harassment, discrimination, or inappropriate conduct
- Destructive criticism without constructive alternatives
- Spam, self-promotion, or off-topic discussions

---

**Thank you for contributing to Feedback Loop!** 

Your contributions help make figure skating technique analysis accessible to skaters and coaches worldwide. ⛸️✨