import { describe, expect, it } from "vitest";
import { parseAuthAtRestArgv } from "./run.js";

describe("auth at-rest CLI", () => {
  it("defaults to inventory without requiring AUTH_DEK_KEY", () => {
    const previousUrl = process.env.DATABASE_URL_AUTH;
    const previousDek = process.env.AUTH_DEK_KEY;
    process.env.DATABASE_URL_AUTH = "postgresql://auth_app:secret@127.0.0.1:5432/auth";
    Reflect.deleteProperty(process.env, "AUTH_DEK_KEY");
    try {
      const options = parseAuthAtRestArgv([]);
      expect(options.mode).toBe("inventory");
      expect(options.batchSize).toBe(100);
    } finally {
      if (previousUrl === undefined) Reflect.deleteProperty(process.env, "DATABASE_URL_AUTH");
      else process.env.DATABASE_URL_AUTH = previousUrl;
      if (previousDek === undefined) Reflect.deleteProperty(process.env, "AUTH_DEK_KEY");
      else process.env.AUTH_DEK_KEY = previousDek;
    }
  });

  it("requires AUTH_DEK_KEY for apply and verify modes", () => {
    const previousUrl = process.env.DATABASE_URL_AUTH;
    const previousDek = process.env.AUTH_DEK_KEY;
    process.env.DATABASE_URL_AUTH = "postgresql://auth_app:secret@127.0.0.1:5432/auth";
    Reflect.deleteProperty(process.env, "AUTH_DEK_KEY");
    try {
      expect(() => parseAuthAtRestArgv(["--apply"])).toThrow(/AUTH_DEK_KEY/);
      expect(() => parseAuthAtRestArgv(["--verify"])).toThrow(/AUTH_DEK_KEY/);
    } finally {
      if (previousUrl === undefined) Reflect.deleteProperty(process.env, "DATABASE_URL_AUTH");
      else process.env.DATABASE_URL_AUTH = previousUrl;
      if (previousDek === undefined) Reflect.deleteProperty(process.env, "AUTH_DEK_KEY");
      else process.env.AUTH_DEK_KEY = previousDek;
    }
  });

  it("accepts bounded batch sizes", () => {
    const previousUrl = process.env.DATABASE_URL_AUTH;
    const previousDek = process.env.AUTH_DEK_KEY;
    process.env.DATABASE_URL_AUTH = "postgresql://auth_app:secret@127.0.0.1:5432/auth";
    process.env.AUTH_DEK_KEY = "00".repeat(32);
    try {
      expect(() => parseAuthAtRestArgv(["--batch-size=0"])).toThrow(/batch-size/);
      const options = parseAuthAtRestArgv(["--verify", "--batch-size=25"]);
      expect(options.mode).toBe("verify");
      expect(options.batchSize).toBe(25);
    } finally {
      if (previousUrl === undefined) Reflect.deleteProperty(process.env, "DATABASE_URL_AUTH");
      else process.env.DATABASE_URL_AUTH = previousUrl;
      if (previousDek === undefined) Reflect.deleteProperty(process.env, "AUTH_DEK_KEY");
      else process.env.AUTH_DEK_KEY = previousDek;
    }
  });
});
