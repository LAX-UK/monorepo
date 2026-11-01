"use client";

import {
  type WatchlistReminderClient,
  defaultWatchlistReminderClient,
} from "@/lib/data/http/watchlist-reminders.client";
import { notify } from "@/lib/ui/notify";
import {
  type WatchedLotReminderVm,
  defaultReminderKind,
  reminderOptions,
} from "@/lib/watching/watched-lot-reminder.vm";
import { WATCHED_LOT_REMINDER_NOTE_MAX, type WatchedLotReminderKind } from "@auction/domain";
import { Button, Dialog, DialogClose, Field, Notice, PresetCards, TextArea } from "@auction/ui/lax";
import { useEffect, useState, useTransition } from "react";

type Lot = {
  lotId: string;
  title: string;
  startsAt: number;
  closesAt: number;
  reminder: WatchedLotReminderVm | null;
};

/**
 * The reminder and note on a watched lot: when to be reminded (as the sale starts, a day or an
 * hour before it closes) and a note only the person sees. A time that has passed can't be chosen.
 * Reminders arrive the way the person's watchlist alerts do (Bid settings).
 */
export function LotReminderDialog({
  lot,
  onOpenChange,
  onSaved,
  client = defaultWatchlistReminderClient,
  now = new Date(),
}: {
  /** The lot being edited; `null` keeps the dialog closed. */
  lot: Lot | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  client?: WatchlistReminderClient;
  now?: Date;
}) {
  const [kind, setKind] = useState<WatchedLotReminderKind | null>(null);
  const [note, setNote] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();

  // Each opening starts from the saved reminder, or the first time still to come.
  useEffect(() => {
    if (!lot) return;
    setKind(lot.reminder?.kind ?? defaultReminderKind(reminderOptions(lot, new Date())));
    setNote(lot.reminder?.note ?? "");
    setFailure(null);
  }, [lot]);

  if (!lot) return null;
  const options = reminderOptions(lot, now);
  const noneLeft = options.every((option) => option.disabledReason);
  const tooLong = note.trim().length > WATCHED_LOT_REMINDER_NOTE_MAX;

  const run = (work: () => Promise<boolean>, done: string) =>
    start(async () => {
      setFailure(null);
      if (!(await work())) {
        setFailure("We couldn't save the reminder. Try again in a moment.");
        return;
      }
      notify.success(done);
      onOpenChange(false);
      onSaved();
    });

  return (
    <Dialog
      open
      onOpenChange={(open) => (saving ? undefined : onOpenChange(open))}
      title={`Remind me about "${lot.title}"`}
      description="Only you see this reminder and note. It arrives the way your watchlist alerts do."
      footer={
        <>
          {lot.reminder ? (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => run(() => client.clear(lot.lotId), "Reminder removed")}
              className="md:mr-auto"
            >
              Remove reminder
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button disabled={saving}>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={saving}
            disabled={!kind || noneLeft || tooLong}
            onClick={() =>
              kind
                ? run(() => client.set(lot.lotId, { kind, note: note.trim() }), "Reminder set")
                : undefined
            }
          >
            Save reminder
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {noneLeft ? (
          <Notice tone="info" title="This lot closes too soon for a reminder." />
        ) : (
          <PresetCards
            label="When to remind you"
            value={kind ?? ""}
            onValueChange={(value) => setKind(value as WatchedLotReminderKind)}
            options={options}
            columns={1}
            compact
          />
        )}
        <Field
          label="Note"
          optional
          description="For example, what to check before you bid."
          error={tooLong ? `Keep the note to ${WATCHED_LOT_REMINDER_NOTE_MAX} characters.` : null}
        >
          <TextArea
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={saving}
          />
        </Field>
        {failure ? <Notice tone="danger" alert title={failure} /> : null}
      </div>
    </Dialog>
  );
}
