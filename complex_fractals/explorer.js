import { setupExports } from './export.js';
import { Renderer } from './renderer.js';
import { byId, hexToRgb, setupFullscreen } from './fractal_common.js';
import { setupInteraction } from './interaction.js';

export async function startExplorer(config) {
    const status = byId('fractalStatus');
    const controls = byId('explorerControls');
    const popup = new URLSearchParams(location.search).get('popup');
    const panels = ['main', 'param'];
    const renderers = {};
    const state = {
        main: { zoom: 1, pan: [0, 0] }, param: { zoom: 1, pan: [0, 0] },
        point: [...config.initialPoint], iterations: Number(byId('iterSlider').value),
        showOrbit: false, moveOrbit: false, lockOrbit: !config.newton,
        orbitStart: [.5, .5], colors: ['#ff0000', '#00ff00', '#0000ff'],
    };
    const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(config.channel) : null;
    const motionListeners = new Set();
    const orbitStart = () => state.lockOrbit ? config.critical(state.point) : state.orbitStart;
    const pickingOrbit = panel => panel === 'main' && state.showOrbit && state.moveOrbit && !state.lockOrbit;
    function uniforms(panel) {
        const values = {
            u_iterations: state.iterations, u_zoom: state[panel].zoom, u_pan: state[panel].pan,
            u_param: state.point, u_current_param: state.point,
            u_root_position: state.point, u_current_root2: state.point,
            u_screen_ratio: 1, u_show_path: state.showOrbit ? 1 : 0, u_path_length: 0,
        };
        state.colors.forEach((color, i) => { values[`u_color${i}`] = hexToRgb(color); });
        if (panel === 'main' && state.showOrbit) {
            let z = [...orbitStart()];
            const path = [...z];
            for (let i = 0; i < Math.min(state.iterations, config.maxPath - 1); i++) {
                z = config.step(z, state.point);
                if (!z.every(Number.isFinite) || z.some(value => Math.abs(value) > 1e6)) break;
                path.push(...z);
            }
            values.u_path_length = path.length / 2;
            // A fixed size also clears stale points after reducing the iteration count.
            values.u_path = [...path, ...new Array(config.maxPath * 2 - path.length).fill(0)];
        }
        return values;
    }
    function render() {
        for (const panel of panels) renderers[panel]?.render(uniforms(panel));
    }
    function resize() {
        for (const renderer of Object.values(renderers)) {
            const canvas = renderer.canvas;
            if (!canvas.clientWidth || !canvas.clientHeight) continue;
            const dpr = Math.min(devicePixelRatio || 1, 2);
            renderer.resize(Math.max(1, Math.round(canvas.clientWidth * dpr)), Math.max(1, Math.round(canvas.clientHeight * dpr)));
        }
        render();
    }
    function refreshControls() {
        byId('iterSlider').value = state.iterations;
        byId('iterValue').value = Math.round(state.iterations);
        for (const key of ['showOrbit', 'moveOrbit', 'lockOrbit']) byId(key).checked = state[key];
        byId('moveOrbit').disabled = !state.showOrbit || state.lockOrbit;
        byId('lockOrbit').disabled = !state.showOrbit;
        state.colors.forEach((color, i) => { if (byId(`color${i}`)) byId(`color${i}`).value = color; });
    }
    function readMotion() {
        return {
            pan: [...state.main.pan, ...state.param.pan],
            zoom: [Math.log(state.main.zoom), Math.log(state.param.zoom)],
            parameters: [...state.point, state.iterations, ...state.colors.flatMap(hexToRgb)],
        };
    }
    function writeMotion(values) {
        state.main.pan = values.pan.slice(0, 2);
        state.param.pan = values.pan.slice(2, 4);
        state.main.zoom = Math.exp(values.zoom[0]);
        state.param.zoom = Math.exp(values.zoom[1]);
        state.point = values.parameters.slice(0, 2);
        state.iterations = values.parameters[2];
        state.colors = [0, 1, 2].map(i => '#' + values.parameters.slice(3 + i * 3, 6 + i * 3)
            .map(value => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0')).join(''));
        refreshControls();
        render();
    }
    function motionUniforms(panel, motion) {
        const point = motion.parameters.slice(0, 2);
        const values = { ...uniforms(panel), u_pan: motion.pan.slice(panel === 'main' ? 0 : 2, panel === 'main' ? 2 : 4),
            u_zoom: Math.exp(motion.zoom[panel === 'main' ? 0 : 1]), u_iterations: motion.parameters[2],
            u_param: point, u_current_param: point, u_root_position: point, u_current_root2: point };
        [0, 1, 2].forEach(i => { values[`u_color${i}`] = motion.parameters.slice(3 + i * 3, 6 + i * 3); });
        return values;
    }
    let frame = null;
    function changed() {
        motionListeners.forEach(listener => listener());
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
            frame = null;
            refreshControls();
            render();
            channel?.postMessage({ type: 'state', state });
        });
    }
    try {
        const sources = await Promise.all(panels.map(async panel => {
            const response = await fetch(byId(`canvas-${panel}`).dataset.fragmentUrl);
            if (!response.ok) throw new Error(`Could not load the ${panel} shader (${response.status}). Reload to try again.`);
            return response.text();
        }));
        panels.forEach((panel, i) => { renderers[panel] = new Renderer(byId(`canvas-${panel}`), sources[i]); });
        if (popup === 'main' || popup === 'param') document.body.classList.add('popup-mode', `popup-mode-${popup}`);
        for (const panel of panels) {
            const canvas = renderers[panel].canvas;
            canvas.addEventListener('webglcontextlost', event => {
                event.preventDefault();
                controls.disabled = true;
                status.hidden = false;
                status.textContent = 'The graphics context was lost. Reload this page to restart the explorer.';
                document.body.classList.remove('popup-mode');
            });
            setupInteraction(panel, canvas, () => state[panel],
                () => pickingOrbit(panel) ? orbitStart() : state.point,
                point => { if (pickingOrbit(panel)) state.orbitStart = point; else state.point = point; }, changed);
            setupFullscreen(panel, resize);
            byId(`popout-${panel}`).hidden = !channel || Boolean(popup);
            byId(`popout-${panel}`).addEventListener('click', () => {
                const url = new URL(location.href);
                url.searchParams.set('popup', panel);
                const opened = window.open(url, `${config.channel}-${panel}`, 'width=700,height=700');
                if (!opened) { status.hidden = false; status.textContent = 'The pop-out was blocked. Allow pop-ups for this site and try again.'; }
            });
        }
        channel?.addEventListener('message', event => {
            if (event.data.type === 'hello' && !popup) channel.postMessage({ type: 'state', state });
            if (event.data.type !== 'state') return;
            Object.assign(state, event.data.state);
            motionListeners.forEach(listener => listener());
            refreshControls();
            render();
        });
        if (popup) channel?.postMessage({ type: 'hello' });
        byId('iterSlider').addEventListener('input', event => { state.iterations = Number(event.target.value); changed(); });
        for (const key of ['showOrbit', 'moveOrbit', 'lockOrbit']) {
            byId(key).addEventListener('change', event => {
                state[key] = event.target.checked;
                if (state.lockOrbit) state.moveOrbit = false;
                changed();
            });
        }
        state.colors.forEach((_, i) => byId(`color${i}`)?.addEventListener('input', event => { state.colors[i] = event.target.value; changed(); }));
        const resizeObserver = new ResizeObserver(resize);
        for (const panel of panels) resizeObserver.observe(byId(`wrapper-${panel}`));
        window.addEventListener('resize', resize);
        window.addEventListener('pagehide', () => channel?.close(), { once: true });
        controls.disabled = false;
        refreshControls();
        resize();
        status.hidden = true;
        setupExports({ renderers, uniforms, name: config.channel, readMotion, writeMotion, motionUniforms,
            subscribeMotion(listener) { motionListeners.add(listener); return () => motionListeners.delete(listener); } });
    } catch (error) {
        for (const renderer of Object.values(renderers)) renderer.destroy();
        controls.disabled = true;
        status.textContent = error.message;
        console.error(error);
    }
}
