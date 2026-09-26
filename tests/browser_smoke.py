"""Run against `bundle exec jekyll serve` with Python Playwright installed."""
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_URL', 'http://localhost:4000')
FRACTALS = ['newton_fractal', 'az_one_minus_z', 'z2_plus_c']

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    context = browser.new_context(viewport={'width': 1280, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE)
    page.emulate_media(color_scheme='dark')
    page.evaluate("localStorage.setItem('theme', 'light')")
    page.goto(BASE + '/recipes/')
    assert page.locator('#themeSelect, header, footer').count() == 0
    assert page.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(24, 28, 25)'
    assert page.locator('.back-nav a').first.get_attribute('href') == '/'
    page.locator('#listSearch').fill('no-such-recipe')
    assert page.locator('#contentList li:visible').count() == 0
    assert 'No recipes' in page.locator('#searchStatus').inner_text()
    page.locator('#listSearch').fill('vegana')
    assert page.locator('#contentList li:visible').count() == 1
    page.goto(BASE + '/recipes/cookies/')
    checkbox = page.locator('.task-list-item input').first
    checkbox.check()
    page.reload()
    assert checkbox.is_checked()
    page.locator('#resetChecklist').click()
    assert not checkbox.is_checked()
    for slug in FRACTALS:
        page.goto(BASE + '/complex_fractals/' + slug + '/')
        page.wait_for_function("document.getElementById('fractalStatus').hidden")
        assert page.locator('canvas').count() == 2
        assert page.locator('#explorerControls').is_enabled()
        canvas = page.locator('#canvas-main')
        original = canvas.evaluate('(canvas) => canvas.toDataURL()')
        page.locator('#zoomIn-main').click()
        page.wait_for_timeout(100)
        assert canvas.evaluate('(canvas) => canvas.toDataURL()') != original
        page.locator('#reset-main').click()
        page.wait_for_timeout(100)
        assert canvas.evaluate('(canvas) => canvas.toDataURL()') == original
        page.locator('#mode-main').select_option('point')
        canvas.focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_timeout(100)
        assert canvas.evaluate('(canvas) => canvas.toDataURL()') != original
        page.locator('#showOrbit').check()
        page.locator('#lockOrbit').check()
        page.locator('#iterSlider').fill('30')
        page.locator('#iterSlider').dispatch_event('input')
        page.wait_for_timeout(100)
        with page.expect_popup() as popup_info:
            page.locator('#popout-main').click()
        popup = popup_info.value
        popup.wait_for_function("document.getElementById('fractalStatus').hidden")
        assert popup.locator('#iterSlider').input_value() == '30'
        assert popup.locator('#window-param').is_hidden()
        popup.close()
        assert page.evaluate("document.querySelector('#canvas-main').getContext('webgl').getError()") == 0
    # H2 sections fill each row left-to-right, preserving all nested subsections.
    page.goto(BASE + '/cv/')
    sections = page.locator('article > .section-block')
    assert sections.count() == 8
    boxes = [sections.nth(i).bounding_box() for i in range(4)]
    assert boxes[0]['y'] == boxes[1]['y'] and boxes[0]['x'] < boxes[1]['x']
    assert boxes[2]['y'] == boxes[3]['y'] and boxes[2]['y'] > boxes[0]['y']
    assert sections.nth(2).locator('h3').count() == 2
    page.screenshot(path='/tmp/site-cv-sections.png', full_page=True)
    page.set_viewport_size({'width': 390, 'height': 844})
    boxes = [sections.nth(i).bounding_box() for i in range(4)]
    assert all(boxes[i]['y'] < boxes[i+1]['y'] for i in range(3))
    page.set_viewport_size({'width': 1280, 'height': 1000})
    page.goto(BASE + '/complex_fractals/newton_fractal/')
    page.wait_for_function("document.getElementById('fractalStatus').hidden")
    main = page.locator('#window-main').bounding_box()
    param = page.locator('#window-param').bounding_box()
    guide = page.locator('.fractal-guide > .section-block').nth(0).bounding_box()
    reading = page.locator('.fractal-guide > .section-block').nth(1).bounding_box()
    assert main['y'] == param['y'] and main['x'] < param['x']
    assert guide['y'] == reading['y'] and guide['y'] > main['y']
    assert page.locator('.back-nav a').nth(1).get_attribute('href') == '/complex_fractals/'
    page.screenshot(path='/tmp/site-desktop.png', full_page=True)
    mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    phone = mobile.new_page()
    for route in ['/', '/recipes/', '/recipes/cookies/', '/cv/'] + ['/complex_fractals/' + slug + '/' for slug in FRACTALS]:
        phone.goto(BASE + route)
        if route.endswith(tuple(slug + '/' for slug in FRACTALS)):
            phone.wait_for_function("document.getElementById('fractalStatus').hidden")
            phone.locator('#mode-param').select_option('point')
            phone.locator('#canvas-param').tap(position={'x': 120, 'y': 120})
        assert phone.evaluate('document.documentElement.scrollWidth <= innerWidth'), route
        phone.emulate_media(color_scheme='light')
        assert phone.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(250, 250, 248)'
        phone.emulate_media(color_scheme='dark')
        assert phone.evaluate('getComputedStyle(document.body).backgroundColor') == 'rgb(24, 28, 25)'
    phone.screenshot(path='/tmp/site-mobile.png', full_page=True)
    # A denied storage API must not disable page controls.
    denied = browser.new_context()
    denied.add_init_script("Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error('Denied'); };")
    denied_page = denied.new_page()
    denied_page.goto(BASE + '/recipes/cookies/')
    denied_page.locator('.task-list-item input').first.check()
    assert denied_page.locator('.task-list-item input').first.is_checked()
    assert not errors, errors
    browser.close()
    print('PASS: themes, listings, checklists, all six shaders, controls, pop-outs, mobile layout, and denied storage')
