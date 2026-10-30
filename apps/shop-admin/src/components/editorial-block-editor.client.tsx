"use client";

import { EditorialBlockFields } from "@/components/editorial-block-fields.client";
import { editorialFieldId } from "@/components/editorial/editorial-field-parts.client";
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
import {
  EmptyState,
  EnumSelect,
  Field,
  StaffButton,
  StaffTooltip,
  TextArea,
  useStaffCan,
} from "@auction/staff-ui";
import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from "@auction/staff-ui/icons";
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

/** For a block with no simple form, or formatting a form would lose. */
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
    <Field
      label="Block JSON"
      description="This block has no simple form, or carries formatting a form would lose. Edit it as JSON; changes apply once the JSON is valid."
      error={error}
      disabled={disabled}
    >
      <TextArea
        rows={8}
        spellCheck={false}
        className="font-mono text-staff-xs"
        value={text}
        onChange={(event) => {
          const next = event.target.value;
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
    </Field>
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
  return (
    <li
      id={editorialFieldId(`block-${number}`)}
      tabIndex={-1}
      className="staff-focus flex flex-col gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4"
    >
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-staff-xs font-medium text-staff-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : null}
    </li>
  );
}

function BlockControl({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <StaffTooltip label={label}>
      <StaffButton
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </StaffButton>
    </StaffTooltip>
  );
}

export function EditorialBlockEditor({
  items,
  onChange,
  disabled,
  errors,
}: EditorialBlockEditorProps) {
  const [newType, setNewType] = useState<EditorialBlockType>("richText");
  /** Without `editorial.write` the blocks are shown without moving, removing or adding. */
  const readOnly = !useStaffCan("editorial.write");

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <EmptyState
          size="compact"
          headingLevel="h3"
          illustration="easel"
          title="No blocks yet"
          description={
            readOnly
              ? "This page has no content yet."
              : "Choose a block type below and add the first one."
          }
        />
      ) : (
        <ol aria-label="Body blocks" className="flex flex-col gap-3">
          {items.map((item, index) => {
            const typeLabel = EDITORIAL_BLOCK_LABELS[item.block.type] ?? "Unknown";
            const label = `block ${index + 1} (${typeLabel})`;
            const updateBlock = (block: EditorialBlock) =>
              onChange(replaceItem(items, index, { ...item, block }));
            return (
              <BlockCard key={item.key} number={index + 1} error={errors[`block-${index + 1}`]}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-staff-sm font-semibold text-staff-fg">
                    {index + 1}. {typeLabel}
                  </p>
                  {readOnly ? null : (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <BlockControl
                        label={`Move ${label} up`}
                        disabled={disabled || index === 0}
                        onClick={() => onChange(moveItem(items, index, -1))}
                      >
                        <ArrowUp aria-hidden />
                      </BlockControl>
                      <BlockControl
                        label={`Move ${label} down`}
                        disabled={disabled || index === items.length - 1}
                        onClick={() => onChange(moveItem(items, index, 1))}
                      >
                        <ArrowDown aria-hidden />
                      </BlockControl>
                      <BlockControl
                        label={`Remove ${label}`}
                        disabled={disabled}
                        onClick={() => onChange(removeItem(items, index))}
                      >
                        <Trash2 aria-hidden />
                      </BlockControl>
                    </div>
                  )}
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
      {readOnly ? null : (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="New block type" disabled={disabled} className="w-full sm:w-60">
            <EnumSelect value={newType} onValueChange={setNewType} options={BLOCK_TYPE_OPTIONS} />
          </Field>
          <StaffButton
            type="button"
            variant="secondary"
            icon={<Plus aria-hidden />}
            disabled={disabled}
            onClick={() =>
              onChange([...items, { key: newKey(), block: createEditorialBlock(newType) }])
            }
          >
            Add block
          </StaffButton>
        </div>
      )}
    </div>
  );
}
