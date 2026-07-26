import { describe, expect, it } from "vitest";
import {
  ADMIN_STATUS_REGISTRY,
  STAFF_SHELL_VARIANT_LAYOUT,
  capabilityLabel,
} from "./staff-presenter-adapters";
import type { StaffListShellVariant } from "./staff-shell-variants.types";

const SHELL_VARIANTS: StaffListShellVariant[] = ["catalog", "queue", "people", "finance", "hub"];

describe("staff shell variant contracts", () => {
  it("maps every staff list variant to a shell layout", () => {
    for (const variant of SHELL_VARIANTS) {
      expect(STAFF_SHELL_VARIANT_LAYOUT[variant]).toMatch(/catalog-list|staff-hub/);
    }
  });
});

describe("staff presenter adapter registry", () => {
  it("resolves catalog sale status labels", () => {
    expect(ADMIN_STATUS_REGISTRY.sale.label("active")).toBeTruthy();
  });

  it("resolves capability labels for staff permissions UI", () => {
    expect(capabilityLabel("finance.read")).toBeTruthy();
  });
});
