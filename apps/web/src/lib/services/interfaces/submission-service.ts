import type { createItemSubmissionSchema, updateItemSubmissionSchema } from "@auction/validators";
import type { z } from "zod";
import type { ServiceResult } from "../http/service-result";

export type CreateItemSubmissionInput = z.infer<typeof createItemSubmissionSchema>;
export type UpdateItemSubmissionInput = z.infer<typeof updateItemSubmissionSchema>;

export type CreateSubmissionData = { id: string };

export interface ISubmissionService {
  create(input: CreateItemSubmissionInput): Promise<ServiceResult<CreateSubmissionData>>;
  update(
    id: string,
    input: UpdateItemSubmissionInput,
  ): Promise<ServiceResult<Record<string, unknown>>>;
  submitForReview(id: string): Promise<ServiceResult<Record<string, unknown>>>;
  withdraw(id: string): Promise<ServiceResult<Record<string, unknown>>>;
}
