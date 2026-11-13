import { contactFormValuesSchema } from "@/lib/contact/contact-input";
import { publicFormResolver } from "@/lib/forms/public-form-resolver";

/** The contact form's check, loaded with its first use (see `lazyResolver`). */
export const contactFormResolver = publicFormResolver(contactFormValuesSchema);
