---
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
---

## Guide
Repeat the rule **z → az(1 − z)**, allowing both `z` and `a` to be complex numbers. Moving `a` changes which starting points escape and which stay nearby.

**Try this:** choose **Move point** in the parameter plane and drag around the gold dot. Enable **Show orbit** to see repeated steps from the critical point `z = ½`.

## Reading the picture

The **dynamical plane** fixes `a` and varies the starting point. The **parameter plane** varies `a` and follows the orbit starting at `z = ½`.

Colors encode escape time. Very dark pixels have not escaped within the iteration limit; increasing that limit can reveal more detail.

- **Gold dot:** the selected parameter `a`, shown at the same coordinates on both panels.
- **Magenta dots:** the fixed points `0` and `1 − 1/a` (the second formula needs `a ≠ 0`).
- **Teal dot:** the critical point `z = ½` for `a ≠ 0`.
- **White path:** an orbit when **Show orbit** is enabled. Turn off **Lock to critical point** and select **Move orbit start** to try another starting point.
