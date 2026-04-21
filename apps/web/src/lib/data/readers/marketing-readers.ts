/** Peek at a single active sale for marketing shell (live strip). */
export type LiveSaleReader = {
  peek(): Promise<{ id: string; title: string } | null>;
};
