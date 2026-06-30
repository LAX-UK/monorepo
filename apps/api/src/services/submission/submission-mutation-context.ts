import type { Database } from "@auction/db";
import type { ItemSubmissionServiceDeps } from "./submission-types.js";

export function txRepos(deps: ItemSubmissionServiceDeps, tx: Database) {
  if (!deps.repoFactory) {
    throw new Error("item_submission_repo_factory_required");
  }
  return deps.repoFactory.forTransaction(tx);
}
