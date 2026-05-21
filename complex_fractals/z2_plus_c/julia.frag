#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_iterations;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_param; // c in f(z) = z^2 + c (also drawn on this plane at the same complex coords)
uniform float u_screen_ratio;

uniform float u_show_path;
uniform float u_path_length;
uniform vec2 u_path[256];

#define MAX_ITERS 256

vec2 csquare(vec2 z) {
    return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

// Principal sqrt; non-negative imaginary part on negative real axis (y = 0, x < 0)
vec2 csqrt(vec2 z) {
    float x = z.x;
    float y = z.y;
    float r = length(z);
    if (r < 1e-14) return vec2(0.0);
    if (abs(y) < 1e-8 && x < 0.0) {
        return vec2(0.0, sqrt(-x));
    }
    float re = sqrt(0.5 * (r + x));
    float im = sign(y) * sqrt(max(0.0, 0.5 * (r - x)));
    return vec2(re, im);
}

// Fixed points of z^2 + c: z = (1 ± sqrt(1 - 4c)) / 2
void quadratic_fixed_points(vec2 c, out vec2 fp0, out vec2 fp1) {
    vec2 disc = vec2(1.0, 0.0) - 4.0 * c;
    vec2 s = csqrt(disc);
    fp0 = 0.5 * (vec2(1.0, 0.0) + s);
    fp1 = 0.5 * (vec2(1.0, 0.0) - s);
}

float julia_escape(vec2 z0, vec2 c) {
    vec2 z = z0;
    for (int i = 0; i < MAX_ITERS; i++) {
        if (float(i) >= u_iterations) break;
        z = csquare(z) + c;
        float r2 = dot(z, z);
        if (r2 > 16.0) {
            float m = sqrt(r2);
            return float(i) + 1.0 - log2(log2(m));
        }
    }
    return u_iterations;
}

vec3 palette(float t) {
    t = clamp(t / max(u_iterations, 1.0), 0.0, 1.0);
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t * 2.5 + vec3(0.1, 0.2, 0.3)));
}

float circle(vec2 uv, vec2 c, float r) {
    float d = length(uv - c);
    return 1.0 - smoothstep(r * 0.85, r, d);
}

float segment(vec2 uv, vec2 a, vec2 b, float thick) {
    vec2 ab = b - a;
    float dab = dot(ab, ab);
    if (10.0 * dab < thick) return 0.0;
    vec2 ax = uv - a;
    if (dot(ab, ax) < 0.0) return 0.0;
    if (dot(ab, ax) > dot(ab, ab)) return 0.0;
    float perc = dot(ab, ax) / dot(ab, ab);
    vec2 closest = a + perc * ab;
    float dist = length(uv - closest);
    return 1.0 - smoothstep(thick * 0.85, thick, dist);
}

float draw_path(vec2 z, float zoom, float ratio) {
    if (u_show_path < 0.5 || u_path_length < 1.5) return 0.0;
    float final = circle(z, u_path[0], 0.01 * zoom / ratio);
    for (int i = 0; i < MAX_ITERS; i++) {
        if (float(i) >= u_path_length - 1.0) break;
        vec2 z0 = u_path[i];
        vec2 z1 = u_path[i + 1];
        final = max(final, 0.7 * segment(z, z0, z1, 0.005 * zoom / ratio));
        final = max(final, circle(z, z1, 0.01 * zoom / ratio));
    }
    return final;
}

void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = uv * u_zoom + u_pan;

    float esc = julia_escape(uv, u_param);
    vec3 col = vec3(0.02, 0.02, 0.06);
    if (esc < u_iterations - 0.5) {
        col = palette(esc);
    }

    if (u_show_path > 0.5) {
        float pathVal = draw_path(uv, u_zoom, u_screen_ratio);
        col = mix(col, vec3(1.0), pathVal);
    }

    float fp_r = 0.014 * u_zoom / u_screen_ratio;
    vec3 fpColor = vec3(0.88, 0.28, 0.92);
    vec2 qfp0, qfp1;
    quadratic_fixed_points(u_param, qfp0, qfp1);
    col = mix(col, fpColor, circle(uv, qfp0, fp_r));
    col = mix(col, fpColor, circle(uv, qfp1, fp_r));

    float crit_r = 0.013 * u_zoom / u_screen_ratio;
    vec3 critColor = vec3(0.15, 0.88, 0.82);
    vec2 critical_z2c = vec2(0.0, 0.0);
    col = mix(col, critColor, circle(uv, critical_z2c, crit_r));

    float prm_r = 0.018 * u_zoom / u_screen_ratio;
    vec3 paramColor = vec3(0.95, 0.72, 0.12);
    col = mix(col, paramColor, circle(uv, u_param, prm_r));

    gl_FragColor = vec4(col, 1.0);
}
