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
