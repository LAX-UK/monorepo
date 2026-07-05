import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { parseKycStatusSummary } from "@/lib/data/http/parse/kyc.parse";
import { zTransformParse } from "@/lib/data/http/schema-coerce";

/** Row schema for `GET /kyc/status`. */
export const kycStatusSummarySchema = zTransformParse<KycStatusSummaryDto>(parseKycStatusSummary);
