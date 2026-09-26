// Minimal video-only WebM muxer for WebCodecs VP8/VP9 output. All sizes are
// explicit; microsecond timecodes preserve the encoder's frame timestamps.
// Container reference: https://www.webmproject.org/docs/container/
const bytes = value => {
    const result = [];
    do { result.unshift(value % 256); value = Math.floor(value / 256); } while (value);
    return new Uint8Array(result);
};
const size = value => {
    let length = 1;
    while (value >= 2 ** (7 * length) - 1) length++;
    const result = new Uint8Array(length);
    for (let i = length - 1; i >= 0; i--) { result[i] = value % 256; value = Math.floor(value / 256); }
    result[0] |= 1 << (8 - length);
    return result;
};
const element = (id, data) => new Blob([bytes(id), size(data.size ?? data.byteLength), data]);
const uint = (id, value) => element(id, bytes(value));
const string = (id, value) => element(id, new TextEncoder().encode(value));
const master = (id, children) => element(id, new Blob(children));
const float = (id, value) => {
    const data = new Uint8Array(8);
    new DataView(data.buffer).setFloat64(0, value);
    return element(id, data);
};

export function muxWebM(chunks, { width, height, fps, codec, duration }) {
    const header = master(0x1a45dfa3, [uint(0x4286, 1), uint(0x42f7, 1), uint(0x42f2, 4),
        uint(0x42f3, 8), string(0x4282, 'webm'), uint(0x4287, 4), uint(0x4285, 2)]);
    const info = master(0x1549a966, [uint(0x2ad7b1, 1000), float(0x4489, duration * 1e6),
        string(0x4d80, 'Fractal explorer'), string(0x5741, 'Fractal explorer')]);
    const tracks = master(0x1654ae6b, [master(0xae, [uint(0xd7, 1), uint(0x73c5, 1),
        uint(0x83, 1), uint(0x9c, 0), string(0x86, codec === 'vp8' ? 'V_VP8' : 'V_VP9'),
        uint(0x23e383, Math.round(1e9 / fps)),
        master(0xe0, [uint(0xb0, width), uint(0xba, height)])])]);
    const clusters = [], cues = [];
    let position = info.size + tracks.size;
    for (const chunk of chunks) {
        // One cluster per frame keeps relative block timecodes at zero even at
        // low frame rates, avoiding the signed 16-bit block timestamp limit.
        const block = element(0xa3, new Blob([new Uint8Array([0x81, 0, 0, chunk.key ? 0x80 : 0]), chunk.data]));
        const cluster = master(0x1f43b675, [uint(0xe7, chunk.timestamp), block]);
        if (chunk.key) cues.push(master(0xbb, [uint(0xb3, chunk.timestamp),
            master(0xb7, [uint(0xf7, 1), uint(0xf1, position)])]));
        clusters.push(cluster);
        position += cluster.size;
    }
    return new Blob([header, master(0x18538067, [info, tracks, ...clusters, master(0x1c53bb6b, cues)])], { type: 'video/webm' });
}

export const canEncodeVideo = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

export async function encodeVideo({ canvas, fps, duration, draw, canceled, progress }) {
    if (!canEncodeVideo()) throw new Error('Frame-by-frame video needs WebCodecs. Use a current Chrome or Edge browser over HTTPS or localhost.');
    const frameCount = Math.max(1, Math.round(duration * fps));
    let config;
    for (const codec of ['vp09.00.10.08', 'vp8']) {
        const candidate = { codec, width: canvas.width, height: canvas.height, framerate: fps,
            bitrate: canvas.width * canvas.height >= 3840 * 2160 ? 40000000 : 16000000,
            latencyMode: 'quality' };
        if ((await VideoEncoder.isConfigSupported(candidate)).supported) { config = candidate; break; }
    }
    if (!config) throw new Error('No supported WebM encoder at this resolution. Try a smaller size or another browser.');
    const chunks = [];
    let encodingError;
    const encoder = new VideoEncoder({
        output(chunk) {
            const data = new Uint8Array(chunk.byteLength);
            chunk.copyTo(data);
            chunks.push({ data, timestamp: chunk.timestamp, key: chunk.type === 'key' });
        },
        error(error) { encodingError = error; },
    });
    try {
        encoder.configure(config);
        for (let i = 0; i < frameCount; i++) {
            if (canceled()) return null;
            if (encodingError) throw encodingError;
            draw(i / fps);
            const timestamp = Math.round(i * 1e6 / fps);
            const frame = new VideoFrame(canvas, { timestamp, duration: Math.round((i + 1) * 1e6 / fps) - timestamp });
            try { encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 }); }
            finally { frame.close(); }
            // Bounded batches provide backpressure. flush waits for actual codec
            // output; elapsed wall time never advances the video timeline.
            if ((i + 1) % 8 === 0 || i === frameCount - 1) {
                await encoder.flush();
                progress(i + 1, frameCount);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }
        if (encodingError) throw encodingError;
        if (canceled()) return null;
        if (chunks.length !== frameCount || chunks.some((chunk, i) => chunk.timestamp !== Math.round(i * 1e6 / fps))) {
            throw new Error('The encoder did not preserve every frame. No incomplete video was saved. Try another resolution or browser.');
        }
        return muxWebM(chunks, { ...config, fps, duration: frameCount / fps });
    } finally {
        if (encoder.state !== 'closed') encoder.close();
    }
}
