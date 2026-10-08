import { NextResponse } from "next/server";
import { shopAdminLiveHealthBody } from "../../../server/operational-health";

/** Liveness only — no Shop API or OIDC config (safe during platform rollouts). */
export function GET(): Response {
  return NextResponse.json(shopAdminLiveHealthBody());
}
