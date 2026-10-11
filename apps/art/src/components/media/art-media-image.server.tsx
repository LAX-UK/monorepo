import { MediaImageServer, type MediaImageServerProps } from "@auction/marketing-ui";

export type ArtMediaImageServerProps = MediaImageServerProps;

/** Server-rendered lax.art media with the shared LAX placeholder pattern. */
export function ArtMediaImage(props: ArtMediaImageServerProps) {
  return <MediaImageServer {...props} />;
}
