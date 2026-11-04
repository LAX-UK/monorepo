import { describe, expect, it, vi } from "vitest";
import { createAlertDigestTask, isInDigestWindow } from "./alert-digest.task.js";

const HOUR = 3_600_000;
// November: London is on UTC. July: London is an hour ahead of UTC.
const at = (iso: string) => new Date(iso);

describe("digest window", () => {
  it("opens at 08:00 London and closes an hour later, in winter and in summer", () => {
    expect(isInDigestWindow(at("2026-11-04T07:59:00Z"), HOUR)).toBe(false);
    expect(isInDigestWindow(at("2026-11-04T08:00:00Z"), HOUR)).toBe(true);
    expect(isInDigestWindow(at("2026-11-04T08:59:00Z"), HOUR)).toBe(true);
    expect(isInDigestWindow(at("2026-11-04T09:00:00Z"), HOUR)).toBe(false);
    expect(isInDigestWindow(at("2026-07-01T06:59:00Z"), HOUR)).toBe(false);
    expect(isInDigestWindow(at("2026-07-01T07:00:00Z"), HOUR)).toBe(true);
    expect(isInDigestWindow(at("2026-07-01T07:59:00Z"), HOUR)).toBe(true);
    expect(isInDigestWindow(at("2026-07-01T08:00:00Z"), HOUR)).toBe(false);
  });

  it("is closed all afternoon, so a restart then sends nothing", () => {
    expect(isInDigestWindow(at("2026-11-04T15:30:00Z"), HOUR)).toBe(false);
  });
});

describe("digest task", () => {
  const runs = () => [{ run: vi.fn(async () => undefined as never) }, { run: vi.fn() }];

  it("runs LAX Shop's and lax.art's digests in the window when sending is on", async () => {
    const r = runs();
    await createAlertDigestTask({ mode: "on", runs: r }).run(at("2026-11-04T08:10:00Z"));
    expect(r[0]?.run).toHaveBeenCalledWith("on");
    expect(r[1]?.run).toHaveBeenCalledWith("on");
  });

  it("does nothing outside the window, or when alerts are off", async () => {
    const r = runs();
    await createAlertDigestTask({ mode: "on", runs: r }).run(at("2026-11-04T12:00:00Z"));
    await createAlertDigestTask({ mode: "off", runs: r }).run(at("2026-11-04T08:10:00Z"));
    expect(r[0]?.run).not.toHaveBeenCalled();
  });

  it("shows a dry run only in the first minutes, so the log is not repeated all hour", async () => {
    const r = runs();
    const task = createAlertDigestTask({ mode: "dry_run", runs: r });
    await task.run(at("2026-11-04T08:03:00Z"));
    await task.run(at("2026-11-04T08:30:00Z"));
    expect(r[0]?.run).toHaveBeenCalledTimes(1);
    expect(r[0]?.run).toHaveBeenCalledWith("dry_run");
  });
});
