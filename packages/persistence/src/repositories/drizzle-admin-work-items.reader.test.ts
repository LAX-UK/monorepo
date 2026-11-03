import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import {
  DrizzleAdminWorkItemsReader,
  formatWorkItemAmount,
} from "./drizzle-admin-work-items.reader.js";

describe("formatWorkItemAmount", () => {
  it("shows a stored decimal amount as pounds", () => {
    expect(formatWorkItemAmount("83750.00")).toBe("£83,750.00");
    expect(formatWorkItemAmount("4750.5")).toBe("£4,750.50");
  });

  it("leaves a non-numeric value as it came", () => {
    expect(formatWorkItemAmount("n/a")).toBe("n/a");
  });
});

describe("DrizzleAdminWorkItemsReader.listMarketingEnquiries", () => {
  function readerReturning(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit,
    };
    const db = { select: vi.fn().mockReturnValue(chain) } as unknown as Database;
    return { reader: new DrizzleAdminWorkItemsReader(db), limit };
  }

  it("lists new enquiries as client work that opens the enquiry page", async () => {
    const createdAt = new Date("2026-07-27T10:00:00.000Z");
    const { reader, limit } = readerReturning([
      { id: "enq-1", topic: "press", name: "Ada Lovelace", createdAt },
    ]);

    const rows = await reader.listMarketingEnquiries(25);

    expect(limit).toHaveBeenCalledWith(25);
    expect(rows).toEqual([
      {
        sourceId: "enq-1",
        kind: "marketing_enquiry",
        domain: "clients",
        title: "Contact enquiry — Press",
        subtitle: "Ada Lovelace",
        href: "/admin/enquiries/enq-1",
        saleId: null,
        createdAt,
        sourceUpdatedAt: createdAt,
        assignedToUserId: null,
      },
    ]);
  });
});
