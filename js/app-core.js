/**
 * MediaSoundExtractor - Shared Core Application Engine
 *
 * Provides client-side FFmpeg.wasm initialization with multi-CDN failover,
 * Web Worker blob URL patching for cross-origin compliance, audio conversion command
 * orchestration (MP3 128k / lossless WAV), and sequential task queue management.
 *
 * Invariants:
 * - 100% in-browser WebAssembly execution (zero server upload).
 * - Native ES Module execution (zero build steps, zero npm dependencies).
 * - Automatic Web Worker import patching for cross-origin compliance.
 * - Strict sequential audio processing with WASM FS memory cleanup.
 */

import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

// Re-export external utilities for consumer convenience
export { FFmpeg, fetchFile, toBlobURL };

/**
 * Supported audio output formats.
 */
export const FORMATS = Object.freeze({
    MP3: 'mp3',
    WAV: 'wav'
});

/**
 * Lifecycle states for conversion queue tasks.
 */
export const TASK_STATUS = Object.freeze({
    PENDING: 'pending',
    PROCESSING: 'processing',
    DONE: 'done',
    ERROR: 'error'
});

/**
 * Default timeout for FFmpeg WebAssembly compilation & Worker initialization (25 seconds).
 */
export const DEFAULT_LOAD_TIMEOUT_MS = 25000;

/**
 * Public CDN providers for FFmpeg.wasm assets with multi-CDN failover.
 * Both unpkg and jsdelivr provide mirrors for @ffmpeg/core and @ffmpeg/ffmpeg.
 */
export const CDN_PROVIDERS = Object.freeze([
    {
        name: 'unpkg',
        coreBase: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
        ffmpegBase: 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm'
    },
    {
        name: 'jsdelivr',
        coreBase: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        ffmpegBase: 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm'
    }
]);

/**
 * Checks whether the current runtime environment is running over the file:// protocol.
 * WebAssembly and Web Workers are blocked under file:// due to browser security restrictions.
 *
 * @returns {boolean} True if loaded via file:// protocol.
 */
export function isLocalFileProtocol() {
    return typeof window !== 'undefined' && window.location?.protocol === 'file:';
}

/**
 * Formats a file size in bytes to a human-readable megabyte string.
 *
 * @param {number} bytes - Size in bytes.
 * @returns {string} Formatted size (e.g., '14.2MB').
 */
export function formatFileSize(bytes) {
    if (typeof bytes !== 'number' || isNaN(bytes)) return '0.0MB';
    return (bytes / (1024 * 1024)).toFixed(1) + 'MB';
}

/**
 * Returns the MIME type corresponding to an audio format.
 *
 * @param {string} format - 'mp3' or 'wav'.
 * @returns {string} Corresponding MIME type string.
 */
export function getAudioMimeType(format) {
    return format === FORMATS.MP3 ? 'audio/mp3' : 'audio/wav';
}

/**
 * Returns the sanitized file extension for an audio format.
 *
 * @param {string} format - 'mp3' or 'wav'.
 * @returns {string} File extension ('mp3' or 'wav').
 */
export function getOutputFileExtension(format) {
    return format === FORMATS.MP3 ? 'mp3' : 'wav';
}

/**
 * Generates an output filename replacing the original extension with the target audio format.
 *
 * @param {string} originalName - Original media filename (e.g. 'video.mp4').
 * @param {string} format - Output format ('mp3' or 'wav').
 * @returns {string} Transformed filename (e.g. 'video.mp3').
 */
export function buildOutputFileName(originalName, format) {
    const baseName = (originalName || 'audio').replace(/\.[^/.]+$/, '');
    const ext = getOutputFileExtension(format);
    return `${baseName}.${ext}`;
}

/**
 * Builds the FFmpeg command line arguments array based on format specification.
 *
 * - MP3: extracts audio with 128kbps constant bitrate.
 * - WAV: extracts uncompressed lossless PCM audio.
 *
 * @param {string} inputName - Virtual filesystem input filename.
 * @param {string} outputName - Virtual filesystem output filename.
 * @param {string} format - Target audio format ('mp3' or 'wav').
 * @returns {string[]} FFmpeg argument array.
 */
