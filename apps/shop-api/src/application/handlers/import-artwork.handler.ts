import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
  ImportArtworkResult,
} from "../ports/artwork-import.writer.js";

export type ImportArtworkHandler = (command: ImportArtworkCommand) => Promise<ImportArtworkResult>;

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

const OPTIONAL_TEXT_FIELDS = ["medium", "seoTitle", "seoDescription"] as const;

export function createImportArtworkHandler(writer: ArtworkImportWriter): ImportArtworkHandler {
  return (command) => {
    const normalized: Partial<Pick<ImportArtworkCommand, (typeof OPTIONAL_TEXT_FIELDS)[number]>> =
      {};
    for (const field of OPTIONAL_TEXT_FIELDS) {
      const value = normalizeOptionalText(command[field]);
      if (value !== undefined) normalized[field] = value;
    }
    return writer.importArtwork({ ...command, ...normalized });
  };
}
