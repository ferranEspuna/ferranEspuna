import { cmul } from "../fractal_common.js";
import { startTwoPlaneFamily } from "../two_plane_family.js";

function logisticStep(z, a) {
    const oneMinusZ = [1.0 - z[0], -z[1]];
    return cmul(cmul(a, z), oneMinusZ);
}

startTwoPlaneFamily({
    broadcastChannel: "az_one_minus_z_sync",
    critical: [0.5, 0.0],
    initialParam: [2.75, 0.12],
    maxPathPoints: 96,
    step: logisticStep,
    descriptions: {
        base: `
    <p>
      <strong>Background (both panels):</strong> hue encodes <strong>smoothed escape time</strong> under z<sub>n+1</sub> = a z<sub>n</sub>(1 − z<sub>n</sub>) (brighter ⇒ faster escape). Very dark pixels stay below the escape threshold for all iterations. The parameter plane uses the <strong>critical orbit</strong> from z₀ = ½ — the same default seed as the white orbit on the dynamical plane when “Lock to critical” is on.
    </p>
    <p>
      <strong>Markers on the dynamical plane</strong> (on top of the white orbit): <strong>white</strong> = forward orbit when “Show orbit” is on; <strong>magenta</strong> = <strong>fixed points</strong> z = 0 and z = 1 − 1/a; <strong>teal</strong> = the (finite) <strong>critical point</strong> z = ½ where f′(z) = 0 for f(z) = az(1 − z); <strong>gold</strong> = the parameter a at the same coordinates in the z-plane. The parameter plane shows only the <strong>gold</strong> marker for a.
    </p>
    <p>
      <em>Navigation (same pattern as the Newton fractal page):</em> Each canvas has <strong>Move mode</strong> (pointer sets quantities in the plane) or <strong>Pan/Zoom mode</strong> (drag to pan, scroll to zoom only in this mode). <strong>Right-click</strong> a canvas to toggle that canvas between the two. On the dynamical plane, <strong>Place orbit start</strong> (with “Show orbit” on and critical lock off) selects whether Move mode drags the orbit seed or a; the checkbox controls which, not the right-click.
    </p>
  `,
        desktop: `
  <p>
    <strong>Controls (Desktop):</strong> Same as Newton fractal.<br>
    • <strong>Navigate:</strong> Right-click a canvas to toggle <em>Move</em> vs <em>Pan/Zoom</em> on that canvas only. Desktop starts in Pan/Zoom on both.<br>
    • <strong>Pan/Zoom:</strong> Drag to pan, scroll to zoom.<br>
    • <strong>Move:</strong> Move the mouse to set a, or the orbit start on the dynamical plane when the orbit checkbox allows it.<br>
    • <strong>Iterations, Pop out, Fullscreen:</strong> As labeled.
  </p>
  `,
        mobile: `
  <p>
    <strong>Controls (Mobile):</strong> Same as Newton fractal.<br>
    • <strong>Move a / orbit start:</strong> Drag near the gold dot or (on the dynamical plane) near the white orbit start when shown; or double-tap then drag. Two-finger pan and pinch zoom.<br>
    • <strong>Parameter plane:</strong> Same proximity / double-tap behavior for the gold a marker.<br>
  </p>
  `,
    },
});
