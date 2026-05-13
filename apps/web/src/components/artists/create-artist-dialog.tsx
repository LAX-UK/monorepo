"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { Textarea } from "@auction/ui/components/textarea";
import { useEffect, useState, useTransition } from "react";

export type CreatedArtist = {
  id: string;
  displayName: string;
  slug: string;
  status: "pending" | "approved" | "rejected" | "merged_into";
};

type Props = {
  open: boolean;
  initialName: string;
  onCreated: (artist: CreatedArtist) => void;
  onCancel: () => void;
  /** Pre-fill `kind` when the host already knows it (e.g. picker has the
   * "Maker" filter chip selected). */
  defaultKind?: Kind | undefined;
  /** When set, the new artist is linked to this user (e.g. submitter is the
   * maker). The dialog passes it through on submit; not user-editable. */
  ownerUserId?: string | null;
};

const KINDS = [
  { value: "artist", label: "Artist" },
  { value: "maker", label: "Maker" },
  { value: "brand", label: "Brand" },
  { value: "marque", label: "Marque" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

export function CreateArtistDialog({
  open,
  initialName,
  onCreated,
  onCancel,
  defaultKind,
  ownerUserId,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(initialName);
  const [kind, setKind] = useState<Kind>(defaultKind ?? "artist");
  const [shortBio, setShortBio] = useState("");
  const [nationality, setNationality] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [deathYear, setDeathYear] = useState("");
  const [nameStatus, setNameStatus] = useState<{
    available: boolean;
    suggestions: string[];
  } | null>(null);

  useEffect(() => {
    setDisplayName(initialName);
  }, [initialName]);

  useEffect(() => {
    if (!open) return;
    if (displayName.trim().length < 2) {
      setNameStatus(null);
      return;
    }
    const handle = setTimeout(async () => {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(
        `${apiBase}/artists/check-name?displayName=${encodeURIComponent(displayName)}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        data: { available: boolean; suggestions: string[] };
      };
      setNameStatus(body.data);
    }, 300);
    return () => clearTimeout(handle);
  }, [displayName, open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${apiBase}/artists`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          kind,
          ...(shortBio.trim() ? { shortBio: shortBio.trim() } : {}),
          ...(nationality.trim() ? { nationality: nationality.trim() } : {}),
          ...(birthYear.trim() ? { birthYear: birthYear.trim() } : {}),
          ...(deathYear.trim() ? { deathYear: deathYear.trim() } : {}),
          ...(ownerUserId ? { ownerUserId } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "create_failed");
        return;
      }
      const body = (await res.json()) as { data: CreatedArtist };
      onCreated(body.data);
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom modal manages its own open/close state; native <dialog> element does not fit our overlay/transition model.
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-artist-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-md border bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b p-4">
          <h2 id="create-artist-title" className="text-lg font-semibold">
            Create artist
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-on-surface-variant hover:text-on-surface"
            aria-label="Cancel"
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div className="space-y-2">
            <Label htmlFor="ca-name">Name</Label>
            <Input
              id="ca-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              maxLength={200}
              autoFocus
            />
            {nameStatus && (
              <p
                className={`text-xs ${nameStatus.available ? "text-success" : "text-destructive"}`}
              >
                {nameStatus.available
                  ? "Slug available."
                  : `Slug taken. Suggestions: ${nameStatus.suggestions.join(", ")}`}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-kind">Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger id="ca-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ca-nationality">Nationality</Label>
              <Input
                id="ca-nationality"
                value={nationality}
                onChange={(e) => setNationality(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ca-birth">Birth year</Label>
              <Input
                id="ca-birth"
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="ca-death">Death year (optional)</Label>
              <Input
                id="ca-death"
                value={deathYear}
                onChange={(e) => setDeathYear(e.target.value)}
                maxLength={10}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ca-bio">Short bio (optional)</Label>
            <Textarea
              id="ca-bio"
              value={shortBio}
              onChange={(e) => setShortBio(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="tertiary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create artist"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
