import { describe, expect, it } from "vitest";
import { adminLotFulfilmentListQuerySchema } from "./fulfilment.js";
import { adminInvitationsListQuerySchema } from "./invitation.js";

describe("adminInvitationsListQuerySchema sort", () => {
  it("leaves sort unset by default and accepts every listed order", () => {
    expect(adminInvitationsListQuerySchema.parse({}).sort).toBeUndefined();
    for (const sort of [
      "created_desc",
      "created_asc",
      "expires_asc",
      "expires_desc",
      "email_asc",
      "email_desc",
    ]) {
      expect(adminInvitationsListQuerySchema.parse({ sort }).sort).toBe(sort);
    }
  });

  it("rejects an unknown sort", () => {
    expect(adminInvitationsListQuerySchema.safeParse({ sort: "status_asc" }).success).toBe(false);
  });
});

describe("adminLotFulfilmentListQuerySchema sort", () => {
  it("leaves sort unset by default and accepts every listed order", () => {
    expect(adminLotFulfilmentListQuerySchema.parse({}).sort).toBeUndefined();
    for (const sort of ["updated_desc", "updated_asc", "lot_asc", "lot_desc"]) {
      expect(adminLotFulfilmentListQuerySchema.parse({ sort }).sort).toBe(sort);
    }
  });

  it("rejects an unknown sort", () => {
    expect(adminLotFulfilmentListQuerySchema.safeParse({ sort: "status_asc" }).success).toBe(false);
  });
});
