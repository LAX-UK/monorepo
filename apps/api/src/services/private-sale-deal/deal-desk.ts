import type {
  IPrivateSaleDealCommands,
  IPrivateSaleDealDesk,
  IPrivateSaleDealQueries,
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

  constructor(queries: IPrivateSaleDealQueries, commands: IPrivateSaleDealCommands) {
    this.list = (viewer, query) => queries.list(viewer, query);
    this.detail = (viewer, ref) => queries.detail(viewer, ref);
    this.updateTerms = (viewer, ref, change) => commands.updateTerms(viewer, ref, change);
    this.nameBuyer = (viewer, ref, input) => commands.nameBuyer(viewer, ref, input);
    this.act = (viewer, ref, action, input) => commands.act(viewer, ref, action, input);
  }
}
