/** Magic-byte sniffing for upload validation (Strategy pattern). */

export interface IContentTypeValidator {
  readonly declaredType: string;
  matches(magic: Buffer): boolean;
}

function sniffImageMagic(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export class ImageContentTypeValidator implements IContentTypeValidator {
  constructor(readonly declaredType: "image/jpeg" | "image/png" | "image/webp") {}

  matches(magic: Buffer): boolean {
    return sniffImageMagic(magic) === this.declaredType;
  }
}

export class PdfContentTypeValidator implements IContentTypeValidator {
  readonly declaredType = "application/pdf";

  matches(magic: Buffer): boolean {
    return (
      magic.length >= 4 &&
      magic[0] === 0x25 &&
      magic[1] === 0x50 &&
      magic[2] === 0x44 &&
      magic[3] === 0x46
    );
  }
}

const VALIDATORS: readonly IContentTypeValidator[] = [
  new ImageContentTypeValidator("image/jpeg"),
  new ImageContentTypeValidator("image/png"),
  new ImageContentTypeValidator("image/webp"),
  new PdfContentTypeValidator(),
];

export function pickValidator(declared: string): IContentTypeValidator | undefined {
  return VALIDATORS.find((v) => v.declaredType === declared);
}
