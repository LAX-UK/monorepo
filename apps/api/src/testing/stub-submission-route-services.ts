import { vi } from "vitest";
import type { SubmissionRouteServices } from "../services/interfaces/submission-routes/index.js";

export function stubSubmissionRouteServices(
  overrides?: Partial<SubmissionRouteServices>,
): SubmissionRouteServices {
  return {
    sellerHttp: {
      createDraft: vi.fn(),
      listMine: vi.fn(),
      getMineSummary: vi.fn(),
      getById: vi.fn(),
      patch: vi.fn(),
      submitForReview: vi.fn(),
      withdraw: vi.fn(),
    },
    adminHttp: {
      listSubmissions: vi.fn(),
      bulkApproveOrReject: vi.fn(),
      startReview: vi.fn(),
      accept: vi.fn(),
      convert: vi.fn(),
      assign: vi.fn(),
      approve: vi.fn(),
      reject: vi.fn(),
    },
    documentHttp: {
      listForViewer: vi.fn(),
      listForStaff: vi.fn(),
      attachForViewer: vi.fn(),
      attachForStaff: vi.fn(),
      removeForViewer: vi.fn(),
      removeForStaff: vi.fn(),
    },
    ...overrides,
  };
}
