/** Port for server-side image analysis and LQIP generation (DIP). */
export type ImageDimensions = {
  width: number;
  height: number;
};

export type ImageProcessor = {
  analyze(buffer: Buffer): Promise<ImageDimensions>;
  makeLqip(buffer: Buffer): Promise<string>;
};
