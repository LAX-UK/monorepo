import { describe, expect, it } from "vitest";
import {
  calendarDateSchema,
  dataRequestDueOn,
  daysLate,
  dueState,
  extendedDueOn,
  londonCalendarDate,
} from "./data-request-dates.js";
import {
  closeDataRequestSchema,
  createDataRequestSchema,
  dataRequestViewSchema,
  downloadReference,
  extendDataRequestSchema,
  isDownloadReference,
  isManualReference,
  maskContact,
  maskContactEmail,
  patchDataRequestSchema,
} from "./data-requests.js";
import { subjectExportDueAt } from "./subject-export.js";

describe("dataRequestDueOn (the ICO month rule)", () => {
  it("is the same date next month", () => {
    expect(dataRequestDueOn("2026-11-02")).toBe("2026-12-02");
  });

  it("lands on the last day of a shorter month", () => {
    expect(dataRequestDueOn("2026-01-31")).toBe("2026-02-28");
    expect(dataRequestDueOn("2026-03-31")).toBe("2026-04-30");
    expect(dataRequestDueOn("2026-08-31")).toBe("2026-09-30");
    expect(dataRequestDueOn("2026-01-29")).toBe("2026-02-28");
  });

  it("uses 29 February in a leap year", () => {
    expect(dataRequestDueOn("2028-01-31")).toBe("2028-02-29");
    expect(dataRequestDueOn("2028-01-29")).toBe("2028-02-29");
    expect(dataRequestDueOn("2027-01-29")).toBe("2027-02-28");
  });

  it("rolls December into the next year", () => {
    expect(dataRequestDueOn("2026-12-31")).toBe("2027-01-31");
  });

  it("agrees with the automatic downloads' rule", () => {
    for (const day of ["2026-01-31", "2028-01-31", "2026-11-30", "2026-12-15"]) {
      expect(dataRequestDueOn(day)).toBe(
        subjectExportDueAt(new Date(`${day}T00:00:00.000Z`))
          .toISOString()
          .slice(0, 10),
      );
    }
  });
});

describe("extendedDueOn", () => {
  it("adds the months to the original due date", () => {
    expect(extendedDueOn("2026-12-02", 1)).toBe("2027-01-02");
    expect(extendedDueOn("2026-12-02", 2)).toBe("2027-02-02");
  });

  it("counts from the due date, clamping to the last day of a short month", () => {
    expect(extendedDueOn("2026-12-31", 2)).toBe("2027-02-28");
    expect(extendedDueOn("2027-12-31", 2)).toBe("2028-02-29");
    expect(extendedDueOn("2026-02-28", 1)).toBe("2026-03-28");
    expect(extendedDueOn("2026-03-30", 1)).toBe("2026-04-30");
    expect(extendedDueOn("2026-03-31", 1)).toBe("2026-04-30");
  });
});

describe("dueState", () => {
  it("has no state while waiting for ID", () => {
    expect(dueState(null, "2026-11-02")).toEqual({ state: "none", daysLeft: null });
  });

  it("is ok beyond a week", () => {
    expect(dueState("2026-11-10", "2026-11-02")).toEqual({ state: "ok", daysLeft: 8 });
  });

  it("is due soon from seven days, including the due day itself", () => {
    expect(dueState("2026-11-09", "2026-11-02")).toEqual({ state: "due_soon", daysLeft: 7 });
    expect(dueState("2026-11-02", "2026-11-02")).toEqual({ state: "due_soon", daysLeft: 0 });
  });

  it("is overdue the day after", () => {
    expect(dueState("2026-11-01", "2026-11-02")).toEqual({ state: "overdue", daysLeft: -1 });
  });

  it("counts across the clock change without drifting", () => {
    expect(dueState("2026-10-26", "2026-10-24").daysLeft).toBe(2);
    expect(dueState("2026-03-30", "2026-03-27").daysLeft).toBe(3);
  });
});

describe("daysLate", () => {
  it("is zero on time and the days after otherwise", () => {
    expect(daysLate("2026-12-02", "2026-12-02")).toBe(0);
    expect(daysLate("2026-12-02", "2026-11-20")).toBe(0);
    expect(daysLate("2026-12-02", "2026-12-05")).toBe(3);
  });
});

