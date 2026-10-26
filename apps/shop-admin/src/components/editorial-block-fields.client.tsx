"use client";

import { EditorialImageField } from "@/components/editorial/editorial-image-field.client";
import { RailRelationFields } from "@/components/editorial/rail-relation-fields.client";
import {
  type EditorialBlockOf,
  readSimpleText,
  simpleSpans,
  withOptionalText,
} from "@/lib/editorial-blocks";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import type { EditorialBlock } from "@auction/shop-contracts";
import { EnumSelect, Field, FieldRow, ListEditor, TextArea, TextInput } from "@auction/staff-ui";
import { useId, useState } from "react";

type FieldsProps<B extends EditorialBlock> = {
  block: B;
  onChange: (next: B) => void;
  disabled: boolean;
};

const HREF_HINT = "https://…, mailto:… or a site path such as /visit";

/** Stable keys for a block's inner list, so editing a row never remounts the ones around it. */
function useListKeys(length: number) {
  const [keys, setKeys] = useState(() => Array.from({ length }, () => crypto.randomUUID()));
  return {
    keyAt: (index: number) => keys[index] ?? `pending-${index}`,
    add: () => setKeys((current) => [...current, crypto.randomUUID()]),
    remove: (index: number) => setKeys((current) => removeItem(current, index)),
    move: (from: number, to: number) =>
      setKeys((current) => moveItem(current, from, to > from ? 1 : -1)),
  };
}

function BlockText({
  label,
  description,
  optional,
  disabled,
  value,
  onChange,
  maxLength,
  type = "text",
}: {
  label: string;
  description?: string;
  optional?: boolean;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  type?: "text" | "url";
}) {
  return (
    <Field
      label={label}
      disabled={disabled}
      {...(description ? { description } : {})}
      {...(optional ? { optional } : {})}
    >
      <TextInput
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function BlockTextArea({
  label,
  optional,
  disabled,
  value,
  onChange,
  maxLength,
  rows = 4,
}: {
  label: string;
  optional?: boolean;
  disabled: boolean;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  rows?: number;
}) {
  return (
    <Field label={label} disabled={disabled} {...(optional ? { optional } : {})}>
      <TextArea
        rows={rows}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

function HeadingFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"heading">>) {
  return (
    <FieldRow>
      <Field label="Level" disabled={disabled}>
        <EnumSelect
          value={String(block.level) as "2" | "3" | "4"}
          onValueChange={(level) => onChange({ ...block, level: Number(level) as 2 | 3 | 4 })}
          options={[
            { value: "2", label: "Heading 2" },
            { value: "3", label: "Heading 3" },
            { value: "4", label: "Heading 4" },
          ]}
        />
      </Field>
      <BlockText
        label="Heading text"
        value={block.text}
        maxLength={500}
        disabled={disabled}
        onChange={(text) => onChange({ ...block, text })}
      />
    </FieldRow>
  );
}

function RichTextFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"richText">>) {
  const simple = readSimpleText(block.spans) ?? { text: "", href: "" };
  return (
    <div className="flex flex-col gap-4">
      <BlockTextArea
        label="Paragraph text"
        value={simple.text}
        disabled={disabled}
        onChange={(text) => onChange({ ...block, spans: simpleSpans(text, simple.href) })}
      />
      <BlockText
        label="Link"
        optional
        description={`Turns the whole paragraph into a link. ${HREF_HINT}`}
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
    <div className="flex flex-col gap-4">
      <BlockTextArea
        label="Quote"
        value={block.text}
        maxLength={2000}
        disabled={disabled}
        onChange={(text) => onChange({ ...block, text })}
      />
      <BlockText
        label="Attribution"
        optional
        value={block.attribution ?? ""}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "attribution", value))}
      />
    </div>
  );
}

function ImageFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"image">>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <EditorialImageField
        name={`${id}-image`}
        label="Image"
        optional={false}
        kind="editorial_inline"
        value={block.mediaKey || null}
        alt={block.alt ?? ""}
        disabled={disabled}
        onChange={(key) => onChange({ ...block, mediaKey: key ?? "" })}
      />
      <BlockText
        label="Alt text"
        description="Describe the image for people using screen readers."
        value={block.alt ?? ""}
        maxLength={500}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "alt", value))}
      />
      <BlockText
        label="Caption"
        optional
        value={block.caption ?? ""}
        maxLength={1000}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "caption", value))}
      />
    </div>
  );
}

function VideoFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"video">>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-4">
      <BlockText
        label="Video URL"
        type="url"
        description="It must start with https://"
        value={block.url}
        maxLength={2048}
        disabled={disabled}
        onChange={(url) => onChange({ ...block, url })}
      />
      <EditorialImageField
        name={`${id}-poster`}
        label="Poster image"
        kind="editorial_inline"
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
    <ListEditor
      items={block.items}
      getKey={(_, index) => keys.keyAt(index)}
      itemLabel={(index) => `question ${index + 1}`}
      addLabel="Add question"
      emptyText="No questions yet."
      disabled={disabled}
      onAdd={() => {
        keys.add();
        setItems([...block.items, { question: "", answer: [{ text: "" }] }]);
      }}
      onRemove={(index) => {
        keys.remove(index);
        setItems(removeItem(block.items, index));
      }}
      onMove={(from, to) => {
        keys.move(from, to);
        setItems(moveItem(block.items, from, to > from ? 1 : -1));
      }}
      renderItem={(item, index) => {
        const answer = readSimpleText(item.answer) ?? { text: "", href: "" };
        return (
          <>
            <BlockText
              label={`Question ${index + 1}`}
              value={item.question}
              maxLength={500}
              disabled={disabled}
              onChange={(question) =>
                setItems(replaceItem(block.items, index, { ...item, question }))
              }
            />
            <BlockTextArea
              label={`Answer ${index + 1}`}
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
            <BlockText
              label={`Answer ${index + 1} link`}
              optional
              description={HREF_HINT}
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
          </>
        );
      }}
    />
  );
}

function CardGridFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"cardGrid">>) {
  const keys = useListKeys(block.items.length);
  const id = useId();
  const setItems = (items: EditorialBlockOf<"cardGrid">["items"]) => onChange({ ...block, items });
  return (
    <ListEditor
      items={block.items}
      getKey={(_, index) => keys.keyAt(index)}
      itemLabel={(index) => `card ${index + 1}`}
      addLabel="Add card"
      emptyText="No cards yet."
      max={12}
      disabled={disabled}
      onAdd={() => {
        keys.add();
        setItems([...block.items, { title: "" }]);
      }}
      onRemove={(index) => {
        keys.remove(index);
        setItems(removeItem(block.items, index));
      }}
      onMove={(from, to) => {
        keys.move(from, to);
        setItems(moveItem(block.items, from, to > from ? 1 : -1));
      }}
      renderItem={(item, index) => {
        const update = (next: typeof item) => setItems(replaceItem(block.items, index, next));
        return (
          <>
            <BlockText
              label={`Card ${index + 1} title`}
              value={item.title}
              maxLength={200}
              disabled={disabled}
              onChange={(title) => update({ ...item, title })}
            />
            <BlockTextArea
              label={`Card ${index + 1} text`}
              optional
              rows={3}
              value={item.body ?? ""}
              maxLength={1000}
              disabled={disabled}
              onChange={(value) => update(withOptionalText(item, "body", value))}
            />
            <BlockText
              label={`Card ${index + 1} link`}
              optional
              description={HREF_HINT}
              value={item.linkUrl ?? ""}
              maxLength={2048}
              disabled={disabled}
              onChange={(value) => update(withOptionalText(item, "linkUrl", value))}
            />
            <EditorialImageField
              name={`${id}-card-${keys.keyAt(index)}`}
              label={`Card ${index + 1} image`}
              kind="editorial_inline"
              value={item.mediaKey ?? null}
              disabled={disabled}
              onChange={(key) => update(withOptionalText(item, "mediaKey", key ?? ""))}
            />
          </>
        );
      }}
    />
  );
}

function CtaFields({ block, onChange, disabled }: FieldsProps<EditorialBlockOf<"cta">>) {
  return (
    <div className="flex flex-col gap-4">
      <FieldRow>
        <BlockText
          label="Title"
          value={block.title}
          maxLength={200}
          disabled={disabled}
          onChange={(title) => onChange({ ...block, title })}
        />
        <BlockText
          label="Button label"
          value={block.buttonLabel}
          maxLength={80}
          disabled={disabled}
          onChange={(buttonLabel) => onChange({ ...block, buttonLabel })}
        />
      </FieldRow>
      <BlockTextArea
        label="Body"
        optional
        rows={3}
        value={block.body ?? ""}
        maxLength={1000}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "body", value))}
      />
      <BlockText
        label="Button link"
        description={HREF_HINT}
        value={block.href}
        maxLength={2048}
        disabled={disabled}
        onChange={(href) => onChange({ ...block, href })}
      />
    </div>
  );
}

function InfoStripFields({
  block,
  onChange,
  disabled,
}: FieldsProps<EditorialBlockOf<"infoStrip">>) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <BlockText
        label="Date label"
        optional
        value={block.dateLabel ?? ""}
        maxLength={120}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "dateLabel", value))}
      />
      <BlockText
        label="Venue label"
        optional
        value={block.venueLabel ?? ""}
        maxLength={200}
        disabled={disabled}
        onChange={(value) => onChange(withOptionalText(block, "venueLabel", value))}
      />
      <BlockText
        label="Hours label"
        optional
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
