import GlslCanvas from "https://esm.run/glslCanvas";

const BROADCAST_CHANNEL = "az_one_minus_z_sync";
const CRITICAL = [0.5, 0.0];
const MAX_PATH_POINTS = 256;

window.addEventListener("load", async () => {
    const canvas = document.getElementById("mainCanvas");
    const paramCanvas = document.getElementById("paramCanvas");
    const wrapperMain = document.getElementById("wrapperMain");
    const wrapperParam = document.getElementById("wrapperParam");
    const slider = document.getElementById("iterSlider");
    const iterDisplay = document.getElementById("iterValue");
    const fullscreenBtnMain = document.getElementById("fullscreenBtnMain");
    const fullscreenBtnParam = document.getElementById("fullscreenBtnParam");
    const descriptionEl = document.getElementById("description");
    const popoutBtnMain = document.getElementById("popoutBtnMain");
    const popoutBtnParam = document.getElementById("popoutBtnParam");
    const showOrbitToggle = document.getElementById("showOrbitToggle");
    const orbitOriginControl = document.getElementById("orbitOriginControl");
    const orbitOriginToggle = document.getElementById("orbitOriginToggle");
    const trackCriticalControl = document.getElementById("trackCriticalControl");
    const trackCriticalToggle = document.getElementById("trackCriticalToggle");

    const sandbox = new GlslCanvas(canvas);
    const paramSandbox = new GlslCanvas(paramCanvas);
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);

    const urlParams = new URLSearchParams(window.location.search);
    const popupMode = urlParams.get("popup");

    if (popupMode) {
        document.body.classList.add("popup-mode");
        if (popupMode === "main") document.body.classList.add("popup-mode-main");
        else if (popupMode === "param") document.body.classList.add("popup-mode-param");
    }

    const baseText = `
    <p>
      <strong>Background (both panels):</strong> hue encodes <strong>smoothed escape time</strong> under z<sub>n+1</sub> = a z<sub>n</sub>(1 − z<sub>n</sub>) (brighter ⇒ faster escape). Very dark pixels stay below the escape threshold for all iterations. The parameter plane uses the <strong>critical orbit</strong> from z₀ = ½ — the same default seed as the white orbit on the dynamical plane when “Lock to critical” is on.
    </p>
    <p>
      <strong>Markers on the dynamical plane</strong> (on top of the white orbit): <strong>white</strong> = forward orbit when “Show orbit” is on; <strong>magenta</strong> = <strong>fixed points</strong> z = 0 and z = 1 − 1/a; <strong>teal</strong> = the (finite) <strong>critical point</strong> z = ½ where f′(z) = 0 for f(z) = az(1 − z); <strong>gold</strong> = the parameter a at the same coordinates in the z-plane. The parameter plane shows only the <strong>gold</strong> marker for a.
    </p>
    <p>
      <em>Navigation (same pattern as the Newton fractal page):</em> Each canvas has <strong>Move mode</strong> (pointer sets quantities in the plane) or <strong>Pan/Zoom mode</strong> (drag to pan, scroll to zoom only in this mode). <strong>Right-click</strong> a canvas to toggle that canvas between the two. On the dynamical plane, <strong>Place orbit start</strong> (with “Show orbit” on and critical lock off) selects whether Move mode drags the orbit seed or a; the checkbox controls which, not the right-click.
    </p>
  `;

    const desktopInstructions = `
  <p>
    <strong>Controls (Desktop):</strong> Same as Newton fractal.<br>
    • <strong>Navigate:</strong> Right-click a canvas to toggle <em>Move</em> vs <em>Pan/Zoom</em> on that canvas only. Desktop starts in Pan/Zoom on both.<br>
    • <strong>Pan/Zoom:</strong> Drag to pan, scroll to zoom.<br>
    • <strong>Move:</strong> Move the mouse to set a, or the orbit start on the dynamical plane when the orbit checkbox allows it.<br>
    • <strong>Iterations, Pop out, Fullscreen:</strong> As labeled.
  </p>
  `;

    const mobileInstructions = `
  <p>
    <strong>Controls (Mobile):</strong> Same as Newton fractal.<br>
    • <strong>Move a / orbit start:</strong> Drag near the gold dot or (on the dynamical plane) near the white orbit start when shown; or double-tap then drag. Two-finger pan and pinch zoom.<br>
    • <strong>Parameter plane:</strong> Same proximity / double-tap behavior for the gold a marker.<br>
  </p>
  `;

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    descriptionEl.innerHTML = baseText + (isMobile ? mobileInstructions : desktopInstructions);

    if (isMobile) {
        if (popoutBtnMain) popoutBtnMain.style.display = "none";
        if (popoutBtnParam) popoutBtnParam.style.display = "none";
    }

    let interactionModeMain = isMobile ? "root" : "pan";
    let interactionModeParam = isMobile ? "root" : "pan";

    function normalizeInteractionMode(m) {
        if (m === "pan") return "pan";
        return "root";
    }

    function applyMainCursor() {
        canvas.style.cursor = interactionModeMain === "pan" ? "move" : "crosshair";
    }
    function applyParamCursor() {
        paramCanvas.style.cursor = interactionModeParam === "pan" ? "move" : "crosshair";
    }
    canvas.style.cursor = isMobile ? "crosshair" : "move";
    paramCanvas.style.cursor = isMobile ? "crosshair" : "move";
    applyMainCursor();
    applyParamCursor();

    let zoomMain = 1.0;
    let panMain = [0.0, 0.0];
    let zoomParam = 1.0;
    let panParam = [0.0, 0.0];
    let paramValue = [2.75, 0.12];

    let showOrbit = showOrbitToggle ? showOrbitToggle.checked : false;
    let controlOrbitOrigin = orbitOriginToggle ? orbitOriginToggle.checked : false;
    let trackCritical = trackCriticalToggle ? trackCriticalToggle.checked : true;
    let orbitStart = [CRITICAL[0], CRITICAL[1]];

    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let ongoingTouches = [];
    let touchMode = null;
    let touchStartPos = null;
    let lastTapTime = 0;
    const doubleTapThreshold = 300;
    const rootTouchRadius = 0.1;

    function cmul(a, b) {
        return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    }

    function logisticStep(z, a) {
        const one = [1.0, 0.0];
        const omz = [one[0] - z[0], one[1] - z[1]];
        return cmul(cmul(a, z), omz);
    }

    function buildOrbit(z0, a, maxIter) {
        const path = [z0[0], z0[1]];
        let z = [z0[0], z0[1]];
        const steps = Math.min(maxIter, MAX_PATH_POINTS - 1);
        for (let i = 0; i < steps; i++) {
            z = logisticStep(z, a);
            path.push(z[0], z[1]);
            if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) break;
            if (z[0] * z[0] + z[1] * z[1] > 1e12) break;
        }
        return path;
    }

    function effectiveOrbitStart() {
        return trackCritical ? [CRITICAL[0], CRITICAL[1]] : [orbitStart[0], orbitStart[1]];
    }

    function eligibleOrbitPick() {
        return showOrbit && controlOrbitOrigin && !trackCritical;
    }

    function refreshOrbitUi() {
        if (!orbitOriginControl || !trackCriticalControl) return;
        if (showOrbit) {
            orbitOriginControl.style.display = "inline";
            trackCriticalControl.style.display = "inline";
        } else {
            orbitOriginControl.style.display = "none";
            trackCriticalControl.style.display = "none";
        }
        if (orbitOriginToggle) {
            orbitOriginToggle.disabled = trackCritical;
            if (trackCritical) {
                orbitOriginToggle.checked = false;
                controlOrbitOrigin = false;
            }
        }
    }
    refreshOrbitUi();

    function getShaderMouse(event, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
        const x_css = event.clientX - rect.left;
        const y_css = event.clientY - rect.top;
        const small_resol = Math.min(rect.width, rect.height);
        const uv_x = (2.0 * x_css - rect.width) / small_resol;
        const uv_y = (2.0 * (rect.height - y_css) - rect.height) / small_resol;
        const isMain = targetCanvas === canvas;
        const z = isMain ? zoomMain : zoomParam;
        const p = isMain ? panMain : panParam;
        return [uv_x * z + p[0], uv_y * z + p[1]];
    }

    function getTouchPos(touch, targetCanvas) {
        const rect = targetCanvas.getBoundingClientRect();
        const x_css = touch.clientX - rect.left;
        const y_css = touch.clientY - rect.top;
        const small_resol = Math.min(rect.width, rect.height);
        const uv_x = (2.0 * x_css - rect.width) / small_resol;
        const uv_y = (2.0 * (rect.height - y_css) - rect.height) / small_resol;
        const isMain = targetCanvas === canvas;
        const z = isMain ? zoomMain : zoomParam;
        const p = isMain ? panMain : panParam;
        return [uv_x * z + p[0], uv_y * z + p[1]];
    }

    function uploadPath(path) {
        const n = Math.floor(path.length / 2);
        sandbox.setUniform("u_path_length", n);
        if (sandbox.gl && sandbox.program) {
            const gl = sandbox.gl;
            const program = sandbox.program;
            let loc = gl.getUniformLocation(program, "u_path");
            if (!loc) loc = gl.getUniformLocation(program, "u_path[0]");
            if (loc) {
                gl.useProgram(program);
                gl.uniform2fv(loc, new Float32Array(path));
            }
        } else {
            for (let i = 0; i < n; i++) {
                sandbox.setUniform("u_path[" + i + "]", path[2 * i], path[2 * i + 1]);
            }
        }
    }

    function resizeToCurrentDisplay() {
        const dpr = window.devicePixelRatio || 1;
        const screenMin = Math.min(window.screen.width, window.screen.height) * dpr;

        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            canvas.width = Math.round(canvas.clientWidth * dpr);
            canvas.height = Math.round(canvas.clientHeight * dpr);
            sandbox.resize();
            const canvasMin = Math.min(canvas.width, canvas.height);
            sandbox.setUniform("u_screen_ratio", canvasMin / screenMin);
        }

        if (paramCanvas.clientWidth > 0 && paramCanvas.clientHeight > 0) {
            paramCanvas.width = Math.round(paramCanvas.clientWidth * dpr);
            paramCanvas.height = Math.round(paramCanvas.clientHeight * dpr);
            paramSandbox.resize();
            const paramCanvasMin = Math.min(paramCanvas.width, paramCanvas.height);
            paramSandbox.setUniform("u_screen_ratio", paramCanvasMin / screenMin);
        }
    }

    function updateUniforms() {
        const it = parseInt(slider.value, 10);
        const z0 = effectiveOrbitStart();

        sandbox.setUniform("u_iterations", it);
        sandbox.setUniform("u_zoom", zoomMain);
        sandbox.setUniform("u_pan", panMain[0], panMain[1]);
        sandbox.setUniform("u_param", paramValue[0], paramValue[1]);
        sandbox.setUniform("u_show_path", showOrbit ? 1.0 : 0.0);

        if (showOrbit) {
            const path = buildOrbit(z0, paramValue, it);
            uploadPath(path);
        } else {
            sandbox.setUniform("u_path_length", 0.0);
        }

        paramSandbox.setUniform("u_iterations", it);
        paramSandbox.setUniform("u_zoom", zoomParam);
        paramSandbox.setUniform("u_pan", panParam[0], panParam[1]);
        paramSandbox.setUniform("u_current_param", paramValue[0], paramValue[1]);

        if (sandbox.render) sandbox.render();
        if (paramSandbox.render) paramSandbox.render();
    }

    function broadcastState(type, data) {
        channel.postMessage({ type, data });
    }

    channel.onmessage = (event) => {
        const { type, data } = event.data;
        if (type !== "state") return;
        zoomMain = data.zoomMain;
        panMain = data.panMain;
        zoomParam = data.zoomParam;
        panParam = data.panParam;
        paramValue = data.paramValue;
        slider.value = data.iterations;
        iterDisplay.textContent = data.iterations;
        showOrbit = data.showOrbit;
        controlOrbitOrigin = data.controlOrbitOrigin;
        trackCritical = data.trackCritical;
        orbitStart = data.orbitStart;
        interactionModeMain = data.interactionModeMain != null ? normalizeInteractionMode(data.interactionModeMain) : (isMobile ? "root" : "pan");
        interactionModeParam = data.interactionModeParam != null ? normalizeInteractionMode(data.interactionModeParam) : (isMobile ? "root" : "pan");

        if (showOrbitToggle) showOrbitToggle.checked = showOrbit;
        if (orbitOriginToggle) orbitOriginToggle.checked = controlOrbitOrigin;
        if (trackCriticalToggle) trackCriticalToggle.checked = trackCritical;
        refreshOrbitUi();
        applyMainCursor();
        applyParamCursor();
        updateUniforms();
    };

    function syncState() {
        broadcastState("state", {
            zoomMain,
            panMain,
            zoomParam,
            panParam,
            paramValue,
            iterations: parseInt(slider.value, 10),
            showOrbit,
            controlOrbitOrigin,
            trackCritical,
            orbitStart: [orbitStart[0], orbitStart[1]],
            interactionModeMain,
            interactionModeParam,
        });
        updateUniforms();
    }

    const fragUrl = new URL(canvas.getAttribute("data-fragment-url"), window.location.href);
    const paramFragUrl = new URL(paramCanvas.getAttribute("data-fragment-url"), window.location.href);

    try {
        const fragShader = await (await fetch(fragUrl, { mode: "same-origin" })).text();
        sandbox.load(fragShader);
        const paramFragShader = await (await fetch(paramFragUrl, { mode: "same-origin" })).text();
        paramSandbox.load(paramFragShader);

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resizeToCurrentDisplay();
                updateUniforms();
                if (sandbox.render) sandbox.render();
                if (paramSandbox.render) paramSandbox.render();
                if (popupMode) broadcastState("hello", {});
            });
        });
    } catch (err) {
        console.error("Failed to load shaders:", err);
        return;
    }

    channel.addEventListener("message", (event) => {
        if (event.data.type === "hello" && !popupMode) syncState();
    });

    iterDisplay.textContent = slider.value;
    slider.addEventListener("input", () => {
        iterDisplay.textContent = slider.value;
        syncState();
    });

    if (showOrbitToggle) {
        showOrbitToggle.addEventListener("change", () => {
            showOrbit = showOrbitToggle.checked;
            refreshOrbitUi();
            syncState();
        });
    }
    if (orbitOriginToggle) {
        orbitOriginToggle.addEventListener("change", () => {
            controlOrbitOrigin = orbitOriginToggle.checked;
            syncState();
        });
    }
    if (trackCriticalToggle) {
        trackCriticalToggle.addEventListener("change", () => {
            trackCritical = trackCriticalToggle.checked;
            if (trackCritical) {
                orbitStart = [CRITICAL[0], CRITICAL[1]];
                controlOrbitOrigin = false;
                if (orbitOriginToggle) orbitOriginToggle.checked = false;
            }
            refreshOrbitUi();
            syncState();
        });
    }

    function handleContextMenu(e) {
        if (e.target !== canvas && e.target !== paramCanvas) return;
        e.preventDefault();
        const targetCanvas = e.target;
        const isMain = targetCanvas === canvas;
        if (isMain) {
            if (interactionModeMain === "root") {
                interactionModeMain = "pan";
                canvas.style.cursor = "move";
            } else {
                interactionModeMain = "root";
                canvas.style.cursor = "crosshair";
            }
        } else {
            if (interactionModeParam === "root") {
                interactionModeParam = "pan";
                paramCanvas.style.cursor = "move";
            } else {
                interactionModeParam = "root";
                paramCanvas.style.cursor = "crosshair";
            }
        }
        syncState();
    }
    canvas.addEventListener("contextmenu", handleContextMenu);
    paramCanvas.addEventListener("contextmenu", handleContextMenu);

    function handleMouseDown(e) {
        const targetCanvas = e.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;
        const isMain = targetCanvas === canvas;
        const currentMode = isMain ? interactionModeMain : interactionModeParam;
        if (currentMode === "pan" && e.button === 0) {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        }
    }
    canvas.addEventListener("mousedown", handleMouseDown);
    paramCanvas.addEventListener("mousedown", handleMouseDown);

    window.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
            isDragging = false;
            syncState();
        }
    });

    function handleMouseMove(e) {
        const targetCanvas = e.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;
        const isMain = targetCanvas === canvas;
        const [shaderX, shaderY] = getShaderMouse(e, targetCanvas);
        const currentMode = isMain ? interactionModeMain : interactionModeParam;

        if (isDragging && currentMode === "pan") {
            const deltaX_css = e.clientX - lastMousePos.x;
            const deltaY_css = e.clientY - lastMousePos.y;
            const rect = targetCanvas.getBoundingClientRect();
            const small_resol = Math.min(targetCanvas.width, targetCanvas.height);
            const currentZoom = isMain ? zoomMain : zoomParam;
            const deltaX_shader = (deltaX_css * (targetCanvas.width / rect.width) * 2.0 / small_resol) * currentZoom;
            const deltaY_shader = (deltaY_css * (targetCanvas.height / rect.height) * 2.0 / small_resol) * currentZoom;
            if (isMain) {
                panMain[0] -= deltaX_shader;
                panMain[1] += deltaY_shader;
            } else {
                panParam[0] -= deltaX_shader;
                panParam[1] += deltaY_shader;
            }
            updateUniforms();
            syncState();
            lastMousePos = { x: e.clientX, y: e.clientY };
        } else if (currentMode === "root") {
            if (isMain && eligibleOrbitPick()) {
                orbitStart = [shaderX, shaderY];
            } else {
                paramValue = [shaderX, shaderY];
            }
            updateUniforms();
            syncState();
        }
    }
    canvas.addEventListener("mousemove", handleMouseMove);
    paramCanvas.addEventListener("mousemove", handleMouseMove);

    function handleWheel(e) {
        e.preventDefault();
        const targetCanvas = e.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;
        const isMain = targetCanvas === canvas;
        const currentMode = isMain ? interactionModeMain : interactionModeParam;
        if (currentMode !== "pan") return;

        const [mx0, my0] = getShaderMouse(e, targetCanvas);
        const zoomAmount = e.deltaY * 0.0005;
        if (isMain) zoomMain *= 1.0 + zoomAmount;
        else zoomParam *= 1.0 + zoomAmount;
        const [mx1, my1] = getShaderMouse(e, targetCanvas);
        if (isMain) {
            panMain[0] += mx0 - mx1;
            panMain[1] += my0 - my1;
        } else {
            panParam[0] += mx0 - mx1;
            panParam[1] += my0 - my1;
        }
        updateUniforms();
        syncState();
    }
    canvas.addEventListener("wheel", handleWheel);
    paramCanvas.addEventListener("wheel", handleWheel);

    function distance2D(a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    function handleTouchStart(e) {
        e.preventDefault();
        ongoingTouches = [...e.touches];
        const targetCanvas = e.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;

        if (ongoingTouches.length === 1) {
            const [x, y] = getTouchPos(ongoingTouches[0], targetCanvas);
            const now = Date.now();
            const timeSinceLastTap = now - lastTapTime;
            const isMain = targetCanvas === canvas;
            const currentZoom = isMain ? zoomMain : zoomParam;
            const dynamicRadius = rootTouchRadius * currentZoom;
            const distToParam = distance2D([x, y], paramValue);
            const z0 = effectiveOrbitStart();
            const distToOrbit = showOrbit && isMain ? distance2D([x, y], z0) : Infinity;

            if (timeSinceLastTap < doubleTapThreshold) {
                if (isMain && showOrbit && controlOrbitOrigin) {
                    touchMode = "movePathOrigin";
                } else {
                    touchMode = "moveRoot";
                }
            } else {
                if (showOrbit && distToOrbit < dynamicRadius) {
                    touchMode = "movePathOrigin";
                } else if (distToParam < dynamicRadius) {
                    touchMode = "moveRoot";
                } else {
                    touchMode = null;
                }
            }
            touchStartPos = { x: ongoingTouches[0].clientX, y: ongoingTouches[0].clientY };
            lastTapTime = now;
        } else if (ongoingTouches.length === 2) {
            touchMode = "pan";
        }
    }
    canvas.addEventListener("touchstart", handleTouchStart);
    paramCanvas.addEventListener("touchstart", handleTouchStart);

    function handleTouchMove(e) {
        e.preventDefault();
        const targetCanvas = e.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;

        if (e.touches.length === 2) touchMode = "pan";

        if (touchMode === "movePathOrigin" && e.touches.length === 1) {
            const [x, y] = getTouchPos(e.touches[0], targetCanvas);
            orbitStart = [x, y];
        } else if (touchMode === "moveRoot" && e.touches.length === 1) {
            const [x, y] = getTouchPos(e.touches[0], targetCanvas);
            paramValue = [x, y];
        } else if (touchMode === "pan" && e.touches.length === 2) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            const prevT0 = ongoingTouches[0];
            const prevT1 = ongoingTouches[1];
            if (!prevT1) return;

            const isMain = targetCanvas === canvas;
            const prevDist = Math.hypot(prevT0.clientX - prevT1.clientX, prevT0.clientY - prevT1.clientY);
            const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
            if (prevDist > 0 && newDist > 0) {
                const zoomFactor = prevDist / newDist;
                if (isMain) zoomMain *= zoomFactor;
                else zoomParam *= zoomFactor;
            }
            const prevMidX = (prevT0.clientX + prevT1.clientX) / 2;
            const prevMidY = (prevT0.clientY + prevT1.clientY) / 2;
            const newMidX = (t0.clientX + t1.clientX) / 2;
            const newMidY = (t0.clientY + t1.clientY) / 2;
            const rect = targetCanvas.getBoundingClientRect();
            const small_resol = Math.min(rect.width, rect.height);
            const currentZoom = isMain ? zoomMain : zoomParam;
            const deltaX_shader = ((newMidX - prevMidX) * 2.0 / small_resol) * currentZoom;
            const deltaY_shader = ((newMidY - prevMidY) * 2.0 / small_resol) * currentZoom;
            if (isMain) {
                panMain[0] -= deltaX_shader;
                panMain[1] += deltaY_shader;
            } else {
                panParam[0] -= deltaX_shader;
                panParam[1] += deltaY_shader;
            }
        }

        updateUniforms();
        syncState();
        ongoingTouches = [...e.touches];
    }
    canvas.addEventListener("touchmove", handleTouchMove);
    paramCanvas.addEventListener("touchmove", handleTouchMove);

    function reapplyState() {
        updateUniforms();
        requestAnimationFrame(() => {
            if (sandbox.render) sandbox.render();
            if (paramSandbox.render) paramSandbox.render();
        });
    }

    async function toggleFullscreen(targetWrapper) {
        if (!document.fullscreenElement) {
            try {
                await targetWrapper.requestFullscreen();
            } catch (err) {
                console.error(err);
            }
        } else {
            await document.exitFullscreen();
        }
    }

    fullscreenBtnMain.addEventListener("click", () => toggleFullscreen(wrapperMain));
    fullscreenBtnParam.addEventListener("click", () => toggleFullscreen(wrapperParam));

    document.addEventListener("fullscreenchange", () => {
        const fs = !!document.fullscreenElement;
        fullscreenBtnMain.textContent = fs && document.fullscreenElement === wrapperMain ? "Exit Fullscreen" : "Fullscreen";
        fullscreenBtnParam.textContent = fs && document.fullscreenElement === wrapperParam ? "Exit Fullscreen" : "Fullscreen";
        setTimeout(() => {
            resizeToCurrentDisplay();
            reapplyState();
        }, 150);
    });

    function openPopup(mode) {
        const w = 600;
        const h = 600;
        const left = (window.screen.width - w) / 2;
        const top = (window.screen.height - h) / 2;
        window.open(`index.html?popup=${mode}`, `_blank_${mode}`, `width=${w},height=${h},left=${left},top=${top}`);
    }
    if (popoutBtnMain) popoutBtnMain.addEventListener("click", () => openPopup("main"));
    if (popoutBtnParam) popoutBtnParam.addEventListener("click", () => openPopup("param"));

    window.addEventListener("resize", () => resizeToCurrentDisplay());
});
