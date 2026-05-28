import {
  clientWorkspaceOverviewMeta,
  clientWorkspacePageMeta,
} from "@/lib/workspace/client-workspace-mode";
import { describe, expect, it } from "vitest";

describe("client workspace meta", () => {
  it("uses Buying/Selling on list pages", () => {
    expect(clientWorkspacePageMeta("buying")).toBe("Buying");
    expect(clientWorkspacePageMeta("selling")).toBe("Selling");
  });

  it("uses Collector home / Seller home on overview", () => {
    expect(clientWorkspaceOverviewMeta("buying")).toBe("Collector home");
    expect(clientWorkspaceOverviewMeta("selling")).toBe("Seller home");
  });
});
