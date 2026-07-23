"use client";

import type { SalePressMentionType } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DatePicker } from "@auction/ui/components/date-picker";
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

export type PressFormState = {
  url: string;
  headline: string;
  outletName: string;
  publishedAt: string;
  excerpt: string;
  mentionType: SalePressMentionType | "";
};

export const EMPTY_PRESS_FORM: PressFormState = {
  url: "",
  headline: "",
  outletName: "",
  publishedAt: "",
  excerpt: "",
  mentionType: "",
};

export const MENTION_TYPE_OPTIONS: { value: SalePressMentionType; label: string }[] = [
  { value: "feature", label: "Feature" },
  { value: "interview", label: "Interview" },
  { value: "quote", label: "Quote" },
  { value: "roundup", label: "Roundup" },
];

const NO_MENTION_TYPE = "__none__";

type Props = {
  form: PressFormState;
  onChange: (next: PressFormState) => void;
  onAdd: () => void;
  saving?: boolean;
};

export function PressMentionForm({ form, onChange, onAdd, saving = false }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="press-url">Article URL *</Label>
          <Input
            id="press-url"
            type="url"
            variant="underline"
            placeholder="https://dailymail.co.uk/article/..."
            value={form.url}
            onChange={(e) => onChange({ ...form, url: e.target.value })}
            disabled={saving}
            className="mt-1 font-body text-sm"
          />
        </div>
        <div>
          <Label htmlFor="press-outlet">Outlet name *</Label>
          <Input
            id="press-outlet"
            type="text"
            variant="underline"
            placeholder="Daily Mail"
            maxLength={200}
            value={form.outletName}
            onChange={(e) => onChange({ ...form, outletName: e.target.value })}
            disabled={saving}
            className="mt-1 font-body text-sm"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="press-headline">Headline *</Label>
        <Input
          id="press-headline"
          type="text"
          variant="underline"
          placeholder="Article headline as published"
          maxLength={500}
          value={form.headline}
          onChange={(e) => onChange({ ...form, headline: e.target.value })}
          disabled={saving}
          className="mt-1 font-body text-sm"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="press-date">Publication date</Label>
          <DatePicker
            id="press-date"
            value={form.publishedAt}
            onChange={(value) => onChange({ ...form, publishedAt: value })}
            disabled={saving}
            placeholder="Pick a date"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="press-type">Mention type</Label>
          <Select
            value={form.mentionType || NO_MENTION_TYPE}
            onValueChange={(value) =>
              onChange({
                ...form,
                mentionType: value === NO_MENTION_TYPE ? "" : (value as SalePressMentionType),
              })
            }
            disabled={saving}
          >
            <SelectTrigger
              id="press-type"
              variant="underline"
              className="mt-1 w-full font-body text-sm"
            >
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_MENTION_TYPE}>— select type —</SelectItem>
              {MENTION_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="press-excerpt">
          Excerpt / pull quote
          <span className="ml-1 font-body font-normal normal-case text-on-surface-variant/50">
            ({(form.excerpt ?? "").length}/280)
          </span>
        </Label>
        <Textarea
          id="press-excerpt"
          variant="underline"
          placeholder="Short quote or summary from the article (max 280 chars)"
          maxLength={280}
          rows={2}
          value={form.excerpt ?? ""}
          onChange={(e) => onChange({ ...form, excerpt: e.target.value })}
          disabled={saving}
          className="mt-1 font-body text-sm"
        />
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAdd}
          disabled={saving || !form.url.trim() || !form.headline.trim() || !form.outletName.trim()}
        >
          Add link
        </Button>
      </div>
    </div>
  );
}
