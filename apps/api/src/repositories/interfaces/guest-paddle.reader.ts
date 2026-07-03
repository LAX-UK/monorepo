export interface IGuestPaddleReader {
  /**
   * Assigned in-room paddle for a guest at a sale, shown on the pass only once the
   * guest has been checked in at the linked sale (staff-verified presence).
   */
  findCheckedInPaddle(saleId: string, userId: string): Promise<number | null>;
}