export function buildFFmpegArgs(inputName, outputName, format = FORMATS.MP3) {
    if (format === FORMATS.MP3) {
        return ['-i', inputName, '-b:a', '128k', outputName];
    }
    return ['-i', inputName, outputName];
}

/**
 * Creates a unique task item object representing a queued media file.
 *
 * @param {File} file - Browser File object.
 * @returns {object} Task descriptor object.
 */
export function createTaskItem(file) {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
        id,
        file,
        name: file?.name || 'unknown',
        status: TASK_STATUS.PENDING,
        progress: 0,
        url: null,
        outputName: '',
        size: formatFileSize(file?.size || 0)
    };
}

/**
 * Revokes the Object URL associated with a task if one exists, freeing browser memory.
 *
 * @param {object} task - Task item.
 */
export function revokeTaskUrl(task) {
    if (task && task.url) {
        URL.revokeObjectURL(task.url);
        task.url = null;
    }
}

/**
 * Revokes Object URLs for an entire collection of tasks.
 *
 * @param {object[]} tasks - Array of task items.
 */
export function revokeAllTaskUrls(tasks) {
    if (Array.isArray(tasks)) {
        tasks.forEach(revokeTaskUrl);
    }
}

/**
 * Downloads and patches the FFmpeg worker.js script to replace relative imports
 * (./const.js, ./errors.js) with absolute CDN URLs. This is crucial for avoiding
 * cross-origin Worker security restrictions when running in the browser.
 *
 * @param {object} provider - CDN provider configuration object.
 * @returns {Promise<string>} Blob URL pointing to the patched Worker script.
 */
