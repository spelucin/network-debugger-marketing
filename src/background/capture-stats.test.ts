import { beforeEach, describe, expect, it } from "vitest";
import { CaptureObserver } from "./capture-stats";

describe("CaptureObserver", () => {
  let obs: CaptureObserver;

  beforeEach(() => {
    obs = new CaptureObserver();
  });

  const gaCollect = (v: number) =>
    `https://www.google-analytics.com/g/collect?v=${v}`;

  it("counts distinct urls once across repeated sightings", () => {
    const url = gaCollect(1);
    expect(obs.observe(7, url, "ga4", 0.1)).toBe(true);
    // Same url again — from either plane — is a duplicate.
    expect(obs.observe(7, url, "ga4", 0.1)).toBe(false);

    const snap = obs.snapshot(7);
    expect(snap.perf.observed).toBe(1);
    expect(snap.platforms[0]?.hits).toBe(1);
  });

  it("keeps per-tab isolation for both metrics and dedup sets", () => {
    const url = gaCollect(2);
    obs.observe(7, url, "ga4", 0);
    obs.observe(8, url, "ga4", 0); // same url, different tab: both count
    obs.observe(9, gaCollect(3), null, 0);

    expect(obs.snapshot(7).perf.observed).toBe(1);
    expect(obs.snapshot(8).perf.observed).toBe(1);
    expect(obs.snapshot(9).perf.observed).toBe(1);
    expect(obs.snapshot(9).platforms).toHaveLength(0);
  });

  it("forgets a tab entirely on forgetTab, including its dedup set", () => {
    const url = gaCollect(4);
    obs.observe(7, url, "ga4", 0);
    obs.forgetTab(7);
    expect(obs.snapshot(7)).toEqual({ platforms: [], perf: { observed: 0, matched: 0, avgMs: 0 } });
    expect(obs.observe(7, url, "ga4", 0)).toBe(true); // fresh slate counts again
  });

  it("evicts oldest urls once the dedup set caps out", () => {
    for (let i = 0; i < 300; i += 1) {
      obs.observe(7, `https://t.example/${i}`, null, 0);
    }
    // Every distinct sighting counted; the cap only bounds dedup memory.
    expect(obs.snapshot(7).perf.observed).toBe(300);
    // The first url aged out of the set and counts again on re-sighting.
    expect(obs.observe(7, "https://t.example/0", null, 0)).toBe(true);
    expect(obs.snapshot(7).perf.observed).toBe(301);
  });

  it("reports average classification time in ms with sane rounding", () => {
    obs.observe(7, gaCollect(5), "ga4", 1);
    obs.observe(7, gaCollect(6), "ga4", 2);
    expect(obs.snapshot(7).perf.avgMs).toBeCloseTo(1.5, 5);
  });
});
