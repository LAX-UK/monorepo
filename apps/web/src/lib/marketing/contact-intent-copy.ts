export type ContactSellIntent = "selling" | "private-sale";

export type ContactSellType = "prints" | "corporate" | "estate";

export type ContactTopic = "buying" | "selling" | "shipping" | "press" | "other";

/** An intent can replace the general topic list with its own question and choices. */
export type ContactTopicField = {
  label: string;
  options: readonly { value: ContactTopic; label: string }[];
};

/** How an intent words the form. Defaults keep the general contact form unchanged. */
export type ContactIntentFormCopy = {
  topicField: ContactTopicField | null;
  messageLabel: string;
  /** Opens every message so staff can tell the enquiry apart; null for the general form. */
  messageTag: string | null;
  submitLabel: string;
};

export type ContactIntentConfig = ContactIntentFormCopy & {
  topic: ContactTopic;
  headline: string | null;
  successMessage: string;
  successCtaHref: string | null;
  successCtaLabel: string | null;
};

/** The longest sale name carried in a link; longer text is cut so a link cannot fill the form. */
const SALE_NAME_MAX = 120;

function saleNameFrom(raw: string | null | undefined): string | null {
  const name = raw?.replace(/\s+/g, " ").trim().slice(0, SALE_NAME_MAX).trim();
  return name || null;
}

export function contactIntentFromSearchParams(input: {
  intent?: string | null;
  type?: string | null;
  /** The sale an enquiry is about, as its title. */
  sale?: string | null;
}): ContactIntentConfig {
  const intent = input.intent?.trim();
  const type = input.type?.trim() as ContactSellType | undefined;

  const defaultForm: ContactIntentFormCopy = {
    topicField: null,
    messageLabel: "Message",
    messageTag: null,
    submitLabel: "Send message",
  };

  const defaultSuccess = {
    successMessage:
      "Thank you — we've received your message and will respond within two business days (GMT).",
    successCtaHref: null,
    successCtaLabel: null,
  };

  if (intent === "registration") {
    const sale = saleNameFrom(input.sale);
    return {
      topic: "buying",
      headline: sale
        ? `Ask about your registration for ${sale}. Tell us what you need to know; client services reply within two business days.`
        : "Ask about your registration. Tell us which sale and what you need to know; client services reply within two business days.",
      ...defaultForm,
      messageTag: sale ? `Registration enquiry: ${sale}` : "Registration enquiry",
      ...defaultSuccess,
    };
  }

  if (intent === "private-sale") {
    return {
      topic: "buying",
      headline: null,
      topicField: {
        label: "I would like to",
        options: [
          { value: "buying", label: "Buy a work privately" },
          { value: "selling", label: "Sell a work privately" },
        ],
      },
      messageLabel: "Tell us about the work",
      messageTag: "Private sale enquiry",
      submitLabel: "Send enquiry",
      successMessage:
        "Thank you. Your enquiry has been received and a specialist will reply within two business days (GMT).",
      successCtaHref: "/sell",
      successCtaLabel: "How selling works",
    };
  }

  if (intent === "purchase-problem") {
    return {
      topic: "buying",
      headline:
        "Report a problem with a purchase. Tell us the lot and what happened; client services reply within two business days.",
      ...defaultForm,
      ...defaultSuccess,
    };
  }

  if (intent === "bidding-limit") {
    return {
      topic: "buying",
      headline:
        "Ask to raise your bidding limit. Tell us which sale and the amount; client services reply within two business days.",
      ...defaultForm,
      ...defaultSuccess,
    };
  }

  if (intent === "data-copy") {
    return {
      topic: "other",
      headline:
        "Request a full copy of your data. Tell us which account and what you need; we reply within one month at the latest.",
      ...defaultSuccess,
    };
  }

  if (intent === "press") {
    return {
      ...defaultForm,
      topic: "press",
      headline: "Press & media enquiry — our team responds within two business hours (GMT).",
      successMessage:
        "Thank you — your press enquiry has been received. A member of our media team will respond shortly.",
      successCtaHref: "/press",
      successCtaLabel: "Back to press centre",
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
      ...defaultForm,
      topic: "selling",
      headline,
      successMessage,
      successCtaHref: "/selling/new",
      successCtaLabel: "Start a submission",
    };
  }

  return { ...defaultForm, topic: "buying", headline: null, ...defaultSuccess };
}
