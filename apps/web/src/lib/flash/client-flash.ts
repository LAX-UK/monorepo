import { type FlashAudience, pathUnder } from "./flash-audience";

/** The seller pages under `/selling` that actions send people back to with a message. */
export const CLIENT_FLASH: FlashAudience = {
  cookie: "lax-client-flash",
  keyContext: "lax-bid:client-flash:v1",
  isFlashablePath: (path) => pathUnder("/selling", path),
};

/** Where the page tells the server its message has been shown. */
export const CLIENT_FLASH_CLEAR_ENDPOINT = "/api/flash";
