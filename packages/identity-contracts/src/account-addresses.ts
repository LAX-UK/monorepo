import { z } from "zod";
import { accountPhoneSchema } from "./account-contact.js";

/** Issuer routes LAX Account calls (under the Better Auth base path) to manage the address book. */
export const ACCOUNT_ADDRESSES_PATH = "/lax/account-addresses";
export const ACCOUNT_ADDRESSES_CREATE_PATH = "/lax/account-addresses/create";
export const ACCOUNT_ADDRESSES_UPDATE_PATH = "/lax/account-addresses/update";
export const ACCOUNT_ADDRESSES_DELETE_PATH = "/lax/account-addresses/delete";
export const ACCOUNT_ADDRESSES_DEFAULT_PATH = "/lax/account-addresses/default";

/** A person keeps at most this many saved addresses; the limit is enforced by the issuer. */
export const ACCOUNT_ADDRESS_LIMIT = 20;

/** ISO 3166-1 alpha-2 codes an address may use. */
export const ADDRESS_COUNTRY_CODES: readonly string[] =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );

const GB_POSTCODE = /^([A-Z]{1,2}\d[A-Z\d]?)\s?(\d[A-Z]{2})$/;
const US_ZIP = /^\d{5}(-\d{4})?$/;
/** Postcode systems differ widely; elsewhere accept letters, digits, spaces and hyphens only. */
const GENERIC_POSTCODE = /^[A-Z0-9][A-Z0-9 -]{1,10}[A-Z0-9]$/;

/**
 * The postcode in the form it is stored and printed, or null when it is not valid for the
 * country. Great Britain and the United States are checked strictly because they are the
 * common cases and typos there are costly; other countries get a sanity check only.
 */
export function normalisePostcode(raw: string, country: string): string | null {
  const compact = raw.trim().toUpperCase().replace(/\s+/g, " ");
  if (country === "GB") {
    const match = GB_POSTCODE.exec(compact);
    return match ? `${match[1]} ${match[2]}` : null;
  }
  if (country === "US") return US_ZIP.test(compact) ? compact : null;
  return GENERIC_POSTCODE.test(compact) ? compact : null;
}

const text = (max: number) => z.string().trim().min(1).max(max);

/** What a person enters for an address. Defaults are set separately, never through this shape. */
export const accountAddressInputSchema = z
  .object({
    label: text(80),
    recipientName: text(200),
    line1: text(200),
    line2: z.string().trim().max(200).nullable().default(null),
    city: text(120),
    region: z.string().trim().max(120).nullable().default(null),
    postcode: text(32),
    country: z.string().refine((code) => ADDRESS_COUNTRY_CODES.includes(code)),
    phone: accountPhoneSchema.nullable().default(null),
  })
  .transform((value, ctx) => {
    const postcode = normalisePostcode(value.postcode, value.country);
    if (!postcode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["postcode"],
        message: "invalid_postcode",
      });
      return z.NEVER;
    }
    return {
      ...value,
      postcode,
      line2: value.line2 || null,
      region: value.region || null,
    };
  });

export type AccountAddressInput = z.input<typeof accountAddressInputSchema>;
export type AccountAddressFields = z.output<typeof accountAddressInputSchema>;

export const accountAddressSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  recipientName: z.string(),
  line1: z.string(),
  line2: z.string().nullable(),
  city: z.string(),
  region: z.string().nullable(),
  postcode: z.string(),
  country: z.string(),
  phone: z.string().nullable(),
  isDefaultShipping: z.boolean(),
  isDefaultBilling: z.boolean(),
  /** Send back as `expectedVersion` when changing or deleting, so a stale edit is refused. */
  version: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const accountAddressesSchema = z.object({ addresses: z.array(accountAddressSchema) });
export const accountAddressResultSchema = z.object({ address: accountAddressSchema });
export const accountAddressDeletedSchema = z.object({ deleted: z.literal(true) });

export type AccountAddress = z.infer<typeof accountAddressSchema>;
export type AccountAddressesResponse = z.infer<typeof accountAddressesSchema>;

export const ACCOUNT_ADDRESS_DEFAULT_KINDS = ["shipping", "billing"] as const;
export const accountAddressDefaultKindSchema = z.enum(ACCOUNT_ADDRESS_DEFAULT_KINDS);
export type AccountAddressDefaultKind = z.infer<typeof accountAddressDefaultKindSchema>;

/** Reasons the issuer refuses an address change, returned as `{ error }` (HTTP 400, 404 or 409). */
export const ACCOUNT_ADDRESS_ERRORS = [
  "invalid_address",
  "address_not_found",
  "address_limit_reached",
  "version_conflict",
] as const;

export type AccountAddressError = (typeof ACCOUNT_ADDRESS_ERRORS)[number];
