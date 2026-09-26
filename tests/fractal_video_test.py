"""Frame-accurate exports and motion editing against the running site.

Run with the Playwright Python environment; ffprobe verifies the actual file.
"""
import itertools
import json
import os
from pathlib import Path
import subprocess
import tempfile

from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_URL', 'http://localhost:4000')


def wait_idle(page):
    page.wait_for_function("!document.getElementById('exportSettings').disabled", timeout=60000)
    assert 'failed' not in page.locator('#exportStatus').inner_text().lower(), page.locator('#exportStatus').inner_text()


def save_video(page, button, directory, filename):
    page.evaluate('window.exportFrames = []')
    with page.expect_download(timeout=60000) as event:
        page.locator(button).click()
    path = Path(directory) / filename
    event.value.save_as(path)
    wait_idle(page)
    return path, page.evaluate('window.exportFrames')


def inspect_video(path, fps, frames):
    result = json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-count_frames', '-show_entries',
        'stream=nb_read_frames,r_frame_rate,width,height:format=duration', '-of', 'json', str(path)]))
    assert int(result['streams'][0]['nb_read_frames']) == frames, result
    assert result['streams'][0]['r_frame_rate'] == f'{fps}/1', result
    assert abs(float(result['format']['duration']) - frames / fps) < .00001, result


