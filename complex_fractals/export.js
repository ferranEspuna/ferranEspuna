import { Renderer } from './renderer.js';
import { byId, clampZoom } from './fractal_common.js';

export function exportDimensions(edge, shape, canvas) {
    const ratio = { square: 1, landscape: 16 / 9, portrait: 9 / 16 }[shape] || canvas.width / canvas.height;
    // Even dimensions are required by common video encoders.
    return ratio >= 1 ? [edge, Math.max(2, Math.round(edge / ratio / 2) * 2)]
        : [Math.max(2, Math.round(edge * ratio / 2) * 2), edge];
}

function videoMimeType() {
    if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
    return ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/mp4', 'video/webm']
        .find(type => MediaRecorder.isTypeSupported(type)) || null;
}

export function setupExports({ renderers, uniforms, name }) {
    byId('exportSection').hidden = false;
    const settings = byId('exportSettings');
    const status = byId('exportStatus');
    const link = byId('exportDownload');
    const mimeType = videoMimeType();
    let downloadUrl;
    let busy = false;
    let stopRecording;
    if (!mimeType) {
        byId('exportVideo').disabled = true;
        byId('videoSupport').textContent = 'Video recording is unavailable in this browser. PNG export is still available.';
    }
    function download(blob, filename) {
        if (!blob || !blob.size) throw new Error('The export was empty. Try a smaller resolution.');
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        downloadUrl = URL.createObjectURL(blob);
        link.href = downloadUrl;
        link.download = filename;
        link.textContent = `Download ${filename}`;
        link.hidden = false;
        link.click();
    }
    function draw(renderer, values) {
        renderer.render({ ...values, u_hide_overlays: 1, u_show_path: 0, u_path_length: 0 });
        if (renderer.gl.isContextLost() || renderer.gl.getError() !== renderer.gl.NO_ERROR) {
            throw new Error('The graphics device could not render this export. Try a smaller resolution.');
        }
    }
    async function run(video) {
        if (busy) return;
        busy = true;
        settings.disabled = true;
        status.textContent = 'Preparing a full-resolution render…';
        let renderer, stream, recorder, frame, endTimer;
        let canceled = false;
        try {
            const panel = byId('exportPanel').value;
            const edge = Number(byId('exportSize').value);
            if (video && edge > 3840) throw new Error('Choose 1920 or 3840 px for video. 7680 px is available for PNG images.');
            if (video && !mimeType) throw new Error('Video recording is unavailable in this browser.');
            const source = renderers[panel];
            const [width, height] = exportDimensions(edge, byId('exportShape').value, source.canvas);
            const gl = source.gl;
            const viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
            const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
            if (width > Math.min(limit, viewport[0]) || height > Math.min(limit, viewport[1])) {
                throw new Error('This resolution exceeds your graphics device’s limit. Choose a smaller size.');
            }
            const snapshot = structuredClone(uniforms(panel));
            // Let the browser paint the progress message before allocating a large canvas.
            await new Promise(resolve => setTimeout(resolve, 0));
            renderer = new Renderer(document.createElement('canvas'), source.source);
            renderer.resize(width, height);
            if (renderer.gl.drawingBufferWidth !== width || renderer.gl.drawingBufferHeight !== height) {
                throw new Error('The requested canvas size is unavailable. Choose a smaller resolution.');
            }
            draw(renderer, snapshot);
            const basename = `${name}-${panel}-${width}x${height}`;
            if (!video) {
                const blob = await new Promise(resolve => renderer.canvas.toBlob(resolve, 'image/png'));
                download(blob, `${basename}.png`);
                status.textContent = `PNG ready: ${width} × ${height} pixels. Use the download link to save again.`;
                return;
            }
            const duration = Number(byId('exportDuration').value) * 1000;
            const live = byId('exportMotion').value === 'live';
            stream = renderer.canvas.captureStream(30);
            recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: edge >= 3840 ? 40000000 : 16000000 });
            const chunks = [];
            let recordingError;
            let interruption = '';
            const finished = new Promise(resolve => {
                recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
                recorder.onerror = event => { recordingError = event.error || new Error('Video encoding failed. Try a smaller resolution.'); };
                recorder.onstop = resolve;
            });
            stopRecording = (discard = false, reason = '') => {
                canceled = discard;
                interruption = reason;
                cancelAnimationFrame(frame);
                clearTimeout(endTimer);
                if (recorder.state !== 'inactive') recorder.stop();
            };
            byId('exportStop').hidden = false;
            byId('exportCancel').hidden = false;
            recorder.start(1000);
            const start = performance.now();
            let previousFrame = -Infinity;
            let previousSecond = -1;
            function tick(now) {
                if (recorder.state !== 'recording') return;
                try {
                    const elapsed = now - start;
                    if (now - previousFrame >= 1000 / 30) {
                        const values = live ? uniforms(panel) : { ...snapshot,
                            u_zoom: clampZoom(snapshot.u_zoom / Math.pow(4, Math.min(1, elapsed / duration))) };
                        draw(renderer, values);
                        previousFrame = now;
                    }
                    const second = Math.floor(elapsed / 1000);
                    if (second !== previousSecond) {
                        status.textContent = `Recording ${width} × ${height} · ${Math.min(second, duration / 1000)} / ${duration / 1000} seconds${live ? ' · use the explorer controls above' : ' · zooming toward the center'}.`;
                        previousSecond = second;
                    }
                    frame = requestAnimationFrame(tick);
                } catch (error) {
                    recordingError = error;
                    stopRecording(true);
                }
            }
            frame = requestAnimationFrame(tick);
            endTimer = setTimeout(() => stopRecording(), duration);
            await finished;
            if (recordingError) throw recordingError;
            if (canceled) { status.textContent = 'Recording canceled.'; return; }
            const type = recorder.mimeType || mimeType;
            const extension = type.includes('mp4') ? 'mp4' : 'webm';
            download(new Blob(chunks, { type }), `${basename}.${extension}`);
            status.textContent = `${interruption}Video ready: ${width} × ${height} pixels. Use the download link to save again.`;
        } catch (error) {
            status.textContent = `Export failed: ${error.message}`;
        } finally {
            cancelAnimationFrame(frame);
            clearTimeout(endTimer);
            if (recorder && recorder.state !== 'inactive') recorder.stop();
            stream?.getTracks().forEach(track => track.stop());
            renderer?.destroy();
            stopRecording = undefined;
            settings.disabled = false;
            byId('exportStop').hidden = true;
            byId('exportCancel').hidden = true;
            busy = false;
        }
    }
    byId('exportImage').addEventListener('click', () => run(false));
    byId('exportVideo').addEventListener('click', () => run(true));
    byId('exportStop').addEventListener('click', () => stopRecording?.());
    byId('exportCancel').addEventListener('click', () => stopRecording?.(true));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) stopRecording?.(false, 'Recording stopped because the tab was hidden. ');
    });
    window.addEventListener('pagehide', () => {
        stopRecording?.(true);
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    });
}
