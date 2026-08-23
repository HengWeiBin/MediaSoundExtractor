# AGENTS.md

## What this is

Serverless, single-file browser app: converts dropped audio/video files to MP3 (128k) or WAV fully client-side via FFmpeg.wasm v0.12. The entire app is `index.html` (markup + inline `<script type="module">`). No build step, no package.json, no test suite, no linter.

## Running / verifying changes

- Must be served over HTTP(S): WebAssembly + Web Workers fail under `file://`. The app itself detects `file:` and shows a setup-error screen instead of the UI.
- Serve from the repo root and open the port:
  - `python -m http.server 8000` → http://localhost:8000
  - or `npx serve .`, or VS Code Live Server extension
- Manual verification only (no automated tests): after reload, the loader overlay must disappear and the bottom status bar must show `System Ready.` Then drop a media file and confirm conversion + download in both toggle modes (MP3 / WAV).
- First page load downloads the ~30MB WASM core from a public CDN — needs internet access.

## Dependencies are CDN-only (never npm-install)

- Tailwind CSS Play CDN (`cdn.tailwindcss.com`) — utilities work without a build; several class sets are built dynamically via template strings in JS.
- `@ffmpeg/ffmpeg@0.12.10` and `@ffmpeg/util@0.12.1`: unpkg ESM imports at the top of the module script.
- `@ffmpeg/core@0.12.6` (the WASM binary): versioned inside the `CDN_PROVIDERS` array.
- When bumping FFmpeg versions, update BOTH the ESM import URLs and `CDN_PROVIDERS`.

## Gotchas

- `initFFmpegWithProvider()` fetches `worker.js` as text and regex-rewrites its relative imports (`./const.js`, `./errors.js`) to absolute CDN URLs, then loads it as a Blob URL. This patching is required to avoid cross-origin Worker errors — do not "simplify" it away.
- FFmpeg init has multi-CDN failover (unpkg → jsdelivr) and a 25s timeout promise racing `ffmpeg.load()`. Keep providers in sync.
- Task processing is strictly sequential: one pending task at a time through recursive `processNext()`, guarded by `isProcessing` / `currentProcessingTaskId`.
- Memory hygiene in WASM: after each conversion the input/output files are deleted from the FFmpeg FS, and output object URLs are revoked on clear. Preserve this in the task pipeline.
- Deleting a task from the list goes through a `window` `delete-task` CustomEvent because rows are re-rendered wholesale via innerHTML in `renderAll()`.
- Product invariant: everything runs locally in the browser ("no server upload"). Do not introduce backend/network calls for media data.

## Conventions

- Plain ES modules inline in HTML; no framework, no TypeScript. Keep it that way unless explicitly asked otherwise.
- UI text and code comments are Traditional Chinese (zh-TW) — match that.