export async function createPatchedWorkerBlobURL(provider) {
    const workerReq = await fetch(`${provider.ffmpegBase}/worker.js`);
    if (!workerReq.ok) {
        throw new Error(`Failed to download Worker script from ${provider.name} (HTTP ${workerReq.status})`);
    }
    let workerScript = await workerReq.text();
    workerScript = workerScript.replace(/["']\.\/const\.js["']/g, `"${provider.ffmpegBase}/const.js"`);
    workerScript = workerScript.replace(/["']\.\/errors\.js["']/g, `"${provider.ffmpegBase}/errors.js"`);
    const workerBlob = new Blob([workerScript], { type: 'text/javascript' });
    return URL.createObjectURL(workerBlob);
}

/**
 * Initializes FFmpeg using a specific CDN provider with Worker patching and timeout guard.
 *
 * @param {object} provider - CDN provider configuration.
 * @param {object} [options={}] - Options and lifecycle callbacks.
 * @param {function} [options.onLog] - Callback for FFmpeg log messages: (msg) => void.
 * @param {function} [options.onProgress] - Callback for conversion progress: ({ progress, time }) => void.
 * @param {function} [options.onStep] - Callback for initialization step updates: (stepText, stepInfo) => void.
 * @param {number} [options.timeoutMs] - Load timeout in milliseconds (default: 25000).
 * @returns {Promise<FFmpeg>} Loaded FFmpeg instance.
 */
export async function initFFmpegWithProvider(provider, options = {}) {
    const {
        onLog,
        onProgress,
        onStep,
        timeoutMs = DEFAULT_LOAD_TIMEOUT_MS
    } = options;

    const ffmpeg = new FFmpeg();

    if (typeof onLog === 'function') {
        ffmpeg.on('log', ({ message }) => onLog(message));
    }

    if (typeof onProgress === 'function') {
        ffmpeg.on('progress', (progressEvent) => onProgress(progressEvent));
    }

    // Step 1: Download & patch worker script
    onStep?.(`Downloading Worker module (${provider.name})...`, {
        step: 'download_worker',
        provider: provider.name
    });
    const workerBlobURL = await createPatchedWorkerBlobURL(provider);

    // Step 2: Download Core JS and WASM binary
    onStep?.(`Downloading FFmpeg Core JS (${provider.name})...`, {
        step: 'download_core',
        provider: provider.name
    });
    const coreBlobURL = await toBlobURL(`${provider.coreBase}/ffmpeg-core.js`, 'text/javascript');

    onStep?.(`Downloading WASM core binary (${provider.name})...`, {
        step: 'download_wasm',
        provider: provider.name
    });
    const wasmBlobURL = await toBlobURL(`${provider.coreBase}/ffmpeg-core.wasm`, 'application/wasm');

    // Step 3: Load & compile WebAssembly module with timeout guard
    onStep?.('Compiling WebAssembly module...', {
        step: 'compile_wasm',
        provider: provider.name
    });

    const loadPromise = ffmpeg.load({
        coreURL: coreBlobURL,
        wasmURL: wasmBlobURL,
        classWorkerURL: workerBlobURL
    });

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Load timeout (${timeoutMs}ms) exceeded during WASM compilation / Worker communication`));
        }, timeoutMs);
    });

    await Promise.race([loadPromise, timeoutPromise]);
    return ffmpeg;
}

/**
 * Initializes the FFmpeg engine with automatic multi-CDN failover (unpkg -> jsdelivr).
 *
 * @param {object} [options={}] - Options and lifecycle callbacks.
 * @param {object[]} [options.providers] - Custom provider list (defaults to CDN_PROVIDERS).
 * @param {function} [options.onLog] - Callback for FFmpeg log messages: (msg) => void.
 * @param {function} [options.onProgress] - Callback for conversion progress: ({ progress, time }) => void.
 * @param {function} [options.onStep] - Callback for initialization step updates: (stepText, stepInfo) => void.
 * @param {number} [options.timeoutMs] - Load timeout in milliseconds (default: 25000).
 * @returns {Promise<{ ffmpeg: FFmpeg, provider: object }>} Initialized engine and successful provider.
 */
export async function initFFmpegCore(options = {}) {
    const providers = options.providers || CDN_PROVIDERS;
    let lastError = null;

    for (const provider of providers) {
        try {
            console.log(`[FFmpeg Core] Attempting load via provider: ${provider.name}...`);
            const ffmpeg = await initFFmpegWithProvider(provider, options);
            console.log(`[FFmpeg Core] Successfully initialized via provider: ${provider.name}`);
            return { ffmpeg, provider };
        } catch (error) {
            console.warn(`[FFmpeg Core] Provider ${provider.name} failed:`, error);
            lastError = error;
        }
    }

    throw lastError || new Error('All CDN providers failed to initialize FFmpeg');
}

/**
 * Executes audio extraction for a single media file via FFmpeg.wasm.
 *
 * Steps:
 * 1. Writes media file into virtual filesystem.
 * 2. Runs FFmpeg CLI command with appropriate bitrate/codec arguments.
 * 3. Reads processed audio buffer from virtual filesystem.
 * 4. Creates audio Blob and browser Object URL.
 * 5. Strictly cleans up input and output files from virtual FS to prevent memory leaks.
 *
 * @param {FFmpeg} ffmpeg - Initialized FFmpeg instance.
 * @param {File} file - Input media file.
 * @param {object} [options={}] - Conversion options.
 * @param {string} [options.id] - Task ID (defaults to random).
 * @param {string} [options.format] - Target format ('mp3' or 'wav', defaults to 'mp3').
 * @param {function} [options.onStatus] - Status update callback: (statusText) => void.
 * @returns {Promise<{ blob: Blob, url: string, outputName: string }>} Conversion result.
 */
export async function convertSingleFile(ffmpeg, file, options = {}) {
    if (!ffmpeg) {
        throw new Error('FFmpeg instance is required for conversion');
    }

    const format = options.format || FORMATS.MP3;
    const taskId = options.id || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9));
    const onStatus = options.onStatus || (() => {});

    const sanitizedBaseName = (file.name || 'input').replace(/[^a-zA-Z0-9._-]/g, '_');
    const inputVirtualName = `input_${taskId}_${sanitizedBaseName}`;
    const outputExt = getOutputFileExtension(format);
    const outputVirtualName = `output_${taskId}.${outputExt}`;
    const finalOutputName = buildOutputFileName(file.name, format);

    try {
        // 1. Write file into virtual FS
        onStatus(`Writing file ${file.name}...`);
        const fileData = await fetchFile(file);
        await ffmpeg.writeFile(inputVirtualName, fileData);

        // 2. Execute conversion command
        onStatus(`Processing ${file.name}...`);
        const args = buildFFmpegArgs(inputVirtualName, outputVirtualName, format);
        await ffmpeg.exec(args);

        // 3. Read output from virtual FS
        onStatus('Reading output...');
        const outputData = await ffmpeg.readFile(outputVirtualName);

        // 4. Create Blob and Object URL
        const mimeType = getAudioMimeType(format);
        const blob = new Blob([outputData.buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        return {
            blob,
            url,
            outputName: finalOutputName
        };
    } finally {
        // 5. Memory hygiene: strictly clean virtual filesystem
        try {
            await ffmpeg.deleteFile(inputVirtualName);
        } catch (_) {
            // Ignore if file was never written
        }
        try {
            await ffmpeg.deleteFile(outputVirtualName);
        } catch (_) {
            // Ignore if output was never generated
        }
    }
}

/**
 * Sequential Task Queue Manager for media conversions.
 * Manages the task list, sequential execution pipeline, progress delegation,
 * and memory cleanup.
 */
export class TaskQueue {
    /**
     * @param {object} [options={}] - Configuration options.
     * @param {FFmpeg} [options.ffmpeg] - FFmpeg instance (can be attached later).
     * @param {string} [options.format] - Default output format ('mp3' or 'wav').
     * @param {function} [options.onTasksChange] - Callback when tasks array changes: (tasks) => void.
     * @param {function} [options.onProgress] - Callback for task progress: (taskId, percent) => void.
     * @param {function} [options.onStatus] - Callback for status updates: (statusText) => void.
     * @param {function} [options.onProcessingStateChange] - Callback when processing state changes: (isProcessing) => void.
     */
    constructor(options = {}) {
        this.ffmpeg = options.ffmpeg || null;
        this.format = options.format || FORMATS.WAV;
        this.tasks = [];
        this.isProcessing = false;
        this.currentProcessingTaskId = null;

        this.onTasksChange = options.onTasksChange || null;
        this.onProgress = options.onProgress || null;
        this.onStatus = options.onStatus || null;
        this.onProcessingStateChange = options.onProcessingStateChange || null;
    }

    /**
     * Attaches or updates the FFmpeg instance. If pending tasks exist, triggers processing.
     *
     * @param {FFmpeg} ffmpeg - FFmpeg instance.
     */
    setFFmpeg(ffmpeg) {
        this.ffmpeg = ffmpeg;
        if (this.hasPendingTasks()) {
            this.processNext();
        }
    }

    /**
     * Sets the target conversion format ('mp3' or 'wav').
     *
     * @param {string} format - Target audio format.
     */
    setFormat(format) {
        this.format = format;
    }

    /**
     * Retrieves current output format.
     *
     * @returns {string} Current format ('mp3' or 'wav').
     */
    getFormat() {
        return this.format;
    }

    /**
     * Whether compress mode (MP3) is active.
     *
     * @returns {boolean} True if format is MP3.
     */
    isCompressMode() {
        return this.format === FORMATS.MP3;
    }

    /**
     * Toggles between MP3 and WAV formats.
     *
     * @param {boolean} compress - If true, sets MP3; otherwise WAV.
     */
    setCompressMode(compress) {
        this.format = compress ? FORMATS.MP3 : FORMATS.WAV;
    }

    /**
     * Checks if any tasks are currently waiting for processing.
     *
     * @returns {boolean} True if pending tasks exist.
     */
    hasPendingTasks() {
        return this.tasks.some(t => t.status === TASK_STATUS.PENDING);
    }

    /**
     * Adds files to the conversion queue and starts processing if idle.
     *
     * @param {File[]|FileList} files - Media files to queue.
     * @returns {object[]} Newly created task items.
     */
    addFiles(files) {
        const fileArray = Array.from(files || []);
        if (fileArray.length === 0) return [];

        const newTasks = fileArray.map(createTaskItem);
        this.tasks = [...this.tasks, ...newTasks];
        this.notifyTasksChange();
        this.processNext();
        return newTasks;
    }

    /**
     * Removes a single task by ID and revokes its object URL.
     *
     * @param {string} taskId - ID of the task to remove.
     */
    removeTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            revokeTaskUrl(task);
            this.tasks = this.tasks.filter(t => t.id !== taskId);
            this.notifyTasksChange();
        }
    }

    /**
     * Clears all tasks and revokes all generated object URLs.
     */
    clearTasks() {
        revokeAllTaskUrls(this.tasks);
        this.tasks = [];
        this.notifyTasksChange();
    }

    /**
     * Returns all successfully completed tasks with ready download URLs.
     *
     * @returns {object[]} Completed tasks.
     */
    getCompletedTasks() {
        return this.tasks.filter(t => t.status === TASK_STATUS.DONE && t.url);
    }

    /**
     * Handles FFmpeg progress event by forwarding to current task and listeners.
     *
     * @param {object} event - Progress event object { progress: number, time: number }.
     */
    handleProgress({ progress }) {
        if (!this.currentProcessingTaskId) return;

        const percent = Math.min(100, Math.max(0, Math.round((progress || 0) * 100)));
        const currentTask = this.tasks.find(t => t.id === this.currentProcessingTaskId);
        if (currentTask) {
            currentTask.progress = percent;
        }

        if (typeof this.onProgress === 'function') {
            this.onProgress(this.currentProcessingTaskId, percent);
        }
    }

    /**
     * Processes the next pending task in strict sequential FIFO order.
     */
    async processNext() {
        if (this.isProcessing || !this.ffmpeg) return;

        const next = this.tasks.find(t => t.status === TASK_STATUS.PENDING);
        if (!next) {
            this.isProcessing = false;
            this.currentProcessingTaskId = null;
            this.notifyProcessingState(false);
            return;
        }

        this.isProcessing = true;
        this.currentProcessingTaskId = next.id;
        this.notifyProcessingState(true);
        next.status = TASK_STATUS.PROCESSING;
        this.notifyTasksChange();

        try {
            const result = await convertSingleFile(this.ffmpeg, next.file, {
                id: next.id,
                format: this.format,
                onStatus: (msg) => this.notifyStatus(msg)
            });

            next.url = result.url;
            next.outputName = result.outputName;
            next.status = TASK_STATUS.DONE;
            next.progress = 100;
            if (typeof this.onProgress === 'function') {
                this.onProgress(next.id, 100);
            }
        } catch (err) {
            console.error('[TaskQueue] Task conversion error:', err);
            this.notifyStatus(`Error: ${err.message || err}`);
            next.status = TASK_STATUS.ERROR;
        }

        this.isProcessing = false;
        this.currentProcessingTaskId = null;
        this.notifyTasksChange();
        this.processNext();
    }

    notifyTasksChange() {
        if (typeof this.onTasksChange === 'function') {
            this.onTasksChange([...this.tasks]);
        }
    }

    notifyStatus(msg) {
        if (typeof this.onStatus === 'function') {
            this.onStatus(msg);
        }
    }

    notifyProcessingState(isProcessing) {
        if (typeof this.onProcessingStateChange === 'function') {
            this.onProcessingStateChange(isProcessing);
        }
    }
}
