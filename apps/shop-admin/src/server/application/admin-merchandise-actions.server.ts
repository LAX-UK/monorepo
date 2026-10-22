"use server";

import type {
  NewProductPayload,
  ProductFieldsPayload,
  StockPayload,
  VariantPayload,
} from "@/lib/merchandise-form";
import type { MerchandiseProductDetail } from "@auction/shop-contracts";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";
import { fetchAdminJson } from "./load-admin-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid product request.",
} as const satisfies AdminMutationResult<never>;

function productPath(productId: string): string | null {
  return UUID.test(productId) ? `merchandise/products/${productId}` : null;
}

function variantPath(variantId: string): string | null {
  return UUID.test(variantId) ? `merchandise/variants/${variantId}` : null;
}

/** The product as stored now, for the editor's "reload" after someone else saved first. */
export async function getMerchandiseProductDetail(
  productId: string,
): Promise<AdminMutationResult<MerchandiseProductDetail>> {
  const path = productPath(productId);
  if (!path) return invalidInput;
  const result = await fetchAdminJson<MerchandiseProductDetail>(path);
  switch (result.status) {
    case "ok":
      return { ok: true, data: result.data };
    case "unauthorized":
      return { ok: false, kind: "unauthorized" };
    case "forbidden":
      return { ok: false, kind: "forbidden" };
    case "not_found":
      return { ok: false, kind: "failed", message: "This product no longer exists." };
    default:
      return { ok: false, kind: "failed", message: "Could not load this product." };
  }
}

export async function createMerchandiseProduct(input: {
  payload: NewProductPayload;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ productId: string }>> {
  return forwardAdminJsonMutation<{ productId: string }>({
    bffPath: "merchandise/products",
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function saveMerchandiseProduct(input: {
  productId: string;
  payload: ProductFieldsPayload;
  /** The version the editor opened, or the one it chose to overwrite. */
  expectedVersion: string;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = productPath(input.productId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ version: string }>({
    bffPath: path,
    method: "PUT",
    jsonBody: { ...input.payload, expectedVersion: input.expectedVersion },
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setMerchandiseProductArchived(input: {
  productId: string;
  archived: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ version: string }>> {
  const path = productPath(input.productId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ version: string }>({
    bffPath: `${path}/${input.archived ? "archive" : "restore"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function addMerchandiseVariant(input: {
  productId: string;
  payload: VariantPayload;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ variantId: string }>> {
  const path = productPath(input.productId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ variantId: string }>({
    bffPath: `${path}/variants`,
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function updateMerchandiseVariant(input: {
  variantId: string;
  payload: VariantPayload;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ variantId: string }>> {
  const path = variantPath(input.variantId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ variantId: string }>({
    bffPath: path,
    method: "PUT",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function setMerchandiseVariantArchived(input: {
  variantId: string;
  archived: boolean;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ variantId: string }>> {
  const path = variantPath(input.variantId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ variantId: string }>({
    bffPath: `${path}/${input.archived ? "archive" : "restore"}`,
    method: "POST",
    idempotencyKey: input.idempotencyKey,
  });
}

export async function adjustMerchandiseStock(input: {
  variantId: string;
  payload: StockPayload;
  idempotencyKey: string;
}): Promise<AdminMutationResult<{ variantId: string; onHand: number }>> {
  const path = variantPath(input.variantId);
  if (!path) return invalidInput;
  return forwardAdminJsonMutation<{ variantId: string; onHand: number }>({
    bffPath: `${path}/adjust-stock`,
    method: "POST",
    jsonBody: input.payload,
    idempotencyKey: input.idempotencyKey,
  });
}
