export type UpdateFulfilmentStatusCommand = {
  fulfilmentId: string;
  status: string;
  actorSubjectId: string;
  carrier?: string | undefined;
  trackingNumber?: string | undefined;
  possessionAt?: string | undefined;
};

export type UpdateFulfilmentStatusResult = {
  fulfilmentId: string;
  status: string;
};

export interface FulfilmentWriter {
  updateStatus(command: UpdateFulfilmentStatusCommand): Promise<UpdateFulfilmentStatusResult>;
}
