# Claude Code Project Context

This file contains project-specific information to help Claude Code work more effectively with the Feedback Loop figure skating analyzer.

## 🎯 Project Overview

**Name**: Feedback Loop - Figure Skating Jump Analyzer  
**Current Phase**: Phase 1.2 - Core Video Functionality  
**Tech Stack**: React 18 + TypeScript + Vite + Tailwind CSS  
**Target Platform**: Mobile-first PWA (iPhone optimized)  

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Layout/           # App container, status bar, device frame
│   ├── Video/            # Video players, containers, upload
│   ├── Analysis/         # Metrics, charts, timeline (future)
│   └── Controls/         # Buttons, playback controls (future)
├── hooks/                # Custom React hooks (future)
├── services/             # MediaPipe, analysis logic (future)
└── utils/                # Constants, types, helpers (future)
```

## 🎨 Design System

**Colors**: Ice-blue theme with gradients (`from-ice-blue-300 to-ice-blue-600`)  
**Layout**: iPhone container (390x844px) with rounded corners  
**Typography**: SF Pro Text system fonts  
**Components**: Modular, TypeScript interfaces, mobile-first responsive  

## 🛠️ Development Commands

```bash
# Start development server (mobile accessible)
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Mobile testing
# Access http://[YOUR_LOCAL_IP]:5173/ on iPhone Safari
```

## 📋 Current Status & Next Tasks

### ✅ Completed (Phase 1.1)
- React + TypeScript + Vite setup
- Tailwind CSS with custom theme
- Component architecture (AppContainer, StatusBar, VideoContainer)
- Mobile-responsive iPhone frame layout
- Basic UI interactions (analyze button toggle)

### 🔄 In Progress (Phase 1.2)
- Video upload functionality
- HTML5 video player components
- Basic video synchronization

### 📅 Upcoming Phases
- **Phase 2**: Manual jump marking and basic metrics
- **Phase 3**: MediaPipe pose detection integration  
- **Phase 4**: Advanced biomechanical analysis
- **Phase 5**: Production deployment

## 🎯 Key Implementation Guidelines

### Component Development
- Use TypeScript interfaces for all props
- Follow mobile-first responsive design
- Implement proper error boundaries
- Include loading states and animations
- Test on actual iPhone when possible

### Video Functionality
- Support MP4, MOV, WEBM formats
- Implement drag & drop upload
- Ensure synchronized playback
- Add frame-by-frame scrubbing
- Optimize for mobile performance

### MediaPipe Integration (Future)
- Process at 10fps for analysis (30fps playback)
- Use Web Workers for heavy computation
- Implement pose skeleton overlay
- Cache processed results
- Graceful fallback if MediaPipe fails

## 🚨 Important Constraints

**Mobile Performance**: Target iPhone 12+ performance  
**File Sizes**: Videos should be under 50MB for browser handling  
**Browser Support**: iOS Safari 14+, Chrome Mobile 90+  
**Offline**: Eventually work without internet (PWA)  

## 🔧 Debugging & Testing

### Common Issues
- **CORS errors**: Check vite.config.ts headers for MediaPipe
- **Mobile viewport**: Test in Chrome DevTools iPhone 14 Pro mode
- **Video sync drift**: Use shared RAF loop, not separate timers
- **Memory leaks**: Dispose MediaPipe instances properly

### Testing Workflow
1. Desktop development: http://localhost:5173/
2. Mobile testing: http://[YOUR_LOCAL_IP]:5173/
3. Component testing: Individual component development
4. Integration testing: Full user workflows

## 📚 References & Resources

**Documentation**:
- [PROJECT_VISION.md](./PROJECT_VISION.md) - User needs and business context
- [ROADMAP.md](./ROADMAP.md) - 16-week development plan  
- [TECHNICAL_SPEC.md](./TECHNICAL_SPEC.md) - Detailed implementation specs

**External APIs**:
- MediaPipe Pose: `@mediapipe/tasks-vision`
- Model URL: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`

**Key Libraries**:
- React Player: For video controls (when we add it)
- Framer Motion: For animations (when we add it)
- Canvas API: For pose overlays and frame processing

## 🎬 Video Analysis Context

**Target Jumps**: Single, double, triple jumps (Axel, Lutz, Flip, Loop, Sal, Toe)  
**Key Metrics**: Air time, rotation speed, jump height, landing stability  
**Analysis Phases**: Takeoff, flight, rotation, landing  
**Pose Points**: Focus on ankles (ground contact), shoulders/hips (rotation), knees (technique)  

## 🏃‍♂️ Quick Start for New Development Sessions

```bash
# Resume development
cd feedback-loop
npm run dev
git status  # Check current branch and changes
git log --oneline -5  # See recent commits

# For new features, create feature branch:
# git checkout -b feature/video-upload
```

## 💡 Tips for Working with Claude Code

- Reference component file paths like `src/components/Video/VideoContainer.tsx:25`
- Mention specific Phase numbers when discussing features
- Include mobile testing reminders in implementation
- Always consider TypeScript types and error handling
- Keep commits focused on single features/fixes

---

*Last updated: 2025-08-31 | Current branch: feature/foundation-setup*  
*Development server: Running | Type check: Passing | Ready for Phase 1.2*