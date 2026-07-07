import GlslCanvas from "https://esm.run/glslCanvas";
import {
    applyCursor,
    applyPopupMode,
    byId,
    distance2D,
    getCommonElements,
    getPopupMode,
    hideOnMobile,
    isMobileDevice,
    loadShaderPair,
    normalizeInteractionMode,
    panDeltaToPlane,
    pointerToPlane,
    renderAll,
    resizeShaderCanvases,
    setPathUniform,
    setResponsiveDescription,
    setVisible,
    setupFullscreen,
    setupPopouts,
    touchPanDeltaToPlane,
    touchToPlane,
} from "./fractal_common.js";

export function startTwoPlaneFamily(config) {
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

        const showOrbitToggle = byId("showOrbitToggle");
        const orbitOriginControl = byId("orbitOriginControl");
        const orbitOriginToggle = byId("orbitOriginToggle");
        const trackCriticalControl = byId("trackCriticalControl");
        const trackCriticalToggle = byId("trackCriticalToggle");

        const sandbox = new GlslCanvas(canvas);
        const paramSandbox = new GlslCanvas(paramCanvas);
        const channel = new BroadcastChannel(config.broadcastChannel);
        const popupMode = getPopupMode();
        const isMobile = isMobileDevice();
        const maxPathPoints = config.maxPathPoints || 96;
        const pathStopRadiusSq = config.pathStopRadiusSq || 1e12;

        applyPopupMode(popupMode);
        setResponsiveDescription(descriptionEl, config.descriptions, isMobile);
        hideOnMobile(isMobile, popoutBtnMain, popoutBtnParam);

        let interactionModeMain = isMobile ? "root" : "pan";
        let interactionModeParam = isMobile ? "root" : "pan";
        let zoomMain = 1.0;
        let panMain = [0.0, 0.0];
        let zoomParam = 1.0;
        let panParam = [0.0, 0.0];
        let paramValue = [config.initialParam[0], config.initialParam[1]];
        let showOrbit = showOrbitToggle ? showOrbitToggle.checked : false;
        let controlOrbitOrigin = orbitOriginToggle ? orbitOriginToggle.checked : false;
        let trackCritical = trackCriticalToggle ? trackCriticalToggle.checked : true;
        let orbitStart = [config.critical[0], config.critical[1]];
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

        function buildOrbit(z0, param, maxIter) {
            const path = [z0[0], z0[1]];
            let z = [z0[0], z0[1]];
            const steps = Math.min(maxIter, maxPathPoints - 1);
            for (let i = 0; i < steps; i++) {
                z = config.step(z, param);
                path.push(z[0], z[1]);
                if (!Number.isFinite(z[0]) || !Number.isFinite(z[1])) break;
                if (z[0] * z[0] + z[1] * z[1] > pathStopRadiusSq) break;
            }
            return path;
        }

        function effectiveOrbitStart() {
            return trackCritical ? [config.critical[0], config.critical[1]] : [orbitStart[0], orbitStart[1]];
        }

        function eligibleOrbitPick() {
            return showOrbit && controlOrbitOrigin && !trackCritical;
        }

        function refreshOrbitUi() {
            setVisible(orbitOriginControl, showOrbit);
            setVisible(trackCriticalControl, showOrbit);
            if (!orbitOriginToggle) return;
            orbitOriginToggle.disabled = trackCritical;
            if (trackCritical) {
                orbitOriginToggle.checked = false;
                controlOrbitOrigin = false;
            }
        }

        function resizeToCurrentDisplay() {
            resizeShaderCanvases([
                { canvas, sandbox },
                { canvas: paramCanvas, sandbox: paramSandbox },
            ]);
        }

        function updateUniforms() {
            const iterations = parseInt(slider.value, 10);
            const z0 = effectiveOrbitStart();

            sandbox.setUniform("u_iterations", iterations);
            sandbox.setUniform("u_zoom", zoomMain);
            sandbox.setUniform("u_pan", panMain[0], panMain[1]);
            sandbox.setUniform("u_param", paramValue[0], paramValue[1]);
            sandbox.setUniform("u_show_path", showOrbit ? 1.0 : 0.0);

            if (showOrbit) {
                setPathUniform(sandbox, buildOrbit(z0, paramValue, iterations));
            } else {
                sandbox.setUniform("u_path_length", 0.0);
            }

            paramSandbox.setUniform("u_iterations", iterations);
            paramSandbox.setUniform("u_zoom", zoomParam);
            paramSandbox.setUniform("u_pan", panParam[0], panParam[1]);
            paramSandbox.setUniform("u_current_param", paramValue[0], paramValue[1]);

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
            interactionModeMain = data.interactionModeMain != null
                ? normalizeInteractionMode(data.interactionModeMain)
                : (isMobile ? "root" : "pan");
            interactionModeParam = data.interactionModeParam != null
                ? normalizeInteractionMode(data.interactionModeParam)
                : (isMobile ? "root" : "pan");

            if (showOrbitToggle) showOrbitToggle.checked = showOrbit;
            if (orbitOriginToggle) orbitOriginToggle.checked = controlOrbitOrigin;
            if (trackCriticalToggle) trackCriticalToggle.checked = trackCritical;
            refreshOrbitUi();
            applyCursor(canvas, interactionModeMain);
            applyCursor(paramCanvas, interactionModeParam);
            updateUniforms();
        };

        refreshOrbitUi();

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
        });

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
                    orbitStart = [config.critical[0], config.critical[1]];
                    controlOrbitOrigin = false;
                    if (orbitOriginToggle) orbitOriginToggle.checked = false;
                }
                refreshOrbitUi();
                syncState();
            });
        }

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
                if (view.isMain && eligibleOrbitPick()) orbitStart = [shaderX, shaderY];
                else paramValue = [shaderX, shaderY];
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
                const distToParam = distance2D([x, y], paramValue);
                const distToOrbit = showOrbit && view.isMain
                    ? distance2D([x, y], effectiveOrbitStart())
                    : Infinity;

                if (timeSinceLastTap < doubleTapThreshold) {
                    touchMode = view.isMain && eligibleOrbitPick() ? "movePathOrigin" : "moveRoot";
                } else if (view.isMain && eligibleOrbitPick() && distToOrbit < dynamicRadius) {
                    touchMode = "movePathOrigin";
                } else if (distToParam < dynamicRadius) {
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

            if (touchMode === "movePathOrigin" && event.touches.length === 1 && eligibleOrbitPick()) {
                orbitStart = pointFromTouch(event.touches[0], targetCanvas);
            } else if (touchMode === "moveRoot" && event.touches.length === 1) {
                paramValue = pointFromTouch(event.touches[0], targetCanvas);
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
}
