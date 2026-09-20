import { MediaImageServer, type MediaImageServerProps } from "@auction/marketing-ui";

export type ShopMediaImageServerProps = MediaImageServerProps;

/** Server-rendered Shop media with shared LAX placeholder pattern. */
export function ShopMediaImage(props: ShopMediaImageServerProps) {
  return <MediaImageServer {...props} />;
}
