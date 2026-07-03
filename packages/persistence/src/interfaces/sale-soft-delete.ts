export interface ISaleSoftDeleteSideEffects {
  softDeleteCascade(input: {
    saleId: string;
    actorUserId: string;
    deletedAt: Date;
    lotIds: string[];
  }): Promise<void>;
}
