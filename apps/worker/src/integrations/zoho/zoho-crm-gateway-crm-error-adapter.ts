import type {
  CrmBatchUpsertInput,
  CrmConvertLeadInput,
  CrmConvertLeadResult,
  CrmDeleteRecordInput,
  CrmDeleteRecordResult,
  CrmGateway,
  CrmGatewayMetrics,
  CrmRecordResult,
  CrmSearchByEmailInput,
  CrmSearchByEmailResult,
  CrmUpdateByIdInput,
  CrmUpsertInput,
} from "../crm/crm-gateway.js";
import { mapZohoErrorToCrmGatewayError } from "./map-zoho-to-crm-gateway-error.js";

/** Maps Zoho-layer throws to {@link CrmGatewayError} for CRM handlers. */
export class ZohoCrmGatewayCrmErrorAdapter implements CrmGateway {
  constructor(private readonly inner: CrmGateway) {}

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

  async convertLead(input: CrmConvertLeadInput): Promise<CrmConvertLeadResult> {
    return this.guard(() => this.inner.convertLead(input));
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
