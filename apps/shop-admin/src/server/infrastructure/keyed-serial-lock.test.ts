import { afterEach, describe, expect, it, vi } from "vitest";
import { createKeyedSerialLock } from "./keyed-serial-lock";

describe("createKeyedSerialLock", () => {
  const unhandled = vi.fn();

  afterEach(() => {
    process.off("unhandledRejection", unhandled);
    unhandled.mockReset();
  });

  it("runs tasks for one key in order", async () => {
    const withLock = createKeyedSerialLock();
    const order: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const firstMayFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const first = withLock("session-1", async () => {
      await firstMayFinish;
      order.push("first");
    });
    const second = withLock("session-1", async () => {
      order.push("second");
    });

    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(["first", "second"]);
  });

  it("fails only the caller whose task failed and leaves no unhandled rejection", async () => {
    process.on("unhandledRejection", unhandled);
    const withLock = createKeyedSerialLock();

    const failing = withLock("session-1", async () => {
      throw new Error("refresh rejected");
    });
    const next = withLock("session-1", async () => "ok");

    await expect(failing).rejects.toThrow("refresh rejected");
    await expect(next).resolves.toBe("ok");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(unhandled).not.toHaveBeenCalled();
  });

  it("does not hold other keys behind a slow task", async () => {
    const withLock = createKeyedSerialLock();
    let release: () => void = () => undefined;
    const slowMayFinish = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = withLock("a", () => slowMayFinish);

    await expect(withLock("b", async () => "b done")).resolves.toBe("b done");
    release();
    await slow;
  });
});
