export interface ILotSoftDeleteSideEffects {
  softDeleteLot(input: {
    lotId: string;
    actorUserId: string;
    deletedAt: Date;
  }): Promise<void>;
}
