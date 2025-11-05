#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_iterations;

// NEW UNIFORMS
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_root_position;

#define MAX_ITERS 30

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

vec2 cinv(vec2 z) {
    float mag = max(dot(z, z), 1e-6);
    return vec2(z.x, -z.y) / mag;
}

vec3 complex_color(vec2 z) {
    float arg = atan(z.y, z.x);
    float mag = length(z);
    vec3 col = vec3(0.5 + 0.5*cos(arg + vec3(0.0, 2.0, 4.0)));
    col *= pow(mag / (1.0 + mag), 0.35);
    return col;
}

// UPDATED: now scales edge softness with zoom
float circle(vec2 uv, vec2 c, float r, float zoom) {
    float d = length(uv - c);
    float edge = 0.002 / zoom; // keep edge width constant in screen space
    return smoothstep(r, r - edge, d);
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

void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);

    // UV with zoom & pan
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = (uv * u_zoom) + u_pan;

    vec2 root0 = vec2(-0.4, 0.0);
    vec2 root1 = vec2(0.4, 0.0);
    vec2 root2 = u_root_position;

    vec2 out_comp = newton(uv, root0, root1, root2);

    float r = exp(-1.5 * length(out_comp - root0));
    float g = exp(-1.5 * length(out_comp - root1));
    float b = exp(-1.5 * length(out_comp - root2));

    vec3 color = vec3(r, g, b);

    // FIXED: keep dots constant size on screen
    float dot_r = 0.02 / u_zoom;
    vec3 zero = vec3(0.0);
    color = mix(color, zero, circle(uv, root0, dot_r, u_zoom));
    color = mix(color, zero, circle(uv, root1, dot_r, u_zoom));
    color = mix(color, zero, circle(uv, root2, dot_r, u_zoom));

    gl_FragColor = vec4(color, 1.0);
}
