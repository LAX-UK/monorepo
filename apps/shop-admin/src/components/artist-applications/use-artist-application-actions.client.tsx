"use client";

import { adminMutationErrorMessage } from "@/lib/admin-mutation-message";
import {
  acceptArtistApplication,
  assignArtistApplication,
  declineArtistApplication,
  requestArtistApplicationInformation,
} from "@/server/application/admin-artist-application-actions.server";
import type { AdminMutationResult } from "@/server/application/admin-mutation-result";
import type {
  AdminArtistApplicationActionResponse,
  ArtistApplicationReviewer,
} from "@auction/shop-contracts";
import { ARTIST_APPLICATION_LIMITS } from "@auction/shop-domain";
import { ConfirmActionDialog, toast } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ArtistApplicationTarget } from "./artist-application-target";

export type { ArtistApplicationTarget } from "./artist-application-target";
import {
  AcceptArtistApplicationDialog,
  type AcceptChoices,
} from "./accept-artist-application-dialog.client";

type Result = AdminMutationResult<AdminArtistApplicationActionResponse>;
type Dialog = "accept" | "decline" | "request_info" | null;

/** A dialog closes once its change is saved, or when a newer copy means the page must reload. */
const finished = (result: Result) =>
  result.ok || (result.kind === "conflict" && Boolean(result.currentVersion));

/**
 * An application's review actions, the same from the queue and from the record page: assign,
 * ask for more information, accept and decline. Each is saved against the version the screen was
 * rendered with; when someone else got there first nothing is written and `conflict` is set, for
 * the screen to offer a reload.
 */
export function useArtistApplicationActions({ currentSubject }: { currentSubject: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<{ kind: Dialog; target: ArtistApplicationTarget } | null>(
    null,
  );
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const run = useCallback(
    async (call: () => Promise<Result>, done: { title: string; failTitle: string }) => {
      setPending(true);
      setConflict(false);
      const result = await call().catch(
        () =>
          ({ ok: false, kind: "failed", message: "The change did not save. Try again." }) as const,
      );
      setPending(false);
      if (!result.ok) {
        if (result.kind === "conflict" && result.currentVersion) setConflict(true);
        else toast.error(done.failTitle, { description: adminMutationErrorMessage(result) });
        return result;
      }
      toast.success(done.title);
      router.refresh();
      return result;
    },
    [router],
  );

  const assign = (
    target: ArtistApplicationTarget,
    person: ArtistApplicationReviewer | null,
    personName: string,
  ) =>
    run(
      () =>
        assignArtistApplication({
          id: target.id,
          expectedVersion: target.version,
          assigneeSubject: person?.subject ?? null,
        }),
      {
        title:
          person?.subject === currentSubject
            ? "Assigned to you"
            : person
              ? `Assigned to ${personName}`
              : "Reviewer removed",
        failTitle: person ? "Could not assign" : "Could not remove the reviewer",
      },
    );

  const assignToMe = (target: ArtistApplicationTarget) =>
    run(
      () =>
        assignArtistApplication({
          id: target.id,
          expectedVersion: target.version,
          assigneeSubject: currentSubject,
        }),
      { title: "Assigned to you", failTitle: "Could not assign" },
    );

  const close = () => {
    setDialog(null);
    setAcceptError(null);
  };

  const target = dialog?.target ?? null;

  const dialogs = target ? (
    <>
      <ConfirmActionDialog
        open={dialog?.kind === "request_info"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={`Ask ${target.title} for more information?`}
        description="The artist gets your note by email and can change the application and send it back. It stays assigned to the same reviewer."
        confirmLabel="Send to the artist"
        loading={pending}
        reason={{
          label: "Note to the artist",
          description: "The artist reads this exactly as you write it.",
          maxLength: ARTIST_APPLICATION_LIMITS.messageToArtist,
          missingMessage: "Write what you would like the artist to add.",
          placeholder: "For example: could you add a photograph of the work in a room?",
        }}
        onConfirm={async ({ reason }) => {
          const result = await run(
            () =>
              requestArtistApplicationInformation({
                id: target.id,
                expectedVersion: target.version,
                message: reason,
              }),
            { title: "Sent to the artist", failTitle: "Could not send" },
          );
          if (finished(result)) close();
        }}
      />
      <ConfirmActionDialog
        open={dialog?.kind === "decline"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        title={`Decline ${target.title}?`}
        description="The artist gets your reason by email and can apply again in six months. This cannot be undone."
        confirmLabel="Decline application"
        tone="danger"
        loading={pending}
        reason={{
          label: "Reason for the artist",
          description: "Sent to the artist and kept on the application. Be kind and specific.",
          maxLength: ARTIST_APPLICATION_LIMITS.messageToArtist,
          missingMessage: "Write the reason the artist will read.",
        }}
        onConfirm={async ({ reason }) => {
          const result = await run(
            () =>
              declineArtistApplication({
                id: target.id,
                expectedVersion: target.version,
                reason,
              }),
            { title: "Application declined", failTitle: "Could not decline" },
          );
          if (finished(result)) close();
        }}
      />
      <AcceptArtistApplicationDialog
        open={dialog?.kind === "accept"}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        target={target}
        loading={pending}
        error={acceptError}
        onAccept={async (choices: AcceptChoices) => {
          setAcceptError(null);
          setPending(true);
          const result = await acceptArtistApplication({
            id: target.id,
            expectedVersion: target.version,
            ...choices,
          }).catch(
            () =>
              ({
                ok: false,
                kind: "failed",
                message: "The application was not accepted. Try again.",
              }) as const,
          );
          setPending(false);
          if (!result.ok) {
            if (result.kind === "conflict" && result.currentVersion) {
              setConflict(true);
              close();
            } else {
              setAcceptError(adminMutationErrorMessage(result));
            }
            return;
          }
          const imported = result.data.importedArtworkCount ?? 0;
          toast.success(`${target.title} is now a gallery artist`, {
            description:
              imported > 0
                ? `${imported} draft ${imported === 1 ? "artwork" : "artworks"} added. The welcome email is on its way.`
                : "The welcome email is on its way.",
          });
          close();
          router.refresh();
        }}
      />
    </>
  ) : null;

  return {
    pending,
    conflict,
    dismissConflict: () => setConflict(false),
    reload: () => {
      setConflict(false);
      router.refresh();
    },
    assign,
    assignToMe,
    requestAccept: (next: ArtistApplicationTarget) => setDialog({ kind: "accept", target: next }),
    requestDecline: (next: ArtistApplicationTarget) => setDialog({ kind: "decline", target: next }),
    requestInformation: (next: ArtistApplicationTarget) =>
      setDialog({ kind: "request_info", target: next }),
    dialogs,
  };
}

export type ArtistApplicationActions = ReturnType<typeof useArtistApplicationActions>;
