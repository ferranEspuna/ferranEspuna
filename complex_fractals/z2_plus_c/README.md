<!-- page
columns: true
layout: complex_fractal
category: fractal
title: Mandelbrot & Julia
description: Change one complex number to explore the Mandelbrot set and its Julia sets.
permalink: /complex_fractals/z2_plus_c/
family: polynomial
iteration_max: 256
iteration_value: 64
main_shader: julia.frag
param_shader: mandelbrot_parameter.frag
-->

# Mandelbrot & Julia

## Guide
Repeat the rule **z → z² + c**. Some starting points stay nearby; others escape. The Mandelbrot set maps the choices of `c`, while the other panel shows the corresponding Julia picture.

**Try this:** right-click in the parameter plane and move the mouse around the dark region’s boundary, or double-tap and drag on mobile. Watch the Julia picture change from connected shapes to scattered islands.

### Controls

- **Desktop:** right-click a plot to switch between **pan / zoom** and **point placement**, independently for each plot. Drag to pan; in point placement mode the point follows the mouse. Scroll to zoom in either mode without moving the point.
- **Mobile:** drag with one finger to pan. To move a point, double-tap, keep the second tap held, and drag; lift your finger to finish. Use two fingers to pan and pinch to zoom. Adding a second finger cancels point placement, so pinching cannot leave the root or parameter accidentally moved.
- **Orbit start:** enable **Show orbit**, turn off its tracking/critical-point lock, and enable **Move orbit start**. Point placement in the dynamical plane then moves the orbit start instead of the parameter or root.
- **Fullscreen:** use **Fullscreen** to enter; use the browser’s Back gesture on mobile or **Esc** on desktop to leave. There is no exit button covering the plot.
- **Keyboard:** Tab to a plot, press **M** to switch modes, use the arrow keys to pan or move the point, **+ / −** to zoom, and **0** to reset the view. **Reset view** also restores the initial pan and zoom.

## Reading the picture

The **dynamical plane** fixes `c` and tries a different starting point at each pixel. The **parameter plane** tries a different `c` at each pixel, always starting at `z = 0`.

Colors encode escape time; very dark pixels have not escaped within the iteration limit. Staying dark for a finite number of iterations is not a proof that a point never escapes.

- **Gold dot:** the selected parameter `c`, shown at the same coordinates on both panels.
- **Magenta dots:** fixed points, where applying the rule leaves the point unchanged.
- **Teal dot:** the critical point `z = 0`.
- **White path:** an orbit when **Show orbit** is enabled. Turn off **Lock to critical point** and select **Move orbit start** to try another starting point.
