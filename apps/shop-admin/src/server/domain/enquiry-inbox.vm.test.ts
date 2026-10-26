import { describe, expect, it } from "vitest";
import {
  enquiriesList,
  enquiryPath,
  enquiryRef,
  enquirySenderName,
  enquirySenderSecondary,
  enquiryStaffName,
  parseEnquiriesState,
  parseEnquiryRef,
} from "./enquiry-inbox.vm";

const ID = "0b8f6c1e-5d7a-4a43-9b52-0d3a1f4c9e11";

describe("parseEnquiriesState", () => {
  it("keeps me, unassigned or a colleague's subject as the assignee filter", () => {
    expect(parseEnquiriesState({ assignee: "me" }).filters.assignee).toBe("me");
    expect(parseEnquiriesState({ assignee: "staff-42" }).filters.assignee).toBe("staff-42");
    expect(enquiriesList.apiQuery(parseEnquiriesState({ assignee: "staff-42" }))).toMatchObject({
      assignee: "staff-42",
    });
    expect(parseEnquiriesState({ assignee: "x".repeat(201) }).filters.assignee).toBeUndefined();
    expect(parseEnquiriesState({}).filters.assignee).toBeUndefined();
  });
});

describe("enquiriesList", () => {
  it("opens on every enquiry, newest first, with waiting enquiries leading on the server", () => {
    const state = enquiriesList.parse({});
    expect(state.view).toBe("all");
    expect(enquiriesList.apiQuery(state)).toEqual({});
    expect(enquiriesList.sortState(state)).toEqual({ columnId: "received", direction: "desc" });
  });

  it("reads the view, filters, search, sort and panel from the URL", () => {
    const state = enquiriesList.parse({
      view: "new",
      kind: "artwork",
      topic: "selling",
      assignee: "me",
      q: " ada ".trim(),
      sort: "received_asc",
      enquiry: `artwork:${ID}`,
    });
    expect(state).toMatchObject({
      view: "new",
      q: "ada",
      sort: "received_asc",
      filters: { kind: "artwork", topic: "selling", assignee: "me" },
      open: `artwork:${ID}`,
    });
    expect(enquiriesList.apiQuery(state)).toEqual({
      status: "new",
      q: "ada",
      kind: "artwork",
      topic: "selling",
      assignee: "me",
      sort: "received_asc",
    });
  });

  it("drops values it does not recognise, so a hand-edited link still opens the list", () => {
    const state = enquiriesList.parse({
      view: "archived",
      kind: "order",
      topic: "complaint",
      assignee: "someone-else",
    });
    expect(state).toEqual({ view: "all", filters: {} });
  });

  it("counts Waiting, In progress and Closed from the per-status counts", () => {
    const state = enquiriesList.parse({});
    const views = enquiriesList.views(state, { new: 3, in_progress: 2, closed: 5 });
    expect(views.map((view) => [view.label, view.count])).toEqual([
      ["All", 10],
      ["Waiting", 3],
      ["In progress", 2],
      ["Closed", 5],
    ]);
  });

  it("changing a filter returns to the first page and closes the panel", () => {
    const state = enquiriesList.parse({ view: "new", cursor: "c1", enquiry: `general:${ID}` });
    expect(enquiriesList.href(state, { kind: "general" })).toBe("/enquiries?view=new&kind=general");
  });
});

describe("enquiry references", () => {
  it("round-trips the panel id and the page path", () => {
    expect(parseEnquiryRef(enquiryRef({ kind: "general", id: ID }))).toEqual({
      kind: "general",
      id: ID,
    });
    expect(enquiryPath({ kind: "artwork", id: ID })).toBe(`/enquiries/artwork/${ID}`);
  });

  it("refuses anything that is not a kind and an id", () => {
    expect(parseEnquiryRef(null)).toBeNull();
    expect(parseEnquiryRef("order:123")).toBeNull();
    expect(parseEnquiryRef("general")).toBeNull();
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
