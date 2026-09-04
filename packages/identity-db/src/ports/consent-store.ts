export type ConsentRecord = {
  id: string;
  clientId: string;
  userId: string;
  scopes: string;
  consentGiven: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Atomic oauth_consent upsert; merges scopes on conflict. */
export type ConsentStore = {
  upsert(input: ConsentRecord): Promise<ConsentRecord>;
};
