declare module "sharp" {
  type SharpInstance = {
    metadata(): Promise<{ width?: number; height?: number }>;
    resize(
      width: number,
      height: undefined,
      options?: { withoutEnlargement?: boolean },
    ): SharpInstance;
    blur(sigma: number): SharpInstance;
    webp(options: { quality: number }): SharpInstance;
    toBuffer(): Promise<Buffer>;
  };
  function sharp(input: Buffer): SharpInstance;
  export default sharp;
}
