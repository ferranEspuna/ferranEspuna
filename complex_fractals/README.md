

This section packages interactive, real-time GLSL fragment shaders visualizing chaotic dynamical systems and complex functions. 

Each interactive visualizer uses a dual-panel layout, split-sync state broadcasting across windows, and touch-responsive gesture support.

## Interactive Visualizers

*   [**Newton's Fractal**](/complex_fractals/newton_fractal/) - Visualize the basins of attraction for Newton's root-finding method on cubic polynomials. Drag the third root or step-by-step orbit path.
*   [**Logistic Family**](/complex_fractals/az_one_minus_z/) - Explore fixed points, critical orbits, and chaotic regions under the complex logistic map $f_a(z) = a z (1 - z)$ with dual phase/parameter space navigation.
*   [**Mandelbrot & Julia**](/complex_fractals/z2_plus_c/) - The classic complex quadratic map $f_c(z) = z^2 + c$. Toggle between the parameter space (Mandelbrot set) and dynamical plane (Julia sets).

## Architecture

All visualizers are designed with:
1.  **Dual-panel layout**: Dynamical space vs Parameter space.
2.  **State sync**: Web BroadcastChannel API syncs zoom, pan, parameters, and paths across popout/main window instances.
3.  **WebGL shaders**: Rendered on the client's GPU via `glslCanvas` libraries.
