"use client";

import { EditorialBlockFields } from "@/components/editorial-block-fields.client";
import { SelectField, TextAreaField } from "@/components/forms/fields";
import {
  EDITORIAL_BLOCK_LABELS,
  EDITORIAL_BLOCK_TYPES,
  type EditorialBlockItem,
  type EditorialBlockType,
  createEditorialBlock,
  fromBlockItems,
  isStructuredBlock,
  parseBlocksJson,
  parseSingleBlockJson,
  toBlockItems,
} from "@/lib/editorial-blocks";
import { moveItem, removeItem, replaceItem } from "@/lib/editorial-list-ops";
import type { EditorialBlock } from "@auction/shop-contracts";
import { Button } from "@auction/ui";
import { useState } from "react";

type EditorialBlockEditorProps = {
  items: EditorialBlockItem[];
  onChange: (next: EditorialBlockItem[]) => void;
  disabled: boolean;
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

function AdvancedJsonEditor({
  items,
  onApply,
  disabled,
}: {
  items: EditorialBlockItem[];
  onApply: (blocks: EditorialBlock[]) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState(() => JSON.stringify(fromBlockItems(items), null, 2));
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  return (
    <div className="space-y-2">
      <TextAreaField
        label="Body blocks (JSON array)"
        hint='Apply JSON replaces every block; unapplied edits are dropped when you switch back. Example: [{"type":"heading","level":2,"text":"Title"}]'
        rows={14}
        monospace
        value={text}
        disabled={disabled}
        onChange={(next) => {
          setText(next);
          setMessage(null);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => {
            const parsed = parseBlocksJson(text);
            if (!parsed.ok) {
              setMessage({ tone: "error", text: parsed.error });
              return;
            }
            onApply(parsed.blocks);
            setMessage({ tone: "success", text: `Applied ${parsed.blocks.length} block(s).` });
          }}
        >
          Apply JSON
        </Button>
        {message ? (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={message.tone === "error" ? "text-sm text-error" : "text-sm text-success"}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function EditorialBlockEditor({ items, onChange, disabled }: EditorialBlockEditorProps) {
  const [advanced, setAdvanced] = useState(false);
  const [newType, setNewType] = useState<EditorialBlockType>("richText");

  return (
    <section className="space-y-3" aria-label="Body blocks">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-medium">Body blocks ({items.length})</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={advanced}
          disabled={disabled}
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? "Back to block forms" : "Advanced JSON"}
        </Button>
      </div>

      {advanced ? (
        <AdvancedJsonEditor
          items={items}
          disabled={disabled}
          onApply={(blocks) => onChange(toBlockItems(blocks, newKey))}
        />
      ) : (
        <>
          {items.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No blocks yet. Add one below.</p>
          ) : (
            <ol className="space-y-3">
              {items.map((item, index) => {
                const label = `block ${index + 1} (${EDITORIAL_BLOCK_LABELS[item.block.type] ?? "Unknown"})`;
                const updateBlock = (block: EditorialBlock) =>
                  onChange(replaceItem(items, index, { ...item, block }));
                return (
                  <li key={item.key} className="space-y-3 rounded border bg-surface p-3">
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
                      <BlockJsonFields
                        block={item.block}
                        onChange={updateBlock}
                        disabled={disabled}
                      />
                    )}
                  </li>
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
        </>
      )}
    </section>
  );
}
