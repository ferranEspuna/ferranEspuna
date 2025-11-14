#version 400
#extension GL_ARB_gpu_shader_fp64 : enable

uniform dvec2 u_resolution;
uniform double u_time;
uniform double u_iterations;

// NEW UNIFORMS
uniform double u_zoom;
uniform dvec2 u_pan;
uniform dvec2 u_root_position;

#define MAX_ITERS 100

dvec2 cmul(dvec2 a, dvec2 b) {
    return dvec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x);
}

dvec2 cinv(dvec2 z) {
    double mag = max(dot(z, z), 1e-6);
    return dvec2(z.x, -z.y) / mag;
}

double circle(dvec2 uv, dvec2 c, double r) {
    double d = length(uv - c);
    return 1.0 - smoothstep(r * 0.85, r, d);
}

dvec2 newton(dvec2 z, dvec2 root0, dvec2 root1, dvec2 root2) {
    for (int i = 0; i < MAX_ITERS; ++i) {
        if (double(i) >= u_iterations) break;
        dvec2 a = z - root0;
        dvec2 b = z - root1;
        dvec2 c = z - root2;
        dvec2 f = cmul(cmul(a, b), c);
        dvec2 der = cmul(a, b) + cmul(b, c) + cmul(c, a);
        z -= cmul(f, cinv(der));
    }
    return z;
}

void main() {
    double small_resol = min(u_resolution.x, u_resolution.y);

    dvec2 uv = (2.0 * dvec2(gl_FragCoord.xy) - u_resolution) / small_resol;
    uv = (uv * u_zoom) + u_pan;

    dvec2 root0 = dvec2(-0.4, 0.0);
    dvec2 root1 = dvec2(0.4, 0.0);
    dvec2 root2 = u_root_position;

    dvec2 out_comp = newton(uv, root0, root1, root2);

    double r = exp(-1.5 * length(out_comp - root0));
    double g = exp(-1.5 * length(out_comp - root1));
    double b = exp(-1.5 * length(out_comp - root2));

    dvec3 color = dvec3(r, g, b);

    double dot_r = 0.02 * u_zoom;

    dvec3 zero = dvec3(0.0);
    dvec3 one = dvec3(1.0);

    color = mix(color, zero, circle(uv, root0, dot_r));
    color = mix(color, zero, circle(uv, root1, dot_r));
    color = mix(color, one, circle(uv, root2, dot_r));

    gl_FragColor = vec4(color, 1.0);
}
