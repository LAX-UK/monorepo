import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
  ImportArtworkResult,
} from "../ports/artwork-import.writer.js";

export type ImportArtworkHandler = (command: ImportArtworkCommand) => Promise<ImportArtworkResult>;

function normalizeMedium(medium: string | null | undefined): string | null | undefined {
  if (medium === undefined || medium === null) return medium;
  const trimmed = medium.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function createImportArtworkHandler(writer: ArtworkImportWriter): ImportArtworkHandler {
  return (command) => {
    const medium = normalizeMedium(command.medium);
    return writer.importArtwork({
      ...command,
      ...(medium !== undefined ? { medium } : {}),
    });
  };
}
