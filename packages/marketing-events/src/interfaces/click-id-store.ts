import type { ClickIds } from "@auction/types";

export interface IClickIdStore {
  put(userId: string, ids: ClickIds): Promise<void>;
  get(userId: string): Promise<ClickIds | null>;
}
