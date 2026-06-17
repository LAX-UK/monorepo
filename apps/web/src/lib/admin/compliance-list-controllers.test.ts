import { describe, expect, it } from "vitest";
import { sofListController } from "./admin-list-controllers";
import {
  buildSofCaseDetailHref,
  buildSofListHref,
  normalizeSofListStatus,
  parseSofDetailListStatus,
  parseSofListStatus,
} from "./sof-list-query";

describe("sof-list-query", () => {
  it("parseSofListStatus defaults to pending", () => {
    expect(parseSofListStatus({})).toBe("pending");
    expect(parseSofListStatus({ status: "invalid" })).toBe("pending");
  });

  it("parseSofDetailListStatus reads listStatus param", () => {
    expect(parseSofDetailListStatus({ listStatus: "rejected" })).toBe("rejected");
    expect(parseSofDetailListStatus({})).toBe("pending");
  });

  it("normalizeSofListStatus maps row statuses", () => {
    expect(normalizeSofListStatus("rejected")).toBe("rejected");
    expect(normalizeSofListStatus("awaiting_decision")).toBe("pending");
  });

  it("buildSofCaseDetailHref includes listStatus", () => {
    expect(buildSofCaseDetailHref("case-1", "approved")).toBe(
      "/admin/compliance/source-of-funds/case-1?listStatus=approved",
    );
  });

  it("buildSofListHref includes status chip", () => {
    expect(buildSofListHref("rejected")).toBe("/admin/compliance/source-of-funds?status=rejected");
  });
});

describe("sofListController.parseQuery", () => {
  it("caps page size at 100", () => {
    const q = sofListController.parseQuery({ limit: "200" });
    expect(q.limit).toBe(100);
  });

  it("parses offset from search params", () => {
    const q = sofListController.parseQuery({ offset: "50" });
    expect(q.offset).toBe(50);
  });

  it("defaults status to pending", () => {
    const q = sofListController.parseQuery({});
    expect(q.status).toBe("pending");
  });

  it("parses status from search params", () => {
    expect(sofListController.parseQuery({ status: "rejected" }).status).toBe("rejected");
    expect(sofListController.parseQuery({ status: "approved" }).status).toBe("approved");
    expect(sofListController.parseQuery({ status: "invalid" }).status).toBe("pending");
  });
});
