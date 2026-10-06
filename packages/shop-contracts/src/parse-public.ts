import "./contract-formats.js";
import { Value } from "@sinclair/typebox/value";
import {
  type PublicArtistDetail,
  PublicArtistDetailSchema,
  type PublicArtistList,
  PublicArtistListSchema,
} from "./artist-public.js";
import {
  type ArtworkInterestStatus,
  ArtworkInterestStatusSchema,
  type RegisterArtworkInterestResponse,
  RegisterArtworkInterestResponseSchema,
} from "./artwork-interest-public.js";
import {
  type PublicArtworkDetail,
  PublicArtworkDetailSchema,
  type PublicArtworkList,
  PublicArtworkListSchema,
} from "./artwork-public.js";
import {
  type PublicCategoryList,
  PublicCategoryListSchema,
  type PublicCategorySummary,
  PublicCategorySummarySchema,
} from "./category-public.js";
import {
  type BasketResponse,
  BasketResponseSchema,
  type BasketView,
  BasketViewSchema,
  type CheckoutSession,
  CheckoutSessionSchema,
  type OrderList,
  OrderListSchema,
  type OrderSummary,
  OrderSummarySchema,
} from "./commerce-public.js";
import {
  type PublicMerchandiseProductList,
  PublicMerchandiseProductListSchema,
} from "./merchandise-public.js";
import {
  type PortalDocument,
  PortalDocumentsResponseSchema,
  type PortalEdition,
  PortalEditionsResponseSchema,
  type PortalPayout,
  PortalPayoutsResponseSchema,
  type PortalSaleAuthority,
  type PortalSaleAuthorityRequest,
  PortalSaleAuthorityRequestsResponseSchema,
  PortalSaleAuthorityResponseSchema,
  type PortalSaleStatement,
  PortalSalesResponseSchema,
} from "./portal-me.js";

export class ShopContractParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopContractParseError";
  }
}

export function parsePublicArtworkList(value: unknown): PublicArtworkList {
  if (!Value.Check(PublicArtworkListSchema, value)) {
    throw new ShopContractParseError("Invalid public artwork list payload");
  }
  return value;
}

export function parsePublicArtworkDetail(value: unknown): PublicArtworkDetail {
  if (!Value.Check(PublicArtworkDetailSchema, value)) {
    throw new ShopContractParseError("Invalid public artwork detail payload");
  }
  return value;
}

export function parsePublicCategoryList(value: unknown): PublicCategoryList {
  if (!Value.Check(PublicCategoryListSchema, value)) {
    throw new ShopContractParseError("Invalid public category list payload");
  }
  return value;
}

export function parsePublicCategorySummary(value: unknown): PublicCategorySummary {
  if (!Value.Check(PublicCategorySummarySchema, value)) {
    throw new ShopContractParseError("Invalid public category payload");
  }
  return value;
}

export function parsePublicMerchandiseProductList(value: unknown): PublicMerchandiseProductList {
  if (!Value.Check(PublicMerchandiseProductListSchema, value)) {
    throw new ShopContractParseError("Invalid public merchandise product list payload");
  }
  return value;
}

export function parsePublicArtistList(value: unknown): PublicArtistList {
  if (!Value.Check(PublicArtistListSchema, value)) {
    throw new ShopContractParseError("Invalid public artist list payload");
  }
  return value;
}

export function parsePublicArtistDetail(value: unknown): PublicArtistDetail {
  if (!Value.Check(PublicArtistDetailSchema, value)) {
    throw new ShopContractParseError("Invalid public artist detail payload");
  }
  return value;
}

export function parseBasketView(value: unknown): BasketView {
  if (!Value.Check(BasketViewSchema, value)) {
    throw new ShopContractParseError("Invalid basket payload");
  }
  return value;
}

export function parseBasketResponse(value: unknown): BasketResponse {
  if (!Value.Check(BasketResponseSchema, value)) {
    throw new ShopContractParseError("Invalid basket payload");
  }
  return value;
}

export function parseOrderList(value: unknown): OrderList {
  if (!Value.Check(OrderListSchema, value)) {
    throw new ShopContractParseError("Invalid order list payload");
  }
  return value;
}

export function parseOrderSummary(value: unknown): OrderSummary {
  if (!Value.Check(OrderSummarySchema, value)) {
    throw new ShopContractParseError("Invalid order payload");
  }
  return value;
}

export function parseCheckoutSession(value: unknown): CheckoutSession {
  if (!Value.Check(CheckoutSessionSchema, value)) {
    throw new ShopContractParseError("Invalid checkout session payload");
  }
  return value;
}

export function parseArtworkInterestStatus(value: unknown): ArtworkInterestStatus {
  if (!Value.Check(ArtworkInterestStatusSchema, value)) {
    throw new ShopContractParseError("Invalid artwork interest status payload");
  }
  return value;
}

export function parseRegisterArtworkInterestResponse(
  value: unknown,
): RegisterArtworkInterestResponse {
  if (!Value.Check(RegisterArtworkInterestResponseSchema, value)) {
    throw new ShopContractParseError("Invalid register artwork interest payload");
  }
  return value;
}

export function parsePortalEditions(value: unknown): PortalEdition[] {
  if (!Value.Check(PortalEditionsResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal editions payload");
  }
  return value.items;
}

export function parsePortalSaleAuthority(value: unknown): PortalSaleAuthority[] {
  if (!Value.Check(PortalSaleAuthorityResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal sale authority payload");
  }
  return value.items;
}

export function parsePortalSaleAuthorityRequests(value: unknown): PortalSaleAuthorityRequest[] {
  if (!Value.Check(PortalSaleAuthorityRequestsResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal sale authority requests payload");
  }
  return value.items;
}

export function parsePortalPayouts(value: unknown): PortalPayout[] {
  if (!Value.Check(PortalPayoutsResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal payouts payload");
  }
  return value.items;
}

export function parsePortalDocuments(value: unknown): PortalDocument[] {
  if (!Value.Check(PortalDocumentsResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal documents payload");
  }
  return value.items;
}

export function parsePortalSales(value: unknown): PortalSaleStatement[] {
  if (!Value.Check(PortalSalesResponseSchema, value)) {
    throw new ShopContractParseError("Invalid portal sales payload");
  }
  return value.items;
}
