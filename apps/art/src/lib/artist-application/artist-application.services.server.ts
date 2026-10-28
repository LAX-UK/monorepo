import { artCommerceMutationClient } from "@/lib/art-commerce-mutation.server";
import { artCommerceRequest } from "@/lib/art-commerce-request.server";
import type { ArtistApplicationGateway } from "./artist-application.port";
import { createBffArtistApplicationGateway } from "./bff-artist-application.gateway.server";

/** Composition root for the artist application pages, actions and the upload route. */
export const artistApplicationGateway: ArtistApplicationGateway = createBffArtistApplicationGateway(
  {
    read: (path) =>
      artCommerceRequest(
        path,
        { headers: { accept: "application/json" } },
        { applyCookies: false },
      ),
    mutation: artCommerceMutationClient,
  },
);
