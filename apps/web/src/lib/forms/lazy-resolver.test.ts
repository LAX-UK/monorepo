import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { lazyResolver } from "./lazy-resolver";

const schema = z.object({ q: z.string().trim().max(3, "Too long") });
type Values = z.infer<typeof schema>;
const direct = zodResolver(schema as never) as Resolver<Values>;
const options = { fields: {}, shouldUseNativeValidation: false } as const;

describe("lazyResolver", () => {
  it("gives the same answers as the resolver it loads", async () => {
    const lazy = lazyResolver<Values>(async () => direct);
    for (const values of [{ q: " ab " }, { q: "abcdef" }, { q: 1 as unknown as string }]) {
      expect(await lazy(values, undefined, options)).toEqual(
        await direct(values, undefined, options),
      );
    }
  });

  it("loads once, on the first check or on preload", async () => {
    const load = vi.fn(async () => direct);
    const lazy = lazyResolver<Values>(load);
    expect(load).not.toHaveBeenCalled();
    lazy.preload();
    await lazy({ q: "a" }, undefined, options);
    await lazy({ q: "b" }, undefined, options);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("fetches again after a failed load", async () => {
    const load = vi
      .fn<() => Promise<Resolver<Values>>>()
      .mockRejectedValueOnce(new Error("chunk failed"))
      .mockResolvedValue(direct);
    const lazy = lazyResolver<Values>(load);
    await expect(lazy({ q: "a" }, undefined, options)).rejects.toThrow("chunk failed");
    await expect(lazy({ q: "a" }, undefined, options)).resolves.toEqual({
      values: { q: "a" },
      errors: {},
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("swallows a failed preload and retries on the next check", async () => {
    const load = vi
      .fn<() => Promise<Resolver<Values>>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(direct);
    const lazy = lazyResolver<Values>(load);
    lazy.preload();
    await Promise.resolve();
    await expect(lazy({ q: "a" }, undefined, options)).resolves.toMatchObject({ errors: {} });
  });
});
