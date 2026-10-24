<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](README.md) [![繁體中文](https://img.shields.io/badge/語言-繁體中文-green?style=flat-square)](README.zh-TW.md)

</div>

# MEDIA PRO — MediaSoundExtractor

<p align="center">
  <img src="favicon.svg" alt="MEDIA PRO Logo" width="80" height="80">
  <br>
  <strong>🎬 In-Browser Local Audio Extraction & Conversion Tool (FFmpeg.wasm)</strong>
  <br>
  <span>100% Client-Side Processing · Zero Server Upload · High-Speed & Privacy-First · Dual Format MP3 (128k) / WAV</span>
</p>

<p align="center">
  <a href="https://mediasoundextractor.netlify.app/"><img src="https://img.shields.io/badge/Live%20App-Netlify-00C7B7?style=flat-square&logo=netlify" alt="Live App"></a>
  <a href="https://hengweibin.github.io/MediaSoundExtractor/"><img src="https://img.shields.io/badge/Landing%20Page-GitHub%20Pages-222222?style=flat-square&logo=githubpages" alt="Landing Page"></a>
  <a href="https://github.com/HengWeiBin/MediaSoundExtractor/releases"><img src="https://img.shields.io/badge/Release-v1.0.0-3b82f6?style=flat-square" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License"></a>
</p>

---

### 🔗 Quick Links

- 🚀 **Live Web Application (Netlify)**: [https://mediasoundextractor.netlify.app/](https://mediasoundextractor.netlify.app/)
- 🌐 **Product Landing Page (GitHub Pages)**: [https://hengweibin.github.io/MediaSoundExtractor/](https://hengweibin.github.io/MediaSoundExtractor/)
- 💻 **GitHub Repository**: [https://github.com/HengWeiBin/MediaSoundExtractor](https://github.com/HengWeiBin/MediaSoundExtractor)

---

**MediaSoundExtractor** is a pure client-side web application for extracting audio tracks from video and audio files directly inside your browser. It converts media into **MP3 (128 kbps)** or uncompressed **WAV** using [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) v0.12. 

**Zero server upload**: all media processing occurs locally within your browser using WebAssembly. Your files never leave your device.

## ✨ Key Features

- 🎬 **Drag & Drop Workflow**: Easily drop video/audio files for batch queue processing.
- 🔁 **Dual Export Formats**: Instant toggle between MP3 (128 kbps CBR) and uncompressed WAV.
- ⏱️ **Real-Time Progress Tracking**: Live progress bars, transcode phase indicator, and elapsed timer.
- 🔒 **Absolute Privacy**: 100% in-browser processing via WebAssembly; zero network transfers of your media files.
- 🌐 **Multi-CDN Failover**: Automatic fallback between unpkg and jsdelivr for high-availability FFmpeg core binary loading.
- 🌍 **Bilingual & Locale-Aware**: Full English (`/en/`) and Traditional Chinese (`/zh/`) interfaces with automatic browser preference detection and manual language switcher.
- 📦 **Zero-Build Architecture**: Vanilla HTML5 + ES Modules with no build step, no npm packages, and zero server-side runtime.

## 🚀 Quick Start

### Prerequisites

A modern web browser with WebAssembly support (Chrome, Edge, Firefox, Safari) and a local static HTTP server.

> **Note**: WebAssembly and Web Workers cannot run under the `file://` protocol due to browser security restrictions. The app must be served over HTTP or HTTPS.

No Node.js build process or `npm install` is required — all dependencies are loaded directly via CDN.

### Running Locally

```bash
# In the repository root
python -m http.server 8000
# or: npx serve .
```

Navigate to `http://localhost:8000` in your browser. Once the status bar displays `System Ready.` (after downloading the ~30MB FFmpeg WASM core on the first visit), the extractor is ready for use.

## 📖 How It Works

1. **Drop Files**: Drag and drop one or more audio or video files into the upload dropzone.
2. **Select Target Format**: Choose **MP3** (128 kbps) or **WAV** in the format selector.
3. **Automatic Conversion**: The queue processes items sequentially. Watch the live progress bar and status indicator.
4. **Download**: Click **Download** once complete to save your extracted audio file.

## 🛠️ Tech Stack & Architecture

- **Core Engine**: Plain JavaScript ES Modules (`js/app-core.js`) encapsulating FFmpeg lifecycle management, sequential task processing, and file system cleanup.
- **Audio Transcoding**: [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) v0.12 (`@ffmpeg/ffmpeg@0.12.10` + `@ffmpeg/core@0.12.6`).
- **Styling**: Tailwind CSS via Play CDN.
- **Routing & i18n**: Physical directories (`/zh/` and `/en/`) with root client-side language negotiation in `index.html` via `localStorage` and `navigator.languages`.

### Engineering Highlights & Safeguards

- **Worker Blob URL Patching**: To prevent cross-origin Worker restrictions on CDNs, `initFFmpegWithProvider()` fetches `worker.js` as text, rewrites relative imports to absolute CDN URLs, and injects it as an isolated Blob URL.
- **Multi-CDN Failover**: Automatically tries unpkg first, falling back to jsdelivr if loading times out (25-second watchdog) or encounters network issues.
- **Strict Sequential Queue**: Tasks are processed one by one to avoid saturating browser memory and ensure stability of the single-threaded WebAssembly runtime.
- **WASM Memory Hygiene**: Input and output files in FFmpeg's virtual in-memory file system (MEMFS) are immediately unlinked (`ffmpeg.deleteFile`) after processing each item, and Blob URLs are explicitly revoked when tasks are cleared.

## 🚢 Deployment

MediaSoundExtractor is a 100% static application and can be hosted on any static hosting platform (Netlify, GitHub Pages, Vercel, Cloudflare Pages):

| Setting | Value |
| --- | --- |
| **Build Command** | *(Leave blank)* |
| **Publish Directory** | `.` (repository root) |

Deploy via Netlify CLI:

```bash
netlify deploy --prod --dir .
```

## 📝 Important Notes

- **HTTP(S) Required**: Accessing `index.html` directly via `file://` will trigger an environment setup warning.
- **Memory Limitations**: Conversions take place inside the browser's allocated memory. Processing exceptionally massive video files (multi-gigabyte) may be constrained by available device RAM.
- **Sequential Processing**: Batch tasks run in strict sequence to guarantee WASM virtual memory stability.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
