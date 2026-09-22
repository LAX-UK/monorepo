import type {
  ArtworkImportWriter,
  ImportArtworkCommand,
  ImportArtworkResult,
} from "../ports/artwork-import.writer.js";

export type ImportArtworkHandler = (command: ImportArtworkCommand) => Promise<ImportArtworkResult>;

export function createImportArtworkHandler(writer: ArtworkImportWriter): ImportArtworkHandler {
  return (command) => writer.importArtwork(command);
}
