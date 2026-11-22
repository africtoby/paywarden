/** Pure maths for the landing-page canvas motion. No DOM, so it is unit-tested. */

export type Pt = { x: number; y: number };

/** Parse the "M x y L x y ..." polylines that buildPaths() returns. */
export function parsePolyline(d: string): Pt[] {
  const nums = d.match(/-?\d+(?:\.\d+)?/g) ?? [];
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: Number(nums[i]), y: Number(nums[i + 1]) });
  return pts;
}

/** Tiny seeded generator so the scatter and the sampling look the same every load. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick `count` points spread evenly (by arc length) along all the paths.
 * Coordinates come back centred on 0 and scaled to -1..1 for a seal of `size`.
 */
export function sampleAlongPaths(paths: string[], count: number, size: number, rnd: () => number): Pt[] {
  const lines = paths.map(parsePolyline).filter((l) => l.length > 1);
  const lens = lines.map((l) => {
    const cum = [0];
    for (let i = 1; i < l.length; i++) cum.push(cum[i - 1] + Math.hypot(l[i].x - l[i - 1].x, l[i].y - l[i - 1].y));
    return cum;
  });
  const total = lens.reduce((s, c) => s + c[c.length - 1], 0);
  const half = size / 2;
  const out: Pt[] = [];
  for (let n = 0; n < count; n++) {
    // Stratified along the whole length, plus a little jitter so it reads as grain, not beads.
    let at = ((n + rnd()) / count) * total;
    let li = 0;
    while (li < lines.length - 1 && at > lens[li][lens[li].length - 1]) {
      at -= lens[li][lens[li].length - 1];
      li++;
    }
    const cum = lens[li];
    const pts = lines[li];
    let k = 1;
    while (k < cum.length - 1 && cum[k] < at) k++;
    const seg = cum[k] - cum[k - 1] || 1;
    const t = Math.min(1, Math.max(0, (at - cum[k - 1]) / seg));
    out.push({
      x: (pts[k - 1].x + (pts[k].x - pts[k - 1].x) * t - half) / half,
      y: (pts[k - 1].y + (pts[k].y - pts[k - 1].y) * t - half) / half,
    });
  }
  return out;
}

/** Rotate (x, y, z) around Y then X, then project with a simple perspective. */
export function project(x: number, y: number, z: number, rotY: number, rotX: number, focal: number) {
  const cy = Math.cos(rotY);
  const sy = Math.sin(rotY);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(rotX);
  const sx = Math.sin(rotX);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const s = focal / (focal - z2);
  return { x: x1 * s, y: y2 * s, scale: s };
}

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

/**
 * Strength (0..1) of a ripple ring at `dist` from its origin, `age` seconds after it started.
 * The ring travels at `speed` px/s, is `width` px thick and fades over `life` seconds.
 */
export function ringStrength(dist: number, age: number, speed: number, width: number, life: number): number {
  if (age < 0 || age > life) return 0;
  const d = (dist - age * speed) / width;
  const fade = 1 - age / life;
  return Math.exp(-d * d) * fade * fade;
}
