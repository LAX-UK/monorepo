export interface IImageCleanup {
  enqueueRemoved(
    previous: string | null | undefined,
    next: string | null | undefined,
  ): Promise<void>;

  enqueueRemovedMany(previous: readonly string[], next: readonly string[]): Promise<void>;
}
