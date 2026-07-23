import { describe, expect, it } from "vitest";
import { buildSofListPageModel } from "./compliance/build-sof-list-page-model";
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

describe("buildSofListPageModel", () => {
  it("caps page size at 100", () => {
    const model = buildSofListPageModel({ limit: "200" });
    expect(model.query.limit).toBe(100);
  });

  it("parses offset from search params", () => {
    const model = buildSofListPageModel({ offset: "50" });
    expect(model.query.offset).toBe(50);
  });

  it("defaults status to pending", () => {
    const model = buildSofListPageModel({});
    expect(model.query.status).toBe("pending");
  });

  it("parses status from search params", () => {
    expect(buildSofListPageModel({ status: "rejected" }).query.status).toBe("rejected");
    expect(buildSofListPageModel({ status: "approved" }).query.status).toBe("approved");
    expect(buildSofListPageModel({ status: "invalid" }).query.status).toBe("pending");
  });
});
