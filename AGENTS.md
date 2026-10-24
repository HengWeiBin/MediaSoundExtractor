# AGENTS.md

## What this is

Serverless, zero-build client-side browser application: converts dropped audio/video files to MP3 (128k) or WAV fully client-side via FFmpeg.wasm v0.12. Features physical bilingual UI routing (`/zh/index.html` and `/en/index.html`) driven by a shared core engine (`js/app-core.js`) and a lightweight root language detection router (`index.html`). No build step, no package.json, no test suite, no linter.

## Running / verifying changes

- Must be served over HTTP(S): WebAssembly + Web Workers fail under `file://`. The app itself detects `file:` and shows a setup-error screen instead of the UI.
- Serve from the repo root and open the port:
  - `python -m http.server 8000` → http://localhost:8000
  - or `npx serve .`, or VS Code Live Server extension
- Verify routes:
  - `/` detects browser language (or `localStorage`) and redirects to `/zh/` or `/en/`.
  - `/zh/` displays Traditional Chinese UI.
  - `/en/` displays English UI.
- Manual verification only (no automated tests): after reload, the loader overlay must disappear and the bottom status bar must show `System Ready.` (or `系統就緒。` in Chinese). Then drop a media file and confirm conversion + download in both toggle modes (MP3 / WAV).
- First page load downloads the ~30MB WASM core from a public CDN — needs internet access.

## Dependencies are CDN-only (never npm-install)

- Tailwind CSS Play CDN (`cdn.tailwindcss.com`) — utilities work without a build; several class sets are built dynamically via template strings in JS.
- `@ffmpeg/ffmpeg@0.12.10` and `@ffmpeg/util@0.12.1`: unpkg ESM imports at the top of the module scripts / `js/app-core.js`.
- `@ffmpeg/core@0.12.6` (the WASM binary): versioned inside the `CDN_PROVIDERS` array in `js/app-core.js`.
- When bumping FFmpeg versions, update BOTH the ESM import URLs and `CDN_PROVIDERS`.

## Architecture & Gotchas

- `initFFmpegWithProvider()` fetches `worker.js` as text and regex-rewrites its relative imports (`./const.js`, `./errors.js`) to absolute CDN URLs, then loads it as a Blob URL. This patching is required to avoid cross-origin Worker errors — do not "simplify" it away.
- FFmpeg init has multi-CDN failover (unpkg → jsdelivr) and a 25s timeout promise racing `ffmpeg.load()`. Keep providers in sync.
- Task processing is strictly sequential: one pending task at a time through recursive `processNext()`, guarded by `isProcessing` / `currentProcessingTaskId`.
- Memory hygiene in WASM: after each conversion the input/output files are deleted from the FFmpeg FS, and output object URLs are revoked on clear. Preserve this in the task pipeline.
- Deleting a task from the list goes through a `window` `delete-task` CustomEvent because rows are re-rendered wholesale via innerHTML in `renderAll()`.
- Product invariant: everything runs locally in the browser ("no server upload"). Do not introduce backend/network calls for media data.
- Shared Core Engine: `js/app-core.js` encapsulates FFmpeg initialization, worker blob creation, task state management, audio conversion logic, and download triggering. Both `/zh/index.html` and `/en/index.html` import `app-core.js`. Do not duplicate conversion logic across HTML pages.
- Physical Directory Locale Routing: Root `index.html` executes an immediate client-side redirect in `<head>` inspecting `localStorage.getItem('mse_lang_pref')` falling back to `navigator.languages`. Both `/zh/` and `/en/` persist preferences when the user interacts with the language switcher.

## Conventions

- Plain ES modules in HTML and `js/app-core.js`; no framework, no TypeScript. Keep it that way unless explicitly asked otherwise.
- Code comments, commit messages, and repository documentation MUST be in English.
- UI text is bilingual, residing in `/zh/` (Traditional Chinese, zh-TW) and `/en/` (English) with `js/app-core.js` as the shared engine.

## Agent skills

### Issue tracker

GitHub issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`GLOSSARY.md` + `docs/adr/`). See `docs/agents/domain.md`.
