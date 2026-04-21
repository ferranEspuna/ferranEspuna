#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_iterations;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_param; // a in f(z) = a z (1 - z), drawn at same coords on this plane
uniform float u_screen_ratio;

uniform float u_show_path;
uniform float u_path_length;
uniform vec2 u_path[256];

#define MAX_ITERS 256

vec2 cmul(vec2 a, vec2 b) {
    return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cinv(vec2 z) {
    float m = max(dot(z, z), 1e-12);
    return vec2(z.x, -z.y) / m;
}

// Fixed points of z ↦ a z(1-z): z = 0 and z = 1 - 1/a
void logistic_fixed_points(vec2 a, out vec2 fp0, out vec2 fp1) {
    fp0 = vec2(0.0, 0.0);
    vec2 one = vec2(1.0, 0.0);
    fp1 = one - cinv(a);
}

vec2 f_logistic(vec2 a, vec2 z) {
    vec2 one = vec2(1.0, 0.0);
    return cmul(cmul(a, z), one - z);
}

float phase_escape(vec2 z0, vec2 a) {
    vec2 z = z0;
    for (int i = 0; i < MAX_ITERS; i++) {
        if (float(i) >= u_iterations) break;
        z = f_logistic(a, z);
        float r2 = dot(z, z);
        if (r2 > 1.0e4) {
            float m = sqrt(r2);
            return float(i) + 1.0 - log2(log2(max(m, 2.0)));
        }
    }
    return u_iterations;
}

vec3 palette(float t) {
    t = clamp(t / max(u_iterations, 1.0), 0.0, 1.0);
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.15, 0.45, 0.75) + t * 2.2 + vec3(0.05, 0.15, 0.25)));
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

    float esc = phase_escape(uv, u_param);
    vec3 col = vec3(0.02, 0.03, 0.05);
    if (esc < u_iterations - 0.5) {
        col = palette(esc);
    }

    if (u_show_path > 0.5) {
        float pathVal = draw_path(uv, u_zoom, u_screen_ratio);
        col = mix(col, vec3(1.0), pathVal);
    }

    float fp_r = 0.014 * u_zoom / u_screen_ratio;
    vec3 fpColor = vec3(0.88, 0.28, 0.92);
    vec2 lfp0, lfp1;
    logistic_fixed_points(u_param, lfp0, lfp1);
    col = mix(col, fpColor, circle(uv, lfp0, fp_r));
    col = mix(col, fpColor, circle(uv, lfp1, fp_r));

    float crit_r = 0.013 * u_zoom / u_screen_ratio;
    vec3 critColor = vec3(0.15, 0.88, 0.82);
    vec2 critical_log = vec2(0.5, 0.0);
    col = mix(col, critColor, circle(uv, critical_log, crit_r));

    float prm_r = 0.018 * u_zoom / u_screen_ratio;
    vec3 paramColor = vec3(0.95, 0.72, 0.12);
    col = mix(col, paramColor, circle(uv, u_param, prm_r));

    gl_FragColor = vec4(col, 1.0);
}
