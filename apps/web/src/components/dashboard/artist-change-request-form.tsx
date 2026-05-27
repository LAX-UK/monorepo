"use client";

import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Surface } from "@auction/ui/components/surface";
import { Textarea } from "@auction/ui/components/textarea";
import { ArrowRight, Send } from "lucide-react";
import { useId, useMemo, useState } from "react";

type ChangeKind = "portrait" | "biography" | "attribution" | "links" | "other";

const CHANGE_KIND_OPTIONS: Array<{ value: ChangeKind; label: string; helper: string }> = [
  { value: "portrait", label: "Portrait", helper: "Update or replace the headshot." },
  { value: "biography", label: "Biography", helper: "Edit dates, education, exhibitions." },
  { value: "attribution", label: "Attribution", helper: "Correct school, period, or maker." },
  { value: "links", label: "External links", helper: "Add gallery, archive, or estate URL." },
  { value: "other", label: "Other", helper: "Anything not covered above." },
];

type ArtistChangeRequestFormProps = {
  recipient: string;
};

export function ArtistChangeRequestForm({ recipient }: ArtistChangeRequestFormProps) {
  const titleId = useId();
  const kindId = useId();
  const artistId = useId();
  const detailsId = useId();
  const evidenceId = useId();

  const [artistName, setArtistName] = useState("");
  const [kind, setKind] = useState<ChangeKind>("biography");
  const [details, setDetails] = useState("");
  const [evidence, setEvidence] = useState("");

  const mailtoHref = useMemo(() => {
    const subjectBase = "Artist profile change request";
    const subject =
      artistName.trim().length > 0 ? `${subjectBase} — ${artistName.trim()}` : subjectBase;
    const kindLabel = CHANGE_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? "Other";
    const body = [
      `Artist / maker: ${artistName.trim() || "(please add)"}`,
      `Change type: ${kindLabel}`,
      "",
      "Requested change:",
      details.trim() || "(describe the change you'd like)",
      "",
      "Supporting evidence or references:",
      evidence.trim() || "(links, dates, or sources we can verify)",
    ].join("\n");
    const params = new URLSearchParams({ subject, body });
    return `mailto:${recipient}?${params.toString().replace(/\+/g, "%20")}`;
  }, [artistName, kind, details, evidence, recipient]);

  const submitDisabled = artistName.trim().length === 0 || details.trim().length < 8;

  return (
    <Surface
      variant="section"
      padding="md"
      className="space-y-5 border-border-hairline bg-surface-container-lowest/80 shadow-sm"
      id={titleId}
    >
      <header className="space-y-1">
        <h2 className="font-headline text-lg font-semibold text-on-surface">Request a change</h2>
        <p className="font-body text-sm text-on-surface-variant">
          Send a structured request to the catalogue team. We&apos;ll reply once a specialist has
          reviewed the update.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={artistId}>Artist / maker name</Label>
          <Input
            id={artistId}
            value={artistName}
            onChange={(event) => setArtistName(event.target.value)}
            placeholder="e.g. Hossein Zenderoudi"
            maxLength={120}
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={kindId}>What needs to change?</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as ChangeKind)}>
            <SelectTrigger id={kindId} className="h-11 w-full font-body text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANGE_KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="font-body text-xs text-on-surface-variant">
            {CHANGE_KIND_OPTIONS.find((o) => o.value === kind)?.helper}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={detailsId}>Requested change</Label>
        <Textarea
          id={detailsId}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Describe the exact change — corrected text, new portrait link, attribution wording, etc."
          required
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={evidenceId}>Supporting evidence (optional)</Label>
        <Textarea
          id={evidenceId}
          value={evidence}
          onChange={(event) => setEvidence(event.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Add gallery URLs, scholarly references, or any sources we can verify."
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" asChild={!submitDisabled} disabled={submitDisabled}>
          {submitDisabled ? (
            <span className="inline-flex items-center gap-2">
              <Send className="size-4" aria-hidden /> Send request
            </span>
          ) : (
            <a href={mailtoHref} className="inline-flex items-center gap-2">
              <Send className="size-4" aria-hidden /> Send request{" "}
              <ArrowRight className="size-4" aria-hidden />
            </a>
          )}
        </Button>
        <p className="font-body text-xs text-on-surface-variant">
          Submitting opens your email client with a pre-filled draft. We act on requests within 2
          working days.
        </p>
      </div>
    </Surface>
  );
}
