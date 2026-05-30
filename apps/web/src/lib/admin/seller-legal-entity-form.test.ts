import type { AdminLegalEntityPickerRow } from "@/lib/data/http/admin.server";
import { describe, expect, it, vi } from "vitest";
import { applySellerLegalEntitySelection } from "./seller-legal-entity-form";

const row: AdminLegalEntityPickerRow = {
  id: "le-1",
  displayName: "Acme Ltd",
  status: "approved",
};

describe("applySellerLegalEntitySelection", () => {
  it("clears the id and display name when selection is null", () => {
    const onChange = vi.fn();
    const setDisplayName = vi.fn();
    applySellerLegalEntitySelection(onChange, setDisplayName, null);
    expect(onChange).toHaveBeenCalledWith("");
    expect(setDisplayName).toHaveBeenCalledWith("");
  });

  it("sets id and display name when a row is provided", () => {
    const onChange = vi.fn();
    const setDisplayName = vi.fn();
    applySellerLegalEntitySelection(onChange, setDisplayName, "le-1", row);
    expect(onChange).toHaveBeenCalledWith("le-1");
    expect(setDisplayName).toHaveBeenCalledWith("Acme Ltd");
  });
});
