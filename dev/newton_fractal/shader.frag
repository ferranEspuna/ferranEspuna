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

#define MAX_ITERS 100

// ----------------------
// Double-Double (dd) core
// ----------------------
struct dd {
    float hi;
    float lo;
};

dd dd_make(float x) {
    dd r;
    r.hi = x;
    r.lo = 0.0;
    return r;
}

dd dd_make2(float hi, float lo) {
    dd r;
    r.hi = hi;
    r.lo = lo;
    return r;
}

// two_sum: s = a + b exactly split into s (approx) and e (error)
void two_sum(float a, float b, out float s, out float e) {
    s = a + b;
    float bb = s - a;
    e = (a - (s - bb)) + (b - bb);
}

// split constant for two_prod (Dekker)
const float DD_SPLIT = 4097.0; // works for IEEE-754 single precision

// two_prod: p = a*b exactly split into p (approx) and e (error)
void two_prod(float a, float b, out float p, out float e) {
    p = a * b;
    // Dekker split
    float a_c = DD_SPLIT * a;
    float a_hi = a_c - (a_c - a);
    float a_lo = a - a_hi;
    float b_c = DD_SPLIT * b;
    float b_hi = b_c - (b_c - b);
    float b_lo = b - b_hi;
    e = ((a_hi * b_hi - p) + a_hi * b_lo + a_lo * b_hi) + a_lo * b_lo;
}

// dd add: a + b -> dd
dd dd_add(dd a, dd b) {
    float s1, e1;
    two_sum(a.hi, b.hi, s1, e1);
    float s2, e2;
    two_sum(a.lo, b.lo, s2, e2);
    float s = e1 + s2;
    float hi, lo;
    two_sum(s1, s, hi, lo);
    lo = lo + e2;
    // renormalize
    float final_hi, final_lo;
    two_sum(hi, lo, final_hi, final_lo);
    final_lo += (a.lo + b.lo) - s2; // small correction (safe)
    dd r;
    r.hi = final_hi;
    r.lo = final_lo;
    return r;
}

// dd neg
dd dd_neg(dd a) {
    return dd_make2(-a.hi, -a.lo);
}

// dd sub
dd dd_sub(dd a, dd b) {
    return dd_add(a, dd_neg(b));
}

// dd mul: a * b -> dd
dd dd_mul(dd a, dd b) {
    float p, e;
    two_prod(a.hi, b.hi, p, e);
    e = e + (a.hi * b.lo + a.lo * b.hi);
    float hi, lo;
    two_sum(p, e, hi, lo);
    dd r;
    r.hi = hi;
    r.lo = lo;
    return r;
}

// dd_to_float: collapse dd to float (approx)
float dd_to_float(dd a) {
    return a.hi + a.lo;
}

// dd reciprocal with one Newton-Raphson refinement: 1/a
dd dd_inv(dd a) {
    // initial approximation from float
    float approx = 1.0 / (a.hi + a.lo);
    dd e = dd_make(approx);

    // Newton iterate: e = e * (2 - a * e)
    dd ae = dd_mul(a, e);                 // a * e
    dd two = dd_make(2.0);
    dd t = dd_sub(two, ae);               // (2 - a*e)
    dd refined = dd_mul(e, t);            // e * (2 - a*e)
    return refined;
}

// ----------------------
// dd2: 2D / complex double-double
// ----------------------
struct dd2 {
    dd x;
    dd y;
};

dd2 dd2_make(float x, float y) {
    dd2 r;
    r.x = dd_make(x);
    r.y = dd_make(y);
    return r;
}

dd2 dd2_from_vec2(vec2 v) {
    return dd2_make(v.x, v.y);
}

dd2 dd2_add(dd2 a, dd2 b) {
    dd2 r;
    r.x = dd_add(a.x, b.x);
    r.y = dd_add(a.y, b.y);
    return r;
}

dd2 dd2_sub(dd2 a, dd2 b) {
    dd2 r;
    r.x = dd_sub(a.x, b.x);
    r.y = dd_sub(a.y, b.y);
    return r;
}

// scalar multiply dd2 * dd
dd2 dd2_mul_scalar(dd2 a, dd s) {
    dd2 r;
    r.x = dd_mul(a.x, s);
    r.y = dd_mul(a.y, s);
    return r;
}

// complex multiplication (a.x + i a.y) * (b.x + i b.y)
dd2 dd2_cmul(dd2 a, dd2 b) {
    dd real = dd_sub(dd_mul(a.x, b.x), dd_mul(a.y, b.y));
    dd imag = dd_add(dd_mul(a.x, b.y), dd_mul(a.y, b.x));
    dd2 r;
    r.x = real;
    r.y = imag;
    return r;
}

// complex conjugate: (x, -y)
dd2 dd2_conj(dd2 a) {
    dd2 r;
    r.x = a.x;
    r.y = dd_neg(a.y);
    return r;
}

