import GlslCanvas from "https://esm.run/glslCanvas";

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
    // NEW DOM ELEMENTS
    const showPathToggle = document.getElementById("showPathToggle");
    const pathOriginControl = document.getElementById("pathOriginControl");
    const pathOriginToggle = document.getElementById("pathOriginToggle");
    const trackCenterControl = document.getElementById("trackCenterControl");
    const trackCenterToggle = document.getElementById("trackCenterToggle");
    const popoutBtnMain = document.getElementById("popoutBtnMain");
    const popoutBtnParam = document.getElementById("popoutBtnParam");
    const color0Input = document.getElementById("color0");
    const color1Input = document.getElementById("color1");
    const color2Input = document.getElementById("color2");

    const sandbox = new GlslCanvas(canvas);
    const paramSandbox = new GlslCanvas(paramCanvas);

    // -------------------
    // Broadcast Channel for Sync
    // -------------------
    const channel = new BroadcastChannel('fractal_sync');

    // -------------------
    // Popup Mode Detection
    // -------------------
    const urlParams = new URLSearchParams(window.location.search);
    const popupMode = urlParams.get('popup'); // 'main' or 'param'

    if (popupMode) {
        document.body.classList.add('popup-mode');
        if (popupMode === 'main') {
            document.body.classList.add('popup-mode-main');
        } else if (popupMode === 'param') {
            document.body.classList.add('popup-mode-param');
        }
    }

    // -------------------
    // Conditional instructions
    // -------------------
    const baseText = `
    <p>
      This visualization renders the <strong>Newton fractal</strong> for a cubic polynomial with three roots (marked as two black dots and one gray dot that you can control the position of).
      Each pixel represents a starting point on the complex plane. We apply Newton's method to these points to find one of the polynomial's roots.
      The pixel's color indicates which root the method converges to. By default, red, green, and blue correspond to the three roots.
      Intermediate or dark colors appear where points take longer to converge or fail to converge entirely.
      With enough iterations, the plane divides into three <strong>basins of attraction</strong>.
      While the interiors of these basins are smooth, the boundaries are fractals: complex, chaotic regions where the smallest shift in starting position can lead to a completely different outcome.
    </p>
    <p>
      <em>Mathematical Insight:</em> While Newton's method is efficient, it is not foolproof. It can get trapped in an <strong>attracting cycle</strong>, where the value oscillates endlessly without ever reaching a root.
      For cubic polynomials, the <strong>centroid</strong> of the roots acts as a "canary in the coal mine". If an attracting cycle exists, the centroid is mathematically guaranteed to be pulled into it.
      The <strong>Parameter Space</strong> visualization (right) uses this fact. Here, each pixel represents a possible position for the third root (the movable gray dot).
      The color shows the fate of the centroid for that specific configuration. By exploring this space, you can find the "problematic" polynomials where Newton's method fails,
      represented as dark or intermediate-colored regions. Can you find any familiar patterns in these regions? What lengths of attracting cycles can you find?
    </p>
  `;

    const desktopInstructions = `
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
  `;

    const mobileInstructions = `
  <p>
    <strong>Controls (Mobile):</strong><br>
    • <strong>Move Root/Point:</strong> Drag the gray or white dots with one finger. (Double-tap and drag anywhere if precise selection is difficult).<br>
    • <strong>Navigate:</strong> Pan with two fingers, pinch to zoom.<br>
    • <strong>Analysis:</strong> Use the toggles to show the iteration path or track the centroid.<br>
    • <strong>Fullscreen:</strong> Tap the button for an immersive view.
  </p>
  `;

    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    descriptionEl.innerHTML = baseText + (isMobile ? mobileInstructions : desktopInstructions);

    // Hide Pop Out buttons on mobile
    if (isMobile) {
        if (popoutBtnMain) popoutBtnMain.style.display = 'none';
        if (popoutBtnParam) popoutBtnParam.style.display = 'none';
    }

    // -------------------
    // State
    // -------------------
    let interactionModeMain = isMobile ? "root" : "pan";
    let interactionModeParam = isMobile ? "root" : "pan";

    canvas.style.cursor = isMobile ? "crosshair" : "move";
    paramCanvas.style.cursor = isMobile ? "crosshair" : "move";

    // Independent state for Main Canvas
    let zoomMain = 1.0;
    let panMain = [0.0, 0.0];

    // Independent state for Parameter Canvas
    let zoomParam = 1.0;
    let panParam = [0.0, 0.0];

    let rootPosition = [0.0, 0.866025];
    // NEW STATE - Initialize from DOM to handle browser restore
    let showPath = showPathToggle ? showPathToggle.checked : false;
    let controlPathOrigin = pathOriginToggle ? pathOriginToggle.checked : false;
    let trackCenter = trackCenterToggle ? trackCenterToggle.checked : false;
    let pathOrigin = [0.5, 0.5]; // Default path start

    // Helper to get hex from input or default
    const getColor = (el, defaultHex) => el ? el.value : defaultHex;

    // Initialize colors from DOM
    let rootColors = [
        hexToRgb(getColor(color0Input, "#ff0000")),
        hexToRgb(getColor(color1Input, "#00ff00")),
        hexToRgb(getColor(color2Input, "#0000ff"))
    ];

    // Initial visibility check based on restored state
    if (showPath) {
        if (pathOriginControl) pathOriginControl.style.display = "inline";
        if (trackCenterControl) trackCenterControl.style.display = "inline";
    } else {
        if (pathOriginControl) pathOriginControl.style.display = "none";
        if (trackCenterControl) trackCenterControl.style.display = "none";
    }

    if (trackCenter) {
        if (pathOriginToggle) pathOriginToggle.disabled = true;
    }


    function hexToRgb(hex) {
        // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
        var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        hex = hex.replace(shorthandRegex, function (m, r, g, b) {
            return r + r + g + g + b + b;
        });

        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
            parseInt(result[1], 16) / 255.0,
            parseInt(result[2], 16) / 255.0,
            parseInt(result[3], 16) / 255.0
        ] : [0, 0, 0];
    }

    let isDragging = false;
    let lastMousePos = { x: 0, y: 0 };
    let ongoingTouches = [];
    let touchMode = null;
    let touchStartPos = null;

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

        return [(uv_x * z) + p[0], (uv_y * z) + p[1]];
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

        return [(uv_x * z) + p[0], (uv_y * z) + p[1]];
    }

    function resizeToCurrentDisplay() {
        const dpr = window.devicePixelRatio || 1;
        const screenMin = Math.min(window.screen.width, window.screen.height) * dpr;

        // Resize Main Canvas if visible
        if (canvas.clientWidth > 0 && canvas.clientHeight > 0) {
            const cssWidth = canvas.clientWidth;
            const cssHeight = canvas.clientHeight;
            canvas.width = Math.round(cssWidth * dpr);
            canvas.height = Math.round(cssHeight * dpr);
            sandbox.resize();

            const canvasMin = Math.min(canvas.width, canvas.height);
            const screenRatio = canvasMin / screenMin;
            sandbox.setUniform("u_screen_ratio", screenRatio);
        }

        // Resize Param Canvas if visible
        if (paramCanvas.clientWidth > 0 && paramCanvas.clientHeight > 0) {
            const cssWidth2 = paramCanvas.clientWidth;
            const cssHeight2 = paramCanvas.clientHeight;
            paramCanvas.width = Math.round(cssWidth2 * dpr);
            paramCanvas.height = Math.round(cssHeight2 * dpr);
            paramSandbox.resize();

            const paramCanvasMin = Math.min(paramCanvas.width, paramCanvas.height);
            const paramScreenRatio = paramCanvasMin / screenMin;
            paramSandbox.setUniform("u_screen_ratio", paramScreenRatio);
        }
    }

    function handleResize() { resizeToCurrentDisplay(); }

    // -------------------
    // State Broadcasting
    // -------------------
    function broadcastState(type, data) {
        channel.postMessage({ type, data });
    }

    function updateUniforms() {
        sandbox.setUniform("u_iterations", parseInt(slider.value, 10));
        sandbox.setUniform("u_zoom", zoomMain);
        sandbox.setUniform("u_pan", panMain[0], panMain[1]);
        sandbox.setUniform("u_root_position", rootPosition[0], rootPosition[1]);
        sandbox.setUniform("u_show_path", showPath ? 1.0 : 0.0);
        sandbox.setUniform("u_path_origin", pathOrigin[0], pathOrigin[1]);

        paramSandbox.setUniform("u_iterations", parseInt(slider.value, 10));
        paramSandbox.setUniform("u_zoom", zoomParam);
        paramSandbox.setUniform("u_pan", panParam[0], panParam[1]);
        paramSandbox.setUniform("u_current_root2", rootPosition[0], rootPosition[1]);

        // Colors
        sandbox.setUniform("u_color0", rootColors[0][0], rootColors[0][1], rootColors[0][2]);
        sandbox.setUniform("u_color1", rootColors[1][0], rootColors[1][1], rootColors[1][2]);
        sandbox.setUniform("u_color2", rootColors[2][0], rootColors[2][1], rootColors[2][2]);

        paramSandbox.setUniform("u_color0", rootColors[0][0], rootColors[0][1], rootColors[0][2]);
        paramSandbox.setUniform("u_color1", rootColors[1][0], rootColors[1][1], rootColors[1][2]);
        paramSandbox.setUniform("u_color2", rootColors[2][0], rootColors[2][1], rootColors[2][2]);

        if (sandbox.render) sandbox.render();
        if (paramSandbox.render) paramSandbox.render();
    }

    channel.onmessage = (event) => {
        const { type, data } = event.data;
        let needsUpdate = false;

        if (type === 'state') {
            zoomMain = data.zoomMain;
            panMain = data.panMain;
            zoomParam = data.zoomParam;
            panParam = data.panParam;
            rootPosition = data.rootPosition;
            showPath = data.showPath;
            controlPathOrigin = data.controlPathOrigin;
            trackCenter = data.trackCenter;
            pathOrigin = data.pathOrigin;
            slider.value = data.iterations;
            iterDisplay.textContent = data.iterations;
            rootColors = data.rootColors || [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]];

            // Sync inputs
            function rgbToHex(rgb) {
                return "#" + ((1 << 24) + (Math.round(rgb[0] * 255) << 16) + (Math.round(rgb[1] * 255) << 8) + Math.round(rgb[2] * 255)).toString(16).slice(1);
            }
            if (color0Input) color0Input.value = rgbToHex(rootColors[0]);
            if (color1Input) color1Input.value = rgbToHex(rootColors[1]);
            if (color2Input) color2Input.value = rgbToHex(rootColors[2]);

            // Update UI controls to match state
            showPathToggle.checked = showPath;
            pathOriginToggle.checked = controlPathOrigin;
            trackCenterToggle.checked = trackCenter;

            if (showPath) {
                pathOriginControl.style.display = "inline";
                trackCenterControl.style.display = "inline";
            } else {
                pathOriginControl.style.display = "none";
                trackCenterControl.style.display = "none";
            }

            if (trackCenter) {
                pathOriginToggle.disabled = true;
            } else {
                pathOriginToggle.disabled = false;
            }

            needsUpdate = true;
        }

        if (needsUpdate) {
            updateUniforms();
        }
    };

    function syncState() {
        const state = {
            zoomMain,
            panMain,
            zoomParam,
            panParam,
            rootPosition,
            showPath,
            controlPathOrigin,
            trackCenter,
            pathOrigin,
            pathOrigin,
            iterations: parseInt(slider.value, 10),
            rootColors
        };
        broadcastState('state', state);
        updateUniforms();
    }

    // -------------------
    // Load both shaders
    // -------------------
    const fragUrl = new URL(canvas.getAttribute("data-fragment-url"), window.location.href);
    const paramFragUrl = new URL(paramCanvas.getAttribute("data-fragment-url"), window.location.href);

    try {
        // Load main shader
        const response = await fetch(fragUrl, { mode: "same-origin" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const fragShader = await response.text();
        sandbox.load(fragShader);

        // Load parameter space shader
        const paramResponse = await fetch(paramFragUrl, { mode: "same-origin" });
        if (!paramResponse.ok) throw new Error(`HTTP ${paramResponse.status}`);
        const paramFragShader = await paramResponse.text();
        paramSandbox.load(paramFragShader);

        // ---- FIX: robust 2-frame initialization for BOTH shaders ----
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                resizeToCurrentDisplay();  // ensure correct framebuffer size for both canvases
                updateUniforms();
                // Force render both
                if (sandbox.render) sandbox.render();
                if (paramSandbox.render) paramSandbox.render();

                // If we are a popup, request state from opener/others
                if (popupMode) {
                    // We can't easily request state, but we can broadcast our presence or just wait for an update.
                    // Actually, the main window might not know we exist.
                    // Best bet: The opener should have sent us state? Or we just wait for user interaction.
                    // Alternatively, we can broadcast a "hello" message and others reply with state.
                    broadcastState('hello', {});
                }
            });
        });

    } catch (err) {
        console.error("Failed to load shaders:", err);
        const ctx = canvas.getContext("2d");
        ctx.fillText("Error loading shader", 20, 20);
        return;
    }

    // Listen for hello to sync state to new windows
    channel.addEventListener('message', (event) => {
        if (event.data.type === 'hello' && !popupMode) {
            // If I am the main window (or any window with state), send it.
            // Ideally only one window responds.
            syncState();
        }
    });

    iterDisplay.textContent = slider.value;

    slider.addEventListener("input", () => {
        iterDisplay.textContent = slider.value;
        syncState();
    });

    // -------------------
    // NEW TOGGLE LISTENERS
    // -------------------
    showPathToggle.addEventListener("change", () => {
        showPath = showPathToggle.checked;

        if (showPath) {
            pathOriginControl.style.display = "inline"; // Show the second toggle
            trackCenterControl.style.display = "inline"; // Show the third toggle
        } else {
            pathOriginControl.style.display = "none"; // Hide it
            trackCenterControl.style.display = "none"; // Hide it
            // Also uncheck and reset the controlPathOrigin state
            if (controlPathOrigin) {
                controlPathOrigin = false;
                pathOriginToggle.checked = false;
            }
            // Reset trackCenter state
            if (trackCenter) {
                trackCenter = false;
                trackCenterToggle.checked = false;
                pathOriginToggle.disabled = false;
            }
        }
        syncState();
    });

    pathOriginToggle.addEventListener("change", () => {
        controlPathOrigin = pathOriginToggle.checked;
        syncState();
    });

    trackCenterToggle.addEventListener("change", () => {
        trackCenter = trackCenterToggle.checked;
        if (trackCenter) {
            // Disable manual control
            controlPathOrigin = false;
            pathOriginToggle.checked = false;
            pathOriginToggle.disabled = true;

            // Snap to center immediately
            pathOrigin = [rootPosition[0] / 3.0, rootPosition[1] / 3.0];
        } else {
            // Re-enable manual control option
            pathOriginToggle.disabled = false;
        }
        syncState();
    });

    // Color Listeners
    function updateColor(index, hex) {
        rootColors[index] = hexToRgb(hex);
        syncState();
    }

    if (color0Input) color0Input.addEventListener("input", (e) => updateColor(0, e.target.value));
    if (color1Input) color1Input.addEventListener("input", (e) => updateColor(1, e.target.value));
    if (color2Input) color2Input.addEventListener("input", (e) => updateColor(2, e.target.value));

    // -------------------
    // Desktop interactions
    // -------------------
    function handleContextMenu(e) {
        e.preventDefault();
        const targetCanvas = e.target;
        const isMain = targetCanvas === canvas;

        if (isMain) {
            if (interactionModeMain === 'root') {
                interactionModeMain = 'pan';
                canvas.style.cursor = 'move';
            } else {
                interactionModeMain = 'root';
                canvas.style.cursor = 'crosshair';
            }
        } else {
            if (interactionModeParam === 'root') {
                interactionModeParam = 'pan';
                paramCanvas.style.cursor = 'move';
            } else {
                interactionModeParam = 'root';
                paramCanvas.style.cursor = 'crosshair';
            }
        }
    }
    canvas.addEventListener("contextmenu", handleContextMenu);
    paramCanvas.addEventListener("contextmenu", handleContextMenu);

    function handleMouseDown(e) {
        const targetCanvas = e.target;
        const isMain = targetCanvas === canvas;
        const currentMode = isMain ? interactionModeMain : interactionModeParam;

        if (currentMode === 'pan' && e.button === 0) {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
        }
    }
    canvas.addEventListener("mousedown", handleMouseDown);
    paramCanvas.addEventListener("mousedown", handleMouseDown);

    window.addEventListener("mouseup", (e) => {
        if (e.button === 0) {
            isDragging = false;
            // Sync state on mouse up to ensure final position is shared
            syncState();
        }
    });

    function handleMouseMove(e) {
        const targetCanvas = e.target;
        // Only process if target is one of our canvases
        if (targetCanvas !== canvas && targetCanvas !== paramCanvas) return;

        const isMain = targetCanvas === canvas;
        const [shaderX, shaderY] = getShaderMouse(e, targetCanvas);
        const currentMode = isMain ? interactionModeMain : interactionModeParam;

        if (isDragging && currentMode === 'pan') {
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

            updateUniforms(); // Local update for smoothness
            // We could throttle sync here if needed, but for now let's rely on mouseup for final sync
            // or maybe sync every frame? Syncing every frame might be too much for BroadcastChannel.
            // Let's try syncing every frame for now, if it lags we can throttle.
            syncState();

            lastMousePos = { x: e.clientX, y: e.clientY };
        } else if (currentMode === 'root') {
            // MODIFIED LOGIC: Control Path Origin only applies to Main Canvas
            if (isMain && showPath && controlPathOrigin) {
                pathOrigin = [shaderX, shaderY];
            } else {
                // Move root (applies to both canvases, but logic is same)
                rootPosition = [shaderX, shaderY];

                // Update path origin if tracking
                if (trackCenter) {
                    pathOrigin = [rootPosition[0] / 3.0, rootPosition[1] / 3.0];
                }
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
        const isMain = targetCanvas === canvas;
        const currentMode = isMain ? interactionModeMain : interactionModeParam;

        if (currentMode === 'pan') {
            const [mouseX_before, mouseY_before] = getShaderMouse(e, targetCanvas);
            const zoomAmount = e.deltaY * 0.0005;

            if (isMain) {
                zoomMain *= (1.0 + zoomAmount);
            } else {
                zoomParam *= (1.0 + zoomAmount);
            }

            const [mouseX_after, mouseY_after] = getShaderMouse(e, targetCanvas);

            if (isMain) {
                panMain[0] += (mouseX_before - mouseX_after);
                panMain[1] += (mouseY_before - mouseY_after);
            } else {
                panParam[0] += (mouseX_before - mouseX_after);
                panParam[1] += (mouseY_before - mouseY_after);
            }

            updateUniforms();
            syncState();
        }
    }
    canvas.addEventListener("wheel", handleWheel);
    paramCanvas.addEventListener("wheel", handleWheel);

    // -------------------
    // Mobile interactions (updated)
    // -------------------
    let lastTapTime = 0;
    const doubleTapThreshold = 300; // ms
    const rootTouchRadius = 0.1; // proximity threshold in shader coordinates

    function distance2D(a, b) {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    function handleTouchStart(e) {
        e.preventDefault();
        ongoingTouches = [...e.touches];
        const targetCanvas = e.target;

        if (ongoingTouches.length === 1) {
            const [x, y] = getTouchPos(ongoingTouches[0], targetCanvas);
            const now = Date.now();
            const timeSinceLastTap = now - lastTapTime;

            const isMain = targetCanvas === canvas;
            const currentZoom = isMain ? zoomMain : zoomParam;
            const dynamicRadius = rootTouchRadius * currentZoom; // scale with zoom

            // Check proximity to both, path origin takes priority
            const distToRoot = distance2D([x, y], rootPosition);
            const distToPath = (showPath && isMain) ? distance2D([x, y], pathOrigin) : Infinity; // Only check path if shown AND on main canvas

            if (timeSinceLastTap < doubleTapThreshold) {
                // Double-tap-drag: behavior depends on 'controlPathOrigin' toggle
                if (isMain && showPath && controlPathOrigin) {
                    touchMode = 'movePathOrigin';
                } else {
                    touchMode = 'moveRoot';
                }
            } else {
                // Single-tap-drag: behavior depends on proximity, path origin takes priority
                if (showPath && distToPath < dynamicRadius) {
                    touchMode = 'movePathOrigin';
                } else if (distToRoot < dynamicRadius) {
                    touchMode = 'moveRoot';
                } else {
                    touchMode = null;
                }
            }

            touchStartPos = { x: ongoingTouches[0].clientX, y: ongoingTouches[0].clientY };
            lastTapTime = now;
        } else if (ongoingTouches.length === 2) {
            touchMode = 'pan';
        }
    }
    canvas.addEventListener("touchstart", handleTouchStart);
    paramCanvas.addEventListener("touchstart", handleTouchStart);

    function handleTouchMove(e) {
        e.preventDefault();
        const targetCanvas = e.target;
        if (e.touches.length === 2) touchMode = 'pan';

        if (touchMode === 'movePathOrigin' && e.touches.length === 1) {
            const [x, y] = getTouchPos(e.touches[0], targetCanvas);
            pathOrigin = [x, y];
        } else if (touchMode === 'moveRoot' && e.touches.length === 1) {
            const [x, y] = getTouchPos(e.touches[0], targetCanvas);
            rootPosition = [x, y];

            // Update path origin if tracking
            if (trackCenter) {
                pathOrigin = [rootPosition[0] / 3.0, rootPosition[1] / 3.0];
            }
        } else if (touchMode === 'pan' && e.touches.length === 2) {
            const t0 = e.touches[0];
            const t1 = e.touches[1];
            const prevT0 = ongoingTouches[0];
            const prevT1 = ongoingTouches[1];

            const prevDist = Math.hypot(prevT0.clientX - prevT1.clientX, prevT0.clientY - prevT1.clientY);
            const newDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);

            const isMain = targetCanvas === canvas;

            // avoid division by zero
            if (prevDist > 0 && newDist > 0) {
                const zoomFactor = prevDist / newDist;
                if (isMain) {
                    zoomMain *= zoomFactor;
                } else {
                    zoomParam *= zoomFactor;
                }
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

    // -------------------
    // Fullscreen
    // -------------------
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
                console.error("Error attempting to enable fullscreen:", err);
            }
        } else {
            await document.exitFullscreen();
        }
    }

    fullscreenBtnMain.addEventListener("click", () => toggleFullscreen(wrapperMain));
    fullscreenBtnParam.addEventListener("click", () => toggleFullscreen(wrapperParam));

    document.addEventListener("fullscreenchange", () => {
        const isFullscreen = !!document.fullscreenElement;
        fullscreenBtnMain.textContent = "Fullscreen";
        fullscreenBtnParam.textContent = "Fullscreen";

        if (isFullscreen) {
            if (document.fullscreenElement === wrapperMain) {
                fullscreenBtnMain.textContent = "Exit Fullscreen";
            } else if (document.fullscreenElement === wrapperParam) {
                fullscreenBtnParam.textContent = "Exit Fullscreen";
            }
        }
        setTimeout(() => { resizeToCurrentDisplay(); reapplyState(); }, 150);
    });

    // -------------------
    // Popout Logic
    // -------------------
    function openPopup(mode) {
        const width = 600;
        const height = 600;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        window.open(`index.html?popup=${mode}`, `_blank_${mode}`, `width=${width},height=${height},left=${left},top=${top}`);
    }

    if (popoutBtnMain) popoutBtnMain.addEventListener("click", () => openPopup('main'));
    if (popoutBtnParam) popoutBtnParam.addEventListener("click", () => openPopup('param'));

    window.addEventListener("resize", handleResize);

    // -------------------
    // Fix for mobile blank canvas
    // -------------------
    function ensureCanvasRenders() {
        if (sandbox.render) sandbox.render();
        if (paramSandbox.render) paramSandbox.render();
    }

});
