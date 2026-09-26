// Small, on-demand WebGL renderer. Shaders and runtime are served by this site.
export class Renderer {
    constructor(canvas, source) {
        this.canvas = canvas;
        this.source = source;
        const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
        if (!gl) throw new Error('WebGL is unavailable. Try enabling hardware acceleration or using another browser.');
        const compile = (type, text) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, text);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const message = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error(`The fractal shader could not compile: ${message}`);
            }
            return shader;
        };
        const vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }');
        const fragment = compile(gl.FRAGMENT_SHADER, source);
        const program = this.program = gl.createProgram();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);
        this.buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        this.uniforms = new Map();
        for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
            const info = gl.getActiveUniform(program, i);
            this.uniforms.set(info.name.replace(/\[0\]$/, ''), { type: info.type, location: gl.getUniformLocation(program, info.name) });
        }
    }
    resize(width, height) {
        if (this.canvas.width !== width) this.canvas.width = width;
        if (this.canvas.height !== height) this.canvas.height = height;
    }
    render(values) {
        const gl = this.gl;
        if (gl.isContextLost()) return;
        gl.useProgram(this.program);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        for (const [name, value] of Object.entries({ ...values, u_resolution: [this.canvas.width, this.canvas.height] })) {
            const uniform = this.uniforms.get(name);
            if (!uniform) continue;
            const { location, type } = uniform;
            if (type === gl.FLOAT) gl.uniform1f(location, value);
            else if (type === gl.FLOAT_VEC2) gl.uniform2fv(location, value);
            else if (type === gl.FLOAT_VEC3) gl.uniform3fv(location, value);
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    destroy() {
        this.gl.deleteBuffer(this.buffer);
        this.gl.deleteProgram(this.program);
        this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
}
