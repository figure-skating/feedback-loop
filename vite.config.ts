import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";

// https://vitejs.dev/config/
const useLocalHttps =
  process.env.CI !== "true" &&
  process.env.NODE_ENV !== "production" &&
  fs.existsSync("./localhost+1-key.pem") &&
  fs.existsSync("./localhost+1.pem");

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === "production" ? "/feedback-loop/" : "/",
  server: {
    https: useLocalHttps
      ? {
          key: fs.readFileSync("./localhost+1-key.pem"),
          cert: fs.readFileSync("./localhost+1.pem"),
        }
      : undefined,
    host: "0.0.0.0",
    port: 5173,
    headers: {
      "Cross-Origin-Embedder-Policy": "credentialless",
      "Cross-Origin-Opener-Policy": "same-origin",
    },
    fs: {
      allow: [".."],
    },
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false, // Disable to avoid MediaPipe source map issues
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    exclude: ["@mediapipe/tasks-vision"],
  },
});
