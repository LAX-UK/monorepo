export type ShopSchedulerTask = {
  name: string;
  run(now: Date): Promise<void>;
};
