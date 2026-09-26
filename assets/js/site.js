// Group only top-level Markdown H2s. Nested headings and H3 subsections stay
// with their parent section. DOM order remains the reading and keyboard order.
for (const container of document.querySelectorAll('[data-sections]')) {
    if (![...container.children].some(child => child.tagName === 'H2')) continue;
    const nodes = [...container.childNodes];
    container.classList.remove('prose');
    container.classList.add('section-flow');
    let section = document.createElement('div');
    section.className = 'section-intro prose';
    container.append(section);
    for (const node of nodes) {
        if (node.nodeName === 'H2') {
            section = document.createElement('section');
            section.className = 'section-block';
            if (node.id) section.setAttribute('aria-labelledby', node.id);
            container.append(section);
        }
        section.append(node);
    }
    const intro = container.querySelector('.section-intro');
    if (!intro.textContent.trim() && !intro.children.length) intro.remove();
}

// Use only the column slots that contain sections, retaining the readable
// width of a slot and centering the resulting group within the page.
for (const flow of document.querySelectorAll('.section-flow[data-columns]')) {
    const sectionCount = Math.max(1, [...flow.querySelectorAll('.section-block, .shader-window')]
        .filter(section => section.closest('[data-columns]') === flow).length);
    const fitColumns = () => {
        const style = getComputedStyle(flow);
        const gap = parseFloat(style.columnGap) || 0;
        const minimum = parseFloat(style.columnWidth) || flow.parentElement.clientWidth;
        const available = flow.parentElement.clientWidth;
        const slots = Math.max(1, Math.floor((available + gap) / (minimum + gap)));
        const count = Math.min(sectionCount, slots);
        const slotWidth = (available - (slots - 1) * gap) / slots;
        flow.style.setProperty('--flow-width', `${count * slotWidth + (count - 1) * gap}px`);
        flow.style.setProperty('--column-count', count);
    };
    new ResizeObserver(fitColumns).observe(flow.parentElement);
    // Recalculate when the page setting changes, as well as on resize.
    new MutationObserver(fitColumns).observe(flow, { attributes: true, attributeFilter: ['data-columns'] });
    fitColumns();
}

const search = document.getElementById('listSearch');
if (search) {
    search.closest('.search-control').hidden = false;
    search.addEventListener('input', () => {
        let count = 0;
        const query = search.value.trim().toLocaleLowerCase();
        for (const item of document.querySelectorAll('#contentList > li')) {
            item.hidden = !item.textContent.toLocaleLowerCase().includes(query);
            if (!item.hidden) count++;
        }
        document.getElementById('searchStatus').textContent = count ? `${count} recipe${count === 1 ? '' : 's'} found.` : 'No recipes found. Try another search.';
    });
}

const checkboxes = [...document.querySelectorAll('.task-list-item input[type="checkbox"]')];
for (const checkbox of checkboxes) {
    const row = checkbox.closest('li');
    const label = row.textContent.trim();
    // Key by ingredient text so editing/reordering a recipe does not shift saved checks.
    const key = `ingredient:${location.pathname}:${label}`;
    checkbox.disabled = false;
    checkbox.setAttribute('aria-label', label);
    try { checkbox.checked = localStorage.getItem(key) === 'true'; } catch { /* Optional persistence. */ }
    const update = () => {
        row.classList.toggle('checked', checkbox.checked);
        try { localStorage.setItem(key, String(checkbox.checked)); } catch { /* Optional persistence. */ }
    };
    row.classList.toggle('checked', checkbox.checked);
    checkbox.addEventListener('change', update);
    row.addEventListener('click', event => {
        if (event.target.closest('input, a, button, label')) return;
        checkbox.checked = !checkbox.checked;
        update();
    });
}
const reset = document.getElementById('resetChecklist');
if (reset && checkboxes.length) {
    // Keep the checklist action with Ingredients when the recipe uses columns.
    checkboxes[0].closest('.section-block')?.append(reset);
    reset.hidden = false;
    reset.addEventListener('click', () => checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
    }));
}
