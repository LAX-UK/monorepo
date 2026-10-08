import { NextResponse } from "next/server";
import { getShopAdminContainer } from "../../../server/container";

/** Liveness only — no Shop API dependency checks (safe during platform rollouts). */
export function GET(): Response {
  const container = getShopAdminContainer();
  return NextResponse.json({
    status: "ok",
    release: container.config.release ?? "unknown",
  });
}
