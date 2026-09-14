import { describe, expect, it } from "vitest";
import { resolveApplicationRoleGrantLockDatabaseUrl } from "./migrate-roles.js";

describe("resolveApplicationRoleGrantLockDatabaseUrl", () => {
  it("reuses the owner database by default for DO managed clusters", () => {
    const owner = "postgresql://doadmin:secret@db.example.com:25060/auction?sslmode=require";
    expect(resolveApplicationRoleGrantLockDatabaseUrl(owner)).toBe(owner);
  });

  it("honors APPLICATION_ROLE_GRANT_LOCK_DATABASE when set", () => {
    const owner = "postgresql://doadmin:secret@db.example.com:25060/auction?sslmode=require";
    process.env.APPLICATION_ROLE_GRANT_LOCK_DATABASE = "defaultdb";
    try {
      expect(resolveApplicationRoleGrantLockDatabaseUrl(owner)).toBe(
        "postgresql://doadmin:secret@db.example.com:25060/defaultdb?sslmode=require",
      );
    } finally {
      process.env.APPLICATION_ROLE_GRANT_LOCK_DATABASE = undefined;
    }
  });
});
