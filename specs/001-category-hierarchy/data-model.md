# Data Model: Category Hierarchy Integrity

## Entity: Category

Current shape (`packages/db/src/schema/categories.ts`):

- `id: uuid` (PK)
- `name: text` (required)
- `slug: text` (required, unique)
- `parent_id: uuid | null` (FK -> `category.id`, `onDelete: set null`)

## Invariants

1. `parent_id` is either `null` or points to an existing category.
2. `parent_id` cannot equal `id` (no self-parent).
3. A category chain cannot contain cycles.
4. Deleting a parent category sets child `parent_id` to `null`.

## Dependent Domain Usage

- Lots, sales, and item submissions reference category ids and assume category references are valid.
- Category list responses must remain stable for frontend forms and filters.

## Validation Responsibilities

- **Database**: referential integrity for non-null parent id.
- **Application layer**: self-parent and cycle detection on writes.
- **Tests**: verify valid hierarchy writes, invalid writes, and stable reads.
