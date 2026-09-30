import { isBackgroundAuthRequest } from "@auction/identity-rp";
import type { NextRequest } from "next/server";

export function isBackgroundNextAuthRequest(request: NextRequest): boolean {
  return isBackgroundAuthRequest((name) => request.headers.get(name));
}
