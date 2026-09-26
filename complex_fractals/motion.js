// Motion is independent of rendering speed. Zoom tracks store log(scale), so
// interpolation and smoothing represent a constant proportional zoom speed.
export const TRACKS = ['pan', 'zoom', 'parameters'];

export function sampleTrack(samples, time) {
    if (time <= samples[0].time) return [...samples[0].value];
    if (time >= samples.at(-1).time) return [...samples.at(-1).value];
    let low = 0, high = samples.length - 1;
    while (high - low > 1) {
        const middle = (low + high) >> 1;
        if (samples[middle].time <= time) low = middle;
        else high = middle;
    }
    const a = samples[low], b = samples[high];
    const mix = (time - a.time) / (b.time - a.time);
    return a.value.map((value, i) => value + (b.value[i] - value) * mix);
}

export function addSample(track, time, value) {
    const sample = { time, value: [...value] };
    if (track.samples.at(-1)?.time === time) track.samples[track.samples.length - 1] = sample;
    else track.samples.push(sample);
}

export function createTake(values, duration, effects) {
    return { duration, tracks: Object.fromEntries(TRACKS.map(key => [key,
        { samples: [{ time: 0, value: [...values[key]] }], effects: { ...effects } }])) };
}

const ease = x => x * x * x * (x * (x * 6 - 15) + 10);

export function compileTake(take) {
    const tracks = {};
    for (const key of TRACKS) {
        const { samples, effects } = take.tracks[key];
        // Resample in time before filtering: dense pointer events must not receive
        // more weight than quiet sections or slow frames. Gaussian smoothing is
        // evaluated once per take, rather than for each exported video frame.
        const count = Math.max(1, Math.ceil(take.duration * 120));
        const step = take.duration / count;
        const raw = Array.from({ length: count + 1 }, (_, i) => sampleTrack(samples, i * step));
        const radius = Math.ceil((effects.smooth || 0) / step);
        const filtered = raw.map((value, i) => {
            if (!radius) return { time: i * step, value };
            const sum = value.map(() => 0);
            let weightSum = 0;
            for (let offset = -radius; offset <= radius; offset++) {
                const weight = Math.exp(-4.5 * (offset / radius) ** 2);
                const neighbor = raw[Math.max(0, Math.min(count, i + offset))];
                neighbor.forEach((component, j) => { sum[j] += component * weight; });
                weightSum += weight;
            }
            return { time: i * step, value: sum.map(component => component / weightSum) };
        });
        tracks[key] = time => {
            const progress = Math.max(0, Math.min(1, time / take.duration));
            if (!effects.loop) return sampleTrack(filtered, progress * take.duration);
            // Play the take in the first 80%, then return during the last 20%.
            // Quintic easing gives zero velocity and acceleration on both sides
            // of the seam, including pan, log zoom, roots, iterations and colors.
            if (progress < .8) return sampleTrack(filtered, ease(progress / .8) * take.duration);
            const mix = ease((progress - .8) / .2);
            return filtered.at(-1).value.map((value, i) => value + (filtered[0].value[i] - value) * mix);
        };
    }
    return time => Object.fromEntries(TRACKS.map(key => [key, tracks[key](time)]));
}
