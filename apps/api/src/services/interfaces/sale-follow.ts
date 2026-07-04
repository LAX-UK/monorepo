export type { ISaleFollowRepository, SaleFollowRow } from "@auction/persistence/interfaces";

/** ISP: existence-check interface used by the follow service to validate the sale. */
export interface ISaleExistenceReader {
  findById(id: string): Promise<{ id: string } | null>;
}
