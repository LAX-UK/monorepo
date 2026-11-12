import type { IdentityDatabase } from "@auction/identity-db";
import { SubjectExportRegistry } from "../../subject-export/subject-export.registry.js";
import { createDrizzleSessionClientsReader } from "../drizzle-session-clients.reader.js";
import { AddressesExportCategory } from "./categories/addresses.category.js";
import { ConsentsExportCategory } from "./categories/consents.category.js";
import { ContactExportCategory } from "./categories/contact.category.js";
import { ProfileExportCategory } from "./categories/profile.category.js";
import { RequestsExportCategory } from "./categories/requests.category.js";
import { SignInAndSecurityExportCategory } from "./categories/sign-in-and-security.category.js";

/** The LAX Account categories, in the order the download lists them. */
export function createAccountSubjectExportRegistry(
  db: IdentityDatabase,
  crypto: { open(sealed: string): string } | null = null,
): SubjectExportRegistry {
  return new SubjectExportRegistry([
    new ProfileExportCategory(db),
    new ContactExportCategory(db),
    new AddressesExportCategory(db),
    new SignInAndSecurityExportCategory(
      db,
      undefined,
      crypto,
      createDrizzleSessionClientsReader(db),
    ),
    new ConsentsExportCategory(db),
    new RequestsExportCategory(db),
  ]);
}
