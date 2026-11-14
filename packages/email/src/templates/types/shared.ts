import type { LaxOperatedProduct } from "@auction/branding";

/** Optional on shared account mail: the product the person signed up through or is acting in. */
export type EmailProductVars = { product?: LaxOperatedProduct };

export type RecipientResolution = "live" | "snapshot";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type OptOutableLotVars = {
  userName?: string | null;
  lotTitle: string;
  lotUrl: string;
  unsubscribeUrl: string;
};

export type TemplateDomainSlice<TNames extends string, TVars extends Record<TNames, unknown>> = {
  names: readonly TNames[];
  vars: TVars;
  recipientResolution: Record<TNames, RecipientResolution>;
};

/**
 * A file kept in LAX's document storage that travels with an email: only its key and name are
 * stored with the message, and the sender reads the bytes when it sends.
 */
export type StoredEmailAttachment = {
  storageKey: string;
  /** Letters, digits, dots and dashes only (it goes in a mail header). */
  filename: string;
  contentType: "application/pdf";
};
