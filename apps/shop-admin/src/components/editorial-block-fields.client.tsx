"use client";

import { RailRelationFields } from "@/components/editorial/rail-relation-fields.client";
import { SelectField, TextAreaField, TextField } from "@/components/forms/fields";
import { MediaUploadField } from "@/components/media-upload-field";
import {
  type EditorialBlockOf,
  readSimpleText,
  simpleSpans,
  withOptionalText,
} from "@/lib/editorial-blocks";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import type { EditorialBlock } from "@auction/shop-contracts";
import { Button } from "@auction/ui";
import { useState } from "react";

type FieldsProps<B extends EditorialBlock> = {
  block: B;
  onChange: (next: B) => void;
  disabled: boolean;
};

const HREF_HINT = "https://…, mailto:… or a site path such as /visit";

function useListKeys(length: number) {
  const [keys, setKeys] = useState(() => Array.from({ length }, () => crypto.randomUUID()));
  return {
    keyAt: (index: number) => keys[index] ?? `pending-${index}`,
    add: () => setKeys((current) => [...current, crypto.randomUUID()]),
    remove: (index: number) => setKeys((current) => removeItem(current, index)),
    move: (index: number, direction: -1 | 1) =>
      setKeys((current) => moveItem(current, index, direction)),
  };
}

function ItemControls({
  label,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  label: string;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || index === 0}
        aria-label={`Move ${label} up`}
        onClick={() => onMove(-1)}
      >
        Up
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || index === count - 1}
        aria-label={`Move ${label} down`}
        onClick={() => onMove(1)}
      >
        Down
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || count <= 1}
        aria-label={`Remove ${label}`}
        onClick={onRemove}
      >
        Remove
      </Button>
    </div>
  );
}

function HeadingFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"heading">>) {
  return (
    <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
      <SelectField
        label="Level"
        value={String(block.level) as "2" | "3" | "4"}
        options={[
          { value: "2", label: "H2" },
          { value: "3", label: "H3" },
          { value: "4", label: "H4" },
        ]}
        disabled={disabled}
        onChange={(level) => onChange({ ...block, level: Number(level) as 2 | 3 | 4 })}
      />
      <TextField
        label="Heading text"
        value={block.text}
        maxLength={500}
        required
        disabled={disabled}
        onChange={(text) => onChange({ ...block, text })}
      />
    </div>
  );
}

function RichTextFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"richText">>) {
  const simple = readSimpleText(block.spans) ?? { text: "", href: "" };
  return (
    <div className="space-y-3">
      <TextAreaField
        label="Paragraph text"
        rows={4}
        value={simple.text}
        disabled={disabled}
        onChange={(text) => onChange({ ...block, spans: simpleSpans(text, simple.href) })}
      />
      <TextField
        label="Link (optional)"
        hint={`Turns the whole paragraph into a link. ${HREF_HINT}`}
        value={simple.href}
        maxLength={2048}
        disabled={disabled}
        onChange={(href) => onChange({ ...block, spans: simpleSpans(simple.text, href) })}
      />
    </div>
  );
}

function QuoteFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"quote">>) {
  return (
    <div className="space-y-3">
      <TextAreaField
        label="Quote"
        value={block.text}
        maxLength={2000}
        disabled={disabled}
        onChange={(text) => onChange({ ...block, text })}
      />
      <TextField
        label="Attribution (optional)"
        value={block.attribution ?? ""}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "attribution", value))}
      />
    </div>
  );
}

function ImageFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"image">>) {
  return (
    <div className="space-y-3">
      <MediaUploadField
        kind="editorial_inline"
        label="Image"
        value={block.mediaKey || null}
        alt={block.alt ?? ""}
        disabled={disabled}
        onChange={(key) => onChange({ ...block, mediaKey: key ?? "" })}
      />
      <TextField
        label="Alt text"
        hint="Describe the image for screen readers."
        value={block.alt ?? ""}
        maxLength={500}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "alt", value))}
      />
      <TextField
        label="Caption (optional)"
        value={block.caption ?? ""}
        maxLength={1000}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "caption", value))}
      />
    </div>
  );
}

function VideoFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"video">>) {
  return (
    <div className="space-y-3">
      <TextField
        label="Video URL"
        type="url"
        hint="Must start with https://"
        value={block.url}
        maxLength={2048}
        required
        disabled={disabled}
        onChange={(url) => onChange({ ...block, url })}
      />
      <MediaUploadField
        kind="editorial_inline"
        label="Poster image (optional)"
        value={block.posterMediaKey ?? null}
        disabled={disabled}
        onChange={(key) => onChange(withOptionalText(block, "posterMediaKey", key ?? ""))}
      />
    </div>
  );
}

function FaqGroupFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"faqGroup">>) {
  const keys = useListKeys(block.items.length);
  const setItems = (items: EditorialBlockOf<"faqGroup">["items"]) => onChange({ ...block, items });
  return (
    <div className="space-y-3">
      {block.items.map((item, index) => {
        const answer = readSimpleText(item.answer) ?? { text: "", href: "" };
        const label = `question ${index + 1}`;
        return (
          <fieldset key={keys.keyAt(index)} className="space-y-2 rounded border p-3">
            <legend className="px-1 text-xs font-medium text-on-surface-variant">
              Question {index + 1}
            </legend>
            <TextField
              label="Question"
              value={item.question}
              maxLength={500}
              required
              disabled={disabled}
              onChange={(question) =>
                setItems(replaceItem(block.items, index, { ...item, question }))
              }
            />
            <TextAreaField
              label="Answer"
              value={answer.text}
              disabled={disabled}
              onChange={(text) =>
                setItems(
                  replaceItem(block.items, index, {
                    ...item,
                    answer: simpleSpans(text, answer.href),
                  }),
                )
              }
            />
            <TextField
              label="Answer link (optional)"
              hint={HREF_HINT}
              value={answer.href}
              maxLength={2048}
              disabled={disabled}
              onChange={(href) =>
                setItems(
                  replaceItem(block.items, index, {
                    ...item,
                    answer: simpleSpans(answer.text, href),
                  }),
                )
              }
            />
            <ItemControls
              label={label}
              index={index}
              count={block.items.length}
              disabled={disabled}
              onMove={(direction) => {
                keys.move(index, direction);
                setItems(moveItem(block.items, index, direction));
              }}
              onRemove={() => {
                keys.remove(index);
                setItems(removeItem(block.items, index));
              }}
            />
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => {
          keys.add();
          setItems([...block.items, { question: "", answer: [{ text: "" }] }]);
        }}
      >
        Add question
      </Button>
    </div>
  );
}

function CardGridFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"cardGrid">>) {
  const keys = useListKeys(block.items.length);
  const setItems = (items: EditorialBlockOf<"cardGrid">["items"]) => onChange({ ...block, items });
  return (
    <div className="space-y-3">
      {block.items.map((item, index) => {
        const label = `card ${index + 1}`;
        const update = (next: typeof item) => setItems(replaceItem(block.items, index, next));
        return (
          <fieldset key={keys.keyAt(index)} className="space-y-2 rounded border p-3">
            <legend className="px-1 text-xs font-medium text-on-surface-variant">
              Card {index + 1}
            </legend>
            <TextField
              label="Card title"
              value={item.title}
              maxLength={200}
              required
              disabled={disabled}
              onChange={(title) => update({ ...item, title })}
            />
            <TextAreaField
              label="Card text (optional)"
              value={item.body ?? ""}
              maxLength={1000}
              disabled={disabled}
              onChange={(value) => update(withOptionalText(item, "body", value))}
            />
            <TextField
              label="Card link (optional)"
              hint={HREF_HINT}
              value={item.linkUrl ?? ""}
              maxLength={2048}
              disabled={disabled}
              onChange={(value) => update(withOptionalText(item, "linkUrl", value))}
            />
            <MediaUploadField
              kind="editorial_inline"
              label="Card image (optional)"
              value={item.mediaKey ?? null}
              disabled={disabled}
              onChange={(key) => update(withOptionalText(item, "mediaKey", key ?? ""))}
            />
            <ItemControls
              label={label}
              index={index}
              count={block.items.length}
              disabled={disabled}
              onMove={(direction) => {
                keys.move(index, direction);
                setItems(moveItem(block.items, index, direction));
              }}
              onRemove={() => {
                keys.remove(index);
                setItems(removeItem(block.items, index));
              }}
            />
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || block.items.length >= 12}
        onClick={() => {
          keys.add();
          setItems([...block.items, { title: "" }]);
        }}
      >
        Add card
      </Button>
    </div>
  );
}

function CtaFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"cta">>) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField
        label="Title"
        value={block.title}
        maxLength={200}
        required
        disabled={disabled}
        onChange={(title) => onChange({ ...block, title })}
      />
      <TextField
        label="Button label"
        value={block.buttonLabel}
        maxLength={80}
        required
        disabled={disabled}
        onChange={(buttonLabel) => onChange({ ...block, buttonLabel })}
      />
      <div className="sm:col-span-2">
        <TextAreaField
          label="Body (optional)"
          value={block.body ?? ""}
          maxLength={1000}
          disabled={disabled}
          onChange={(value) => onChange(withOptionalText(block, "body", value))}
        />
      </div>
      <div className="sm:col-span-2">
        <TextField
          label="Button link"
          hint={HREF_HINT}
          value={block.href}
          maxLength={2048}
          required
          disabled={disabled}
          onChange={(href) => onChange({ ...block, href })}
        />
      </div>
    </div>
  );
}

function InfoStripFields({
  block,
  onChange,
  disabled,
}: FieldsProps<EditorialBlockOf<"infoStrip">>) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <TextField
        label="Date label"
        value={block.dateLabel ?? ""}
        maxLength={120}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "dateLabel", value))}
      />
      <TextField
        label="Venue label"
        value={block.venueLabel ?? ""}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "venueLabel", value))}
      />
      <TextField
        label="Hours label"
        value={block.hoursLabel ?? ""}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "hoursLabel", value))}
      />
    </div>
  );
}

