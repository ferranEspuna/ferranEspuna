import GlslCanvas from "https://esm.run/glslCanvas";
import {
    applyCursor,
    applyPopupMode,
    byId,
    cadd,
    cinv,
    cmul,
    csub,
    distance2D,
    getCommonElements,
    getPopupMode,
    hexToRgb,
    hideOnMobile,
    isMobileDevice,
    loadShaderPair,
    normalizeInteractionMode,
    panDeltaToPlane,
    pointerToPlane,
    renderAll,
    resizeShaderCanvases,
    rgbToHex,
    setPathUniform,
    setResponsiveDescription,
    setVisible,
    setupFullscreen,
    setupPopouts,
    touchPanDeltaToPlane,
    touchToPlane,
} from "../fractal_common.js";

const ROOT0 = [-0.4, 0.0];
const ROOT1 = [0.4, 0.0];
const DEFAULT_ROOT_COLORS = [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, 1.0],
];

const descriptions = {
    base: `
    <p>
      This visualization renders the <strong>Newton fractal</strong> for a cubic polynomial with three roots. Each pixel is a starting point z₀; we iterate Newton’s method toward a root. Basin colors (customizable) show which root the orbit converges to; intermediate or dark shades mean slower convergence or failure to settle on a root within the iteration budget.
    </p>
    <p>
      <strong>Markers — phase space (left):</strong> <strong>white</strong> = Newton steps from one orbit when “Show Path” is on (drawn first so other markers stay visible on top); <strong>black</strong> = the two fixed roots at ±0.4; <strong>light gray</strong> = the movable third root; <strong>teal</strong> = the <strong>centroid</strong> (r₁ + r₂ + r₃)/3 of the three roots. For a monic cubic, that point is where p″(z) = 0; it is an additional <strong>critical point</strong> of the Newton map N(z) = z − p(z)/p′(z) besides the roots themselves (which are attracting fixed points of N).
    </p>
    <p>
      <strong>Markers — parameter space (right):</strong> each pixel is a choice of the <strong>third root</strong>; the two black dots are the fixed first roots (same as on the left). <strong>Light gray</strong> marks the current third root used on the left. <strong>Teal</strong> marks the centroid for that same triple of roots — the seed used when coloring each pixel. There is no white path on this panel.
    </p>
    <p>
      <em>Mathematical note:</em> Newton’s method can fall into <strong>attracting cycles</strong>. For cubics, the centroid is a natural probe orbit: the parameter view colors each third-root choice by where Newton sends the centroid. Dark or mottled regions often correspond to non-convergence or long transients.
    </p>
  `,
    desktop: `
  <p>
    <strong>Controls (Desktop):</strong><br>
    • <strong>Navigate:</strong> Right-click <em>on a specific canvas</em> to toggle its mode between <em>Move Mode</em> and <em>Pan/Zoom Mode</em>.<br>
    &nbsp;&nbsp;- <em>Pan/Zoom Mode:</em> Click & drag to pan, scroll to zoom.<br>
    &nbsp;&nbsp;- <em>Move Mode:</em> Move your mouse to position the third root (gray dot) or the path origin.<br>
    • <strong>Iterations:</strong> Use the slider above to adjust the number of iterations.<br>
    • <strong>Analysis:</strong> Controls below the Phase Space plot:<br>
    &nbsp;&nbsp;- <em>Show Path:</em> Visualizes the individual steps of Newton's method for a single point (white dot).<br>
    &nbsp;&nbsp;- <em>Track Center:</em> Locks the path's starting point to the centroid of the roots.<br>
    • <strong>Pop Out:</strong> Open shaders in separate windows for multi-screen analysis (synchronized).<br>
    • <strong>Fullscreen:</strong> Available for both views.
  </p>
  `,
    mobile: `
  <p>
    <strong>Controls (Mobile):</strong><br>
    • <strong>Move Root/Point:</strong> Drag the gray or white dots with one finger. (Double-tap and drag anywhere if precise selection is difficult).<br>
    • <strong>Navigate:</strong> Pan with two fingers, pinch to zoom.<br>
    • <strong>Analysis:</strong> Use the toggles to show the iteration path or track the centroid.<br>
    • <strong>Fullscreen:</strong> Tap the button for an immersive view.
  </p>
  `,
};

