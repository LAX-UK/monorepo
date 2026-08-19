export type IdentityOutboxRelayResult = {
  relayed: number;
  cursor: number;
};

export type IIdentityOutboxRelayRepository = {
  relayBatch(): Promise<IdentityOutboxRelayResult>;
};
