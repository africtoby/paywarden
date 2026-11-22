import { describe, expect, it } from "vitest";
import { buildPaths } from "@/components/seal";
import { mulberry, parsePolyline, project, ringStrength, sampleAlongPaths } from "./motion-math";

describe("motion-math", () => {
  it("parses a polyline", () => {
    expect(parsePolyline("M1.5 2L3 4.25")).toEqual([
      { x: 1.5, y: 2 },
      { x: 3, y: 4.25 },
    ]);
  });

  it("samples the requested count inside the unit square, deterministically", () => {
    const paths = buildPaths("paywarden", 200);
    const a = sampleAlongPaths(paths, 2500, 200, mulberry(7));
    const b = sampleAlongPaths(paths, 2500, 200, mulberry(7));
    expect(a).toHaveLength(2500);
    expect(a).toEqual(b);
    for (const p of a) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1.001);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1.001);
    }
  });

  it("projects without change at zero rotation and z = 0", () => {
    const p = project(0.5, -0.25, 0, 0, 0, 3);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.y).toBeCloseTo(-0.25);
    expect(p.scale).toBeCloseTo(1);
  });

  it("makes points nearer the camera larger after a half turn", () => {
    const near = project(0.8, 0, 0, Math.PI / 2, 0, 3);
    expect(near.scale).not.toBeCloseTo(1);
  });

  it("ripple is zero before start, after life and far from the wavefront", () => {
    expect(ringStrength(100, -1, 500, 40, 1.4)).toBe(0);
    expect(ringStrength(100, 2, 500, 40, 1.4)).toBe(0);
    expect(ringStrength(900, 0.2, 500, 40, 1.4)).toBeLessThan(0.001);
    expect(ringStrength(100, 0.2, 500, 40, 1.4)).toBeGreaterThan(0.5);
  });
});
