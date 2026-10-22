import { twoFactor as twoFactorPlugin } from "better-auth/plugins";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { twoFactor, user } from "./auth";

// Better Auth adds fields to its plugin tables between releases; a field missing from the Drizzle
// table only fails at runtime ("field does not exist in the twoFactor schema", a 500 on every 2FA
// verification). Comparing against the installed plugin catches that at upgrade time instead.
describe("Better Auth plugin schema", () => {
  const pluginSchema = twoFactorPlugin().schema;

  it("has a column for every two-factor field the installed plugin uses", () => {
    const columns = Object.keys(getTableColumns(twoFactor));
    expect(columns).toEqual(expect.arrayContaining(Object.keys(pluginSchema.twoFactor.fields)));
  });

  it("has a column for every user field the two-factor plugin adds", () => {
    const columns = Object.keys(getTableColumns(user));
    expect(columns).toEqual(expect.arrayContaining(Object.keys(pluginSchema.user.fields)));
  });
});
