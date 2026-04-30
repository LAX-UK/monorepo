# Contract Notes: Category Hierarchy

## API Surface

- Existing read endpoint: `GET /categories`
- Response item shape remains:
  - `id: string`
  - `name: string`
  - `slug: string`
  - `parentId: string | null`

## Behavioral Contract

1. `parentId` is either `null` or a valid category id.
2. No category may directly or indirectly reference itself as an ancestor.
3. Parent deletion keeps child categories valid by setting `parentId` to `null`.
4. Invalid hierarchy write attempts return explicit error responses.

## Documentation Alignment

- Ensure `docs/openapi.yaml` reflects hierarchy constraints and error cases for category-related operations (current and future write endpoints).
