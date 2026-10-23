import { z } from "zod";

/** Issuer routes LAX Account calls (under the Better Auth base path) to read and rename a person. */
export const ACCOUNT_PROFILE_PATH = "/lax/account-profile";
export const ACCOUNT_PROFILE_UPDATE_PATH = "/lax/account-profile/update";

/** Same ceiling as the product profile APIs, so a name accepted here is accepted everywhere. */
export const ACCOUNT_NAME_MAX_LENGTH = 200;

export const accountNameSchema = z.string().trim().min(1).max(ACCOUNT_NAME_MAX_LENGTH);

export const accountProfileSchema = z.object({ name: z.string() });

export type AccountProfileResponse = z.infer<typeof accountProfileSchema>;
