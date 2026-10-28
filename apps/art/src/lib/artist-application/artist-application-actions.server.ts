"use server";

import type {
  ArtistApplicationBlockerView,
  MyArtistApplication,
  SaveArtistApplicationBody,
} from "@auction/shop-contracts";
import type { ArtistApplicationResult } from "./artist-application.port";
import { artistApplicationGateway } from "./artist-application.services.server";

/** What the form hears back from a save or a send. */
export type ArtistApplicationActionResult =
  | { ok: true; application: MyArtistApplication }
  | {
      ok: false;
      reason: "signed_out" | "stale" | "refused" | "unavailable";
      message: string;
      blockers?: readonly ArtistApplicationBlockerView[];
    };

const MESSAGES = {
  signed_out: "Your session has ended. Sign in again to keep going; your answers are saved.",
  stale: "Your application changed in another window. Reload to see the latest version.",
  unavailable: "We could not save your application just now. Check your connection and try again.",
} as const;

function toAction(
  result: ArtistApplicationResult<MyArtistApplication>,
): ArtistApplicationActionResult {
  switch (result.kind) {
    case "ok":
      return { ok: true, application: result.value };
    case "signed_out":
      return { ok: false, reason: "signed_out", message: MESSAGES.signed_out };
    case "unavailable":
      return { ok: false, reason: "unavailable", message: MESSAGES.unavailable };
    case "refused":
      return result.status === 409 && /changed/i.test(result.message)
        ? { ok: false, reason: "stale", message: MESSAGES.stale }
        : { ok: false, reason: "refused", message: result.message };
  }
}

/**
 * Saves the form's answers. The first save starts the application, so an artist never has to
 * press "Start" before they can type.
 */
export async function saveArtistApplication(input: {
  id: string | null;
  body: SaveArtistApplicationBody;
}): Promise<ArtistApplicationActionResult> {
  let id = input.id;
  let version = input.body.expectedVersion;
  if (!id) {
    const started = await artistApplicationGateway.start();
    if (started.kind !== "ok") return toAction(started);
    id = started.value.id;
    version = started.value.version;
  }
  return toAction(
    await artistApplicationGateway.save(id, { ...input.body, expectedVersion: version }),
  );
}

/**
 * Sends the application. A refusal for missing answers comes back with what is missing, read from
 * the application itself, so the form can take the artist straight to it.
 */
export async function submitArtistApplication(input: {
  id: string;
  expectedVersion: number;
}): Promise<ArtistApplicationActionResult> {
  const sent = await artistApplicationGateway.submit(input.id, input.expectedVersion);
  if (sent.kind === "refused" && sent.status === 400) {
    const state = await artistApplicationGateway.readState();
    const blockers = state.kind === "ok" ? (state.value.application?.blockers ?? []) : [];
    return {
      ok: false,
      reason: "refused",
      message: "Some answers are missing. Each one is listed below.",
      blockers,
    };
  }
  return toAction(sent);
}
