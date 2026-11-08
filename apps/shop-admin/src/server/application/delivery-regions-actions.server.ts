"use server";

import type { AdminDeliveryRegions } from "@auction/shop-contracts";
import { DELIVERY_REGION_IDS, type DeliveryRegionId } from "@auction/shop-domain";
import type { AdminMutationResult } from "./admin-mutation-result";
import { forwardAdminJsonMutation } from "./forward-admin-mutation";

/*
 * LAX Admin's calls for Delivery regions: save one region, and save the countries not delivered
 * to. shop-api applies every rule again and returns the regions as saved.
 */

const COUNTRY_CODE = /^[A-Z]{2}$/;

const invalidInput = {
  ok: false,
  kind: "validation",
  message: "Invalid delivery settings.",
} as const satisfies AdminMutationResult<never>;

export async function saveDeliveryRegion(input: {
  id: DeliveryRegionId;
  standardMinDays: number;
  standardMaxDays: number;
  specialistMinDays: number;
  specialistMaxDays: number;
  fixedPricePence: number | null;
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminDeliveryRegions>> {
  if (!(DELIVERY_REGION_IDS as readonly string[]).includes(input.id)) return invalidInput;
  const { id, idempotencyKey, ...body } = input;
  return forwardAdminJsonMutation({
    bffPath: `delivery-regions/${id}`,
    method: "PUT",
    jsonBody: body,
    idempotencyKey,
  });
}

export async function saveNotDeliveredTo(input: {
  countries: string[];
  idempotencyKey: string;
}): Promise<AdminMutationResult<AdminDeliveryRegions>> {
  if (!input.countries.every((code) => COUNTRY_CODE.test(code))) return invalidInput;
  return forwardAdminJsonMutation({
    bffPath: "delivery-regions/not-delivered-to",
    method: "PUT",
    jsonBody: { countries: input.countries },
    idempotencyKey: input.idempotencyKey,
  });
}
