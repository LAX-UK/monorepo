import type { IAdminDisputeDeskReader } from "@auction/persistence/interfaces";
import type { DisputeDeskCase, DisputeDeskPage } from "@auction/types";
import type { Result } from "neverthrow";
import type {
  DisputeAllocationError,
  DisputeAllocationInput,
} from "../disputes/dispute-allocation.service.js";
import { buildDisputeTimeline } from "../disputes/dispute-timeline.js";
import type {
  AdminDisputeDeskListInput,
  IAdminDisputeDeskService,
} from "../interfaces/admin-routes/admin-compliance-routes.js";

/** The write side the screen needs: the finance team's allocation of a dispute. */
export interface IDisputeAllocator {
  allocate(
    input: DisputeAllocationInput,
  ): Promise<Result<{ caseId: string; version: number }, DisputeAllocationError>>;
}

/** The Disputes screen: cases to list and open, and the allocation that moves seller payouts. */
export class AdminDisputeDeskService implements IAdminDisputeDeskService {
  constructor(
    private readonly reader: IAdminDisputeDeskReader,
    private readonly allocator: IDisputeAllocator,
  ) {}

  listCases(input: AdminDisputeDeskListInput): Promise<DisputeDeskPage> {
    return this.reader.listPage(input);
  }

  async getCase(caseId: string): Promise<DisputeDeskCase | null> {
    const record = await this.reader.findCase(caseId);
    if (!record) return null;
    return { ...record, timeline: buildDisputeTimeline(record) };
  }

  allocate(input: DisputeAllocationInput) {
    return this.allocator.allocate(input);
  }
}
