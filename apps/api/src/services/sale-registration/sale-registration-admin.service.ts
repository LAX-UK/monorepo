import { type Result, err, ok } from "neverthrow";
import type {
  ISaleRegistrationAdminService,
  SaleRegistrationAdminRow,
  SaleRegistrationServiceError,
} from "../interfaces/sale-registration-service.js";
import type { SaleRegistrationContext } from "./sale-registration-context.js";
import { toBidLimitString } from "./sale-registration-request.mapper.js";

export class SaleRegistrationAdminService implements ISaleRegistrationAdminService {
  constructor(private readonly ctx: SaleRegistrationContext) {}

  async listForSaleAdmin(input: {
    saleId: string;
    status?: "pending" | "approved" | "rejected" | "withdrawn" | undefined;
  }): Promise<SaleRegistrationAdminRow[]> {
    return this.ctx.registrationRepo.listForAdmin(input);
  }

  async approve(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
  }): Promise<Result<void, SaleRegistrationServiceError>> {
    const row = await this.ctx.registrationRepo.findByIdAndSale(input.registrationId, input.saleId);
    if (!row) {
      return err({ message: "Registration not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Only pending registrations can be approved", status: 400 });
    }
    await this.ctx.registrationRepo.setApproved(input.registrationId, input.decidedByUserId);
    return ok(undefined);
  }

  async reject(input: {
    saleId: string;
    registrationId: string;
    decidedByUserId: string;
    reason?: string | undefined;
  }): Promise<Result<void, SaleRegistrationServiceError>> {
    const row = await this.ctx.registrationRepo.findByIdAndSale(input.registrationId, input.saleId);
    if (!row) {
      return err({ message: "Registration not found", status: 404 });
    }
    if (row.status !== "pending") {
      return err({ message: "Only pending registrations can be rejected", status: 400 });
    }
    await this.ctx.registrationRepo.setRejected(
      input.registrationId,
      input.decidedByUserId,
      input.reason ?? null,
    );
    return ok(undefined);
  }

  async updateBidLimit(input: {
    saleId: string;
    registrationId: string;
    bidLimit: number | null;
    decidedByUserId: string;
  }): Promise<Result<void, SaleRegistrationServiceError>> {
    const row = await this.ctx.registrationRepo.findByIdAndSale(input.registrationId, input.saleId);
    if (!row) {
      return err({ message: "Registration not found", status: 404 });
    }
    if (row.status !== "approved") {
      return err({
        message: "Only approved registrations can update bid limits",
        status: 400,
      });
    }
    const bidLimitStr = input.bidLimit != null ? toBidLimitString(input.bidLimit) : null;
    await this.ctx.registrationRepo.updateBidLimit(
      input.registrationId,
      bidLimitStr,
      input.decidedByUserId,
    );
    return ok(undefined);
  }
}
