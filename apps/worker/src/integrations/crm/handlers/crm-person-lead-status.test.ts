import { describe, expect, it } from "vitest";
import { InMemoryCrmLinkRepo, fakeCrmGateway } from "../crm-test-doubles.js";
import { CrmPersonSyncHandler } from "./crm-person-sync-handler.js";

const fields = {
  Email: "ada@example.com",
  Last_Name: "Lovelace",
  Lead_Source_Detailed: "LAX Account sign-up",
  Enquiry_Type: "General",
  Consent_Marketing_Opt_In: false,
};
const createOnlyFields = { Lead_Status: "New (Unassigned)", Lead_Source: "Website" };

function setup(
  findByEmail = async () => null as { recordId: string; module: "Leads" | "Contacts" } | null,
) {
  const gateway = fakeCrmGateway({ findByEmail: findByEmail as never });
  const linkRepo = new InMemoryCrmLinkRepo();
  return { gateway, linkRepo, handler: new CrmPersonSyncHandler({ gateway, linkRepo }) };
}

const upsertedFields = (gateway: ReturnType<typeof fakeCrmGateway>) =>
  gateway.upsert.mock.calls[0]?.[0]?.fields as Record<string, unknown>;

describe("lead status and source on the person upsert", () => {
  it("sets New (Unassigned) and Website when it creates the lead", async () => {
    const { gateway, handler } = setup();
    await handler.syncPerson("u1", "ada@example.com", fields, "upsert", { createOnlyFields });

    expect(upsertedFields(gateway)).toMatchObject({
      Lead_Status: "New (Unassigned)",
      Lead_Source: "Website",
      Lead_Source_Detailed: "LAX Account sign-up",
    });
  });

  it("never overwrites the status of a lead that is already linked", async () => {
    const { gateway, linkRepo, handler } = setup();
    await linkRepo.seedSubject("u1", "Leads", "lead-1");

    await handler.syncPerson("u1", "ada@example.com", fields, "upsert", { createOnlyFields });

    expect(upsertedFields(gateway)).not.toHaveProperty("Lead_Status");
    expect(upsertedFields(gateway)).not.toHaveProperty("Lead_Source");
    expect(upsertedFields(gateway)).toHaveProperty("Lead_Source_Detailed");
  });

  it("never overwrites the status of a lead an admin created and the email matches", async () => {
    const { gateway, handler } = setup(async () => ({ recordId: "lead-9", module: "Leads" }));

    await handler.syncPerson("u1", "ada@example.com", fields, "upsert", { createOnlyFields });

    expect(upsertedFields(gateway)).not.toHaveProperty("Lead_Status");
    expect(upsertedFields(gateway)).not.toHaveProperty("Lead_Source");
  });

  it("sends no lead-only fields to a person who is already a Contact", async () => {
    const { gateway, handler } = setup(async () => ({ recordId: "contact-9", module: "Contacts" }));

    await handler.syncPerson("u1", "ada@example.com", fields, "upsert", { createOnlyFields });

    const sent = upsertedFields(gateway);
    expect(gateway.upsert.mock.calls[0]?.[0]?.module).toBe("Contacts");
    for (const name of [
      "Lead_Status",
      "Lead_Source",
      "Lead_Source_Detailed",
      "Enquiry_Type",
      "Consent_Marketing_Opt_In",
    ]) {
      expect(sent).not.toHaveProperty(name);
    }
    expect(sent.Email).toBe("ada@example.com");
  });
});
