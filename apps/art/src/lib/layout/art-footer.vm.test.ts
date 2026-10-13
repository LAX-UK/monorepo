import { describe, expect, it } from "vitest";
import { buildArtFooterVm } from "./art-footer.vm";

function discoverLinks(cookieSettings: boolean) {
  const vm = buildArtFooterVm({
    crossProductLinks: [],
    accountState: { kind: "guest" },
    cookieSettings,
  });
  return vm.columns.find((column) => column.id === "discover")?.links ?? [];
}

describe("buildArtFooterVm", () => {
  it("offers cookie settings only when analytics consent is collected", () => {
    expect(discoverLinks(true)).toContainEqual({
      label: "Cookie settings",
      href: "#cookie-settings",
    });
    expect(discoverLinks(false).some((link) => link.label === "Cookie settings")).toBe(false);
  });
});
