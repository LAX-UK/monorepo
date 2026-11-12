import type {
  IPrivateSaleDealArtworkCommands,
  IPrivateSaleDealCommands,
  IPrivateSaleDealDesk,
  IPrivateSaleDealQueries,
  IPrivateSaleDealSettlementCommands,
} from "../interfaces/private-sale-deal-desk.js";

/**
 * The staff desk as the routes see it: one port, made of the read side and the write side, which
 * are separate services with separate reasons to change.
 */
export class PrivateSaleDealDesk implements IPrivateSaleDealDesk {
  readonly list: IPrivateSaleDealQueries["list"];
  readonly detail: IPrivateSaleDealQueries["detail"];
  readonly updateTerms: IPrivateSaleDealCommands["updateTerms"];
  readonly nameBuyer: IPrivateSaleDealCommands["nameBuyer"];
  readonly act: IPrivateSaleDealCommands["act"];
  readonly set: IPrivateSaleDealArtworkCommands["set"];
  readonly remove: IPrivateSaleDealArtworkCommands["remove"];
  readonly markSold: IPrivateSaleDealSettlementCommands["markSold"];

  constructor(
    queries: IPrivateSaleDealQueries,
    commands: IPrivateSaleDealCommands,
    artwork: IPrivateSaleDealArtworkCommands,
    settlement: IPrivateSaleDealSettlementCommands,
  ) {
    this.list = (viewer, query) => queries.list(viewer, query);
    this.detail = (viewer, ref) => queries.detail(viewer, ref);
    this.updateTerms = (viewer, ref, change) => commands.updateTerms(viewer, ref, change);
    this.nameBuyer = (viewer, ref, input) => commands.nameBuyer(viewer, ref, input);
    this.act = (viewer, ref, action, input) => commands.act(viewer, ref, action, input);
    this.set = (viewer, ref, input) => artwork.set(viewer, ref, input);
    this.remove = (viewer, ref, input) => artwork.remove(viewer, ref, input);
    this.markSold = (viewer, ref) => settlement.markSold(viewer, ref);
  }
}