with sync_playwright() as p, tempfile.TemporaryDirectory() as directory:
    browser = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1280, 'height': 1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE + '/complex_fractals/newton_fractal/')
    page.wait_for_function("document.getElementById('fractalStatus').hidden")
    page.locator('#exportSection').evaluate('(element) => element.open = true')
    assert page.locator('#exportRender').is_disabled()
    assert page.locator('#exportOverdub').is_disabled()
    # Small, short takes exercise the real rendering/encoding path quickly.
    page.evaluate('''async () => {
        exportSize.add(new Option('Test', '320')); exportSize.value = '320';
        exportDuration.add(new Option('Test', '1')); exportDuration.value = '1';
        iterSlider.value = 2; iterSlider.dispatchEvent(new Event('input'));
        const {Renderer} = await import('/complex_fractals/renderer.js');
        const render = Renderer.prototype.render;
        window.exportFrames = [];
        Renderer.prototype.render = function(values) {
            if (!this.canvas.isConnected) exportFrames.push(structuredClone(values));
            return render.call(this, values);
        };
    }''')
    # Time interpolation, proportional zoom, jitter filtering and C2 loop seams.
    page.evaluate('''async () => {
        const {createTake, addSample, sampleTrack, compileTake, TRACKS} = await import('/complex_fractals/motion.js');
        const assert = (condition, message) => { if (!condition) throw new Error(message); };
        const values = {pan: [0, 0, 0, 0], zoom: [0, 0], parameters: [0, 0, 2, 1, 0, 0, 0, 1, 0, 0, 0, 1]};
        const take = createTake(values, 2, {smooth: 0, loop: false});
        addSample(take.tracks.zoom, 2, [Math.log(16), 0]);
        assert(Math.abs(Math.exp(compileTake(take)(1).zoom[0]) - 4) < 1e-9, 'zoom must interpolate geometrically');
        assert(sampleTrack([{time: 0, value: [0]}, {time: .1, value: [1]}, {time: 2, value: [2]}], .05)[0] === .5, 'irregular event interpolation');
        for (let i = 1; i <= 40; i++) addSample(take.tracks.pan, i / 20, [i % 2, 0, 0, 0]);
        const raw = compileTake(take);
        take.tracks.pan.effects.smooth = .35;
        const smooth = compileTake(take);
        let rawVariation = 0, smoothVariation = 0;
        for (let i = 10; i < 30; i++) {
            rawVariation += Math.abs(raw(i / 20).pan[0] - raw((i + 1) / 20).pan[0]);
            smoothVariation += Math.abs(smooth(i / 20).pan[0] - smooth((i + 1) / 20).pan[0]);
        }
        assert(smoothVariation < rawVariation * .1, 'smoothing should remove jitter');
        for (const key of TRACKS) take.tracks[key].effects.loop = true;
        const loop = compileTake(take);
        for (const key of TRACKS) for (let i = 0; i < values[key].length; i++) {
            assert(Math.abs(loop(0)[key][i] - loop(2)[key][i]) < 1e-9, 'loop endpoint mismatch');
            assert(Math.abs(loop(.0001)[key][i] - loop(0)[key][i]) < 1e-6, 'start seam velocity');
            assert(Math.abs(loop(2)[key][i] - loop(1.9999)[key][i]) < 1e-6, 'end seam velocity');
        }
    }''')
    for fps in [24, 25, 30, 50, 60]:
        page.locator('#exportFps').select_option(str(fps))
        path, frames = save_video(page, '#exportVideo', directory, f'{fps}.webm')
        inspect_video(path, fps, fps)
        assert len(frames) == fps
        assert all(frame['u_hide_overlays'] == 1 and frame['u_show_path'] == 0 for frame in frames)
        assert frames[-1]['u_zoom'] < frames[0]['u_zoom']
    # Browser playback, duration and seeking, not just container metadata.
    metadata = page.evaluate('''async () => {
        const video = document.createElement('video'); video.src = exportDownload.href;
        await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(video.error.message); });
        video.currentTime = .5;
        await new Promise((resolve, reject) => { video.onseeked = resolve; video.onerror = () => reject(video.error.message); });
        return [video.duration, video.videoWidth, video.videoHeight, video.currentTime];
    }''')
    assert metadata == [1, 320, 320, .5], metadata
    # Record a live take with changes in each movement category.
    page.locator('#exportFps').select_option('24')
    page.locator('#exportMotion').select_option('live')
    page.locator('#exportSmooth').select_option('0.15')
    page.locator('#exportLoop').check()
    page.evaluate('''() => {
        exportFrames = [];
        exportVideo.click();
        setTimeout(() => {
            const c = document.getElementById('canvas-main');
            for (const key of ['ArrowRight', '+', 'm', 'ArrowUp', 'm']) c.dispatchEvent(new KeyboardEvent('keydown', {key}));
            iterSlider.value = 4; iterSlider.dispatchEvent(new Event('input'));
            color0.value = '#0088ff'; color0.dispatchEvent(new Event('input'));
        }, 250);
    }''')
    wait_idle(page)
    baseline = page.evaluate('window.exportFrames')
    assert len(baseline) == 24
    assert baseline[0]['u_pan'] != baseline[10]['u_pan']
    assert baseline[0]['u_zoom'] != baseline[10]['u_zoom']
    assert baseline[0]['u_root_position'] != baseline[10]['u_root_position']
    # All seven nonempty replacement combinations. Deliberately switch effects
    # off: unchecked tracks must retain their previous smoothed, looping motion.
    page.locator('#exportSmooth').select_option('0')
    page.locator('#exportLoop').uncheck()
    fields = {'Pan': ['u_pan'], 'Zoom': ['u_zoom'], 'Parameters': ['u_root_position', 'u_iterations', 'u_color0']}
    for choices in itertools.product([False, True], repeat=3):
        if not any(choices):
            continue
        for label, selected in zip(fields, choices):
            page.locator('#replace' + label).set_checked(selected)
        page.evaluate('''() => {
            exportFrames = [];
            exportOverdub.click();
            setTimeout(() => {
                const c = document.getElementById('canvas-main');
                for (const key of ['ArrowLeft', '-', 'm', 'ArrowDown', 'm']) c.dispatchEvent(new KeyboardEvent('keydown', {key}));
            }, 250);
        }''')
        wait_idle(page)
        replacement = page.evaluate('window.exportFrames')
        assert len(replacement) == len(baseline) == 24
        for label, selected in zip(fields, choices):
            if selected:
                assert any([frame[field] for frame in replacement] != [frame[field] for frame in baseline]
                           for field in fields[label]), (choices, label, 'selected track did not change')
            else:
                for field in fields[label]:
                    assert [frame[field] for frame in replacement] == [frame[field] for frame in baseline], (choices, field)
        baseline = replacement
    # Empty selection is disabled; canceling a replacement preserves the take.
    for label in fields:
        page.locator('#replace' + label).uncheck()
    assert page.locator('#exportOverdub').is_disabled()
    page.locator('#replacePan').check()
    page.locator('#exportOverdub').click()
    page.locator('#exportCancel').click()
    wait_idle(page)
    assert 'Canceled' in page.locator('#exportStatus').inner_text()
    assert page.locator('#exportRender').is_enabled()
    # Cancel an offline render, then retry the saved take.
    page.evaluate('''() => { exportRender.click(); setTimeout(() => exportCancel.click(), 0); }''')
    wait_idle(page)
    assert 'Canceled' in page.locator('#exportStatus').inner_text()
    path, frames = save_video(page, '#exportRender', directory, 'retry.webm')
    inspect_video(path, 24, 24)
    # Stop a partial replacement: untouched tracks and total duration survive.
    page.evaluate('''() => { exportFrames = []; exportOverdub.click(); setTimeout(() => exportStop.click(), 200); }''')
    wait_idle(page)
    assert len(page.evaluate('window.exportFrames')) == 24
    # The encoder must wait even if rendering is slower than the chosen fps.
    page.evaluate('''async () => {
        const {encodeVideo} = await import('/complex_fractals/video.js');
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d'); let count = 0;
        const blob = await encodeVideo({canvas, fps: 60, duration: .5, canceled: () => false, progress() {},
            draw(time) { const until = performance.now() + 20; while (performance.now() < until) {};
                ctx.fillStyle = `rgb(${count++ * 8},0,0)`; ctx.fillRect(0,0,32,32); }});
        if (count !== 30) throw new Error('Skipped render frames');
        exportDownload.href = URL.createObjectURL(blob); exportDownload.download = 'slow-render.webm';
    }''')
    with page.expect_download() as event:
        page.locator('#exportDownload').click()
    path = Path(directory) / 'slow-render.webm'
    event.value.save_as(path)
    inspect_video(path, 60, 30)
    # Reject an encoder that silently loses a frame, instead of saving a file.
    page.evaluate('''async () => {
        const {encodeVideo} = await import('/complex_fractals/video.js');
        const NativeEncoder = window.VideoEncoder; let closed = false;
        window.VideoEncoder = class {
            static async isConfigSupported(config) { return {supported: true, config}; }
            constructor({output}) { this.output = output; this.state = 'configured'; }
            configure() {}
            encode(frame) {
                if (frame.timestamp === 0) this.output({timestamp: 0, byteLength: 1, type: 'key', copyTo() {}});
            }
            async flush() {}
            close() { closed = true; this.state = 'closed'; }
        };
        try {
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
            let rejected = false;
            try { await encodeVideo({canvas, fps: 30, duration: .1, draw() {}, canceled: () => false, progress() {}}); }
            catch (error) { rejected = error.message.includes('preserve every frame'); }
            if (!rejected || !closed) throw new Error('Dropped frames must fail and release the encoder');
        } finally { window.VideoEncoder = NativeEncoder; }
    }''')
    # Exercise the actual default resolution, plus preview restoration and PNG.
    page.locator('#exportMotion').select_option('zoom')
    page.locator('#exportSize').select_option('1920')
    page.locator('#exportShape').select_option('landscape')
    path, frames = save_video(page, '#exportVideo', directory, 'full-size.webm')
    inspect_video(path, 24, 24)
    assert page.evaluate('''async () => {
        const {Renderer} = await import('/complex_fractals/renderer.js');
        const canvas = document.getElementById('canvas-main'), gl = canvas.getContext('webgl');
        const program = gl.getParameter(gl.CURRENT_PROGRAM);
        window.readView = () => ['u_pan', 'u_zoom', 'u_root_position', 'u_iterations', 'u_color0'].map(name => {
            const value = gl.getUniform(program, gl.getUniformLocation(program, name));
            return ArrayBuffer.isView(value) ? Array.from(value) : value;
        });
        window.beforePreview = readView(); return true;
    }''')
    page.locator('#exportPreview').click()
    wait_idle(page)
    assert page.evaluate('JSON.stringify(beforePreview) === JSON.stringify(readView())')
    with page.expect_download() as event:
        page.locator('#exportImage').click()
    assert event.value.suggested_filename.endswith('1920x1080.png')
    wait_idle(page)
    # Shared UI initializes on every family and narrow screens.
    for family in ['az_one_minus_z', 'z2_plus_c']:
        page.goto(BASE + f'/complex_fractals/{family}/')
        page.wait_for_function("document.getElementById('fractalStatus').hidden")
        page.set_viewport_size({'width': 390, 'height': 844})
        page.locator('#exportSection').evaluate('(element) => element.open = true')
        assert page.locator('#exportVideo').is_enabled()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    # Unsupported browsers retain PNG and motion features without promising CFR.
    unsupported = browser.new_page()
    unsupported.add_init_script('window.VideoEncoder = undefined')
    unsupported.goto(BASE + '/complex_fractals/az_one_minus_z/')
    unsupported.wait_for_function("document.getElementById('fractalStatus').hidden")
    unsupported.locator('#exportSection').evaluate('(element) => element.open = true')
    assert 'WebCodecs' in unsupported.locator('#videoSupport').inner_text()
    assert unsupported.locator('#exportImage').is_enabled()
    assert unsupported.locator('#exportRender').is_disabled()
    assert not errors, errors
    browser.close()
    print('PASS: frame counts at every fps, playback/seek, slow rendering, smoothing/loops, all seven replacement combinations, cancellation, partial takes and browser support')
