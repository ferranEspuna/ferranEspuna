import { byId, clampZoom, clientToPlane } from './fractal_common.js';

export function setupInteraction(panel, canvas, getView, getPoint, movePoint, changed) {
    const touches = new Map();
    const status = byId(`modeStatus-${panel}`);
    let mode = 'pan';
    let mousePosition = null;
    let lastPointerType = 'mouse';
    let lastTap = null;
    let tap = null;
    let movingTouch = false;
    let pointBeforeGesture = null;
    let pointMoved = false;
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
    const updateMode = () => {
        canvas.style.cursor = mode === 'pan' ? 'grab' : 'crosshair';
        status.textContent = mode === 'pan' ? 'Pan / zoom · right-click to place a point' : 'Place point · right-click to pan';
    };
    const toggleMode = () => { mode = mode === 'pan' ? 'point' : 'pan'; mousePosition = null; updateMode(); };
    updateMode();
    canvas.addEventListener('contextmenu', event => {
        event.preventDefault();
        // A touch long-press must not switch the desktop interaction mode.
        if ((event.pointerType || lastPointerType) === 'mouse') toggleMode();
    });
    canvas.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        lastPointerType = event.pointerType;
        canvas.setPointerCapture(event.pointerId);
        const point = { x: event.clientX, y: event.clientY };
        if (event.pointerType === 'mouse') {
            mousePosition = point;
            if (mode === 'point') { movePoint(toPlane(point)); changed(); }
            return;
        }
        touches.set(event.pointerId, point);
        if (touches.size === 1) {
            const now = performance.now();
            movingTouch = Boolean(lastTap && now - lastTap.time < 350 && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < 30);
            tap = { ...point, time: now, double: movingTouch };
            lastTap = null;
            pointBeforeGesture = [...getPoint()];
            pointMoved = false;
            // Never place on touch-down: this may be the first finger of a pinch.
        } else {
            // Pinching wins over placement, including a second finger added mid-drag.
            if (pointMoved) { movePoint(pointBeforeGesture); changed(); }
            movingTouch = false;
            pointMoved = false;
            tap = null;
            lastTap = null;
        }
    });
    canvas.addEventListener('pointermove', event => {
        const after = { x: event.clientX, y: event.clientY };
        lastPointerType = event.pointerType;
        if (event.pointerType === 'mouse') {
            if (mode === 'point') { movePoint(toPlane(after)); changed(); }
            else if (mousePosition) { panBetween(mousePosition, after); changed(); }
            if (mousePosition) mousePosition = after;
            return;
        }
        if (!touches.has(event.pointerId)) return;
        const previous = [...touches.values()];
        const before = touches.get(event.pointerId);
        touches.set(event.pointerId, after);
        if (tap && Math.hypot(after.x - tap.x, after.y - tap.y) > 12) tap.moved = true;
        if (touches.size === 2) {
            const current = [...touches.values()];
            const midpoint = pair => ({ x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2 });
            const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
            const oldMid = midpoint(previous), newMid = midpoint(current);
            if (distance(current) > 0 && distance(previous) > 0) zoomAt(distance(previous) / distance(current), oldMid);
            panBetween(oldMid, newMid);
        } else if (touches.size === 1) {
            if (movingTouch) { movePoint(toPlane(after)); pointMoved = true; }
            else panBetween(before, after);
        }
        changed();
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        canvas.addEventListener(eventName, event => {
            if (event.pointerType === 'mouse') { mousePosition = null; return; }
            if (!touches.has(event.pointerId)) return;
            touches.delete(event.pointerId);
            if (eventName === 'pointerup' && touches.size === 0 && tap && !tap.double && !tap.moved && performance.now() - tap.time < 300) {
                lastTap = { x: tap.x, y: tap.y, time: performance.now() };
            } else lastTap = null;
            // Lifting either finger after a pinch never resumes point placement.
            movingTouch = false;
            tap = null;
        });
    }
    window.addEventListener('blur', () => { mousePosition = null; touches.clear(); movingTouch = false; tap = null; lastTap = null; });
    canvas.addEventListener('wheel', event => {
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
            if (mode === 'pan') getView().pan = getView().pan.map((value, i) => value + delta[i]);
            else movePoint(getPoint().map((value, i) => value + delta[i]));
        } else if (event.key.toLowerCase() === 'm') toggleMode();
        else if (event.key === '+' || event.key === '=') zoomAt(.8);
        else if (event.key === '-') zoomAt(1.25);
        else if (event.key === '0') reset();
        else return;
        event.preventDefault();
        changed();
    });
}
