<!-- page
columns: true
layout: complex_fractal
category: fractal
title: Logistic Family
description: Explore the complex logistic map and the fate of its critical orbit.
permalink: /complex_fractals/az_one_minus_z/
family: polynomial
iteration_max: 256
iteration_value: 64
main_shader: phase.frag
param_shader: parameter.frag
-->

# Logistic Family

## Guide
Repeat the rule **z → az(1 − z)**, allowing both `z` and `a` to be complex numbers. Moving `a` changes which starting points escape and which stay nearby.

**Try this:** right-click in the parameter plane and move the mouse around the gold dot, or double-tap and drag on mobile. Enable **Show orbit** to see repeated steps from the critical point `z = ½`.

### Controls

- **Desktop:** right-click a plot to switch between **pan / zoom** and **point placement**, independently for each plot. Drag to pan; in point placement mode the point follows the mouse. Scroll to zoom in either mode without moving the point.
- **Mobile:** drag with one finger to pan. To move a point, double-tap, keep the second tap held, and drag; lift your finger to finish. Use two fingers to pan and pinch to zoom. Adding a second finger cancels point placement, so pinching cannot leave the root or parameter accidentally moved.
- **Orbit start:** enable **Show orbit**, turn off its tracking/critical-point lock, and enable **Move orbit start**. Point placement in the dynamical plane then moves the orbit start instead of the parameter or root.
- **Fullscreen:** use **Fullscreen** to enter; use the browser’s Back gesture on mobile or **Esc** on desktop to leave. There is no exit button covering the plot.
- **Keyboard:** Tab to a plot, press **M** to switch modes, use the arrow keys to pan or move the point, **+ / −** to zoom, and **0** to reset the view. **Reset view** also restores the initial pan and zoom.

## Reading the picture

The **dynamical plane** fixes `a` and varies the starting point. The **parameter plane** varies `a` and follows the orbit starting at `z = ½`.

Colors encode escape time. Very dark pixels have not escaped within the iteration limit; increasing that limit can reveal more detail.

- **Gold dot:** the selected parameter `a`, shown at the same coordinates on both panels.
- **Magenta dots:** the fixed points `0` and `1 − 1/a` (the second formula needs `a ≠ 0`).
- **Teal dot:** the critical point `z = ½` for `a ≠ 0`.
- **White path:** an orbit when **Show orbit** is enabled. Turn off **Lock to critical point** and select **Move orbit start** to try another starting point.
