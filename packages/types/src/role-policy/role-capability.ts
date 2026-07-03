/** V1 capabilities used for centralized authorization. */
export type RoleCapability =
  | "platform.admin.full"
  | "finance.read"
  | "finance.platform.write"
  | "finance.entity.write"
  /** @deprecated Use finance.platform.write for platform-wide writes. */
  | "finance.write"
  | "user.invite"
  | "auction.manage"
  | "bid.place"
  | "client.submit"
  | "legal_entity.read"
  | "legal_entity.write"
  | "legal_entity.approve"
  | "legal_entity.archive"
  | "artist.read"
  | "artist.review"
  | "artist.merge"
  | "artist.delete"
  | "payout.read"
  | "payout.process"
  | "payout.reverse"
  | "audit.read_pii"
  | "catalogue.write"
  | "specialist.appraise"
  | "operations.fulfilment"
  | "content.write"
  | "support.respond"
  /** Read client/staff directory and profile detail (no moderation or role changes). */
  | "client.read"
  /** Read per-client bid transaction history in admin. */
  | "bids.read"
  /** Review and disposition AML/sanctions watchlist screenings. */
  | "aml.review"
  /** MLRO authority: lift/confirm AML holds and approve Source-of-Funds. */
  | "compliance.mlro";
