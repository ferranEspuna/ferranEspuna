#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_iterations;

// NEW UNIFORMS
uniform float u_zoom;
uniform vec2 u_pan;
uniform vec2 u_root_position;
// ADDED FOR PATH TOGGLE/CONTROL
uniform float u_show_path;
uniform vec2 u_path_origin;

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

float segment(vec2 uv, vec2 a, vec2 b, float thick){
	vec2 ab = b - a;
	float dab = dot(ab, ab);
	if (10.0 * dab < thick){
		return 0.0;
	}
	vec2 ax = uv - a;
	if (dot(ab, ax) < 0.0){
		return 0.0;
	}
	if (dot(ab, ax) > dot(ab, ab)){
		return 0.0;
	}

	float perc = dot(ab, ax) / dot(ab, ab);
	vec2 closest = a + perc * ab;
	float dist = length(uv - closest);

	return 1.0 - smoothstep(thick * 0.85, thick, dist);
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

// MODIFIED: Takes u_path_origin directly instead of z0 argument
float newton_path(vec2 z, vec2 root0, vec2 root1, vec2 root2, float zoom) {
    
    vec2 z0 = u_path_origin; // Use uniform for start point
	float final = circle(z, z0, 0.015 * zoom);
	vec2 new_z0;

	for (int i = 0; i < MAX_ITERS; ++i) {
        if (float(i) >= u_iterations) break;
        vec2 a = z0 - root0;
        vec2 b = z0 - root1;
        vec2 c = z0 - root2;
        vec2 f = cmul(cmul(a, b), c);
        vec2 der = cmul(a, b) + cmul(b, c) + cmul(c, a);
		new_z0 = z0 - cmul(f, cinv(der));
		final = max(final, 0.7 * segment(z, z0, new_z0, 0.005 * zoom));
		final = max(final, circle(z, new_z0, 0.01 * zoom));
		z0 = new_z0;
    }
    return final;
}


void main() {
    float small_resol = min(u_resolution.x, u_resolution.y);
    // MODIFIED UV CALCULATION
    vec2 uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    uv = (uv * u_zoom) + u_pan; // Apply zoom and pan

    vec2 root0 = vec2(-0.4, 0.0);
    vec2 root1 = vec2(0.4, 0.0);
    // MODIFIED ROOT2 CALCULATION
    vec2 root2 = u_root_position;
    // Use the uniform directly

    vec2 out_comp = newton(uv, root0, root1, root2);
    float r = exp(-1.5 * length(out_comp - root0));
    float g = exp(-1.5 * length(out_comp - root1));
    float b = exp(-1.5 * length(out_comp - root2));

    vec3 color = vec3(r, g, b);
    // We need to apply zoom to the dot radius so it stays the same size on screen
    float dot_r = 0.02 * u_zoom;
    vec3 zero = vec3(0.0);
    vec3 one = vec3(1.0);
    color = mix(color, zero, circle(uv, root0, dot_r));
    color = mix(color, zero, circle(uv, root1, dot_r));
    color = mix(color, 0.6 * one, circle(uv, root2, dot_r));
    
    // MODIFIED: Use new uniforms to toggle path and origin drawing
    float path_val = newton_path(uv, root0, root1, root2, u_zoom);
    color = mix(color, one, path_val * u_show_path);

    gl_FragColor = vec4(color, 1.0);
}
