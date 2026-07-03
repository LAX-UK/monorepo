"use client";

import {
  adminCreateOnsiteEventAction,
  adminUpdateOnsiteEventAction,
} from "@/lib/actions/admin/admin-onsite-event";
import type { SaleroomSalePickerOption } from "@/lib/admin/load-saleroom-sales-picker";
import type { OnsiteEventAdminDetail, OnsiteEventSegmentOption } from "@auction/types";
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
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  mode: "create" | "edit";
  initial?: OnsiteEventAdminDetail | null;
  saleroomSales?: SaleroomSalePickerOption[];
};

const DEFAULT_SEGMENTS: OnsiteEventSegmentOption[] = [
  { value: "full_evening", label: "Full evening" },
];

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function emptySegment(): OnsiteEventSegmentOption {
  return { value: "", label: "" };
}

export function OnsiteEventForm({ mode, initial = null, saleroomSales = [] }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [saleId, setSaleId] = useState(initial?.saleId ?? "");
  const [micrositeUrl, setMicrositeUrl] = useState(initial?.micrositeUrl ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [opsEmail, setOpsEmail] = useState(initial?.opsEmail ?? "");
  const [dressCode, setDressCode] = useState(initial?.dressCode ?? "");
  const [arrivalNote, setArrivalNote] = useState(initial?.arrivalNote ?? "");
  const [startsAt, setStartsAt] = useState(initial?.startsAt?.slice(0, 16) ?? "");
  const [rsvpCloseAt, setRsvpCloseAt] = useState(initial?.rsvpCloseAt?.slice(0, 16) ?? "");
  const [segmentOptions, setSegmentOptions] = useState<OnsiteEventSegmentOption[]>(
    initial?.segmentOptions.length ? initial.segmentOptions : DEFAULT_SEGMENTS,
  );

  const updateSegment = (index: number, patch: Partial<OnsiteEventSegmentOption>) => {
    setSegmentOptions((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const onSubmit = () => {
    setError(null);
    if (mode === "create" && !SLUG_PATTERN.test(slug.trim())) {
      setError("Slug must be lowercase letters, numbers, and hyphens only (e.g. lax002).");
      return;
    }
    const cleanedSegments = segmentOptions
      .map((row) => ({
        value: row.value.trim(),
        label: row.label.trim(),
        ...(row.helper?.trim() ? { helper: row.helper.trim() } : {}),
      }))
      .filter((row) => row.value && row.label);
    if (cleanedSegments.length === 0) {
      setError("Add at least one attendance segment with value and label.");
      return;
    }

    startTransition(async () => {
      const payload = {
        ...(mode === "create" ? { slug: slug.trim() } : { slug: initial?.slug ?? slug.trim() }),
        title: title.trim(),
        status,
        segmentOptions: cleanedSegments,
        saleId: saleId.trim() === "" ? null : saleId.trim(),
        micrositeUrl: micrositeUrl.trim() === "" ? null : micrositeUrl.trim(),
        venue: venue.trim() === "" ? null : venue.trim(),
        opsEmail: opsEmail.trim() === "" ? null : opsEmail.trim(),
        dressCode: dressCode.trim() === "" ? null : dressCode.trim(),
        arrivalNote: arrivalNote.trim() === "" ? null : arrivalNote.trim(),
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        rsvpCloseAt: rsvpCloseAt ? new Date(rsvpCloseAt).toISOString() : null,
      };

      const result =
        mode === "create"
          ? await adminCreateOnsiteEventAction(payload)
          : await adminUpdateOnsiteEventAction(payload);

      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (mode === "edit" && result.data) {
        router.push(`/admin/event-rsvps/${encodeURIComponent(result.data.slug)}`);
        router.refresh();
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/40 p-6">
      <div className="space-y-1">
        <h1 className="font-headline text-2xl font-semibold text-on-surface">
          {mode === "create" ? "Create event" : "Edit event"}
        </h1>
        <p className="font-body text-sm text-on-surface-variant">
          Link an invitation-only RSVP event to an onsite or hybrid sale for the expected-guests
          express lane. Date/time fields are saved in UTC.
        </p>
      </div>

      <div className="grid gap-4">
        {mode === "create" ? (
          <div className="space-y-1">
            <Label htmlFor="event-slug">Slug</Label>
            <Input
              id="event-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="lax002"
            />
            <p className="font-body text-xs text-on-surface-variant">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>
        ) : null}
        <div className="space-y-1">
          <Label htmlFor="event-title">Title</Label>
          <Input
            id="event-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Opening evening"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-status">Status</Label>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
            <SelectTrigger id="event-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-sale-id">Linked saleroom sale</Label>
          <Select
            value={saleId === "" ? "__none__" : saleId}
            onValueChange={(value) => setSaleId(value === "__none__" ? "" : value)}
          >
            <SelectTrigger id="event-sale-id">
              <SelectValue placeholder="No linked sale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No linked sale</SelectItem>
              {saleroomSales.map((sale) => (
                <SelectItem key={sale.id} value={sale.id}>
                  {sale.title} ({sale.deliveryMode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="font-body text-xs text-on-surface-variant">
            Link an onsite or hybrid sale to enable the expected-guests express lane at check-in.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Attendance segments</Label>
          {segmentOptions.map((segment, index) => (
            <div
              key={`${segment.value}-${index}`}
              className="grid gap-2 rounded-md border border-border-hairline p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  value={segment.value}
                  onChange={(e) => updateSegment(index, { value: e.target.value })}
                  placeholder="full_evening"
                  aria-label={`Segment ${index + 1} value`}
                />
                <Input
                  value={segment.label}
                  onChange={(e) => updateSegment(index, { label: e.target.value })}
                  placeholder="Full evening"
                  aria-label={`Segment ${index + 1} label`}
                />
              </div>
              <Input
                value={segment.helper ?? ""}
                onChange={(e) => updateSegment(index, { helper: e.target.value })}
                placeholder="Optional helper text"
                aria-label={`Segment ${index + 1} helper`}
              />
              {segmentOptions.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-fit text-destructive"
                  onClick={() =>
                    setSegmentOptions((rows) => rows.filter((_, rowIndex) => rowIndex !== index))
                  }
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove segment
                </Button>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSegmentOptions((rows) => [...rows, emptySegment()])}
          >
            <Plus className="mr-2 size-4" />
            Add segment
          </Button>
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-ops-email">Ops email</Label>
          <Input
            id="event-ops-email"
            type="email"
            value={opsEmail}
            onChange={(e) => setOpsEmail(e.target.value)}
            placeholder="events@lax.bid"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-microsite">Microsite URL</Label>
          <Input
            id="event-microsite"
            value={micrositeUrl}
            onChange={(e) => setMicrositeUrl(e.target.value)}
            placeholder="https://event.lax.bid/lax002"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-venue">Venue</Label>
          <Input id="event-venue" value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-dress-code">Dress code</Label>
          <Input
            id="event-dress-code"
            value={dressCode}
            onChange={(e) => setDressCode(e.target.value)}
            placeholder="Smart formal"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="event-arrival-note">Arrival note</Label>
          <Input
            id="event-arrival-note"
            value={arrivalNote}
            onChange={(e) => setArrivalNote(e.target.value)}
            placeholder="Doors 6:00 PM · Personal and non-transferable."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="event-starts">Starts at</Label>
            <Input
              id="event-starts"
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-rsvp-close">RSVP closes</Label>
            <Input
              id="event-rsvp-close"
              type="datetime-local"
              value={rsvpCloseAt}
              onChange={(e) => setRsvpCloseAt(e.target.value)}
            />
          </div>
        </div>
      </div>

      {error ? (
        <p className="font-body text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={onSubmit}>
          {pending ? "Saving…" : mode === "create" ? "Create event" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
