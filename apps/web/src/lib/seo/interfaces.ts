import type { Lot } from "@auction/types";
import type { Metadata } from "next";

export type StaticPageKey =
  | "home"
  | "about"
  | "contact"
  | "search"
  | "archive"
  | "login"
  | "register";

export interface ILotMetadataBuilder {
  build(lot: Lot, opts: { baseUrl: string }): Metadata;
}

export interface IStructuredDataLot {
  buildJsonLd(lot: Lot, opts: { baseUrl: string }): Record<string, unknown>;
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
