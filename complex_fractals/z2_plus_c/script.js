import { cadd, cmul } from '../fractal_common.js';
import { startExplorer } from '../explorer.js';

startExplorer({
    channel: 'mandelbrot-julia', maxPath: 96,
    initialPoint: [-.4, .6], critical: () => [0, 0],
    step: (z, c) => cadd(cmul(z, z), c),
});
