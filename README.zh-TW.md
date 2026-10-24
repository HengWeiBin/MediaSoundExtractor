<div align="center">

[![English](https://img.shields.io/badge/Language-English-blue?style=flat-square)](README.md) [![繁體中文](https://img.shields.io/badge/語言-繁體中文-green?style=flat-square)](README.zh-TW.md)

</div>

# MEDIA PRO — MediaSoundExtractor

<p align="center">
  <img src="favicon.svg" alt="MEDIA PRO Logo" width="80" height="80">
  <br>
  <strong>🎬 瀏覽器本地音訊擷取與轉檔工具 (FFmpeg.wasm)</strong>
  <br>
  <span>100% 本地運算 · 零伺服器上傳 · 極速隱私 · 支援 MP3 (128k) / WAV 雙格式</span>
</p>

<p align="center">
  <a href="https://mediasoundextractor.netlify.app/"><img src="https://img.shields.io/badge/Live%20App-Netlify-00C7B7?style=flat-square&logo=netlify" alt="Live App"></a>
  <a href="https://hengweibin.github.io/MediaSoundExtractor/"><img src="https://img.shields.io/badge/Landing%20Page-GitHub%20Pages-222222?style=flat-square&logo=githubpages" alt="Landing Page"></a>
  <a href="https://github.com/HengWeiBin/MediaSoundExtractor/releases"><img src="https://img.shields.io/badge/Release-v1.1.0-3b82f6?style=flat-square" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License"></a>
</p>

---

### 🔗 快速連結

- 🚀 **線上立即使用 (Live App - Netlify)**: [https://mediasoundextractor.netlify.app/](https://mediasoundextractor.netlify.app/)
- 🌐 **產品介紹頁 (Landing Page - GitHub Pages)**: [https://hengweibin.github.io/MediaSoundExtractor/](https://hengweibin.github.io/MediaSoundExtractor/)
- 💻 **GitHub 原始碼倉庫**: [https://github.com/HengWeiBin/MediaSoundExtractor](https://github.com/HengWeiBin/MediaSoundExtractor)

---

一個純前端的音訊擷取工具：把拖曳進來的影片 / 音訊檔轉成 **MP3 (128k)** 或 **WAV**。完全在瀏覽器內透過 [FFmpeg.wasm](https://ffmpegwasm.netlify.app/) 完成轉檔——**檔案不會上傳到任何伺服器**。

## ✨ 特色功能

- 🎬 拖放上傳影片 / 音訊檔，批次排程任務
- 🔁 一鍵切換輸出格式：MP3（128kbps）或 WAV
- ⏱️ 即時進度條與任務狀態顯示
- 🔒 100% 本地運算，媒體資料不離開瀏覽器
- 🌐 多 CDN 容錯（unpkg → jsdelivr）載入 FFmpeg WASM 核心
- 🌍 雙語支援：繁體中文（`/zh/`）與英文（`/en/`），具備瀏覽器語言自動導向與手動切換開關

## 🚀 快速開始

### 前置需求

- 任一靜態伺服器（WebAssembly 與 Web Worker 無法在 `file://` 下運作），例如：
  - `python -m http.server 8000`
  - `npx serve .`

無需 Node.js 建置流程、無需 `npm install`——所有依賴皆由 CDN 提供。

### 啟動

```bash
# 在專案根目錄
python -m http.server 8000
```

打開 http://localhost:8000 ，看到底部狀態列顯示 `System Ready.`（或 `系統就緒。`）即可開始使用。

> 首次載入會從公共 CDN 下載約 30MB 的 FFmpeg WASM 核心，需要網路連線。

## 📖 使用教學

1. **拖放檔案**：將音訊 / 影片檔拖進丟放區
2. **選擇格式**：切換 MP3 / WAV
3. **等待轉換**：進度條即時更新
4. **下載**：轉換完成後點擊下載

## 🛠️ 技術棧與架構

- 純 HTML5 + ES Modules（無框架、無建置步驟、無 npm 依賴）
- 模組化共享引擎：核心轉檔邏輯封裝於 `js/app-core.js`，供雙語頁面共同載入
- [FFmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) v0.12（`@ffmpeg/ffmpeg@0.12.10` + `@ffmpeg/core@0.12.6`）
- Tailwind CSS（Play CDN）

## 🚢 部署

這是純靜態網站，可直接部署到 Netlify / Vercel / GitHub Pages：

| 設定 | 值 |
| --- | --- |
| Build command | （留空） |
| Publish directory | `.`（repo 根目錄） |

或使用 Netlify CLI：

```bash
netlify deploy --prod --dir .
```

## 📝 注意事項

- 必須透過 HTTP(S) 存取；直接雙擊 HTML 檔案（`file://`）會顯示設定錯誤畫面
- 大型檔案的轉換在瀏覽器記憶體內進行，過大的檔案可能受限於可用記憶體
- 任務為嚴格序列處理（一次一個），以維持 WASM 記憶體穩定

## 📄 授權

本專案採用 [MIT License](LICENSE) 授權。
