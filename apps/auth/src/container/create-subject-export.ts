import type { IdentityEventPublisher, SecurityNoticePublisher } from "@auction/auth";
import type { IdentityDatabase } from "@auction/identity-db";
import type { AuthAppEnv } from "../env.js";
import { DrizzleSubjectExportRepository } from "../infrastructure/drizzle-subject-export.repository.js";
import { S3SubjectExportReadSigner } from "../infrastructure/s3-subject-export-read-signer.js";
import type { IdentityOperationsService } from "../services/identity-operations.service.js";
import { SubjectExportService } from "../services/subject-export.service.js";

/** The export bucket's read-only credentials, or null when it is not configured. */
function readSigner(env: AuthAppEnv): S3SubjectExportReadSigner | null {
  if (
    !env.SUBJECT_EXPORT_BUCKET ||
    !env.SUBJECT_EXPORT_REGION ||
    !env.SUBJECT_EXPORT_READ_ACCESS_KEY_ID ||
    !env.SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  return new S3SubjectExportReadSigner({
    bucket: env.SUBJECT_EXPORT_BUCKET,
    region: env.SUBJECT_EXPORT_REGION,
    endpoint: env.SUBJECT_EXPORT_ENDPOINT,
    accessKeyId: env.SUBJECT_EXPORT_READ_ACCESS_KEY_ID,
    secretAccessKey: env.SUBJECT_EXPORT_READ_SECRET_ACCESS_KEY,
  });
}

export function createSubjectExportService(options: {
  db: IdentityDatabase;
  env: AuthAppEnv;
  operations: IdentityOperationsService;
  events: IdentityEventPublisher;
  notices: SecurityNoticePublisher;
}): SubjectExportService {
  return new SubjectExportService({
    operations: options.operations,
    repository: new DrizzleSubjectExportRepository(options.db, options.events),
    signer: readSigner(options.env),
    notices: options.notices,
  });
}