/** Structured form for one block; callers route JSON-only blocks elsewhere via `isStructuredBlock`. */
export function EditorialBlockFields({ block, onChange, disabled }: FieldsProps<EditorialBlock>) {
  switch (block.type) {
    case "heading":
      return <HeadingFields block={block} onChange={onChange} disabled={disabled} />;
    case "richText":
      return <RichTextFields block={block} onChange={onChange} disabled={disabled} />;
    case "quote":
      return <QuoteFields block={block} onChange={onChange} disabled={disabled} />;
    case "image":
      return <ImageFields block={block} onChange={onChange} disabled={disabled} />;
    case "video":
      return <VideoFields block={block} onChange={onChange} disabled={disabled} />;
    case "faqGroup":
      return <FaqGroupFields block={block} onChange={onChange} disabled={disabled} />;
    case "cardGrid":
      return <CardGridFields block={block} onChange={onChange} disabled={disabled} />;
    case "cta":
      return <CtaFields block={block} onChange={onChange} disabled={disabled} />;
    case "artworkRail":
      return (
        <RailRelationFields
          kind="artwork"
          headline={block.headline ?? ""}
          slugs={block.artworkSlugs}
          disabled={disabled}
          onChange={({ headline, slugs }) =>
            onChange(withOptionalText({ ...block, artworkSlugs: slugs }, "headline", headline))
          }
        />
      );
    case "artistRail":
      return (
        <RailRelationFields
          kind="artist"
          headline={block.headline ?? ""}
          slugs={block.artistSlugs}
          disabled={disabled}
          onChange={({ headline, slugs }) =>
            onChange(withOptionalText({ ...block, artistSlugs: slugs }, "headline", headline))
          }
        />
      );
    case "infoStrip":
      return <InfoStripFields block={block} onChange={onChange} disabled={disabled} />;
    default:
      return null;
  }
}
