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
