import type { shopPrintException } from "@auction/db/schema";
import type { PrintException } from "@auction/shop-domain";
import { signatureFromColumns, signatureToColumns } from "./edition-facts-columns.js";

type ExceptionRow = typeof shopPrintException.$inferSelect;

/** The columns that say what differs about a print. */
export type ExceptionColumns = Pick<
  ExceptionRow,
  | "remarqueMedium"
  | "remarquePlace"
  | "dedicated"
  | "signatureKind"
  | "signatureMedium"
  | "signaturePlace"
  | "conditionNote"
>;

export function exceptionToColumns(exception: PrintException): ExceptionColumns {
  return {
    remarqueMedium: exception.remarque?.medium ?? null,
    remarquePlace: exception.remarque?.place ?? null,
    dedicated: exception.dedicated === true,
    ...(exception.signature
      ? signatureToColumns(exception.signature)
      : { signatureKind: null, signatureMedium: null, signaturePlace: null }),
    conditionNote: exception.condition ?? null,
  };
}

export function exceptionFromColumns(row: ExceptionColumns): PrintException {
  return {
    ...(row.remarqueMedium && row.remarquePlace
      ? { remarque: { medium: row.remarqueMedium, place: row.remarquePlace } }
      : {}),
    ...(row.dedicated ? { dedicated: true as const } : {}),
    ...(row.signatureKind
      ? { signature: signatureFromColumns({ ...row, signatureKind: row.signatureKind }) }
      : {}),
    ...(row.conditionNote ? { condition: row.conditionNote } : {}),
  };
}
