import { describe, expect, it } from "vitest";
import { redisOptionsFromUrl } from "./redis-url";

describe("redisOptionsFromUrl", () => {
  it("reads host, port and database", () => {
    expect(redisOptionsFromUrl("redis://127.0.0.1:56395/2")).toEqual({
      host: "127.0.0.1",
      port: 56395,
      db: 2,
    });
  });

  it("defaults the port and keeps credentials, decoded", () => {
    expect(redisOptionsFromUrl("redis://default:p%40ss@cache.internal")).toEqual({
      host: "cache.internal",
      port: 6379,
      username: "default",
      password: "p@ss",
    });
  });

  it("turns on TLS for rediss", () => {
    expect(redisOptionsFromUrl("rediss://cache.example.com:25061")).toMatchObject({
      port: 25061,
      tls: { servername: "cache.example.com" },
    });
  });

  it("refuses another protocol", () => {
    expect(() => redisOptionsFromUrl("http://cache:6379")).toThrow(/protocol/);
  });
});
