// Apply before the stylesheet loads to avoid a flash of the wrong theme.
try {
    const theme = localStorage.getItem('theme');
    if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch { /* Storage may be disabled; the system theme still works. */ }
