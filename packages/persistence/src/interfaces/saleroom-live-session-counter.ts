export interface ISaleroomLiveSessionCounter {
  countLiveOrPausedOnActiveSales(): Promise<number>;
}
