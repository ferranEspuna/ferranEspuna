import { byId, clampZoom, clientToPlane } from './fractal_common.js';

// Pointer capture keeps dragging reliable outside the plot; the same path handles touch.
export function setupInteraction(panel, canvas, getView, getPoint, movePoint, changed) {
    const pointers = new Map();
    const mode = byId(`mode-${panel}`);
    const toPlane = point => clientToPlane(point.x, point.y, canvas, getView());
    const center = () => {
        const rect = canvas.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const zoomAt = (factor, point = center()) => {
        const before = toPlane(point);
        const view = getView();
        view.zoom = clampZoom(view.zoom * factor);
        const after = toPlane(point);
        view.pan = view.pan.map((value, i) => value + before[i] - after[i]);
    };
    const panBetween = (before, after) => {
        const a = toPlane(before), b = toPlane(after);
        getView().pan = getView().pan.map((value, i) => value + a[i] - b[i]);
    };
    const updateMode = () => { canvas.style.cursor = mode.value === 'pan' ? 'grab' : 'crosshair'; };
    mode.addEventListener('change', updateMode);
    updateMode();
    canvas.addEventListener('contextmenu', event => {
        event.preventDefault();
        mode.value = mode.value === 'pan' ? 'point' : 'pan';
        updateMode();
    });
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        canvas.setPointerCapture(event.pointerId);
        canvas.focus({ preventScroll: true });
        const point = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, point);
        if (mode.value === 'point' && pointers.size === 1) {
            movePoint(toPlane(point));
            changed();
        }
    });
    canvas.addEventListener('pointermove', event => {
        if (!pointers.has(event.pointerId)) return;
        const previous = [...pointers.values()];
        const before = pointers.get(event.pointerId);
        const after = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, after);
        if (pointers.size === 2) {
            const current = [...pointers.values()];
            const midpoint = pair => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
            const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
            const oldMid = midpoint(previous), newMid = midpoint(current);
            if (distance(current) > 0 && distance(previous) > 0) zoomAt(distance(previous) / distance(current), oldMid);
            panBetween(oldMid, newMid);
        } else if (pointers.size === 1) {
            if (mode.value === 'pan') panBetween(before, after);
            else movePoint(toPlane(after));
        }
        changed();
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        canvas.addEventListener(eventName, event => pointers.delete(event.pointerId));
    }
    canvas.addEventListener('wheel', event => {
        if (mode.value !== 'pan') return;
        event.preventDefault();
        const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1;
        zoomAt(Math.exp(Math.max(-1, Math.min(1, event.deltaY * units * .001))), { x: event.clientX, y: event.clientY });
        changed();
    }, { passive: false });
    const reset = () => { getView().zoom = 1; getView().pan = [0, 0]; changed(); };
    byId(`reset-${panel}`).addEventListener('click', reset);
    byId(`zoomIn-${panel}`).addEventListener('click', () => { zoomAt(.8); changed(); });
    byId(`zoomOut-${panel}`).addEventListener('click', () => { zoomAt(1.25); changed(); });
    canvas.addEventListener('keydown', event => {
        const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
        if (directions[event.key]) {
            const delta = directions[event.key].map(value => value * getView().zoom * (event.shiftKey ? .2 : .05));
            if (mode.value === 'pan') getView().pan = getView().pan.map((value, i) => value + delta[i]);
            else movePoint(getPoint().map((value, i) => value + delta[i]));
        } else if (event.key === '+' || event.key === '=') zoomAt(.8);
        else if (event.key === '-') zoomAt(1.25);
        else if (event.key === '0') reset();
        else return;
        event.preventDefault();
        changed();
    });
}
