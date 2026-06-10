import type { PublicOrganisationSubkind } from "@auction/validators";

export function orgDocumentsStepIntro(subkind: PublicOrganisationSubkind): string {
  switch (subkind) {
    case "estate":
      return "Upload PDF or images (max 15MB) for each probate-related document listed below.";
    case "gallery":
    case "dealer":
    case "company":
      return "Upload your Companies House extract and VAT certificate (PDF or images, max 15MB each).";
    case "charity":
    case "institution":
      return "Upload your Companies House extract or equivalent registration document (PDF or images, max 15MB).";
    case "other":
      return "Upload a supporting document that explains your organisation (PDF or images, max 15MB).";
    default:
      return "Upload PDF or images (max 15MB) for each required document.";
  }
}
