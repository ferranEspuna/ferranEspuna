export const byId = id => document.getElementById(id);
export const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export function cinv(z) {
    const mag = Math.max(z[0] * z[0] + z[1] * z[1], 1e-6);
    return [z[0] / mag, -z[1] / mag];
}
export function hexToRgb(hex) {
    return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
}
export function clientToPlane(x, y, canvas, view) {
    const rect = canvas.getBoundingClientRect();
    const scale = 2 * view.zoom / Math.min(rect.width, rect.height);
    return [(x - rect.left - rect.width / 2) * scale + view.pan[0],
        (rect.height / 2 - y + rect.top) * scale + view.pan[1]];
}
export const clampZoom = zoom => Math.max(1e-6, Math.min(1e6, zoom));

export function setupFullscreen(panel, onChange) {
    const wrapper = byId(`wrapper-${panel}`);
    const button = byId(`fullscreen-${panel}`);
    const active = () => document.fullscreenElement === wrapper || wrapper.classList.contains('fallback-fullscreen');
    const update = () => {
        button.textContent = active() ? 'Exit fullscreen' : 'Fullscreen';
        requestAnimationFrame(onChange);
    };
    const exitFallback = () => {
        wrapper.classList.remove('fallback-fullscreen');
        document.body.classList.remove('fallback-fullscreen-active');
        update();
        button.focus();
    };
    button.addEventListener('click', async () => {
        if (wrapper.classList.contains('fallback-fullscreen')) return exitFallback();
        if (document.fullscreenElement) { await document.exitFullscreen(); return; }
        try {
            if (!wrapper.requestFullscreen) throw new Error('Use fallback');
            await wrapper.requestFullscreen();
        } catch {
            wrapper.classList.add('fallback-fullscreen');
            document.body.classList.add('fallback-fullscreen-active');
            update();
        }
    });
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && wrapper.classList.contains('fallback-fullscreen')) exitFallback();
    });
}
