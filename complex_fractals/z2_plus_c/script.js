import { cadd, cmul } from "../fractal_common.js";
import { startTwoPlaneFamily } from "../two_plane_family.js";

function juliaStep(z, c) {
    return cadd(cmul(z, z), c);
}

startTwoPlaneFamily({
    broadcastChannel: "z2_plus_c_sync",
    critical: [0.0, 0.0],
    initialParam: [-0.4, 0.6],
    maxPathPoints: 96,
    step: juliaStep,
    descriptions: {
        base: `
    <p>
      <strong>Background (both panels):</strong> hue encodes <strong>smoothed escape time</strong> — how quickly the tested orbit’s magnitude crosses the escape threshold (brighter / more saturated ⇒ faster escape). Very dark regions mean no escape within the iteration budget. The parameter plane always uses the <strong>critical orbit</strong> with seed z₀ = 0 (same default as the white orbit on the dynamical plane when “Lock to critical” is on).
    </p>
    <p>
      <strong>Family</strong> f<sub>c</sub>(z) = z<sup>2</sup> + c: the dynamical plane fixes c and varies the pixel’s starting z₀; the parameter plane varies c with z₀ = 0.
    </p>
    <p>
      <strong>Markers on the dynamical plane</strong> (drawn on top of the white orbit so they stay visible if the path crosses them): <strong>white</strong> = forward orbit when “Show orbit” is on; <strong>magenta</strong> = the two <strong>fixed points</strong> z = (1 ± √(1 − 4c)) / 2 (they merge when c = ¼); <strong>teal</strong> = the (finite) <strong>critical point</strong> z = 0 of the map z ↦ z² + c; <strong>gold</strong> = the parameter c plotted at the same complex coordinates as c (so you see c next to the Julia set). The parameter plane shows only the <strong>gold</strong> marker for c.
    </p>
    <p>
      <em>Navigation (same pattern as the Newton fractal page):</em> Each canvas has <strong>Move mode</strong> (pointer sets quantities in the plane) or <strong>Pan/Zoom mode</strong> (drag to pan, scroll to zoom only in this mode). <strong>Right-click</strong> a canvas to toggle that canvas between the two. On the dynamical plane, <strong>Place orbit start</strong> (with “Show orbit” on and critical lock off) selects whether Move mode drags the orbit seed or c; the checkbox controls which, not the right-click.
    </p>
  `,
        desktop: `
  <p>
    <strong>Controls (Desktop):</strong> Same as Newton fractal.<br>
    • <strong>Navigate:</strong> Right-click a canvas to toggle <em>Move</em> vs <em>Pan/Zoom</em> on that canvas only. Desktop starts in Pan/Zoom on both.<br>
    • <strong>Pan/Zoom:</strong> Drag to pan, scroll to zoom.<br>
    • <strong>Move:</strong> Move the mouse to set c, or the orbit start on the dynamical plane when the orbit checkbox allows it.<br>
    • <strong>Iterations, Pop out, Fullscreen:</strong> As labeled.
  </p>
  `,
        mobile: `
  <p>
    <strong>Controls (Mobile):</strong> Same as Newton fractal.<br>
    • <strong>Move c / orbit start:</strong> Drag near the gold dot or (on the dynamical plane) near the white orbit start when shown; or double-tap then drag. Two-finger pan and pinch zoom.<br>
    • <strong>Parameter plane:</strong> Same proximity / double-tap behavior for the gold c marker.<br>
  </p>
  `,
    },
});
