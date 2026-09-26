<!-- page
columns: true
layout: complex_fractal
category: fractal
title: Newton's Fractal
description: Find the roots of a polynomial and explore where Newton’s method converges.
permalink: /complex_fractals/newton_fractal/
family: newton
iteration_max: 100
iteration_value: 10
main_shader: shader.frag
param_shader: parameter_space.frag
-->

# Newton's Fractal

## Guide
Each pixel starts a calculation: repeatedly apply **Newton’s method** to find a root of a cubic polynomial. Its color shows which of the three roots it approaches. Move the third root to change the picture.

**Try this:** right-click in the parameter plane and move the mouse near the two fixed roots, or double-tap and drag on mobile. Increase the iterations to see the boundaries sharpen.

### Controls

- **Desktop:** right-click a plot to switch between **pan / zoom** and **point placement**, independently for each plot. Drag to pan; in point placement mode the point follows the mouse. Scroll to zoom in either mode without moving the point.
- **Mobile:** drag with one finger to pan. To move a point, double-tap, keep the second tap held, and drag; lift your finger to finish. Use two fingers to pan and pinch to zoom. Adding a second finger cancels point placement, so pinching cannot leave the root or parameter accidentally moved.
- **Orbit start:** enable **Show orbit**, turn off its tracking/critical-point lock, and enable **Move orbit start**. Point placement in the dynamical plane then moves the orbit start instead of the parameter or root.
- **Fullscreen:** use **Fullscreen** to enter; use the browser’s Back gesture on mobile or **Esc** on desktop to leave. There is no exit button covering the plot.
- **Keyboard:** Tab to a plot, press **M** to switch modes, use the arrow keys to pan or move the point, **+ / −** to zoom, and **0** to reset the view. **Reset view** also restores the initial pan and zoom.

## Reading the picture

The **dynamical plane** colors starting points by the root they approach. You can choose the three root colors above the plots. Dark or blended regions indicate slower convergence or a calculation that has not settled within the chosen number of iterations.

The **parameter plane** tries a different third root at each pixel and follows the orbit of the roots’ centroid. Some choices lead to attracting cycles instead of convergence to a root.

- **Black dots:** the two fixed roots at −0.4 and +0.4.
- **Gray dot:** the third root, which you can move.
- **Teal dot:** the centroid of the three roots. For a cubic with distinct roots this is an additional critical point of its Newton map, except in degenerate cases.
- **White path:** the steps from one starting point when **Show orbit** is enabled. Choose **Move orbit start** to set that point, or **Track centroid** to follow the centroid as you move the third root.

The plotted calculation is `N(z) = z − p(z)/p′(z)`, with `p(z) = (z + 0.4)(z − 0.4)(z − r)` and movable root `r`.
