import { describe, expect, it } from "vitest";
import { ENQUIRY_VIEWS, enquiryViewCriteria } from "./marketing-enquiry-views.js";

describe("enquiry views", () => {
  it("defines every view", () => {
    for (const view of ENQUIRY_VIEWS) expect(enquiryViewCriteria(view)).toBeDefined();
  });

  it("keeps the working views to open enquiries, longest waiting first", () => {
    for (const view of ["assigned_to_me", "open", "unassigned", "private_sales"] as const) {
      const criteria = enquiryViewCriteria(view);
      expect(criteria.statuses).toEqual(["new", "in_progress", "waiting_on_client"]);
      expect(criteria.order).toBe("oldest_first");
    }
  });

  it("scopes assigned to me, unassigned and private sales", () => {
    expect(enquiryViewCriteria("assigned_to_me").assignee).toBe("viewer");
    expect(enquiryViewCriteria("unassigned").assignee).toBe("nobody");
    expect(enquiryViewCriteria("private_sales").privateSaleOnly).toBe(true);
  });

  it("shows the latest first in closed and all, and every status in all", () => {
    expect(enquiryViewCriteria("closed").order).toBe("newest_first");
    expect(enquiryViewCriteria("all")).toMatchObject({ statuses: null, order: "newest_first" });
  });
});
