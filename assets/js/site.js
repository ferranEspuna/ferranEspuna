const themeSelect = document.getElementById('themeSelect');
if (themeSelect) {
    themeSelect.value = document.documentElement.dataset.theme || 'system';
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        if (theme === 'system') delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = theme;
        try { localStorage.setItem('theme', theme); } catch { /* Optional persistence. */ }
    });
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
    reset.hidden = false;
    reset.addEventListener('click', () => checkboxes.forEach(checkbox => {
        checkbox.checked = false;
        checkbox.dispatchEvent(new Event('change'));
    }));
}
