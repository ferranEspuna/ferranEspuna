import { cadd, csub, cmul, cinv } from '../fractal_common.js';
import { startExplorer } from '../explorer.js';

startExplorer({
    channel: 'newton-fractal', newton: true, maxPath: 100,
    initialPoint: [0, .866025], critical: root => [root[0] / 3, root[1] / 3],
    step(z, root) {
        const a = csub(z, [-.4, 0]), b = csub(z, [.4, 0]), c = csub(z, root);
        const derivative = cadd(cadd(cmul(a, b), cmul(b, c)), cmul(c, a));
        return csub(z, cmul(cmul(cmul(a, b), c), cinv(derivative)));
    },
});
