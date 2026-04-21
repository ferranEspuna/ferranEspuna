#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_iterations;
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_current_param;
uniform float u_screen_ratio;

#define MAX_ITERS 256

vec2 csquare(vec2 z) {
    return vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y);
}

float mandelbrot_escape(vec2 c) {
    vec2 z = vec2(0.0);
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

void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = uv * u_zoom + u_pan;

    float esc = mandelbrot_escape(uv);
    vec3 col = vec3(0.02, 0.02, 0.06);
    if (esc < u_iterations - 0.5) {
        col = palette(esc);
    }

    float dot_r = 0.018 * u_zoom / u_screen_ratio;
    vec3 paramColor = vec3(0.95, 0.72, 0.12);
    col = mix(col, paramColor, circle(uv, u_current_param, dot_r));

    gl_FragColor = vec4(col, 1.0);
}
