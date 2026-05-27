"use client";

import { adminCreateArtistResultAction } from "@/lib/actions/admin";
import { apiBaseUrl } from "@/lib/auth/api-base";
import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
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
  /** When true, creates an approved profile (submission decision flow). */
  approveOnCreate?: boolean;
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
  approveOnCreate = false,
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
    const controller = new AbortController();
    const handle = setTimeout(async () => {
      const apiBase = apiBaseUrl();
      try {
        const res = await fetch(
          `${apiBase}/artists/check-name?displayName=${encodeURIComponent(displayName)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) return;
        const body = (await res.json()) as {
          data: { available: boolean; suggestions: string[] };
        };
        setNameStatus(body.data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }, 300);
    return () => {
      clearTimeout(handle);
      controller.abort();
    };
  }, [displayName, open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await adminCreateArtistResultAction({
        displayName: displayName.trim(),
        kind,
        ...(approveOnCreate ? { status: "approved" as const } : {}),
        ...(shortBio.trim() ? { shortBio: shortBio.trim() } : {}),
        ...(nationality.trim() ? { nationality: nationality.trim() } : {}),
        ...(birthYear.trim() ? { birthYear: birthYear.trim() } : {}),
        ...(deathYear.trim() ? { deathYear: deathYear.trim() } : {}),
        ...(ownerUserId ? { ownerUserId } : {}),
      });
      if (!result.ok) {
        const fieldMessage =
          result.fieldErrors?.displayName?.[0] ??
          result.fieldErrors?.kind?.[0] ??
          result.fieldErrors?.shortBio?.[0];
        setError(fieldMessage ?? result.error);
        return;
      }
      const createdId = result.data?.id;
      if (!createdId) {
        setError("Artist was created but no id was returned");
        return;
      }
      onCreated({
        id: createdId,
        displayName: displayName.trim(),
        status: approveOnCreate ? "approved" : "pending",
      });
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onCancel();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create artist</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="tertiary" onClick={onCancel} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create artist"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
