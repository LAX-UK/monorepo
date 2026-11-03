import type { IdentityDatabase } from "@auction/identity-db";
import { identityAddress } from "@auction/identity-db/schema";
import { and, asc, eq } from "drizzle-orm";
import {
  type ExportSource,
  SourcedExportCategory,
} from "../../../subject-export/sourced-export-category.js";
import { isoRequired } from "../../../subject-export/values.js";
import { afterKey, countWhere } from "./keyset.js";

type AddressRow = {
  id: string;
  label: string;
  recipientName: string;
  phone: string | null;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postcode: string;
  country: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function mapAddress(row: AddressRow) {
  return {
    id: row.id,
    origin: "provided" as const,
    label: row.label,
    recipient: row.recipientName,
    phone: row.phone,
    lines: [row.line1, row.line2].filter((line): line is string => Boolean(line)),
    city: row.city,
    region: row.region,
    postalCode: row.postcode,
    country: row.country,
    isDefaultDelivery: row.isDefaultShipping,
    isDefaultBilling: row.isDefaultBilling,
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
  };
}

/** The shared LAX address book. */
export class AddressesExportCategory extends SourcedExportCategory {
  readonly id = "addresses";
  protected readonly sources: readonly ExportSource[];

  constructor(db: IdentityDatabase) {
    super();
    this.sources = [
      {
        count: (subjectId) =>
          countWhere(db, identityAddress, eq(identityAddress.subjectId, subjectId)),
        page: async (subjectId, key, limit) => {
          const rows = await db
            .select({
              id: identityAddress.id,
              label: identityAddress.label,
              recipientName: identityAddress.recipientName,
              phone: identityAddress.phone,
              line1: identityAddress.line1,
              line2: identityAddress.line2,
              city: identityAddress.city,
              region: identityAddress.region,
              postcode: identityAddress.postcode,
              country: identityAddress.country,
              isDefaultShipping: identityAddress.isDefaultShipping,
              isDefaultBilling: identityAddress.isDefaultBilling,
              createdAt: identityAddress.createdAt,
              updatedAt: identityAddress.updatedAt,
            })
            .from(identityAddress)
            .where(and(eq(identityAddress.subjectId, subjectId), afterKey(identityAddress.id, key)))
            .orderBy(asc(identityAddress.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapAddress(row) }));
        },
      },
    ];
  }
}
