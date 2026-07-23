import type { Result } from "neverthrow";
import type { BidError } from "../../../lib/errors.js";

export type BiddingRouteServiceError = {
  message: string;
  status: number;
  code?: string;
};

export type BiddingRouteOk<T> = { kind: "ok"; data: T; status?: number };
export type BiddingRouteReplay<T> = { kind: "replay"; data: T; status?: number };
export type BiddingRouteErr = { kind: "err"; error: BiddingRouteServiceError };

export type BiddingRouteOutcome<T> = BiddingRouteOk<T> | BiddingRouteReplay<T> | BiddingRouteErr;

export function biddingRouteFromBidError(error: BidError): BiddingRouteErr {
  return {
    kind: "err",
    error: {
      message: error.message,
      status: error.status,
      ...(error.code ? { code: error.code } : {}),
    },
  };
}

export function biddingRouteFromServiceResult<T>(
  result: Result<T, BiddingRouteServiceError>,
  status?: number,
): BiddingRouteOutcome<T> {
  if (result.isErr()) return { kind: "err", error: result.error };
  if (status !== undefined) return { kind: "ok", data: result.value, status };
  return { kind: "ok", data: result.value };
}
