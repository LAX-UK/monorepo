import type {
  CrmBatchUpsertInput,
  CrmCoqlPage,
  CrmCoqlQuery,
  CrmCreateInput,
  CrmDeleteRecordInput,
  CrmDeleteRecordResult,
  CrmGateway,
  CrmGatewayMetrics,
  CrmLeadSummary,
  CrmRecordResult,
  CrmSearchByEmailInput,
  CrmSearchByEmailResult,
  CrmUpdateByIdInput,
  CrmUpsertInput,
} from "../crm/crm-gateway.js";
import { mapZohoErrorToCrmGatewayError } from "./map-zoho-to-crm-gateway-error.js";

/** Maps Zoho-layer throws to {@link CrmGatewayError} for CRM handlers. */
export class ZohoCrmGatewayCrmErrorAdapter implements CrmGateway, CrmCoqlQuery {
  constructor(private readonly inner: CrmGateway & CrmCoqlQuery) {}

  getMetrics(): CrmGatewayMetrics {
    return this.inner.getMetrics();
  }

  async upsert(input: CrmUpsertInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.upsert(input));
  }

  async upsertMany(input: CrmBatchUpsertInput): Promise<CrmRecordResult[]> {
    return this.guard(() => this.inner.upsertMany(input));
  }

  async updateById(input: CrmUpdateByIdInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.updateById(input));
  }

  async findByEmail(input: CrmSearchByEmailInput): Promise<CrmSearchByEmailResult> {
    return this.guard(() => this.inner.findByEmail(input));
  }

  async findDealIdsByContact(contactId: string): Promise<string[]> {
    return this.guard(() => this.inner.findDealIdsByContact(contactId));
  }

  async executeCoql(selectQuery: string): Promise<string[]> {
    return this.guard(() => this.inner.executeCoql(selectQuery));
  }

  async queryCoql(selectQuery: string): Promise<CrmCoqlPage> {
    return this.guard(() => this.inner.queryCoql(selectQuery));
  }

  async createRecord(input: CrmCreateInput): Promise<CrmRecordResult> {
    return this.guard(() => this.inner.createRecord(input));
  }

  async findLead(leadId: string): Promise<CrmLeadSummary | null> {
    return this.guard(() => this.inner.findLead(leadId));
  }

  async deleteRecord(input: CrmDeleteRecordInput): Promise<CrmDeleteRecordResult> {
    return this.guard(() => this.inner.deleteRecord(input));
  }

  async purgeFromRecycleBin(recordId: string): Promise<void> {
    return this.guard(() => this.inner.purgeFromRecycleBin(recordId));
  }

  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      throw mapZohoErrorToCrmGatewayError(err);
    }
  }
}
