import { describe, expect, it } from "vitest";
import {
  DEFAULT_POOL_MAX,
  MAX_POOL_MAX,
  POOL_CONNECTION_TIMEOUT_MS,
  POOL_IDLE_TIMEOUT_MS,
  buildPgPoolConfig,
  readPoolMax,
} from "./pool.js";

describe("readPoolMax", () => {
  it("defaults to a small pool when unset or blank", () => {
    expect(readPoolMax({})).toBe(DEFAULT_POOL_MAX);
    expect(readPoolMax({ DATABASE_POOL_MAX: "  " })).toBe(DEFAULT_POOL_MAX);
    expect(DEFAULT_POOL_MAX).toBeLessThanOrEqual(5);
  });

  it("parses a positive integer", () => {
    expect(readPoolMax({ DATABASE_POOL_MAX: "3" })).toBe(3);
    expect(readPoolMax({ DATABASE_POOL_MAX: " 8 " })).toBe(8);
  });

  it("falls back to the default for invalid values", () => {
    for (const bad of ["0", "-2", "abc", "2.5", "1e1", "NaN"]) {
      expect(readPoolMax({ DATABASE_POOL_MAX: bad })).toBe(DEFAULT_POOL_MAX);
    }
  });

  it("clamps oversized values", () => {
    expect(readPoolMax({ DATABASE_POOL_MAX: "500" })).toBe(MAX_POOL_MAX);
    expect(readPoolMax({ DATABASE_POOL_MAX: String(MAX_POOL_MAX) })).toBe(MAX_POOL_MAX);
  });
});

describe("buildPgPoolConfig", () => {
  it("carries the connection string, size and timeouts", () => {
    const config = buildPgPoolConfig("postgres://u:p@h:5432/d", { DATABASE_POOL_MAX: "4" });
    expect(config.connectionString).toContain("postgres://u:p@h:5432/d");
    expect(config.max).toBe(4);
    expect(config.idleTimeoutMillis).toBe(POOL_IDLE_TIMEOUT_MS);
    expect(config.connectionTimeoutMillis).toBe(POOL_CONNECTION_TIMEOUT_MS);
  });

  it("uses the default size when the environment is empty", () => {
    expect(buildPgPoolConfig("postgres://h/d", {}).max).toBe(DEFAULT_POOL_MAX);
  });
});
