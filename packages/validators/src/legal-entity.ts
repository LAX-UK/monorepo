import {
  legalEntityKinds,
  legalEntityMemberRoles,
  legalEntityStatuses,
  legalEntitySubkinds,
} from "@auction/types";
import { ORG_ONBOARDING_STEPS } from "@auction/types";
import { z } from "zod";

/** Create Legal Entity Input */
export const createLegalEntitySchema = z
  .object({
    displayName: z.string().min(1).max(200),
    legalName: z.string().max(200).optional(),
    kind: z.enum(legalEntityKinds),
    subkind: z.enum(legalEntitySubkinds),
  })
  .refine(
    (data) => {
      // Validate kind/subkind coherence
      if (data.kind === "individual") {
        return ["artist", "private_collector"].includes(data.subkind);
      }
      // organisation
      return [
        "gallery",
        "dealer",
        "estate",
        "company",
        "charity",
        "institution",
        "lax_stock",
        "other",
      ].includes(data.subkind);
    },
    {
      message: "Invalid subkind for the selected kind",
      path: ["subkind"],
    },
  );

export type CreateLegalEntityInput = z.infer<typeof createLegalEntitySchema>;

/** Update Legal Entity Input (admin only) */
export const updateLegalEntitySchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).optional(),
  vatNumber: z.string().max(50).optional(),
  marginSchemeEligible: z.boolean().optional(),
  platformFeeBps: z.number().int().min(0).max(10000).optional(),
});

export type UpdateLegalEntityInput = z.infer<typeof updateLegalEntitySchema>;

/** Invite Member Input */
export const inviteLegalEntityMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(legalEntityMemberRoles),
});

export type InviteLegalEntityMemberInput = z.infer<typeof inviteLegalEntityMemberSchema>;

/** Update Member Role Input */
export const updateLegalEntityMemberRoleSchema = z.object({
  role: z.enum(legalEntityMemberRoles),
});

export type UpdateLegalEntityMemberRoleInput = z.infer<typeof updateLegalEntityMemberRoleSchema>;

/** Status Transition Inputs (admin only) - each transition requires a reason */
const statusTransitionReason = z.string().min(10).max(1000);

export const requestDocsSchema = z.object({
  reason: statusTransitionReason,
});

export const approveLegalEntitySchema = z.object({
  reason: statusTransitionReason.optional(),
});

export const restrictLegalEntitySchema = z.object({
  reason: statusTransitionReason,
});

export const rejectLegalEntitySchema = z.object({
  reason: statusTransitionReason,
});

export const archiveLegalEntitySchema = z.object({
  confirmation: z.literal("ARCHIVE"),
  reason: statusTransitionReason,
});

/** Typed confirmation for destructive actions */
export const typedConfirmationSchema = (expected: string) =>
  z.object({
    confirmation: z.literal(expected),
  });

/** List Legal Entities Query */
export const listLegalEntitiesQuerySchema = z.object({
  kind: z.enum(legalEntityKinds).optional(),
  subkind: z.enum(legalEntitySubkinds).optional(),
  status: z.enum(legalEntityStatuses).optional(),
  isLaxManaged: z.boolean().optional(),
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** Legal Entity Address Input */
export const legalEntityAddressSchema = z.object({
  addressType: z.enum(["registered_office", "collection", "returns", "billing", "both"]),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(100),
  isDefault: z.boolean().optional(),
});

export type LegalEntityAddressInput = z.infer<typeof legalEntityAddressSchema>;

/** KYB Document Upload Input */
export const legalEntityDocumentUploadSchema = z
  .object({
    kind: z.enum([
      "companies_house_extract",
      "vat_certificate",
      "beneficial_owner_id",
      "provenance_sample",
      "bank_statement",
      "other",
    ]),
    uploadObjectId: z.string().uuid(),
    /** Required (non-empty when trimmed) when `kind` is `other`. */
    label: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === "other") {
      const t = data.label?.trim() ?? "";
      if (!t) {
        ctx.addIssue({
          code: "custom",
          message: "other_document_label_required",
          path: ["label"],
        });
      }
    }
  });

export type LegalEntityDocumentUploadInput = z.infer<typeof legalEntityDocumentUploadSchema>;

/** Document Review Input (admin) */
export const reviewLegalEntityDocumentSchema = z.object({
  reviewStatus: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(1000).optional(),
});

export type ReviewLegalEntityDocumentInput = z.infer<typeof reviewLegalEntityDocumentSchema>;

/* ---------- Public organisation onboarding ---------- */

/** Subset of subkinds creatable from the public submit-to-LAX flow. */
export const publicOrganisationSubkinds = [
  "gallery",
  "dealer",
  "estate",
  "company",
  "charity",
  "institution",
  "other",
] as const;
export type PublicOrganisationSubkind = (typeof publicOrganisationSubkinds)[number];

export const createOrganizationSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  subkind: z.enum(publicOrganisationSubkinds),
  vatNumber: z.string().max(50).optional(),
  primaryAddress: legalEntityAddressSchema.optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

const ORG_ONBOARDING_STEP_KEYS = ORG_ONBOARDING_STEPS as unknown as [
  (typeof ORG_ONBOARDING_STEPS)[number],
  ...(typeof ORG_ONBOARDING_STEPS)[number][],
];

export const orgOnboardingStepKeySchema = z.enum(ORG_ONBOARDING_STEP_KEYS);

export type OrgOnboardingStepKeyInput = z.infer<typeof orgOnboardingStepKeySchema>;

/** PATCH body while completing organisation onboarding "details". */
export const organizationOnboardingProfileSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  vatNumber: z.string().max(50).optional(),
  primaryAddress: legalEntityAddressSchema,
});

export type OrganizationOnboardingProfileInput = z.infer<
  typeof organizationOnboardingProfileSchema
>;

export const checkOrgNameSchema = z.object({
  displayName: z.string().min(1).max(200),
});

export const orgRequirementsParamsSchema = z.object({
  subkind: z.enum(publicOrganisationSubkinds),
});
