"use client";

import { EditorialBlockFields } from "@/components/editorial-block-fields.client";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import { useFieldControlId } from "@/components/forms/form-field";
import {
  EDITORIAL_BLOCK_LABELS,
  EDITORIAL_BLOCK_TYPES,
  type EditorialBlockItem,
  type EditorialBlockType,
  createEditorialBlock,
  isStructuredBlock,
  parseSingleBlockJson,
} from "@/lib/editorial-blocks";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import type { FieldErrors } from "@/lib/form-validation";
import type { EditorialBlock } from "@auction/shop-contracts";
import { EmptyState } from "@auction/staff-ui";
import { Button } from "@auction/ui";
import { type ReactNode, useState } from "react";

type EditorialBlockEditorProps = {
  items: EditorialBlockItem[];
  onChange: (next: EditorialBlockItem[]) => void;
  disabled: boolean;
  /** Save-time problems keyed `block-<n>`; each shows on its block and the summary can focus it. */
  errors: FieldErrors;
};

const newKey = () => crypto.randomUUID();

const BLOCK_TYPE_OPTIONS = EDITORIAL_BLOCK_TYPES.map((type) => ({
  value: type,
  label: EDITORIAL_BLOCK_LABELS[type],
}));

function BlockJsonFields({
  block,
  onChange,
  disabled,
}: {
  block: EditorialBlock;
  onChange: (next: EditorialBlock) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(() => JSON.stringify(block, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <p className="text-xs text-on-surface-variant">
        This block has no simple form (or carries formatting the form would lose). Edit it as JSON.
      </p>
      <TextAreaField
        label="Block JSON"
        rows={6}
        monospace
        value={text}
        disabled={disabled}
        onChange={(next) => {
          setText(next);
          const parsed = parseSingleBlockJson(next);
          if (!parsed.ok) {
            setError(parsed.error);
            return;
          }
          setError(null);
          const [first] = parsed.blocks;
          if (first) onChange(first);
        }}
      />
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error} Changes are not applied until the JSON is valid.
        </p>
      ) : null}
    </div>
  );
}

/** A block's card. Its id is what the form's error summary focuses for that block's problem. */
function BlockCard({
  number,
  error,
  children,
}: {
  number: number;
  error: string | undefined;
  children: ReactNode;
}) {
  const id = useFieldControlId(`block-${number}`);
  return (
    <li
      id={id}
      tabIndex={-1}
      className="space-y-3 rounded border bg-surface p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
      {error ? <p className="text-xs font-medium text-error">{error}</p> : null}
    </li>
  );
}

export function EditorialBlockEditor({
  items,
  onChange,
  disabled,
  errors,
}: EditorialBlockEditorProps) {
  const [newType, setNewType] = useState<EditorialBlockType>("richText");

  return (
    <section className="space-y-3" aria-label="Body blocks">
      <h3 className="text-base font-medium">Body blocks ({items.length})</h3>
      {items.length === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="easel"
          title="No blocks yet"
          description="Add one below."
        />
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const label = `block ${index + 1} (${EDITORIAL_BLOCK_LABELS[item.block.type] ?? "Unknown"})`;
            const updateBlock = (block: EditorialBlock) =>
              onChange(replaceItem(items, index, { ...item, block }));
            return (
              <BlockCard key={item.key} number={index + 1} error={errors[`block-${index + 1}`]}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {index + 1}. {EDITORIAL_BLOCK_LABELS[item.block.type] ?? item.block.type}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled || index === 0}
                      aria-label={`Move ${label} up`}
                      onClick={() => onChange(moveItem(items, index, -1))}
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled || index === items.length - 1}
                      aria-label={`Move ${label} down`}
                      onClick={() => onChange(moveItem(items, index, 1))}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={disabled}
                      aria-label={`Remove ${label}`}
                      onClick={() => onChange(removeItem(items, index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
                {isStructuredBlock(item.block) ? (
                  <EditorialBlockFields
                    block={item.block}
                    onChange={updateBlock}
                    disabled={disabled}
                  />
                ) : (
                  <BlockJsonFields block={item.block} onChange={updateBlock} disabled={disabled} />
                )}
              </BlockCard>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[12rem]">
          <SelectField
            label="New block type"
            value={newType}
            options={BLOCK_TYPE_OPTIONS}
            disabled={disabled}
            onChange={setNewType}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() =>
            onChange([...items, { key: newKey(), block: createEditorialBlock(newType) }])
          }
        >
          Add block
        </Button>
      </div>
    </section>
  );
}
