import { errorCopy } from "@/lib/forms/error-copy";
import { z } from "zod";
import {
  type EnquiryFormValues,
  budgetOptions,
  parseLocation,
  parsePriceInMindMinor,
  timingOptions,
} from "./enquiry-values";

/*
 * The enquiry form's Zod schema, apart from the values and options in `enquiry-values.ts` so the
 * private sales page loads it with the form's validation, not in its first scripts.
 */

const PHONE = /^\+?[\d\s().-]{6,}$/;

const flat = z.object({
  path: z.enum(["sell", "buy"]),
  departmentSlug: z.string(),
  artist: z.string().max(200, errorCopy.maxLength(200)),
  title: z.string().max(300, errorCopy.maxLength(300)),
  mediumSize: z.string().max(200, errorCopy.maxLength(200)),
  location: z.string().max(240, errorCopy.maxLength(240)),
  price: z.string(),
  priceNotSure: z.boolean(),
  lookingFor: z.string().max(2000, errorCopy.maxLength(2000)),
  budgetBand: z.string(),
  timing: z.string(),
  notes: z.string().max(5000, errorCopy.maxLength(5000, "your notes")),
  name: z
    .string()
    .trim()
    .min(1, errorCopy.required("your name"))
    .max(120, errorCopy.maxLength(120, "your name")),
  email: z.string().trim().min(1, errorCopy.email).email(errorCopy.email),
  phone: z.string().trim(),
  contactPreference: z.enum(["email", "phone", "either"]),
  marketingOptIn: z.boolean(),
  website: z.string(),
});

/** The sender's answers, checked for the path they chose; the other path's fields are not asked. */
export const enquiryFormSchema = flat.superRefine((values, ctx) => {
  const fail = (path: keyof EnquiryFormValues, message: string) =>
    ctx.addIssue({ code: "custom", path: [path], message });

  if (values.path === "sell") {
    if (!values.departmentSlug) fail("departmentSlug", errorCopy.requiredChoice("a department"));
    if (!values.artist.trim()) fail("artist", 'Enter the artist or maker, or "Unknown"');
    if (!values.title.trim()) fail("title", "Enter a title or short description");
    if (!values.location.trim()) {
      fail("location", "Enter where the work is now, like London, UK");
    } else if (!parseLocation(values.location)) {
      fail("location", "Enter the town and country, like London, UK");
    }
    if (!values.priceNotSure && parsePriceInMindMinor(values.price) === null) {
      fail("price", "Enter an amount in pounds, like 45,000");
    }
  } else {
    if (values.lookingFor.trim().length < 3) fail("lookingFor", "Tell us what you are looking for");
    if (!budgetOptions.some((o) => o.value === values.budgetBand)) {
      fail("budgetBand", errorCopy.requiredChoice("a budget"));
    }
    if (!timingOptions.some((o) => o.value === values.timing)) {
      fail("timing", errorCopy.requiredChoice("a timing"));
    }
  }

  const phone = values.phone.trim();
  if (phone && !PHONE.test(phone)) {
    fail("phone", errorCopy.phone);
  } else if (!phone && values.contactPreference !== "email") {
    fail("phone", "Enter a phone number so we can call you");
  }
});
