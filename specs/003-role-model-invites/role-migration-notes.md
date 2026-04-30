# Role Migration Notes

## Target Role Set

- administrator
- accountant
- client

## Migration Goals

1. Preserve existing valid admin capabilities.
2. Map current non-admin users to `client`.
3. Introduce `accountant` without granting unintended global admin access.
4. Ensure role checks fail closed for unknown values.

## Backfill Considerations

- Determine current role enum/storage and existing values.
- Define one-time migration mapping for legacy roles.
- Add post-migration validation queries and rollback notes.
