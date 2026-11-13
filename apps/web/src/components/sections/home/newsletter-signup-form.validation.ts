import { publicFormResolver } from "@/lib/forms/public-form-resolver";
import { type NewsletterSubscribeInput, newsletterSubscribeSchema } from "@auction/validators";

/** The newsletter form's check, loaded with its first use (see `lazyResolver`). */
export const newsletterSignupResolver =
  publicFormResolver<NewsletterSubscribeInput>(newsletterSubscribeSchema);
