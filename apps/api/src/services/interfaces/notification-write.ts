import type { UserNotification } from "@auction/types";

export type CreateNotificationRow = {
  userId: string;
  type: string;
  title: string;
  message: string;
  lotId?: string | undefined;
};

export interface INotificationWriteRepository {
  createMany(rows: CreateNotificationRow[]): Promise<UserNotification[]>;
}
