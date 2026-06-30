import { canTransition, evaluateLotReadiness, transitionErrorMessage } from "@auction/domain";
import type { ItemSubmission, Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { SubmissionError } from "../../lib/errors.js";
import { insertArtistInTx } from "../artist-registry.service.js";
import type { ApproveSubmissionInput } from "../interfaces/item-submission-service.js";
import { resolveLegalEntityNotificationRecipients } from "../legal-entity-notification-routing.js";
import { submissionToCreateLotInput } from "../submission-to-lot.mapper.js";
import { txRepos } from "./submission-mutation-context.js";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export async function convert(
  deps: ItemSubmissionServiceDeps,
  adminId: string,
  id: string,
  input: ApproveSubmissionInput | undefined = undefined,
): Promise<
  Result<{ submission: ItemSubmission; lot: Lot; readinessPercent: number }, SubmissionError>
> {
  const reviewNotes = input?.reviewNotes;
  const requestedArtistId = input?.artistId ?? null;
  const newArtist = input?.newArtist;
  if (requestedArtistId && newArtist) {
    return err(new SubmissionError("Provide either artistId or newArtist, not both", 400));
  }
  try {
    const { lot, submission, legalEntityId, title, readinessPercent } = await deps.db.transaction(
      async (tx) => {
        const subRepo = txRepos(deps, tx).itemSubmission;
        const lotRepo = txRepos(deps, tx).lot;
        const s = await subRepo.findById(id);
        if (!s) {
          throw new SubmissionError("Not found", 404);
        }
        if (!canTransition(s.status, "convert")) {
          throw new SubmissionError(transitionErrorMessage(s.status, "convert"));
        }
        if (!s.legalEntityId) {
          throw new SubmissionError("Legal entity context missing", 400);
        }
        let artistId: string | null = requestedArtistId ?? null;
        if (newArtist) {
          const created = await insertArtistInTx(tx, adminId, {
            displayName: newArtist.displayName,
            kind: newArtist.kind ?? "artist",
            shortBio: newArtist.shortBio,
            ownerUserId: newArtist.ownerUserId ?? null,
            status: "approved",
          });
          artistId = created.id;
        }
        const lotInput = submissionToCreateLotInput(s);
        const createdLot = await lotRepo.create({
          ...lotInput,
          sellerLegalEntityId: s.legalEntityId,
          artistId,
        });
        if (deps.lotLifecycleRecording) {
          await deps.lotLifecycleRecording.recordCreated(tx, {
            lot: createdLot,
            source: "submission",
            actorUserId: adminId,
          });
        }
        const submission = await subRepo.update(id, {
          status: "converted",
          convertedLotId: createdLot.id,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          ...(reviewNotes?.trim() ? { reviewNotes: reviewNotes.trim() } : {}),
          rejectionReason: null,
        });
        const readiness = evaluateLotReadiness(createdLot);
        return {
          lot: createdLot,
          submission,
          legalEntityId: s.legalEntityId,
          title: s.title,
          readinessPercent: readiness.percent,
        };
      },
    );
    const recipients = await resolveLegalEntityNotificationRecipients(
      deps.legalEntityNotificationRecipients,
      { legalEntityId, fallbackUserId: legalEntityId, audience: "seller" },
    );
    for (const recipientId of recipients) {
      await deps.dispatcher.dispatch(recipientId, {
        type: "submission_converted",
        title: "Draft lot created",
        message: `A draft catalogue lot was created for "${title}". Complete any remaining steps in your seller dashboard.`,
        lotId: lot.id,
        submissionId: id,
        meta: { lotTitle: title },
      });
    }
    return ok({ submission, lot, readinessPercent });
  } catch (e) {
    if (e instanceof SubmissionError) {
      return err(e);
    }
    throw e;
  }
}
