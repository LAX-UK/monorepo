import { describe, expect, it } from "vitest";
import {
  enquiryInboxApiQuery,
  enquiryInboxHref,
  enquiryInboxPageHref,
  enquirySenderName,
  enquirySenderSecondary,
  enquiryStaffName,
  enquiryStatusTone,
  hasActiveEnquiryFilters,
  parseEnquiryInboxQuery,
} from "./enquiry-inbox.vm";

describe("parseEnquiryInboxQuery", () => {
  it("reads every filter from the URL", () => {
    expect(
      parseEnquiryInboxQuery({
        q: " ada ",
        kind: "artwork",
        topic: "selling",
        status: "in_progress",
        assignee: "me",
        cursor: "abc",
      }),
    ).toEqual({
      q: "ada",
      kind: "artwork",
      topic: "selling",
      status: "in_progress",
      assignee: "me",
      cursor: "abc",
    });
  });

  it("drops values it does not recognise, so a hand-edited link still opens the inbox", () => {
    expect(
      parseEnquiryInboxQuery({
        kind: "order",
        topic: "complaint",
        status: "archived",
        assignee: "someone-else",
        q: "   ",
      }),
    ).toEqual({});
  });

  it("takes the first value of a repeated parameter", () => {
    expect(parseEnquiryInboxQuery({ status: ["closed", "new"] })).toEqual({ status: "closed" });
  });
});

describe("enquiryInboxHref", () => {
  const query = parseEnquiryInboxQuery({ status: "new", q: "ada", cursor: "page-2" });

  it("returns to the first page when a filter changes", () => {
    expect(enquiryInboxHref(query, { status: "closed" })).toBe("/enquiries?q=ada&status=closed");
  });

  it("clears a filter with null", () => {
    expect(enquiryInboxHref(query, { status: null, q: null })).toBe("/enquiries");
  });

  it("keeps the other filters", () => {
    expect(enquiryInboxHref({ kind: "general" }, { assignee: "unassigned" })).toBe(
      "/enquiries?kind=general&assignee=unassigned",
    );
  });

  it("builds a next-page link that keeps the filters", () => {
    expect(enquiryInboxPageHref({ status: "new" }, "c1")).toBe("/enquiries?status=new&cursor=c1");
  });
});

describe("enquiryInboxApiQuery", () => {
  it("passes the filters and cursor to the API under the same names", () => {
    expect(
      enquiryInboxApiQuery({ q: "ada", status: "new", assignee: "unassigned", cursor: "c" }),
    ).toEqual({ q: "ada", status: "new", assignee: "unassigned", cursor: "c" });
  });
});

describe("hasActiveEnquiryFilters", () => {
  it("is false for an unfiltered list, even on a later page", () => {
    expect(hasActiveEnquiryFilters({})).toBe(false);
    expect(hasActiveEnquiryFilters({ cursor: "c" })).toBe(false);
  });

  it.each([
    { q: "a" },
    { kind: "general" },
    { topic: "selling" },
    { status: "new" },
    { assignee: "me" },
  ])("is true for %o", (query) => {
    expect(hasActiveEnquiryFilters(query as never)).toBe(true);
  });
});

describe("sender and assignee labels", () => {
  it("heads a row with the name, then the email", () => {
    expect(enquirySenderName({ name: "Ada", email: "ada@example.com" })).toBe("Ada");
    expect(enquirySenderName({ name: " ", email: "ada@example.com" })).toBe("ada@example.com");
    expect(enquirySenderName({ name: null, email: null })).toBe("Unknown sender");
  });

  it("shows the email underneath only when it is not already the heading", () => {
    expect(enquirySenderSecondary({ name: "Ada", email: "ada@example.com" })).toBe(
      "ada@example.com",
    );
    expect(enquirySenderSecondary({ name: null, email: "ada@example.com" })).toBeNull();
  });

  it("names a colleague by profile, else by role and the end of their id", () => {
    const base = { subject: "90000000-0000-4000-8000-000000000027" };
    expect(enquiryStaffName({ ...base, label: "Sam", role: "broker" })).toBe("Sam");
    expect(enquiryStaffName({ ...base, label: null, role: "account_manager" })).toBe(
      "Account manager (0027)",
    );
    expect(enquiryStaffName({ ...base, label: " ", role: null })).toBe("Staff member (0027)");
  });
});

describe("enquiryStatusTone", () => {
  it("flags new enquiries and quietens closed ones", () => {
    expect(enquiryStatusTone("new")).toBe("warning");
    expect(enquiryStatusTone("in_progress")).toBe("info");
    expect(enquiryStatusTone("closed")).toBe("neutral");
  });
});
