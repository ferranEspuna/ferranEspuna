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
    # Two sections should occupy two centered slots, even with room for four.
    page.set_viewport_size({'width': 1920, 'height': 1080})
    page.goto(BASE)
    page.wait_for_function('getComputedStyle(document.querySelector("article")).columnCount === "2"')
    flow_box = page.locator('article').bounding_box()
    assert flow_box['width'] < 1000
    assert abs(flow_box['x'] - (1920 - flow_box['width']) / 2) < 1
    page.set_viewport_size({'width': 1280, 'height': 1000})
    # H2 sections flow downward before moving right; each section stays intact.
    page.goto(BASE + '/cv/')
    sections = page.locator('article > .section-block')
    assert sections.count() == 8
    boxes = [section.bounding_box() for section in sections.all()]
    assert len(set(box['x'] for box in boxes)) == 2
    for first, second in zip(boxes, boxes[1:]):
        assert second['x'] >= first['x']
        if first['x'] == second['x']:
            assert second['y'] >= first['y'] + first['height'] - 1
    assert all(section.evaluate('(node) => node.getClientRects().length') == 1 for section in sections.all())
    # Both explicit false and an omitted option fall back to one column.
    page.locator('article').evaluate('(node) => node.dataset.columns = "false"')
    assert len(set(section.bounding_box()['x'] for section in sections.all())) == 1
    page.locator('article').evaluate('(node) => delete node.dataset.columns')
    assert len(set(section.bounding_box()['x'] for section in sections.all())) == 1
    page.locator('article').evaluate('(node) => node.dataset.columns = "true"')
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
    assert main['x'] == param['x'] and main['y'] < param['y']
    assert guide['x'] == reading['x'] and guide['y'] < reading['y']
    assert guide['x'] > main['x']
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
