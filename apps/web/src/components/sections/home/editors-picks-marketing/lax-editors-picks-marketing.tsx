import type { EditorsPickLotCardVM } from "@/components/sections/home/home-view-models";
import { EditorsPicksMarketingClient } from "./editors-picks-marketing-client";

type Props = {
  lots: EditorsPickLotCardVM[];
};

/** Server entry for the home “Editor’s Picks” strip; interactivity lives in the client layer. */
export function LaxEditorsPicksMarketing({ lots }: Props) {
  if (lots.length === 0) return null;
  return <EditorsPicksMarketingClient lots={lots} />;
}
