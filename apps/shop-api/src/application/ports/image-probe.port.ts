export type ImageDimensions = { width: number; height: number };

export type ImageProbePort = {
  analyze(buffer: Buffer): Promise<ImageDimensions>;
  makeLqip(buffer: Buffer): Promise<string>;
};
