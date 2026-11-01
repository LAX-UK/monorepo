import type { Database } from "@auction/db";
import { legalEntityContactDetails } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  ContactDetails,
  IContactDetailsRepository,
} from "../interfaces/organisation-contact-details.repository.js";

type ContactRow = typeof legalEntityContactDetails.$inferSelect;

function toContactDetails(row: ContactRow): ContactDetails {
  return { email: row.email, phone: row.phone, website: row.website, updatedAt: row.updatedAt };
}

/** One row per organisation in `legal_entity_contact_details`, replaced as a whole on save. */
export class DrizzleContactDetailsRepository implements IContactDetailsRepository {
  constructor(private readonly db: Database) {}

  async find(legalEntityId: string): Promise<ContactDetails | null> {
    const [row] = await this.db
      .select()
      .from(legalEntityContactDetails)
      .where(eq(legalEntityContactDetails.legalEntityId, legalEntityId))
      .limit(1);
    return row ? toContactDetails(row) : null;
  }

  async save(
    legalEntityId: string,
    details: Omit<ContactDetails, "updatedAt">,
    updatedByUserId: string,
  ): Promise<ContactDetails> {
    const values = {
      email: details.email,
      phone: details.phone,
      website: details.website,
      updatedByUserId,
      updatedAt: new Date(),
    };
    const [row] = await this.db
      .insert(legalEntityContactDetails)
      .values({ legalEntityId, ...values })
      .onConflictDoUpdate({ target: legalEntityContactDetails.legalEntityId, set: values })
      .returning();
    if (!row) throw new Error("contact_details_not_saved");
    return toContactDetails(row);
  }
}
