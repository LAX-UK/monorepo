import assert from "node:assert/strict";
import test from "node:test";
import { notificationPreferencePatchSchema } from "./notification.js";

test("notificationPreferencePatchSchema accepts email and whatsapp channel fields", () => {
  const parsed = notificationPreferencePatchSchema.parse({
    outbidEmail: true,
    wonEmail: true,
    lostEmail: false,
    endingSoonEmail: true,
    watchlistEmail: false,
    paymentEmail: true,
    lotEndedSellerEmail: true,
    outbidWhatsapp: false,
    wonWhatsapp: false,
    lostWhatsapp: false,
    endingSoonWhatsapp: false,
    watchlistWhatsapp: false,
    paymentWhatsapp: false,
    lotEndedSellerWhatsapp: false,
    quietStart: null,
    quietEnd: "18:00",
  });

  assert.equal(parsed.paymentEmail, true);
  assert.equal(parsed.lotEndedSellerWhatsapp, false);
  assert.equal(parsed.quietStart, null);
  assert.equal(parsed.quietEnd, "18:00");
});

test("notificationPreferencePatchSchema takes a real IANA time zone for quiet hours", () => {
  assert.equal(
    notificationPreferencePatchSchema.parse({ quietTimeZone: "Europe/London" }).quietTimeZone,
    "Europe/London",
  );
  assert.equal(
    notificationPreferencePatchSchema.safeParse({ quietTimeZone: "Mars/Olympus" }).success,
    false,
  );
});
