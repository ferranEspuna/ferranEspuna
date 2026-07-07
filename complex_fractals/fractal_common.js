export function byId(id) {
    return document.getElementById(id);
}

export function getCommonElements() {
    return {
        canvas: byId("mainCanvas"),
        paramCanvas: byId("paramCanvas"),
        wrapperMain: byId("wrapperMain"),
        wrapperParam: byId("wrapperParam"),
        slider: byId("iterSlider"),
        iterDisplay: byId("iterValue"),
        fullscreenBtnMain: byId("fullscreenBtnMain"),
        fullscreenBtnParam: byId("fullscreenBtnParam"),
        descriptionEl: byId("description"),
        popoutBtnMain: byId("popoutBtnMain"),
        popoutBtnParam: byId("popoutBtnParam"),
    };
}

export function getPopupMode() {
    return new URLSearchParams(window.location.search).get("popup");
}

export function applyPopupMode(popupMode) {
    if (!popupMode) return;
    document.body.classList.add("popup-mode");
    if (popupMode === "main") document.body.classList.add("popup-mode-main");
    else if (popupMode === "param") document.body.classList.add("popup-mode-param");
}

export function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function setResponsiveDescription(descriptionEl, descriptions, isMobile) {
    if (!descriptionEl) return;
    descriptionEl.innerHTML = descriptions.base + (isMobile ? descriptions.mobile : descriptions.desktop);
}

export function hideOnMobile(isMobile, ...elements) {
    if (!isMobile) return;
    for (const el of elements) {
        if (el) el.style.display = "none";
    }
}

export function setVisible(el, visible) {
    if (!el) return;
    el.classList.toggle("hidden", !visible);
    el.style.display = visible ? "" : "none";
}

export function normalizeInteractionMode(mode) {
    return mode === "pan" ? "pan" : "root";
}

export function applyCursor(canvas, mode) {
    if (canvas) canvas.style.cursor = normalizeInteractionMode(mode) === "pan" ? "move" : "crosshair";
}

export function cadd(a, b) {
    return [a[0] + b[0], a[1] + b[1]];
}

export function csub(a, b) {
    return [a[0] - b[0], a[1] - b[1]];
}

