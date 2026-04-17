import type { Auction } from "@auction/types";
import type { Metadata } from "next";

export type StaticPageKey =
  | "home"
  | "about"
  | "contact"
  | "search"
  | "archive"
  | "login"
  | "register";

export interface IAuctionMetadataBuilder {
  build(auction: Auction, opts: { baseUrl: string }): Metadata;
}

export interface IStructuredDataAuction {
  buildJsonLd(auction: Auction, opts: { baseUrl: string }): Record<string, unknown>;
}

export interface IStructuredDataOrganization {
  buildJsonLd(opts: { baseUrl: string; siteName: string }): Record<string, unknown>;
}

export interface IStructuredDataBreadcrumb {
  buildJsonLd(
    items: { name: string; path: string }[],
    opts: { baseUrl: string },
  ): Record<string, unknown>;
}
