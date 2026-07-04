import type { IQrCodeRepository } from "@auction/persistence/interfaces";
import type { Redis } from "ioredis";
import { QrCodeCache } from "./qr-code-cache.js";
import { encodeQrSequence } from "./qr-code-encoding.js";
import { type QrCodeUpdateInput, toQrCodeDto, toUpdatePatch } from "./qr-code-mapper.js";
import type { QrCodeDto, QrCodeEntityType } from "./qr-code-types.js";

export class QrCodeAdminCommandService {
  private readonly cache: QrCodeCache;

  constructor(
    private readonly repo: IQrCodeRepository,
    private readonly redis: Redis,
    private readonly webOrigin: string,
  ) {
    this.cache = new QrCodeCache(redis);
  }

  /**
   * Ensures a default QR code exists for the entity. Idempotent ensure — never mutates existing metadata.
   */
  async getOrCreateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<{ item: QrCodeDto; created: boolean } | null> {
    const existing = await this.getDefault(input.entityType, input.entityId);
    if (existing) return { item: existing, created: false };

    const entity = await this.repo.loadEntity(input.entityType, input.entityId);
    if (!entity) return null;

    const shortCode = await this.nextShortCode();
    try {
      const created = await this.repo.insert({
        shortCode,
        entityType: input.entityType,
        entityId: input.entityId,
        createdByUserId: input.actorUserId ?? null,
      });
      return { item: toQrCodeDto(created, entity.destinationPath, this.webOrigin), created: true };
    } catch (error) {
      const raced = await this.getDefault(input.entityType, input.entityId);
      if (raced) return { item: raced, created: false };
      throw error;
    }
  }

  async listForEntity(entityType: QrCodeEntityType, entityId: string): Promise<QrCodeDto[]> {
    const entity = await this.repo.loadEntity(entityType, entityId);
    if (!entity) return [];
    const rows = await this.repo.listForEntity(entityType, entityId);
    return rows.map((row) => toQrCodeDto(row, entity.destinationPath, this.webOrigin));
  }

  async update(id: string, patch: QrCodeUpdateInput): Promise<QrCodeDto | null> {
    const updated = await this.repo.update(id, toUpdatePatch(patch));
    if (!updated) return null;
    await this.cache.invalidate(updated.shortCode);
    const entity = await this.repo.loadEntity(updated.entityType, updated.entityId);
    if (!entity) return null;
    return toQrCodeDto(updated, entity.destinationPath, this.webOrigin);
  }

  async regenerateDefault(input: {
    entityType: QrCodeEntityType;
    entityId: string;
    actorUserId?: string | null;
  }): Promise<QrCodeDto | null> {
    const entity = await this.repo.loadEntity(input.entityType, input.entityId);
    if (!entity) return null;

    const newShortCode = await this.nextShortCode();
    const { row, oldShortCodes } = await this.repo.disableDefaultAndInsert(
      input.entityType,
      input.entityId,
      {
        shortCode: newShortCode,
        entityType: input.entityType,
        entityId: input.entityId,
        createdByUserId: input.actorUserId ?? null,
      },
    );

    await Promise.all(oldShortCodes.map((shortCode) => this.cache.invalidate(shortCode)));
    return toQrCodeDto(row, entity.destinationPath, this.webOrigin);
  }

  private async getDefault(
    entityType: QrCodeEntityType,
    entityId: string,
  ): Promise<QrCodeDto | null> {
    const entity = await this.repo.loadEntity(entityType, entityId);
    if (!entity) return null;
    const row = await this.repo.findDefaultForEntity(entityType, entityId);
    return row ? toQrCodeDto(row, entity.destinationPath, this.webOrigin) : null;
  }

  private async nextShortCode(): Promise<string> {
    const sequence = BigInt(await this.redis.incr("qr:code:sequence"));
    return encodeQrSequence(sequence);
  }
}
