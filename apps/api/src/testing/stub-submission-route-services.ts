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
      requestChanges: vi.fn(),
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
    agreementHttp: {
      getForSeller: vi.fn(),
      listForSeller: vi.fn(),
      accept: vi.fn(),
      getForStaff: vi.fn(),
      listForStaff: vi.fn(),
      proposeTerms: vi.fn(),
    },
    afterSaleHttp: {
      getForSeller: vi.fn(),
      listUnsoldOutcomes: vi.fn(),
      requestUnsoldChoice: vi.fn(),
      withdraw: vi.fn(),
      getForStaff: vi.fn(),
      decideUnsoldChoice: vi.fn(),
      setRelistReserveFloor: vi.fn(),
      moveOptions: vi.fn(),
      move: vi.fn(),
      remindSeller: vi.fn(),
    },
    messageHttp: {
      listForClient: vi.fn(),
      postForClient: vi.fn(),
      markReadForClient: vi.fn(),
      listThreads: vi.fn(),
      getForStaff: vi.fn(),
      replyForStaff: vi.fn(),
      assignForStaff: vi.fn(),
      markReadForStaff: vi.fn(),
    },
    ...overrides,
  };
}
