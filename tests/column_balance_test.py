"""Check column partitions against every order-preserving alternative."""
from itertools import combinations
import os
from playwright.sync_api import sync_playwright

BASE = os.environ.get('SITE_URL', 'http://localhost:4000')


def check_balance(page, count):
    page.wait_for_timeout(100)
    boxes = page.locator('article .section-block').evaluate_all('''nodes => nodes.map(node => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y, height: box.height, fragments: node.getClientRects().length,
            title: node.querySelector('h2').textContent };
    })''')
    heights = [box['height'] for box in boxes]
    assert [box['title'] for box in boxes] == [
        'Research Interests', 'Current Position', 'Education', 'Publications',
        'Research Experience', 'Technical Skills', 'Awards and Distinctions', 'Selected Project',
    ]
    columns = {}
    previous_x = -1
    for box in boxes:
        assert box['fragments'] == 1, box
        assert box['x'] >= previous_x, 'Section order changed'
        previous_x = box['x']
        columns.setdefault(box['x'], []).append(box)
    assert len(columns) == count, columns
    actual = sum(sum(box['height'] for box in column) ** 2 for column in columns.values())
    alternatives = []
    for cuts in combinations(range(1, len(boxes)), count - 1):
        bounds = (0, *cuts, len(boxes))
        alternatives.append(sum(sum(heights[start:end]) ** 2 for start, end in zip(bounds, bounds[1:])))
    assert abs(actual - min(alternatives)) < 1, (actual, min(alternatives))
    for column in columns.values():
        for first, second in zip(column, column[1:]):
            assert second['y'] >= first['y'] + first['height'] - 1
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    return list(columns.values())


with sync_playwright() as p:
    for engine in [p.chromium, p.firefox]:
        browser = engine.launch()
        page = browser.new_page()
        for width, count in [(2926, 4), (1920, 4), (1600, 3), (1280, 2), (390, 1)]:
            page.set_viewport_size({'width': width, 'height': 1080})
            page.goto(BASE + '/cv/')
            columns = check_balance(page, count)
            if count == 4:
                assert columns[1][0]['title'] == 'Education'
                assert columns[1][1]['title'] == 'Publications'
        # Resizing an already-open page must rebalance too.
        page.set_viewport_size({'width': 1920, 'height': 1080})
        check_balance(page, 4)
        # Late content changes should update the measured partition automatically.
        page.locator('article .section-block').first.evaluate('''node => {
            const p = document.createElement('p'); p.textContent = 'Extra content to check rebalancing. '.repeat(90); node.append(p);
        }''')
        check_balance(page, 4)
        page.locator('article').evaluate('node => node.dataset.columns = "false"')
        check_balance(page, 1)
        # Omitted metadata also uses a single column.
        page.locator('article').evaluate('node => delete node.dataset.columns')
        check_balance(page, 1)
        # Two sections use only two centered slots on a four-column screen.
        page.goto(BASE)
        page.wait_for_timeout(100)
        stacks = page.locator('article .column-stack')
        assert stacks.count() == 2
        assert all(stack.locator('.section-block').count() == 1 for stack in stacks.all())
        box = page.locator('article').bounding_box()
        assert box['width'] < 1000
        assert abs(box['x'] - (1920 - box['width']) / 2) < 1
        browser.close()
        print(engine.name + ': PASS: optimal measured-height partitions, Education in column two, order, whole sections, resize, late content, and single-column opt-out')
