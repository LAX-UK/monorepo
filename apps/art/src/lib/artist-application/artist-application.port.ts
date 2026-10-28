import type {
  ArtistApplicationBlockerView,
  MyArtistApplication,
  MyArtistApplicationState,
  SaveArtistApplicationBody,
} from "@auction/shop-contracts";

/**
 * What one call to the application API answered: done; the visitor is not signed in; refused
 * with a reason the form can show (and, for an incomplete send, what is missing); or not reached.
 */
export type ArtistApplicationResult<T> =
  | { kind: "ok"; value: T }
  | { kind: "signed_out" }
  | {
      kind: "refused";
      status: number;
      message: string;
      blockers: readonly ArtistApplicationBlockerView[] | null;
    }
  | { kind: "unavailable" };

export type ArtistApplicationImageUpload = {
  bytes: ArrayBuffer;
  contentType: string;
};

/** The signed-in artist's application, through the lax.art identity BFF. */
export interface ArtistApplicationGateway {
  readState(): Promise<ArtistApplicationResult<MyArtistApplicationState>>;
  /** Starts a draft, or returns the open one. */
  start(): Promise<ArtistApplicationResult<MyArtistApplication>>;
  save(
    id: string,
    body: SaveArtistApplicationBody,
  ): Promise<ArtistApplicationResult<MyArtistApplication>>;
  submit(
    id: string,
    expectedVersion: number,
  ): Promise<ArtistApplicationResult<MyArtistApplication>>;
  /** Signs an upload, sends the file to storage, and adds it to the application once checked. */
  uploadImage(
    id: string,
    image: ArtistApplicationImageUpload,
  ): Promise<ArtistApplicationResult<MyArtistApplication>>;
}
