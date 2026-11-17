/** Proper nouns that keep their capital when they open a label ("Stripe transfer"). */
const PROPER_NOUNS = ["Stripe", "Xero", "Veriff", "ATG", "Zoho"];

/**
 * "Order ID" → "order ID": the first letter drops so the name reads as a sentence. It stays when
 * a later word is Capitalised (a proper noun: "Stripe Connect account ID"), when the first word is
 * an acronym or code ("ATG", "SHA-256": second character not lower-case) or one of PROPER_NOUNS.
 */
const inSentence = (label: string) => {
  const words = label.split(" ");
  const first = words[0] ?? "";
  const keepsCase =
    words.slice(1).some((word) => /^[A-Z][a-z]/.test(word)) ||
    /^[A-Z][^a-z]/.test(first) ||
    PROPER_NOUNS.includes(first);
  return keepsCase ? label : label.charAt(0).toLowerCase() + label.slice(1);
};

/** Words for CopyButton: what is read out and shown when a reference is copied. */
export const COPY_BUTTON_COPY = {
  /** The button's accessible name: "Copy order ID". */
  action: (label: string) => `Copy ${inSentence(label)}`,
  /** Announced (aria-live) once the text is on the clipboard: "Order ID copied". */
  copied: (label: string) => `${label} copied`,
  /** Announced when the browser refuses; the value is still on the page to select. */
  failed: (label: string) => `Could not copy ${inSentence(label)}`,
} as const;
