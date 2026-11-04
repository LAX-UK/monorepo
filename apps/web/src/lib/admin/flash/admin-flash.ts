import { type FlashAudience, pathUnder } from "@/lib/flash/flash-audience";

/** The staff pages under `/admin`. */
export const ADMIN_FLASH: FlashAudience = {
  cookie: "lax-admin-flash",
  keyContext: "lax-bid:admin-flash:v1",
  isFlashablePath: (path) => pathUnder("/admin", path),
};

/** Where a staff page tells the server its message has been shown. */
export const ADMIN_FLASH_CLEAR_ENDPOINT = "/api/admin/flash";
