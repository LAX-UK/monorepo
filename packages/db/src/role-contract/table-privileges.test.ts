import { describe, expect, it } from "vitest";
import type { TablePrivilegeRow } from "./table-privileges.test-helpers.js";
import { expectUniformTablePrivileges } from "./table-privileges.test-helpers.js";

describe("role contract table privileges", () => {
  it("labels failed privilege checks", () => {
    const rows: TablePrivilegeRow[] = [{ table_name: "user", privilege: "SELECT", allowed: true }];

    expect(() => expectUniformTablePrivileges(rows, false)).toThrow(/user:SELECT/);
  });
});
