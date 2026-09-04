# Platform onboarding conformance

Run the executable checklist after registering a new LAX platform client/resource.

## Command

```bash
pnpm ci:platform-onboarding
```

With a live stack (Shop Identity on `:3010`, Identity on `:3003`):

```bash
PLATFORM_CONFORMANCE_LIVE=1 pnpm ci:platform-onboarding
```

## Pass criteria

- Identity boundary fixture checks pass
- Shop database role contract passes
- Live mode: Shop OIDC roundtrip script succeeds

## Environment template

Copy OIDC and session variables from [apps/shop-identity/src/env.ts](../../apps/shop-identity/src/env.ts) and register the client/resource in [packages/identity-contracts](../../packages/identity-contracts).
