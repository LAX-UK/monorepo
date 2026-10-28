"use server";

import type { AdminArtistApplicationActionResponse } from "@auction/shop-contracts";
import { ARTIST_APPLICATION_LIMITS } from "@auction/shop-domain";
import { ARTIST_SLUG_PATTERN } from "../domain/artist-application.vm";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result = AdminMutationResult<AdminArtistApplicationActionResponse>;

const invalid = (message: string): Result => ({ ok: false, kind: "validation", message });

/** Every action names the application and the version the screen was rendered with. */
type Target = { id: string; expectedVersion: number };

function actionPath(target: Target, action: string): string | null {
  return UUID_PATTERN.test(target.id) && Number.isInteger(target.expectedVersion)
    ? `artist-applications/${target.id}/${action}`
    : null;
}

function noteOrError(text: string, missing: string): { note: string } | { error: Result } {
  const note = text.trim();
  if (!note) return { error: invalid(missing) };
  if (note.length > ARTIST_APPLICATION_LIMITS.messageToArtist) {
    return {
      error: invalid(
        `Keep the note under ${ARTIST_APPLICATION_LIMITS.messageToArtist.toLocaleString("en-GB")} characters.`,
      ),
    };
  }
  return { note };
}

export async function assignArtistApplication(
  input: Target & { assigneeSubject: string | null },
): Promise<Result> {
  const path = actionPath(input, "assign");
  if (!path) return invalid("Invalid application request.");
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion, assigneeSubject: input.assigneeSubject },
  });
}

export async function requestArtistApplicationInformation(
  input: Target & { message: string },
): Promise<Result> {
  const path = actionPath(input, "request-information");
  if (!path) return invalid("Invalid application request.");
  const checked = noteOrError(input.message, "Write what you would like the artist to add.");
  if ("error" in checked) return checked.error;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion, message: checked.note },
  });
}

export async function declineArtistApplication(
  input: Target & { reason: string },
): Promise<Result> {
  const path = actionPath(input, "decline");
  if (!path) return invalid("Invalid application request.");
  const checked = noteOrError(input.reason, "Write the reason the artist will read.");
  if ("error" in checked) return checked.error;
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: { expectedVersion: input.expectedVersion, message: checked.note },
  });
}

export async function acceptArtistApplication(
  input: Target & { artistSlug: string; importWorksAsDrafts: boolean },
): Promise<Result> {
  const path = actionPath(input, "accept");
  if (!path) return invalid("Invalid application request.");
  const artistSlug = input.artistSlug.trim();
  if (!ARTIST_SLUG_PATTERN.test(artistSlug) || artistSlug.length > 120) {
    return invalid("Use lower-case letters, numbers and single hyphens, like ada-moreno.");
  }
  return forwardAdminJsonMutation({
    bffPath: path,
    method: "POST",
    jsonBody: {
      expectedVersion: input.expectedVersion,
      artistSlug,
      importWorksAsDrafts: input.importWorksAsDrafts,
    },
  });
}
