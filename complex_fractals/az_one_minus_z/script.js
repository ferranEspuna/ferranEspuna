import { cmul } from '../fractal_common.js';
import { startExplorer } from '../explorer.js';

startExplorer({
    channel: 'logistic-family', maxPath: 96,
    initialPoint: [2.75, .12], critical: () => [.5, 0],
    step: (z, a) => cmul(cmul(a, z), [1 - z[0], -z[1]]),
});