// dot product as dd: x.x*x.x + x.y*x.y
dd dd2_dot_dd(dd2 a, dd2 b) {
    // returns dd(a.x*b.x + a.y*b.y)
    dd t1 = dd_mul(a.x, b.x);
    dd t2 = dd_mul(a.y, b.y);
    return dd_add(t1, t2);
}

// length as float (sqrt of dd -> convert to float then sqrt)
float dd2_length_float(dd2 a) {
    dd mag = dd_add(dd_mul(a.x, a.x), dd_mul(a.y, a.y));
    float fmag = dd_to_float(mag);
    return sqrt(max(fmag, 0.0));
}

// inverse of complex: 1 / z = conj(z) / |z|^2
dd2 dd2_cinv(dd2 z) {
    dd mag = dd_add(dd_mul(z.x, z.x), dd_mul(z.y, z.y)); // dd
    // avoid tiny mags
    float fmag = dd_to_float(mag);
    if (fmag < 1e-6) {
        // return large value to avoid NaNs: use 1e6
        return dd2_make(1e6, 0.0);
    }
    dd invMag = dd_inv(mag);
    dd2 conjz = dd2_conj(z);
    dd2 r = dd2_mul_scalar(conjz, invMag);
    return r;
}

// dd2 to float vec2
vec2 dd2_to_vec2(dd2 a) {
    return vec2(dd_to_float(a.x), dd_to_float(a.y));
}

// ----------------------
// Helper functions used in shader logic
// ----------------------

// circle: returns float blending factor (0..1) using dd2 distance
float circle_dd(dd2 uv, dd2 c, float r) {
    dd2 d = dd2_sub(uv, c);
    float dist = dd2_length_float(d);
    // smoothstep: same as original but on float
    return 1.0 - smoothstep(r * 0.85, r, dist);
}

// ----------------------
// Newton iteration using dd2
// ----------------------
dd2 newton_dd(dd2 z, dd2 root0, dd2 root1, dd2 root2, int max_iters, int iterations_limit) {
    for (int i = 0; i < MAX_ITERS; ++i) {
        if (i >= iterations_limit) break;

        dd2 a = dd2_sub(z, root0);
        dd2 b = dd2_sub(z, root1);
        dd2 c = dd2_sub(z, root2);

        dd2 f = dd2_cmul(dd2_cmul(a, b), c); // cubic polynomial
        // derivative: a*b + b*c + c*a (complex)
        dd2 ab = dd2_cmul(a, b);
        dd2 bc = dd2_cmul(b, c);
        dd2 ca = dd2_cmul(c, a);
        dd2 der;
        der.x = dd_add(dd_add(ab.x, bc.x), ca.x);
        der.y = dd_add(dd_add(ab.y, bc.y), ca.y);

        dd2 invder = dd2_cinv(der);
        dd2 step = dd2_cmul(f, invder);
        z = dd2_sub(z, step);
    }
    return z;
}

// ----------------------
// Main shader
// ----------------------
void main() {
    // small_resol for aspect normalization (float)
    float small_resol = min(u_resolution.x, u_resolution.y);

    // Convert gl_FragCoord to dd2 uv: uv = (2.0 * gl_FragCoord.xy - u_resolution.xy) / small_resol;
    vec2 frag = gl_FragCoord.xy;
    vec2 uv_f = (2.0 * frag - u_resolution) / small_resol;

    // apply zoom/pan in float space for center, then convert to dd2
    // Note: better precision if we build dd2 from scratch using arithmetic in dd,
    // but converting from float positions is fine as a starting point.
    vec2 uv_fz = (uv_f * u_zoom) + u_pan;

    dd2 uv = dd2_make(uv_fz.x, uv_fz.y);

    // roots (from uniforms)
    dd2 root0 = dd2_make(-0.4, 0.0);
    dd2 root1 = dd2_make(0.4, 0.0);
    dd2 root2 = dd2_make(u_root_position.x, u_root_position.y);

    // run Newton with dd arithmetic
    int iter_limit = int(clamp(u_iterations, 0.0, float(MAX_ITERS)));
    dd2 out_comp = newton_dd(uv, root0, root1, root2, MAX_ITERS, iter_limit);

    // distances (float) -> color contributions
    float r = exp(-1.5 * dd2_length_float(dd2_sub(out_comp, root0)));
    float g = exp(-1.5 * dd2_length_float(dd2_sub(out_comp, root1)));
    float b = exp(-1.5 * dd2_length_float(dd2_sub(out_comp, root2)));

    vec3 color = vec3(r, g, b);

    // Dot radius scaled by zoom: keep same behavior as before (float)
    float dot_r = 0.02 * u_zoom;

    vec3 zero = vec3(0.0);
    vec3 one = vec3(1.0);

    // circle uses dd distances but returns float blending factors
    color = mix(color, zero, circle_dd(uv, root0, dot_r));
    color = mix(color, zero, circle_dd(uv, root1, dot_r));
    color = mix(color, one, circle_dd(uv, root2, dot_r));

    gl_FragColor = vec4(color, 1.0);
}