window.addEventListener("load", async () => {
    const {
        canvas,
        paramCanvas,
        wrapperMain,
        wrapperParam,
        slider,
        iterDisplay,
        fullscreenBtnMain,
        fullscreenBtnParam,
        descriptionEl,
        popoutBtnMain,
        popoutBtnParam,
    } = getCommonElements();

    const showPathToggle = byId("showPathToggle");
    const pathOriginControl = byId("pathOriginControl");
    const pathOriginToggle = byId("pathOriginToggle");
    const trackCenterControl = byId("trackCenterControl");
    const trackCenterToggle = byId("trackCenterToggle");
    const colorInputs = [byId("color0"), byId("color1"), byId("color2")];

    const sandbox = new GlslCanvas(canvas);
    const paramSandbox = new GlslCanvas(paramCanvas);
    const channel = new BroadcastChannel("fractal_sync");
    const popupMode = getPopupMode();
    const isMobile = isMobileDevice();

    applyPopupMode(popupMode);
    setResponsiveDescription(descriptionEl, descriptions, isMobile);
    hideOnMobile(isMobile, popoutBtnMain, popoutBtnParam);

    let interactionModeMain = isMobile ? "root" : "pan";
    let interactionModeParam = isMobile ? "root" : "pan";
    let zoomMain = 1.0;
    let panMain = [0.0, 0.0];
    let zoomParam = 1.0;
    let panParam = [0.0, 0.0];
    let rootPosition = [0.0, 0.866025];
    let showPath = showPathToggle ? showPathToggle.checked : false;
    let controlPathOrigin = pathOriginToggle ? pathOriginToggle.checked : false;
    let trackCenter = trackCenterToggle ? trackCenterToggle.checked : false;
    let pathOrigin = [0.5, 0.5];
    let rootColors = colorInputs.map((input, index) => (
        input ? hexToRgb(input.value) : DEFAULT_ROOT_COLORS[index]
    ));
    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let ongoingTouches = [];
    let touchMode = null;
    let lastTapTime = 0;

    const doubleTapThreshold = 300;
    const rootTouchRadius = 0.1;

    applyCursor(canvas, interactionModeMain);
    applyCursor(paramCanvas, interactionModeParam);

    function viewFor(targetCanvas) {
        const isMain = targetCanvas === canvas;
        return {
            isMain,
            zoom: isMain ? zoomMain : zoomParam,
            pan: isMain ? panMain : panParam,
            mode: isMain ? interactionModeMain : interactionModeParam,
        };
    }

    function pointFromPointer(event, targetCanvas) {
        const view = viewFor(targetCanvas);
        return pointerToPlane(event, targetCanvas, view.zoom, view.pan);
    }

    function pointFromTouch(touch, targetCanvas) {
        const view = viewFor(targetCanvas);
        return touchToPlane(touch, targetCanvas, view.zoom, view.pan);
    }

    function centroidForRoot() {
        return [rootPosition[0] / 3.0, rootPosition[1] / 3.0];
    }

    function newtonStep(z) {
        const a = csub(z, ROOT0);
        const b = csub(z, ROOT1);
        const c = csub(z, rootPosition);
        const ab = cmul(a, b);
        const bc = cmul(b, c);
        const ca = cmul(c, a);
        const f = cmul(ab, c);
        const der = cadd(cadd(ab, bc), ca);
        return csub(z, cmul(f, cinv(der)));
    }

    function buildPath(iterations) {
        const path = [pathOrigin[0], pathOrigin[1]];
        let z = [pathOrigin[0], pathOrigin[1]];
        const steps = Math.min(iterations, 99);
        for (let i = 0; i < steps; i++) {
            z = newtonStep(z);
            path.push(z[0], z[1]);
        }
        return path;
    }

    function eligiblePathPick() {
        return showPath && controlPathOrigin && !trackCenter;
    }

    function refreshPathUi() {
        setVisible(pathOriginControl, showPath);
        setVisible(trackCenterControl, showPath);
        if (!pathOriginToggle) return;
        pathOriginToggle.disabled = trackCenter;
        if (trackCenter) {
            pathOriginToggle.checked = false;
            controlPathOrigin = false;
        }
    }

    function resizeToCurrentDisplay() {
        resizeShaderCanvases([
            { canvas, sandbox },
            { canvas: paramCanvas, sandbox: paramSandbox },
        ]);
    }

    function setRootColorUniforms(targetSandbox) {
        targetSandbox.setUniform("u_color0", rootColors[0][0], rootColors[0][1], rootColors[0][2]);
        targetSandbox.setUniform("u_color1", rootColors[1][0], rootColors[1][1], rootColors[1][2]);
        targetSandbox.setUniform("u_color2", rootColors[2][0], rootColors[2][1], rootColors[2][2]);
    }

    function updateUniforms() {
        const iterations = parseInt(slider.value, 10);

        sandbox.setUniform("u_iterations", iterations);
        sandbox.setUniform("u_zoom", zoomMain);
        sandbox.setUniform("u_pan", panMain[0], panMain[1]);
        sandbox.setUniform("u_root_position", rootPosition[0], rootPosition[1]);
        sandbox.setUniform("u_show_path", showPath ? 1.0 : 0.0);

        if (showPath) setPathUniform(sandbox, buildPath(iterations));
        else sandbox.setUniform("u_path_length", 0.0);

        paramSandbox.setUniform("u_iterations", iterations);
        paramSandbox.setUniform("u_zoom", zoomParam);
        paramSandbox.setUniform("u_pan", panParam[0], panParam[1]);
        paramSandbox.setUniform("u_current_root2", rootPosition[0], rootPosition[1]);

        setRootColorUniforms(sandbox);
        setRootColorUniforms(paramSandbox);
        renderAll(sandbox, paramSandbox);
    }

    function reapplyState() {
        updateUniforms();
        requestAnimationFrame(() => renderAll(sandbox, paramSandbox));
    }

    function broadcastState(type, data) {
        channel.postMessage({ type, data });
    }

    function syncState() {
        broadcastState("state", {
            zoomMain,
            panMain,
            zoomParam,
            panParam,
            rootPosition,
            showPath,
            controlPathOrigin,
            trackCenter,
            pathOrigin,
            iterations: parseInt(slider.value, 10),
            rootColors,
            interactionModeMain,
            interactionModeParam,
        });
        updateUniforms();
    }

    channel.onmessage = (event) => {
        const { type, data } = event.data;
        if (type !== "state") return;

        zoomMain = data.zoomMain;
        panMain = data.panMain;
        zoomParam = data.zoomParam;
        panParam = data.panParam;
        rootPosition = data.rootPosition;
        showPath = data.showPath;
        controlPathOrigin = data.controlPathOrigin;
        trackCenter = data.trackCenter;
        pathOrigin = data.pathOrigin;
        rootColors = (data.rootColors || DEFAULT_ROOT_COLORS).map((color) => [
            color[0],
            color[1],
            color[2],
        ]);
        slider.value = data.iterations;
        iterDisplay.textContent = data.iterations;
        interactionModeMain = data.interactionModeMain != null
            ? normalizeInteractionMode(data.interactionModeMain)
            : (isMobile ? "root" : "pan");
        interactionModeParam = data.interactionModeParam != null
            ? normalizeInteractionMode(data.interactionModeParam)
            : (isMobile ? "root" : "pan");

        colorInputs.forEach((input, index) => {
            if (input) input.value = rgbToHex(rootColors[index]);
        });
        if (showPathToggle) showPathToggle.checked = showPath;
        if (pathOriginToggle) pathOriginToggle.checked = controlPathOrigin;
        if (trackCenterToggle) trackCenterToggle.checked = trackCenter;
        refreshPathUi();
        applyCursor(canvas, interactionModeMain);
        applyCursor(paramCanvas, interactionModeParam);
        updateUniforms();
    };

    refreshPathUi();

    await loadShaderPair({
        canvas,
        sandbox,
        paramCanvas,
        paramSandbox,
        onReady: () => {
            resizeToCurrentDisplay();
            updateUniforms();
            renderAll(sandbox, paramSandbox);
            if (popupMode) broadcastState("hello", {});
        },
        onError: () => {
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.fillText("Error loading shader", 20, 20);
        },
    });

    channel.addEventListener("message", (event) => {
        if (event.data.type === "hello" && !popupMode) syncState();
    });

    iterDisplay.textContent = slider.value;
    slider.addEventListener("input", () => {
        iterDisplay.textContent = slider.value;
        syncState();
    });

    if (showPathToggle) {
        showPathToggle.addEventListener("change", () => {
            showPath = showPathToggle.checked;
            if (!showPath) {
                controlPathOrigin = false;
                trackCenter = false;
                if (pathOriginToggle) {
                    pathOriginToggle.checked = false;
                    pathOriginToggle.disabled = false;
                }
                if (trackCenterToggle) trackCenterToggle.checked = false;
            }
            refreshPathUi();
            syncState();
        });
    }

    if (pathOriginToggle) {
        pathOriginToggle.addEventListener("change", () => {
            controlPathOrigin = pathOriginToggle.checked;
            syncState();
        });
    }

    if (trackCenterToggle) {
        trackCenterToggle.addEventListener("change", () => {
            trackCenter = trackCenterToggle.checked;
            if (trackCenter) {
                controlPathOrigin = false;
                if (pathOriginToggle) pathOriginToggle.checked = false;
                pathOrigin = centroidForRoot();
            }
            refreshPathUi();
            syncState();
        });
    }

    colorInputs.forEach((input, index) => {
        if (!input) return;
        input.addEventListener("input", (event) => {
            rootColors[index] = hexToRgb(event.target.value);
            syncState();
        });
    });

    function handleContextMenu(event) {
        if (event.target !== canvas && event.target !== paramCanvas) return;
        event.preventDefault();
        const isMain = event.target === canvas;
        if (isMain) {
            interactionModeMain = interactionModeMain === "root" ? "pan" : "root";
            applyCursor(canvas, interactionModeMain);
        } else {
            interactionModeParam = interactionModeParam === "root" ? "pan" : "root";
            applyCursor(paramCanvas, interactionModeParam);
        }
        syncState();
    }
    canvas.addEventListener("contextmenu", handleContextMenu);
    paramCanvas.addEventListener("contextmenu", handleContextMenu);

    function handleMouseDown(event) {
        if (event.target !== canvas && event.target !== paramCanvas) return;
        const view = viewFor(event.target);
        if (view.mode === "pan" && event.button === 0) {
            isDragging = true;
            lastMousePos = { x: event.clientX, y: event.clientY };
        }
    }
    canvas.addEventListener("mousedown", handleMouseDown);
    paramCanvas.addEventListener("mousedown", handleMouseDown);

    window.addEventListener("mouseup", (event) => {
        if (event.button !== 0) return;
        isDragging = false;
        syncState();
    });

    function handleMouseMove(event) {
        if (event.target !== canvas && event.target !== paramCanvas) return;
        const targetCanvas = event.target;
        const view = viewFor(targetCanvas);
        const [shaderX, shaderY] = pointFromPointer(event, targetCanvas);

        if (isDragging && view.mode === "pan") {
            const [deltaX, deltaY] = panDeltaToPlane(
                event.clientX - lastMousePos.x,
                event.clientY - lastMousePos.y,
                targetCanvas,
                view.zoom
            );
            if (view.isMain) {
                panMain[0] -= deltaX;
                panMain[1] += deltaY;
            } else {
                panParam[0] -= deltaX;
                panParam[1] += deltaY;
            }
            lastMousePos = { x: event.clientX, y: event.clientY };
            syncState();
        } else if (view.mode === "root") {
            if (view.isMain && eligiblePathPick()) {
                pathOrigin = [shaderX, shaderY];
            } else {
                rootPosition = [shaderX, shaderY];
                if (trackCenter) pathOrigin = centroidForRoot();
            }
            syncState();
        }
    }
    canvas.addEventListener("mousemove", handleMouseMove);
    paramCanvas.addEventListener("mousemove", handleMouseMove);

    function handleWheel(event) {
        if (event.target !== canvas && event.target !== paramCanvas) return;
        event.preventDefault();
        const targetCanvas = event.target;
        const view = viewFor(targetCanvas);
        if (view.mode !== "pan") return;

        const [mx0, my0] = pointFromPointer(event, targetCanvas);
        const zoomAmount = event.deltaY * 0.0005;
        if (view.isMain) zoomMain *= 1.0 + zoomAmount;
        else zoomParam *= 1.0 + zoomAmount;
        const [mx1, my1] = pointFromPointer(event, targetCanvas);

        if (view.isMain) {
            panMain[0] += mx0 - mx1;
            panMain[1] += my0 - my1;
        } else {
            panParam[0] += mx0 - mx1;
            panParam[1] += my0 - my1;
        }
        syncState();
    }
    canvas.addEventListener("wheel", handleWheel);
    paramCanvas.addEventListener("wheel", handleWheel);

    function handleTouchStart(event) {
        event.preventDefault();
        ongoingTouches = [...event.touches];
        const targetCanvas = event.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;

        if (ongoingTouches.length === 1) {
            const [x, y] = pointFromTouch(ongoingTouches[0], targetCanvas);
            const now = Date.now();
            const timeSinceLastTap = now - lastTapTime;
            const view = viewFor(targetCanvas);
            const dynamicRadius = rootTouchRadius * view.zoom;
            const distToRoot = distance2D([x, y], rootPosition);
            const distToPath = view.isMain && eligiblePathPick() ? distance2D([x, y], pathOrigin) : Infinity;

            if (timeSinceLastTap < doubleTapThreshold) {
                touchMode = view.isMain && eligiblePathPick() ? "movePathOrigin" : "moveRoot";
            } else if (view.isMain && eligiblePathPick() && distToPath < dynamicRadius) {
                touchMode = "movePathOrigin";
            } else if (distToRoot < dynamicRadius) {
                touchMode = "moveRoot";
            } else {
                touchMode = null;
            }
            lastTapTime = now;
        } else if (ongoingTouches.length === 2) {
            touchMode = "pan";
        }
    }
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    paramCanvas.addEventListener("touchstart", handleTouchStart, { passive: false });

    function handleTouchMove(event) {
        event.preventDefault();
        const targetCanvas = event.target;
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;

        if (event.touches.length === 2) touchMode = "pan";

        if (touchMode === "movePathOrigin" && event.touches.length === 1 && eligiblePathPick()) {
            pathOrigin = pointFromTouch(event.touches[0], targetCanvas);
        } else if (touchMode === "moveRoot" && event.touches.length === 1) {
            rootPosition = pointFromTouch(event.touches[0], targetCanvas);
            if (trackCenter) pathOrigin = centroidForRoot();
        } else if (touchMode === "pan" && event.touches.length === 2) {
            const t0 = event.touches[0];
            const t1 = event.touches[1];
            const prevT0 = ongoingTouches[0];
            const prevT1 = ongoingTouches[1];
            if (!prevT1) return;

            const view = viewFor(targetCanvas);
            const prevDist = Math.hypot(prevT0.clientX - prevT1.clientX, prevT0.clientY - prevT1.clientY);
            const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
            if (prevDist > 0 && newDist > 0) {
                const zoomFactor = prevDist / newDist;
                if (view.isMain) zoomMain *= zoomFactor;
                else zoomParam *= zoomFactor;
            }

            const [deltaX, deltaY] = touchPanDeltaToPlane(
                { x: (prevT0.clientX + prevT1.clientX) / 2, y: (prevT0.clientY + prevT1.clientY) / 2 },
                { x: (t0.clientX + t1.clientX) / 2, y: (t0.clientY + t1.clientY) / 2 },
                targetCanvas,
                view.isMain ? zoomMain : zoomParam
            );

            if (view.isMain) {
                panMain[0] -= deltaX;
                panMain[1] += deltaY;
            } else {
                panParam[0] -= deltaX;
                panParam[1] += deltaY;
            }
        }

        syncState();
        ongoingTouches = [...event.touches];
    }
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
    paramCanvas.addEventListener("touchmove", handleTouchMove, { passive: false });

    setupFullscreen({
        main: { wrapper: wrapperMain, button: fullscreenBtnMain },
        param: { wrapper: wrapperParam, button: fullscreenBtnParam },
        onChange: () => {
            resizeToCurrentDisplay();
            reapplyState();
        },
    });
    setupPopouts({ mainButton: popoutBtnMain, paramButton: popoutBtnParam });
    window.addEventListener("resize", resizeToCurrentDisplay);
});
