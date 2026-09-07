# Identity fallback synchronization records

After standalone source authority transfers, each monorepo fallback hotfix must
carry the `identity-fallback-hotfix` pull-request label and add a dated record
in this directory. Record:

- monorepo commit and reviewed pull request;
- matching `lax-identity` commit or follow-up pull request;
- affected contracts and migration-journal impact;
- test, image digest, and rollback evidence;
- owner and any bounded synchronization deadline.

Do not use this mechanism for contract evolution; package publication and
consumer migration remain a separate phase.
