/** biome-ignore lint/style/useImportType: `typeof` needs the schema value for `z.infer`. */
import { adminCreateArtistBodySchema } from "@auction/validators";
import type { Control } from "react-hook-form";
import type { z } from "zod";

export type ArtistFormValues = z.infer<typeof adminCreateArtistBodySchema>;

/** Admin create/edit flow: catalogue-only vs linked platform user (seller is the maker). */
export type ArtistScenario = "historical" | "maker-seller";

export type ArtistPreviewData = {
  displayName: string;
  kindLabel: string;
  shortBio: string;
  portraitUrl: string;
};

export type ArtistFormSectionProps = {
  control: Control<ArtistFormValues>;
  disabled?: boolean;
};
