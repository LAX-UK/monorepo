import { publicFormResolver } from "@/lib/forms/public-form-resolver";
import { enquiryFormSchema } from "@/lib/private-sales/enquiry-form-schema";
import type { EnquiryFormValues } from "@/lib/private-sales/enquiry-values";

/** The enquiry form's check, loaded with its first use (see `lazyResolver`). */
export const enquiryFormResolver = publicFormResolver<EnquiryFormValues>(enquiryFormSchema);
