# Quickstart: Category Hierarchy Integrity

## Objective

Verify that category hierarchy integrity is enforced and category responses remain stable.

## Steps

1. Run category-focused tests after implementation.
2. Attempt valid category parent assignment.
3. Attempt invalid parent assignment (non-existent parent id).
4. Attempt self-parent assignment.
5. Attempt circular parent assignment across two categories.
6. Fetch category list and verify parent references are valid or null.

## Commands

```bash
pnpm test
pnpm lint
pnpm typecheck
```

If needed, run scoped package/app tests for faster feedback:

```bash
pnpm --filter @auction/api test
pnpm --filter @auction/validators test
```

## Expected Results

- Invalid hierarchy writes are rejected with deterministic validation/domain errors.
- Valid hierarchy writes succeed.
- Category list responses contain no unresolved parent references.
