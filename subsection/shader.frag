// File: /subsection/shader.frag

// Make sure precision is defined
#ifdef GL_ES
precision mediump float;
#endif

// Uniforms provided by glslCanvas (and our custom one)
uniform vec2 u_resolution; // Replaces iResolution
uniform vec2 u_mouse;      // Replaces iMouse
uniform float u_time;        // Replaces iTime
uniform float u_iterations;  // <-- Our new slider control!

// Renamed to MAX_ITERS and increased the value
#define MAX_ITERS 30

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cinv(vec2 z){
    float mag = dot(z, z) + 1e-6;
    return vec2(z.x, -z.y) / mag;
}

// Modified to accept a 'current_iters' count
vec2 newton(vec2 z, vec2 root0, vec2 root1, vec2 root2, int current_iters) {
    // Loop up to the compile-time maximum
    for (int i = 0; i < MAX_ITERS; ++i) {
        // But break early if we've hit the current iteration count
        if (i >= current_iters) break;
        
        vec2 a = z - root0;
        vec2 b = z - root1;
        vec2 c = z - root2;
        vec2 f = cmul(cmul(a, b), c);
        vec2 der = cmul(a, b) + cmul(b, c) + cmul(c, a);
        z -= cmul(f, cinv(der));
    }
    return z;
}

// (complex_color and circle functions remain unchanged)
// ... (paste your complex_color and circle functions here) ...

vec3 complex_color(vec2 z) {
    float arg = atan(z.y, z.x);
    float mag = length(z);
    vec3 col = vec3(0.5 + 0.5*cos(arg + vec3(0.0, 2.0, 4.0)));
    col *= pow(mag / (1.0 + mag), 0.35);
    return col;
}

float circle(vec2 uv, vec2 c, float r) {
    float d = length(uv - c);
    return smoothstep(r, r-0.002, d);
}


void main() { // Use main() instead of mainImage() for glslCanvas
    float small_resol = min(u_resolution.x, u_resolution.y);
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    float angle = u_time * 0.25;
    
    // --- THIS IS THE KEY CHANGE ---
    // Use our slider-controlled uniform
    int current_iters = int(u_iterations);
    // -----------------------------
    
    // Fixed roots and mouse-controlled root
    vec2 root0 = vec2(-0.4, 0.0);
    vec2 root1 = vec2(0.4, 0.0);
    // Use u_mouse, and flip Y-axis (web standard)
    vec2 root2 = (2.0 * vec2(u_mouse.x, u_resolution.y - u_mouse.y) - u_resolution.xy) / small_resol;

    // Pass the new 'current_iters' variable to the function
    vec2 out_comp = newton(uv, root0, root1, root2, current_iters);
    float r = exp(-1.5*length(out_comp - root0));
    float g = exp(-1.5*length(out_comp - root1));
    float b = exp(-1.5*length(out_comp - root2));
    vec3 color = vec3(r, g, b);
    
    vec3 zero = vec3(0.0);

    // Draw dots at roots
    float dot_r = 0.02;
    color = mix(color, zero, circle(uv, root0, dot_r));
    color = mix(color, zero, circle(uv, root1, dot_r));
    color = mix(color, zero, circle(uv, root2, dot_r));

    gl_FragColor = vec4(color, 1.0);
}
