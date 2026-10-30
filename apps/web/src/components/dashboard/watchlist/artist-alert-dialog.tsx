"use client";

import {
  type ArtistAlertClient,
  defaultArtistAlertClient,
} from "@/lib/data/http/artist-watchlist.client";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { notify } from "@/lib/ui/notify";
import {
  type ArtistAlertDraft,
  artistAlertDraft,
  parseArtistAlertDraft,
} from "@/lib/watching/artist-alert";
import { type ArtistAlertCriteria, EMPTY_ARTIST_ALERT_CRITERIA } from "@auction/domain";
import { Button, Dialog, DialogClose, Field, Notice, TextInput } from "@auction/ui/lax";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

/**
 * The alert for an artist the person follows: words the medium must contain and a price range.
 * Every field is optional; with none set, every new work by the artist is an alert. "Remove
 * alert" clears the criteria, so the person keeps following and hears about every work.
 */
export function ArtistAlertDialog({
  open,
  onOpenChange,
  artist,
  onSaved,
  client = defaultArtistAlertClient,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artist: { id: string; name: string; alert: ArtistAlertCriteria } | null;
  onSaved: () => void;
  client?: ArtistAlertClient;
}) {
  const [draft, setDraft] = useState<ArtistAlertDraft>(
    artistAlertDraft(EMPTY_ARTIST_ALERT_CRITERIA),
  );
  const [errors, setErrors] = useState<Partial<Record<"priceMin" | "priceMax", string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    if (open && artist) {
      setDraft(artistAlertDraft(artist.alert));
      setErrors({});
      setFailure(null);
    }
  }, [open, artist]);

  if (!artist) return null;
  const hasCriteria = Boolean(
    artist.alert.medium || artist.alert.priceMin || artist.alert.priceMax,
  );

  const save = (criteria: ArtistAlertCriteria, message: string) =>
    start(async () => {
      setFailure(null);
      const result = await client.setAlert(artist.id, criteria);
      if (!result.ok) {
        setFailure(result.message);
        return;
      }
      notify.success(message);
      onOpenChange(false);
      onSaved();
    });
  const submit = () => {
    const parsed = parseArtistAlertDraft(draft);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    save(parsed.criteria, "Alert saved");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Alert for ${artist.name}`}
      description={`We'll tell you when works by ${artist.name} that match come up for sale.`}
      footer={
        <>
          {hasCriteria ? (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={saving}
              onClick={() =>
                save(
                  EMPTY_ARTIST_ALERT_CRITERIA,
                  "Alert removed. You'll hear about every new work.",
                )
              }
            >
              Remove alert
            </Button>
          ) : null}
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button variant="primary" loading={saving} onClick={submit}>
            Save alert
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field
          label="Medium"
          optional
          description="Words in the medium, like oil, watercolour or screenprint."
        >
          <TextInput
            value={draft.medium}
            maxLength={80}
            onChange={(event) => setDraft({ ...draft, medium: event.target.value })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Lowest estimate" optional error={errors.priceMin ?? null}>
            <TextInput
              inputMode="decimal"
              leading={<span className="text-lax-muted">£</span>}
              value={draft.priceMin}
              placeholder="No minimum"
              onChange={(event) => setDraft({ ...draft, priceMin: event.target.value })}
            />
          </Field>
          <Field label="Highest estimate" optional error={errors.priceMax ?? null}>
            <TextInput
              inputMode="decimal"
              leading={<span className="text-lax-muted">£</span>}
              value={draft.priceMax}
              placeholder="No limit"
              onChange={(event) => setDraft({ ...draft, priceMax: event.target.value })}
            />
          </Field>
        </div>
        {failure ? <Notice tone="danger" alert title={failure} /> : null}
        <p className="text-lax-13 text-lax-muted">
          Alerts reach you by email and in the app.{" "}
          <Link
            href={CLIENT_ROUTES.settings}
            className="text-lax-fg underline underline-offset-4 lax-focus"
          >
            Change in Bid settings
          </Link>
        </p>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Dialog>
  );
}
