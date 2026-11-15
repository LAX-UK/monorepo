import { describe, expect, it } from "vitest";
import { payloadRecordHrefs } from "./failed-job-record-links";

const entry = (label: string, value: string, masked = false) => ({ label, value, masked });

describe("payloadRecordHrefs", () => {
  it("links the records that have an admin page, in payload order", () => {
    const payload = [
      entry("Lot ID", "lot_14"),
      entry("Template", "outbid"),
      entry("Sale ID", "sale-9"),
      entry("Submission ID", "sub_3"),
    ];
    expect(payloadRecordHrefs(payload, "staff", ["administrator"])).toEqual([
      "/admin/lots/lot_14",
      null,
      "/admin/sales/sale-9",
      "/admin/submissions/sub_3",
    ]);
  });

  it("does not link a masked value or something that is not an identifier", () => {
    const payload = [
      entry("Lot ID", "l•••••14", true),
      entry("Lot ID", "lot14", true),
      entry("Lot ID", "lot 14, Art"),
    ];
    expect(payloadRecordHrefs(payload, "staff", ["administrator"])).toEqual([null, null, null]);
  });

  it("does not link a page the person cannot open", () => {
    expect(payloadRecordHrefs([entry("Lot ID", "lot_14")], "staff", ["finance"])).toEqual([null]);
  });
});
