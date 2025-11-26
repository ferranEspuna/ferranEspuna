#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_iterations;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_current_root2; // The root2 from the main view, to show "you are here"
uniform float u_screen_ratio; // New uniform

#define MAX_ITERS 100

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cinv(vec2 z) {
    float mag = max(dot(z, z), 1e-6);
    return vec2(z.x, -z.y) / mag;
}

float circle(vec2 uv, vec2 c, float r) {
    float d = length(uv - c);
    return 1.0 - smoothstep(r * 0.85, r, d);
}

vec2 newton(vec2 z, vec2 root0, vec2 root1, vec2 root2) {
    for (int i = 0; i < MAX_ITERS; ++i) {
        if (float(i) >= u_iterations) break;
        vec2 a = z - root0;
        vec2 b = z - root1;
        vec2 c = z - root2;
        vec2 f = cmul(cmul(a, b), c);
        vec2 der = cmul(a, b) + cmul(b, c) + cmul(c, a);
        z -= cmul(f, cinv(der));
    }
    return z;
}

vec3 color(vec2 uv, vec2 root0, vec2 root1, vec2 root2) {
    float r = exp(-1.5 * length(uv - root0) / min(length(uv - root1), 1.0) / min(length(uv - root2), 1.0));
    float g = exp(-1.5 * length(uv - root1) / min(length(uv - root0), 1.0) / min(length(uv - root2), 1.0));
    float b = exp(-1.5 * length(uv - root2) / min(length(uv - root0), 1.0) / min(length(uv - root1), 1.0));
    return vec3(r, g, b);
}
void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = (uv * u_zoom) + u_pan; // Apply zoom and pan

    vec2 root0 = vec2(-0.4, 0.0);
    vec2 root1 = vec2(0.4, 0.0);
    vec2 root2 = uv; // The pixel IS the third root

    // Start at centroid
    vec2 z = (root0 + root1 + root2) / 3.0;

    vec2 out_comp = newton(z, root0, root1, root2);
    
    // Color based on convergence to root0, root1, or root2 (which is uv)
    vec3 color = color(out_comp, root0, root1, root2);
    
    // Draw fixed roots for context
    float dot_r = 0.015 * u_zoom / u_screen_ratio;
    vec3 zero = vec3(0.0);
    vec3 one = vec3(1.0);
    
    color = mix(color, zero, circle(uv, root0, dot_r));
    color = mix(color, zero, circle(uv, root1, dot_r));
    

    color = mix(color, 0.6 * one, circle(uv, u_current_root2, dot_r));

    gl_FragColor = vec4(color, 1.0);
}
