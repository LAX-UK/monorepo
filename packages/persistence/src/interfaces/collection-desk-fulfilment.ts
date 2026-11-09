import type { DbTransaction } from "./artist-delete.repository.js";

export type DeskHandOverMove = {
  bookingId: string;
  lotIds: readonly string[];
  /** The name of the person who collected, recorded on each lot's fulfilment. */
  collectedBy: string;
  /** The staff member handing the works over. */
  actorUserId: string;
  at: Date;
};

/** Why a lot's fulfilment would not move: it is not in a status it can be handed over from. */
export type DeskFulfilmentMoveResult = { ok: true } | { ok: false; lotId: string };

/**
 * Moves the fulfilment of lots as part of the booking's own transaction at the collection desk.
 * Every method takes the booking's `tx`, so the booking, each lot's fulfilment and the event all
 * commit together or not at all, and a lot another action has already moved is refused (not
 * overwritten): the move is a conditional update, never a read followed by a write.
 */
export interface ICollectionDeskFulfilment {
  /**
   * Closes each lot's fulfilment as delivered by collection (released or ready for collection
   * only), keeping the status it was in on the booking's lot so an undo can restore it.
   */
  handOver(tx: DbTransaction, move: DeskHandOverMove): Promise<DeskFulfilmentMoveResult>;
  /**
   * Puts the lots handed over in this booking back to the status they were in before, and only
   * while each is still delivered. Clears the remembered status.
   */
  undoHandOver(tx: DbTransaction, bookingId: string): Promise<DeskFulfilmentMoveResult>;
}
