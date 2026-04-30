# Research: Category Hierarchy Integrity

## Current State

- `packages/db/src/schema/categories.ts` already defines:
  - `parentId` referencing `category.id`
  - `onDelete: "set null"`
  - index on `parent_id`
- API currently exposes category listing via:
  - `apps/api/src/routes/categories.ts` (`GET /categories`)
  - `apps/api/src/services/category.service.ts` (`list()`)
  - `apps/api/src/repositories/drizzle-category.repository.ts` (`findAll()`)
- No dedicated category validator currently exists in `packages/validators/src`.
- Category known gap exists in `docs/SYSTEM_ANALYSIS.md`: need to confirm hierarchy integrity requirements.

## Decisions

1. Keep DB FK as baseline integrity guard for unresolved parent references.
2. Add application-level guards for:
   - self-parent (`id === parentId`)
   - circular hierarchy (A -> B -> A)
3. Preserve existing delete semantics (`set null`) for parent deletion.
4. Keep read API shape stable (`id`, `name`, `slug`, `parentId`).

## Open Considerations

- If category create/update endpoints are not yet exposed, validation still belongs in service/repository write methods for future safety.
- Legacy invalid rows should be handled via migration/cleanup strategy before strict enforcement in production.
