import type { AppType } from "@auction/api/app";
import { hc } from "hono/client";

/**
 * Hono's inferred `hc<AppType>` client type can collapse to `unknown` in this workspace.
 * We keep a narrow structural type for the routes the web app calls.
 */
export type RpcApp = {
  auctions: {
    $get: (args: { query: Record<string, string> }) => Promise<Response>;
    archive: {
      summary: {
        $get: (args?: { query?: Record<string, string> }) => Promise<Response>;
      };
      count: {
        $get: (args?: { query?: Record<string, string> }) => Promise<Response>;
      };
    };
    ":id": {
      $get: (args: { param: { id: string } }) => Promise<Response>;
      bids: {
        $get: (args: { param: { id: string }; query?: Record<string, string> }) => Promise<Response>;
      };
    };
  };
  bids: {
    $post: (args: {
      json: { auctionId: string; amount: number; maxAutoBidAmount?: number };
    }) => Promise<Response>;
  };
  users: {
    public: {
      ":userId": {
        $get: (args: { param: { userId: string } }) => Promise<Response>;
      };
    };
    me: {
      $get: () => Promise<Response>;
      bids: { $get: () => Promise<Response> };
      portfolio: { $get: () => Promise<Response> };
      watchlist: {
        $get: () => Promise<Response>;
        $post: (args: { json: { auctionId: string } }) => Promise<Response>;
      };
      notifications: {
        $get: (args?: { query?: Record<string, string> }) => Promise<Response>;
      };
    };
  };
  categories: {
    $get: () => Promise<Response>;
  };
  payments: {
    $post: (args: { json: { auctionId: string } }) => Promise<Response>;
  };
};

export function hcAsRpcApp(
  base: string,
  init?: { fetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> },
): RpcApp {
  return hc<AppType>(base, init) as unknown as RpcApp;
}
