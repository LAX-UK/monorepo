export type ContactSellIntent = "selling" | "private-sale";

export type ContactSellType = "prints" | "corporate" | "estate";

export type ContactIntentConfig = {
  topic: "buying" | "selling" | "shipping" | "press" | "other";
  headline: string | null;
  successMessage: string;
  successCtaHref: string | null;
  successCtaLabel: string | null;
};

export function contactIntentFromSearchParams(input: {
  intent?: string | null;
  type?: string | null;
}): ContactIntentConfig {
  const intent = input.intent?.trim();
  const type = input.type?.trim() as ContactSellType | undefined;

  const defaultSuccess = {
    successMessage:
      "Thank you — we've received your message and will respond within two business days (GMT).",
    successCtaHref: null,
    successCtaLabel: null,
  };

  if (intent === "private-sale") {
    return {
      topic: "buying",
      headline:
        "Enquire about a private sale — our advisors will respond within two business days.",
      ...defaultSuccess,
    };
  }

  if (intent === "selling" || intent === "sell") {
    const typeCopy: Record<ContactSellType, string> = {
      prints: "Tell us about prints and editions you would like to consign.",
      corporate: "Describe your corporate collection or disposal requirements.",
      estate: "Share details about an estate or multi-item consignment.",
    };
    const successByType: Record<ContactSellType, string> = {
      prints:
        "Thanks — a prints specialist will review your enquiry. You can also start a standard submission anytime.",
      corporate:
        "Thanks — our corporate team will follow up on your disposal enquiry. Ready to list a single work now?",
      estate:
        "Thanks — our estate team will review your collection details. For a single item, you can submit directly.",
    };
    const headline =
      type && type in typeCopy
        ? typeCopy[type as ContactSellType]
        : "Speak with a specialist about selling with LAX — we respond within two business days.";
    const successMessage =
      type && type in successByType
        ? successByType[type as ContactSellType]
        : "Thanks — a selling specialist will respond shortly. If you already have photos and details, you can start a submission now.";
    return {
      topic: "selling",
      headline,
      successMessage,
      successCtaHref: "/dashboard/submissions/new",
      successCtaLabel: "Start a submission",
    };
  }

  return { topic: "buying", headline: null, ...defaultSuccess };
}
