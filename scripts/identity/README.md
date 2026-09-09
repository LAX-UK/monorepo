# Identity extraction tooling

`closure.mjs` is the source of truth for the six path-preserved workspace
packages, generated root files, retained scripts, and Auth Docker expectations.

Run a local rehearsal with:

```sh
pnpm ci:identity-extraction-rehearsal
```

Extract to a specific directory with:

```sh
scripts/identity/repo-split.sh /absolute/path/to/identity-repository
```

The command creates one fresh, single-branch, tag-free clone; runs one
`git filter-repo` operation without path renames; overlays only approved paths
from the current working tree; writes a minimal standalone pnpm workspace; asks
pnpm to regenerate the closure-only lockfile; checks the extracted package and
import closure; runs layer checks against the extracted tree; and scans all
retained Git history with gitleaks. It never creates or pushes source-repository
branches.

Use `--committed-only` to omit the approved working-tree overlay,
`--skip-secret-scan` only for a non-release diagnostic run, and `--dry-run` to
print the extraction shape without creating a repository.
