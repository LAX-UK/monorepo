import type { Database } from "@auction/db";

export type ExternalAccountRow = {
  id: string;
  userId: string;
  provider: string;
  externalId: string;
  email: string | null;
  linkedAt: Date;
};

export type UpsertExternalAccountInput = {
  userId: string;
  provider: string;
  externalId: string;
  email?: string | null;
  metadata?: Record<string, unknown>;
};

export interface IExternalAccountRepository {
  findByProviderExternalId(
    provider: string,
    externalId: string,
  ): Promise<ExternalAccountRow | null>;

  upsert(
    input: UpsertExternalAccountInput,
    tx?: Database,
  ): Promise<{ inserted: boolean; row: ExternalAccountRow }>;
}
