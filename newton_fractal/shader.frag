#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_iterations;
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

float circle(vec2 uv, vec2 c, float r) {
    float d = length(uv - c);
    return smoothstep(r, r * 0.998, d);
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

// Compute barycentric coordinates
vec3 barycentric(vec2 p, vec2 a, vec2 b, vec2 c) {
    vec2 v0 = b - a;
    vec2 v1 = c - a;
    vec2 v2 = p - a;

    float d00 = dot(v0, v0);
    float d01 = dot(v0, v1);
    float d11 = dot(v1, v1);
    float d20 = dot(v2, v0);
    float d21 = dot(v2, v1);

    float denom = d00 * d11 - d01 * d01 + 1e-6;

    float v = (d11 * d20 - d01 * d21) / denom;
    float w = (d00 * d21 - d01 * d20) / denom;
    float u = 1.0 - v - w;

    return vec3(u, v, w);
}

void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = (uv * u_zoom) + u_pan;

    vec2 root0 = vec2(-0.4, 0.0);
    vec2 root1 = vec2(0.4, 0.0);
    vec2 root2 = u_root_position;

    vec2 out_comp = newton(uv, root0, root1, root2);

    vec3 bary = barycentric(out_comp, root0, root1, root2);

    // Exponential decay to replace clamping
    float k = 3.0; // controls sharpness of decay
    vec3 color = vec3(
        exp(-k * (1.0 - bary.x)),
        exp(-k * (1.0 - bary.y)),
        exp(-k * (1.0 - bary.z))
    );

    // Draw root dots
    float dot_r = 0.02 * u_zoom;
    vec3 zero = vec3(0.0);
    vec3 one = vec3(1.0);
    color = mix(color, zero, circle(uv, root0, dot_r));
    color = mix(color, zero, circle(uv, root1, dot_r));
    color = mix(color, one, circle(uv, root2, dot_r));

    gl_FragColor = vec4(color, 1.0);
}