describe("calendar dates", () => {
  it("refuses a day that does not exist", () => {
    expect(calendarDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(calendarDateSchema.safeParse("2026-13-01").success).toBe(false);
    expect(calendarDateSchema.safeParse("2026-2-3").success).toBe(false);
    expect(calendarDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(calendarDateSchema.safeParse("2027-02-29").success).toBe(false);
  });

  it("reads the day in London, which runs ahead of UTC in summer", () => {
    expect(londonCalendarDate(new Date("2026-07-01T23:30:00.000Z"))).toBe("2026-07-02");
    expect(londonCalendarDate(new Date("2026-12-01T23:30:00.000Z"))).toBe("2026-12-01");
  });
});

describe("references and masking", () => {
  it("builds the download reference from the request id", () => {
    const reference = downloadReference("7f3c1a22-0000-4000-8000-000000000000");
    expect(reference).toBe("DL-7F3C1A");
    expect(isDownloadReference(reference)).toBe(true);
    expect(isManualReference("DR-0012")).toBe(true);
    expect(isManualReference("DL-7F3C1A")).toBe(false);
  });

  it("masks an email to its first letters and the domain's ending", () => {
    expect(maskContactEmail("lena@north.com")).toBe("l•••••@n•••••.com");
    expect(maskContactEmail("not-an-email")).toBe("•••••");
  });

  it("masks other contacts to their first character", () => {
    expect(maskContact("lena@north.co.uk")).toBe("l•••••@n•••••.uk");
    expect(maskContact("12 High Street, London")).toBe("1•••••");
  });
});

const NEW_REQUEST = {
  actorSubjectId: "staff_1",
  person: { kind: "account", subjectId: "user_1" },
  reason: "full_copy",
  channel: "email",
  receivedOn: "2026-11-02",
  identity: "confirmed",
  products: ["account", "bid"],
};

describe("createDataRequestSchema", () => {
  it("accepts a request for a person with an account", () => {
    expect(createDataRequestSchema.safeParse(NEW_REQUEST).success).toBe(true);
  });

  it("needs a name and a contact when there is no account", () => {
    const person = { kind: "contact", name: "Lena Fischer", detail: "lena@north.com" };
    expect(createDataRequestSchema.safeParse({ ...NEW_REQUEST, person }).success).toBe(true);
    expect(
      createDataRequestSchema.safeParse({ ...NEW_REQUEST, person: { kind: "contact", name: "L" } })
        .success,
    ).toBe(false);
  });

  it("needs a note for Other, a product and a real date", () => {
    expect(createDataRequestSchema.safeParse({ ...NEW_REQUEST, reason: "other" }).success).toBe(
      false,
    );
    expect(
      createDataRequestSchema.safeParse({ ...NEW_REQUEST, reason: "other", notes: "By letter" })
        .success,
    ).toBe(true);
    expect(createDataRequestSchema.safeParse({ ...NEW_REQUEST, products: [] }).success).toBe(false);
    expect(
      createDataRequestSchema.safeParse({ ...NEW_REQUEST, products: ["bid", "bid"] }).success,
    ).toBe(false);
    expect(
      createDataRequestSchema.safeParse({ ...NEW_REQUEST, receivedOn: "2026-02-30" }).success,
    ).toBe(false);
  });
});

describe("patchDataRequestSchema", () => {
  it("needs a version and at least one change", () => {
    const base = { actorSubjectId: "staff_1", version: 2 };
    expect(patchDataRequestSchema.safeParse(base).success).toBe(false);
    expect(patchDataRequestSchema.safeParse({ ...base, notes: "Called back" }).success).toBe(true);
    expect(
      patchDataRequestSchema.safeParse({ ...base, gathered: { product: "bid", done: true } })
        .success,
    ).toBe(true);
    expect(patchDataRequestSchema.safeParse({ notes: "x" }).success).toBe(false);
  });
});

describe("extendDataRequestSchema", () => {
  const input = {
    actorSubjectId: "staff_1",
    version: 1,
    months: 2,
    reason: "complex",
    note: "Needs the specialist's mail archive",
    personToldOn: "2026-11-20",
    personToldVia: "email",
  };

  it("takes one or two months only", () => {
    expect(extendDataRequestSchema.safeParse(input).success).toBe(true);
    expect(extendDataRequestSchema.safeParse({ ...input, months: 3 }).success).toBe(false);
  });

  it("needs a note and a way the person was told", () => {
    expect(extendDataRequestSchema.safeParse({ ...input, note: " " }).success).toBe(false);
    expect(
      extendDataRequestSchema.safeParse({ ...input, personToldVia: "support_form" }).success,
    ).toBe(false);
  });
});

describe("closeDataRequestSchema", () => {
  const base = { actorSubjectId: "staff_1", version: 1 };

  it("closes simple outcomes with no note", () => {
    for (const outcome of ["sent", "nothing_held", "withdrawn"]) {
      expect(closeDataRequestSchema.safeParse({ ...base, outcome }).success).toBe(true);
    }
  });

  it("names the exemption for a partial copy", () => {
    expect(closeDataRequestSchema.safeParse({ ...base, outcome: "sent_partial" }).success).toBe(
      false,
    );
    expect(
      closeDataRequestSchema.safeParse({
        ...base,
        outcome: "sent_partial",
        note: "Legal privilege",
      }).success,
    ).toBe(true);
  });

  it("needs the reason and the right to complain for a refusal", () => {
    const refused = { ...base, outcome: "refused" };
    expect(closeDataRequestSchema.safeParse(refused).success).toBe(false);
    expect(closeDataRequestSchema.safeParse({ ...refused, note: "Excessive" }).success).toBe(false);
    expect(
      closeDataRequestSchema.safeParse({ ...refused, note: "Excessive", complaintRightTold: false })
        .success,
    ).toBe(false);
    expect(
      closeDataRequestSchema.safeParse({ ...refused, note: "Excessive", complaintRightTold: true })
        .success,
    ).toBe(true);
  });
});

describe("dataRequestViewSchema", () => {
  const base = {
    reference: "DR-0012",
    personLabel: "l•••••@n•••••.com",
    hasAccount: false,
    products: ["account"],
    productsDone: { done: 0, total: 1 },
    requestedOn: "2026-11-02",
    dueOn: "2026-12-02",
    extended: false,
    due: { state: "ok", daysLeft: 30 },
  };

  it("tells a download from a manual request by its kind", () => {
    expect(
      dataRequestViewSchema.safeParse({
        ...base,
        kind: "manual",
        status: "in_progress",
        reason: "full_copy",
        channel: "email",
        outcome: null,
        daysLate: null,
      }).success,
    ).toBe(true);
    expect(
      dataRequestViewSchema.safeParse({
        ...base,
        reference: "DL-7F3C1A",
        kind: "download",
        status: "delayed",
        continuedAs: null,
      }).success,
    ).toBe(true);
    expect(
      dataRequestViewSchema.safeParse({ ...base, kind: "download", status: "in_progress" }).success,
    ).toBe(false);
  });
});
