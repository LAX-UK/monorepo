import type { EditorialRepository } from "./application/ports/editorial.repository.js";

export type EditorialRoutesDeps = {
  editorial: EditorialRepository;
  previewSecret: string;
};
