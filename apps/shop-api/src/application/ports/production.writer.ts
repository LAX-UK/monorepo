export type CreateProductionTaskCommand = {
  orderLineId: string;
  editionId: string;
  actorSubjectId: string;
};

export type CreateProductionTaskResult = {
  taskId: string;
  status: "queued";
};

export interface ProductionWriter {
  createTask(command: CreateProductionTaskCommand): Promise<CreateProductionTaskResult>;
}
