import { accountLiveHealthBody } from "@/server/operational-health";
import { NextResponse } from "next/server";

export function GET(): Response {
  return NextResponse.json(accountLiveHealthBody());
}
