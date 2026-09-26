"""Real mouse/touch and browser-history regressions against the running site."""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_URL', 'http://localhost:4000')
URL = BASE + '/complex_fractals/newton_fractal/'


def state(page):
    page.wait_for_timeout(80)
    return page.locator('#canvas-main').evaluate('''canvas => {
        const gl = canvas.getContext('webgl'), program = gl.getParameter(gl.CURRENT_PROGRAM);
        const read = name => gl.getUniform(program, gl.getUniformLocation(program, name));
        return { point: Array.from(read('u_root_position')), zoom: read('u_zoom'), pan: Array.from(read('u_pan')) };
    }''')


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    desktop = browser.new_page(viewport={'width': 1280, 'height': 1000})
    desktop.goto(URL)
    desktop.wait_for_function("document.getElementById('fractalStatus').hidden")
    canvas = desktop.locator('#canvas-main')
    canvas.scroll_into_view_if_needed()
    box = canvas.bounding_box()
    x, y = box['x'] + 100, box['y'] + 100
    desktop.mouse.move(x, y)
    initial = state(desktop)
    desktop.mouse.wheel(0, -150)
    zoomed = state(desktop)
    assert zoomed['zoom'] != initial['zoom'] and zoomed['point'] == initial['point']
    desktop.mouse.click(x, y, button='right')
    desktop.mouse.move(x + 30, y + 20)
    placed = state(desktop)
    assert placed['point'] != initial['point']
    assert desktop.locator('#modeStatus-param').inner_text().startswith('Pan / zoom')
    # Keyboard focus has no effect on the desktop mode or wheel zoom.
    canvas.evaluate('(c) => c.blur()')
    desktop.mouse.wheel(0, -150)
    zoomed = state(desktop)
    assert zoomed['zoom'] != placed['zoom'] and zoomed['point'] == placed['point']
    desktop.mouse.click(x + 30, y + 20, button='right')
    switched = state(desktop)
    desktop.mouse.move(x + 40, y + 30)
    assert state(desktop)['point'] == switched['point']
    # Native fullscreen hides the entry button; the browser exit restores it.
    desktop.locator('#fullscreen-main').click()
    desktop.wait_for_function('document.fullscreenElement !== null')
    assert desktop.locator('#fullscreen-main').is_hidden()
    desktop.evaluate('document.exitFullscreen()')
    desktop.locator('#fullscreen-main').wait_for(state='visible')

    phone = browser.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    phone.goto(URL)
    phone.wait_for_function("document.getElementById('fractalStatus').hidden")
    phone.locator('#canvas-main').scroll_into_view_if_needed()
    box = phone.locator('#canvas-main').bounding_box()
    x, y = box['x'] + 120, box['y'] + 120
    cdp = phone.context.new_cdp_session(phone)

    def touch(kind, points):
        cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [
            {'id': i, 'x': px, 'y': py} for i, px, py in points]})

    def tap():
        touch('touchStart', [(1, x, y)])
        touch('touchEnd', [])

    initial = state(phone)
    # A fresh one-finger drag pans without moving a root.
    touch('touchStart', [(1, x, y)])
    touch('touchMove', [(1, x + 25, y)])
    touch('touchEnd', [])
    panned = state(phone)
    assert panned['point'] == initial['point'] and panned['pan'] != initial['pan']
    tap()
    touch('touchStart', [(1, x, y)])
    touch('touchMove', [(1, x + 30, y + 25)])
    moved = state(phone)
    assert moved['point'] != initial['point']
    # Adding a finger during placement rolls back the accidental move.
    touch('touchStart', [(1, x + 30, y + 25), (2, x + 70, y + 25)])
    assert state(phone)['point'] == initial['point']
    touch('touchMove', [(1, x + 10, y + 25), (2, x + 100, y + 25)])
    pinched = state(phone)
    assert pinched['zoom'] != moved['zoom'] and pinched['point'] == initial['point']
    touch('touchEnd', [(1, x + 10, y + 25)])
    touch('touchMove', [(1, x + 20, y + 40)])
    assert state(phone)['point'] == initial['point']
    touch('touchEnd', [])
    # A pinch immediately following a tap must not be mistaken for placement.
    tap()
    touch('touchStart', [(1, x, y)])
    touch('touchStart', [(1, x, y), (2, x + 60, y)])
    touch('touchMove', [(1, x - 20, y), (2, x + 90, y)])
    touch('touchEnd', [])
    assert state(phone)['point'] == initial['point']
    # A completed double-tap drag persists, but later single drags only pan.
    tap()
    touch('touchStart', [(1, x, y)])
    touch('touchMove', [(1, x + 40, y + 20)])
    touch('touchEnd', [])
    placed = state(phone)
    assert placed['point'] != initial['point']
    touch('touchStart', [(1, x, y)])
    touch('touchMove', [(1, x + 20, y)])
    touch('touchEnd', [])
    assert state(phone)['point'] == placed['point']

    # No native fullscreen API: Back and Esc must close the fallback on this page.
    phone.evaluate('''() => {
        const wrapper = document.getElementById('wrapper-main');
        wrapper.requestFullscreen = wrapper.webkitRequestFullscreen = undefined;
    }''')
    phone.locator('#fullscreen-main').click()
    phone.wait_for_function("document.getElementById('wrapper-main').classList.contains('fallback-fullscreen')")
    assert phone.locator('#fullscreen-main').is_hidden()
    phone.go_back()
    phone.locator('#fullscreen-main').wait_for(state='visible')
    assert phone.url == URL
    assert not phone.locator('#wrapper-main').evaluate("n => n.classList.contains('fallback-fullscreen')")
    phone.locator('#fullscreen-main').click()
    phone.keyboard.press('Escape')
    phone.locator('#fullscreen-main').wait_for(state='visible')
    assert phone.url == URL
    browser.close()
    print('PASS: independent right-click modes, zoom in both modes, double-tap placement, pinch priority, native and fallback fullscreen exits')