export function cmul(a, b) {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

export function cinv(z, epsilon = 1e-6) {
    const mag = Math.max(z[0] * z[0] + z[1] * z[1], epsilon);
    return [z[0] / mag, -z[1] / mag];
}

export function distance2D(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function clientToPlane(clientX, clientY, targetCanvas, zoom, pan) {
    const rect = targetCanvas.getBoundingClientRect();
    const xCss = clientX - rect.left;
    const yCss = clientY - rect.top;
    const smallResol = Math.min(rect.width, rect.height);
    const uvX = (2.0 * xCss - rect.width) / smallResol;
    const uvY = (2.0 * (rect.height - yCss) - rect.height) / smallResol;
    return [uvX * zoom + pan[0], uvY * zoom + pan[1]];
}

export function pointerToPlane(event, targetCanvas, zoom, pan) {
    return clientToPlane(event.clientX, event.clientY, targetCanvas, zoom, pan);
}

export function touchToPlane(touch, targetCanvas, zoom, pan) {
    return clientToPlane(touch.clientX, touch.clientY, targetCanvas, zoom, pan);
}

export function panDeltaToPlane(deltaXCss, deltaYCss, targetCanvas, zoom) {
    const rect = targetCanvas.getBoundingClientRect();
    const smallResol = Math.min(targetCanvas.width, targetCanvas.height);
    const deltaX = (deltaXCss * (targetCanvas.width / rect.width) * 2.0 / smallResol) * zoom;
    const deltaY = (deltaYCss * (targetCanvas.height / rect.height) * 2.0 / smallResol) * zoom;
    return [deltaX, deltaY];
}

export function touchPanDeltaToPlane(prevMid, newMid, targetCanvas, zoom) {
    const rect = targetCanvas.getBoundingClientRect();
    const smallResol = Math.min(rect.width, rect.height);
    const deltaX = ((newMid.x - prevMid.x) * 2.0 / smallResol) * zoom;
    const deltaY = ((newMid.y - prevMid.y) * 2.0 / smallResol) * zoom;
    return [deltaX, deltaY];
}

export function resizeShaderCanvases(items, minScreenRatio = 0.25) {
    const dpr = window.devicePixelRatio || 1;
    const viewport = window.visualViewport;
    const viewportWidth = (viewport && viewport.width) || window.innerWidth || document.documentElement.clientWidth || 1;
    const viewportHeight = (viewport && viewport.height) || window.innerHeight || document.documentElement.clientHeight || 1;
    const viewportMin = Math.max(1, Math.min(viewportWidth, viewportHeight) * dpr);

    for (const { canvas, sandbox } of items) {
        if (!canvas || !sandbox || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) continue;
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        sandbox.resize();
        const canvasMin = Math.min(canvas.width, canvas.height);
        sandbox.setUniform("u_screen_ratio", Math.max(minScreenRatio, canvasMin / viewportMin));
    }
}

export function uploadVec2Array(sandbox, uniformName, values) {
    const n = Math.floor(values.length / 2);
    if (sandbox.gl && sandbox.program) {
        const gl = sandbox.gl;
        const program = sandbox.program;
        let loc = gl.getUniformLocation(program, uniformName);
        if (!loc) loc = gl.getUniformLocation(program, uniformName + "[0]");
        if (loc) {
            gl.useProgram(program);
            gl.uniform2fv(loc, new Float32Array(values));
        }
    } else {
        for (let i = 0; i < n; i++) {
            sandbox.setUniform(uniformName + "[" + i + "]", values[2 * i], values[2 * i + 1]);
        }
    }
}

export function setPathUniform(sandbox, path, lengthUniform = "u_path_length", arrayUniform = "u_path") {
    sandbox.setUniform(lengthUniform, Math.floor(path.length / 2));
    uploadVec2Array(sandbox, arrayUniform, path);
}

export function renderAll(...sandboxes) {
    for (const sandbox of sandboxes) {
        if (sandbox && sandbox.render) sandbox.render();
    }
}

function animationFrame() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function fetchShader(canvas) {
    const fragUrl = new URL(canvas.getAttribute("data-fragment-url"), window.location.href);
    const response = await fetch(fragUrl, { mode: "same-origin" });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${fragUrl}`);
    return response.text();
}

export async function loadShaderPair({ canvas, sandbox, paramCanvas, paramSandbox, onReady, onError }) {
    try {
        sandbox.load(await fetchShader(canvas));
        paramSandbox.load(await fetchShader(paramCanvas));
        await animationFrame();
        await animationFrame();
        if (onReady) onReady();
    } catch (err) {
        console.error("Failed to load shaders:", err);
        if (onError) onError(err);
    }
}

export function setupPopouts({ mainButton, paramButton }) {
    function openPopup(mode) {
        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(`index.html?popup=${mode}`, `_blank_${mode}`, `width=${width},height=${height},left=${left},top=${top}`);
    }

    if (mainButton) mainButton.addEventListener("click", () => openPopup("main"));
    if (paramButton) paramButton.addEventListener("click", () => openPopup("param"));
}

export function setupFullscreen({ main, param, onChange }) {
    let fallbackFullscreenWrapper = null;

    function nativeFullscreenElement() {
        return document.fullscreenElement || document.webkitFullscreenElement || null;
    }

    function activeFullscreenWrapper() {
        return fallbackFullscreenWrapper || nativeFullscreenElement();
    }

    function updateButtons() {
        const active = activeFullscreenWrapper();
        if (main.button) main.button.textContent = active === main.wrapper ? "Exit Fullscreen" : "Fullscreen";
        if (param.button) param.button.textContent = active === param.wrapper ? "Exit Fullscreen" : "Fullscreen";
    }

    function handleChange() {
        updateButtons();
        setTimeout(() => {
            if (onChange) onChange();
        }, 150);
    }

    function enterFallbackFullscreen(targetWrapper) {
        fallbackFullscreenWrapper = targetWrapper;
        document.body.classList.add("fallback-fullscreen-active");
        targetWrapper.classList.add("fallback-fullscreen");
        handleChange();
    }

    function exitFallbackFullscreen() {
        if (!fallbackFullscreenWrapper) return;
        fallbackFullscreenWrapper.classList.remove("fallback-fullscreen");
        fallbackFullscreenWrapper = null;
        document.body.classList.remove("fallback-fullscreen-active");
        handleChange();
    }

    async function requestNativeFullscreen(targetWrapper) {
        const request = targetWrapper.requestFullscreen || targetWrapper.webkitRequestFullscreen;
        if (!request) return false;
        try {
            const result = request.call(targetWrapper);
            if (result && typeof result.then === "function") await result;
            await animationFrame();
            return !!nativeFullscreenElement();
        } catch (err) {
            console.warn("Native fullscreen failed; using fallback fullscreen.", err);
            return false;
        }
    }

    async function exitNativeFullscreen() {
        const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
        if (!exit) return;
        const result = exit.call(document);
        if (result && typeof result.then === "function") await result;
    }

    async function toggleFullscreen(targetWrapper) {
        if (fallbackFullscreenWrapper) {
            exitFallbackFullscreen();
            return;
        }

        if (nativeFullscreenElement()) {
            await exitNativeFullscreen();
            return;
        }

        if (await requestNativeFullscreen(targetWrapper)) handleChange();
        else enterFallbackFullscreen(targetWrapper);
    }

    if (main.button) main.button.addEventListener("click", () => toggleFullscreen(main.wrapper));
    if (param.button) param.button.addEventListener("click", () => toggleFullscreen(param.wrapper));

    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange);
    window.addEventListener("orientationchange", () => setTimeout(handleChange, 250));
}

export function hexToRgb(hex) {
    const expanded = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(expanded);
    return result ? [
        parseInt(result[1], 16) / 255.0,
        parseInt(result[2], 16) / 255.0,
        parseInt(result[3], 16) / 255.0,
    ] : [0, 0, 0];
}

export function rgbToHex(rgb) {
    return "#" + ((1 << 24)
        + (Math.round(rgb[0] * 255) << 16)
        + (Math.round(rgb[1] * 255) << 8)
        + Math.round(rgb[2] * 255)).toString(16).slice(1);
}
