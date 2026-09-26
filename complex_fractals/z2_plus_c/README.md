---
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
---

Repeat the rule **z → z² + c**. Some starting points stay nearby; others escape. The Mandelbrot set maps the choices of `c`, while the other panel shows the corresponding Julia picture.

**Try this:** choose **Move point** in the parameter plane, then tap or drag around the boundary of the dark region. Watch the Julia picture change from connected shapes to scattered islands.

## Reading the picture

The **dynamical plane** fixes `c` and tries a different starting point at each pixel. The **parameter plane** tries a different `c` at each pixel, always starting at `z = 0`.

Colors encode escape time; very dark pixels have not escaped within the iteration limit. Staying dark for a finite number of iterations is not a proof that a point never escapes.

- **Gold dot:** the selected parameter `c`, shown at the same coordinates on both panels.
- **Magenta dots:** fixed points, where applying the rule leaves the point unchanged.
- **Teal dot:** the critical point `z = 0`.
- **White path:** an orbit when **Show orbit** is enabled. Turn off **Lock to critical point** and select **Move orbit start** to try another starting point.
