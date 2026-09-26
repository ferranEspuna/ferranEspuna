import { Renderer } from './renderer.js';
import { byId, clampZoom } from './fractal_common.js';
import { TRACKS, addSample, createTake, compileTake } from './motion.js';
import { canEncodeVideo, encodeVideo } from './video.js';

export function exportDimensions(edge, shape, canvas) {
    const ratio = { square: 1, landscape: 16 / 9, portrait: 9 / 16 }[shape] || canvas.width / canvas.height;
    return ratio >= 1 ? [edge, Math.max(2, Math.round(edge / ratio / 2) * 2)]
        : [Math.max(2, Math.round(edge * ratio / 2) * 2), edge];
}

export function setupExports({ renderers, uniforms, name, readMotion, writeMotion, motionUniforms, subscribeMotion }) {
    byId('exportSection').hidden = false;
    const settings = byId('exportSettings'), status = byId('exportStatus'), link = byId('exportDownload');
    let downloadUrl, savedTake, stopAction;
    let busy = false, phase = '', canceled = false;
    const effects = () => ({ smooth: Number(byId('exportSmooth').value), loop: byId('exportLoop').checked });
    function updateButtons() {
        byId('exportPreview').disabled = !savedTake;
        byId('exportRender').disabled = !savedTake || !canEncodeVideo();
        byId('exportReplace').disabled = !savedTake;
        byId('exportOverdub').disabled = !replacementTracks().length;
    }
    function replacementTracks() {
        return TRACKS.filter(key => byId(`replace${key[0].toUpperCase()}${key.slice(1)}`).checked);
    }
    if (!canEncodeVideo()) byId('videoSupport').textContent = 'Frame-by-frame video needs WebCodecs (current Chrome or Edge over HTTPS or localhost). You can still record and preview motion and save PNG images here.';
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
    function makeRenderer(video) {
        const panel = byId('exportPanel').value;
        const edge = Number(byId('exportSize').value);
        if (video && edge > 3840) throw new Error('Choose 1920 or 3840 px for video. 7680 px is available for PNG images.');
        const source = renderers[panel];
        const [width, height] = exportDimensions(edge, byId('exportShape').value, source.canvas);
        const gl = source.gl, viewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
        const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
        if (width > Math.min(limit, viewport[0]) || height > Math.min(limit, viewport[1])) {
            throw new Error('This resolution exceeds your graphics device’s limit. Choose a smaller size.');
        }
        const renderer = new Renderer(document.createElement('canvas'), source.source);
        renderer.resize(width, height);
        if (renderer.gl.drawingBufferWidth !== width || renderer.gl.drawingBufferHeight !== height) {
            renderer.destroy();
            throw new Error('The requested canvas size is unavailable. Choose a smaller resolution.');
        }
        return { renderer, panel, width, height, basename: `${name}-${panel}-${width}x${height}` };
    }
    function draw(renderer, values) {
        renderer.render({ ...values, u_hide_overlays: 1, u_show_path: 0, u_path_length: 0 });
        if (renderer.gl.isContextLost() || renderer.gl.getError() !== renderer.gl.NO_ERROR) {
            throw new Error('The graphics device could not render this export. Try a smaller resolution.');
        }
    }
    function applyEffects(take) {
        const updated = structuredClone(take);
        for (const key of TRACKS) updated.tracks[key].effects = effects();
        return updated;
    }
    async function renderVideo(take) {
        phase = 'render';
        byId('exportStop').hidden = true;
        stopAction = () => { canceled = true; };
        status.textContent = 'Preparing frame-by-frame video…';
        await new Promise(resolve => setTimeout(resolve, 0));
        if (canceled) return;
        const { renderer, panel, width, height, basename } = makeRenderer(true);
        try {
            const fps = Number(byId('exportFps').value), playback = compileTake(take);
            const blob = await encodeVideo({ canvas: renderer.canvas, fps, duration: take.duration,
                draw: time => draw(renderer, motionUniforms(panel, playback(time))),
                canceled: () => canceled,
                progress: (done, total) => { status.textContent = `Rendering ${width} × ${height} · ${done} / ${total} frames · ${fps} fps. Motion is saved; you can cancel and re-render.`; } });
            if (!blob) return;
            download(blob, `${basename}-${fps}fps.webm`);
            status.textContent = `Video ready: ${width} × ${height} · ${Math.max(1, Math.round(take.duration * fps))} frames · ${fps} fps. Every frame encoded. Motion saved for re-recording.`;
        } finally { renderer.destroy(); }
    }
    function captureMotion(previous, selected) {
        phase = 'capture';
        const duration = previous?.duration || Number(byId('exportDuration').value);
        const base = previous && compileTake(previous);
        if (base) writeMotion(base(0));
        const take = previous ? structuredClone(previous) : createTake(readMotion(), duration, effects());
        for (const key of selected) take.tracks[key] = { samples: [], effects: effects() };
        const start = performance.now();
        let frame, timer, unsubscribe, done = false;
        const elapsed = () => Math.min(duration, (performance.now() - start) / 1000);
        const sample = time => {
            const values = readMotion();
            for (const key of selected) addSample(take.tracks[key], time, values[key]);
        };
        sample(0);
        byId('exportStop').hidden = false;
        byId('exportStop').textContent = 'Stop and save motion';
        return new Promise((resolve, reject) => {
            const finish = (discard = false, error) => {
                if (done) return;
                done = true;
                cancelAnimationFrame(frame);
                clearTimeout(timer);
                unsubscribe?.();
                if (discard) { canceled = true; resolve(null); return; }
                if (error) { reject(error); return; }
                const time = Math.max(.001, elapsed());
                sample(time);
                // A partial replacement must never truncate the untouched tracks.
                take.duration = previous ? duration : time;
                for (const key of selected) addSample(take.tracks[key], take.duration, readMotion()[key]);
                resolve(take);
            };
            stopAction = discard => finish(discard);
            unsubscribe = subscribeMotion(() => { if (!done) sample(elapsed()); });
            function tick() {
                if (done) return;
                try {
                    const time = elapsed();
                    if (base) {
                        const values = readMotion(), replay = base(time);
                        for (const key of TRACKS) if (!selected.includes(key)) values[key] = replay[key];
                        writeMotion(values);
                    }
                    sample(time);
                    status.textContent = `Recording ${selected.join(', ')} · ${time.toFixed(1)} / ${duration.toFixed(1)} seconds. Use the explorer controls above${base ? '; unchecked movements play automatically' : ''}.`;
                    if (time >= duration) finish();
                    else frame = requestAnimationFrame(tick);
                } catch (error) { finish(false, error); }
            }
            frame = requestAnimationFrame(tick);
            timer = setTimeout(() => finish(), duration * 1000);
        });
    }
    async function preview(take) {
        phase = 'preview';
        const playback = compileTake(take), original = readMotion();
        const start = performance.now();
        byId('exportStop').hidden = false;
        byId('exportStop').textContent = 'Stop preview';
        try {
            await new Promise((resolve, reject) => {
                let frame;
                stopAction = discard => { canceled = Boolean(discard); cancelAnimationFrame(frame); resolve(); };
                function tick(now) {
                    try {
                        const time = Math.min(take.duration, (now - start) / 1000);
                        writeMotion(playback(time));
                        status.textContent = `Preview · ${time.toFixed(1)} / ${take.duration.toFixed(1)} seconds.`;
                        if (time >= take.duration) resolve();
                        else frame = requestAnimationFrame(tick);
                    } catch (error) { reject(error); }
                }
                frame = requestAnimationFrame(tick);
            });
        } finally { writeMotion(original); }
        status.textContent = 'Preview finished. Saved motion is ready to render or re-record.';
    }
    async function run(action) {
        if (busy) return;
        busy = true;
        canceled = false;
        settings.disabled = true;
        byId('exportCancel').hidden = false;
        byId('exportCancel').textContent = 'Cancel';
        status.textContent = 'Preparing…';
        try {
            if (action === 'image') {
                phase = 'image';
                stopAction = () => { canceled = true; };
                await new Promise(resolve => setTimeout(resolve, 0));
                const { renderer, panel, width, height, basename } = makeRenderer(false);
                try {
                    draw(renderer, structuredClone(uniforms(panel)));
                    const blob = await new Promise(resolve => renderer.canvas.toBlob(resolve, 'image/png'));
                    if (!canceled) {
                        download(blob, `${basename}.png`);
                        status.textContent = `PNG ready: ${width} × ${height} pixels.`;
                    }
                } finally { renderer.destroy(); }
                return;
            }
            if (action === 'new') {
                if (Number(byId('exportSize').value) > 3840) throw new Error('Choose 1920 or 3840 px for video.');
                if (byId('exportMotion').value === 'zoom') {
                    const values = readMotion(), duration = Number(byId('exportDuration').value);
                    savedTake = createTake(values, duration, effects());
                    const panel = byId('exportPanel').value === 'main' ? 0 : 1;
                    const endZoom = [...values.zoom];
                    endZoom[panel] = Math.log(clampZoom(Math.exp(endZoom[panel]) / 4));
                    addSample(savedTake.tracks.zoom, duration, endZoom);
                } else {
                    const take = await captureMotion(null, TRACKS);
                    if (!take) return;
                    savedTake = take;
                }
            } else if (action === 'overdub') {
                if (!savedTake || !replacementTracks().length) throw new Error('Select at least one movement to re-record.');
                const original = readMotion();
                const take = await captureMotion(savedTake, replacementTracks());
                if (!take) { writeMotion(original); return; }
                savedTake = take;
            } else {
                if (!savedTake) throw new Error('Record a take first.');
                savedTake = applyEffects(savedTake);
            }
            if (action === 'preview') await preview(savedTake);
            else if (canEncodeVideo()) await renderVideo(savedTake);
            else status.textContent = 'Motion saved. Preview and re-record are available; video export needs a browser with WebCodecs.';
        } catch (error) {
            status.textContent = `Export failed: ${error.message}${savedTake ? ' Your saved motion is still available.' : ''}`;
        } finally {
            if (canceled) status.textContent = `Canceled.${savedTake ? ' Previous saved motion is available to re-render or re-record.' : ''}`;
            stopAction = undefined;
            phase = '';
            settings.disabled = false;
            byId('exportStop').hidden = true;
            byId('exportCancel').hidden = true;
            busy = false;
            updateButtons();
        }
    }
    for (const [id, action] of Object.entries({ exportImage: 'image', exportVideo: 'new', exportRender: 'render', exportPreview: 'preview', exportOverdub: 'overdub' })) {
        byId(id).addEventListener('click', () => run(action));
    }
    for (const key of TRACKS) byId(`replace${key[0].toUpperCase()}${key.slice(1)}`).addEventListener('change', updateButtons);
    byId('exportStop').addEventListener('click', () => stopAction?.(false));
    byId('exportCancel').addEventListener('click', () => stopAction?.(true));
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && (phase === 'capture' || phase === 'preview')) stopAction?.(true);
    });
    window.addEventListener('pagehide', () => {
        stopAction?.(true);
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    });
    updateButtons();
}
