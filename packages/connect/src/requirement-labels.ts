import type { ConnectRequirementLabel } from "./types.js";

/** Human-readable labels for common UK Express Connect requirement keys. */
export const REQUIREMENT_LABELS: Record<string, ConnectRequirementLabel> = {
  external_account: {
    label: "Bank account",
    hint: "Add a UK bank account to receive payouts.",
    severity: "warning",
  },
  "tos_acceptance.date": {
    label: "Terms acceptance",
    hint: "Accept Stripe's connected account terms.",
    severity: "warning",
  },
  "tos_acceptance.ip": {
    label: "Terms acceptance",
    hint: "Accept Stripe's connected account terms.",
    severity: "warning",
  },
  "individual.verification.document": {
    label: "Identity document",
    hint: "Upload a valid ID document.",
    severity: "warning",
  },
  "individual.verification.additional_document": {
    label: "Additional identity document",
    hint: "Upload the requested supporting document.",
    severity: "warning",
  },
  "individual.dob.day": {
    label: "Date of birth",
    hint: "Provide your full date of birth.",
    severity: "warning",
  },
  "individual.dob.month": {
    label: "Date of birth",
    hint: "Provide your full date of birth.",
    severity: "warning",
  },
  "individual.dob.year": {
    label: "Date of birth",
    hint: "Provide your full date of birth.",
    severity: "warning",
  },
  "individual.first_name": {
    label: "Legal first name",
    hint: "Provide your legal first name as shown on ID.",
    severity: "warning",
  },
  "individual.last_name": {
    label: "Legal last name",
    hint: "Provide your legal last name as shown on ID.",
    severity: "warning",
  },
  "individual.email": {
    label: "Email address",
    hint: "Provide a contact email for payout notifications.",
    severity: "info",
  },
  "individual.phone": {
    label: "Phone number",
    hint: "Provide a contact phone number.",
    severity: "info",
  },
  "individual.address.line1": {
    label: "Home address",
    hint: "Provide your residential address.",
    severity: "warning",
  },
  "individual.address.city": {
    label: "City",
    hint: "Provide your city.",
    severity: "warning",
  },
  "individual.address.postal_code": {
    label: "Postcode",
    hint: "Provide your postcode.",
    severity: "warning",
  },
  "company.verification.document": {
    label: "Company verification document",
    hint: "Upload company registration or proof of business.",
    severity: "warning",
  },
  "company.tax_id": {
    label: "Company tax ID",
    hint: "Provide your company tax or VAT identifier.",
    severity: "warning",
  },
  "company.name": {
    label: "Company name",
    hint: "Provide your registered company name.",
    severity: "warning",
  },
  "company.address.line1": {
    label: "Registered address",
    hint: "Provide your company registered address.",
    severity: "warning",
  },
  "business_profile.url": {
    label: "Business website",
    hint: "Provide your business website or online profile URL.",
    severity: "info",
  },
  "business_profile.mcc": {
    label: "Business category",
    hint: "Select your business category.",
    severity: "info",
  },
  "representative.verification.document": {
    label: "Representative ID",
    hint: "Upload ID for the account representative.",
    severity: "warning",
  },
  "representative.first_name": {
    label: "Representative first name",
    hint: "Provide the representative's legal first name.",
    severity: "warning",
  },
  "representative.last_name": {
    label: "Representative last name",
    hint: "Provide the representative's legal last name.",
    severity: "warning",
  },
};

export function labelForRequirement(key: string): ConnectRequirementLabel {
  const exact = REQUIREMENT_LABELS[key];
  if (exact) return exact;

  if (key.startsWith("individual.")) {
    return {
      label: "Personal details",
      hint: "Complete the requested personal information.",
      severity: "warning",
    };
  }
  if (key.startsWith("company.") || key.startsWith("representative.")) {
    return {
      label: "Business details",
      hint: "Complete the requested business information.",
      severity: "warning",
    };
  }
  if (key.startsWith("business_profile.")) {
    return {
      label: "Business profile",
      hint: "Complete your business profile details.",
      severity: "info",
    };
  }

  return {
    label: key.replace(/\./g, " · "),
    hint: "Complete this item in payout setup.",
    severity: "warning",
  };
}
