"""Export integration checks against the running Jekyll site."""
import os
import struct
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_URL', 'http://localhost:4000')
FAMILIES = ['newton_fractal', 'az_one_minus_z', 'z2_plus_c']

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    page = browser.new_page(viewport={'width': 1200, 'height': 900}, accept_downloads=True)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))

    def open_explorer(slug):
        page.goto(BASE + '/complex_fractals/' + slug + '/')
        page.wait_for_function("!document.getElementById('exportSection').hidden")
        page.locator('#exportSection summary').click()

    def png():
        with page.expect_download(timeout=60000) as result:
            page.locator('#exportImage').click()
        data = Path(result.value.path()).read_bytes()
        assert data[:8] == b'\x89PNG\r\n\x1a\n'
        return data

    for slug in FAMILIES:
        open_explorer(slug)
        original = page.locator('#canvas-main').evaluate('(c) => c.toDataURL()')
        first = png()
        assert struct.unpack('>II', first[16:24]) == (1920, 1920)
        assert page.locator('#canvas-main').evaluate('(c) => c.toDataURL()') == original
        page.locator('#showOrbit').check()
        page.wait_for_timeout(100)
        assert png() == first, 'Orbit paths must never enter PNG exports'
        # Critical/root markers are visible in the explorer but absent in the PNG.
        x = {'newton_fractal': .3, 'az_one_minus_z': .75, 'z2_plus_c': .5}[slug]
        marker = page.evaluate('''async x => {
            const image = new Image(); image.src = document.getElementById('exportDownload').href; await image.decode();
            const output = document.createElement('canvas'); output.width = image.width; output.height = image.height;
            const ctx = output.getContext('2d'); ctx.drawImage(image, 0, 0);
            const clean = [...ctx.getImageData(Math.floor(image.width * x), Math.floor(image.height / 2), 1, 1).data];
            const live = document.getElementById('canvas-main'); const gl = live.getContext('webgl');
            const pixel = new Uint8Array(4); gl.readPixels(Math.floor(live.width * x), Math.floor(live.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            return {clean, live: [...pixel]};
        }''', x)
        assert sum(abs(a-b) for a,b in zip(marker['clean'][:3], marker['live'][:3])) > 50, marker
        page.locator('#exportPanel').select_option('param')
        before = png()
        page.locator('#mode-param').select_option('point')
        page.locator('#canvas-param').focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(100)
        assert png() == before, 'Moving only a parameter marker must not change the exported parameter plane'

    open_explorer('newton_fractal')
    page.locator('#exportSize').select_option('3840')
    page.locator('#exportShape').select_option('landscape')
    assert struct.unpack('>II', png()[16:24]) == (3840, 2160)
    page.locator('#exportSize').select_option('7680')
    page.locator('#exportVideo').click()
    assert '1920 or 3840' in page.locator('#exportStatus').inner_text()
    assert page.locator('#exportImage').is_enabled()
    page.locator('#exportSize').select_option('1920')
    page.locator('#exportDuration').select_option('5')
    original = page.locator('#canvas-main').evaluate('(c) => c.toDataURL()')
    with page.expect_download(timeout=60000) as result:
        page.locator('#exportVideo').click()
    assert Path(result.value.path()).stat().st_size > 1000
    info = page.evaluate('''async () => {
        const video = document.createElement('video'); video.muted = true;
        video.src = document.getElementById('exportDownload').href;
        await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = reject; });
        const sample = async time => {
            video.currentTime = time;
            await new Promise(resolve => video.onseeked = resolve);
            const c = document.createElement('canvas'); c.width = 160; c.height = 90;
            c.getContext('2d').drawImage(video, 0, 0, 160, 90); return c.toDataURL();
        };
        const first = await sample(.1); const last = await sample(3);
        return {width: video.videoWidth, height: video.videoHeight, changes: first !== last};
    }''')
    assert info == {'width': 1920, 'height': 1080, 'changes': True}, info
    assert page.locator('#canvas-main').evaluate('(c) => c.toDataURL()') == original
    saved_link = page.locator('#exportDownload').get_attribute('href')
    page.locator('#exportVideo').click()
    page.locator('#exportCancel').wait_for(state='visible')
    page.wait_for_timeout(300)
    page.locator('#exportCancel').click()
    page.wait_for_function("document.getElementById('exportStatus').textContent === 'Recording canceled.'")
    assert page.locator('#exportDownload').get_attribute('href') == saved_link
    assert page.locator('#exportImage').is_enabled()
    # Check that a stopped 4K live recording produces a playable high-resolution file.
    page.locator('#exportSize').select_option('3840')
    page.locator('#exportMotion').select_option('live')
    page.locator('#exportVideo').click()
    page.locator('#exportStop').wait_for(state='visible')
    page.wait_for_timeout(1500)
    with page.expect_download(timeout=60000) as result:
        page.locator('#exportStop').click()
    result.value.save_as('/tmp/fractal-4k.webm')
    assert Path(result.value.path()).stat().st_size > 1000
    dimensions = page.evaluate('''async () => {
        const v = document.createElement('video'); v.src = document.getElementById('exportDownload').href;
        await new Promise((resolve, reject) => { v.onloadedmetadata = resolve; v.onerror = reject; });
        return [v.videoWidth, v.videoHeight];
    }''')
    assert dimensions == [3840, 2160], dimensions
    # No recorder support must leave images usable.
    unsupported = browser.new_page()
    unsupported.add_init_script('window.MediaRecorder = undefined;')
    unsupported.goto(BASE + '/complex_fractals/z2_plus_c/')
    unsupported.wait_for_function("!document.getElementById('exportSection').hidden")
    unsupported.locator('#exportSection summary').click()
    assert unsupported.locator('#exportVideo').is_disabled()
    assert unsupported.locator('#exportImage').is_enabled()
    assert not errors, errors
    browser.close()
    print('PASS: all six clean shaders, PNG dimensions, 4K video, animated playback, cancellation, stop, and missing recorder support')
