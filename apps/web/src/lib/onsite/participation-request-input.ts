import { z } from "zod";

const contactFields = {
  name: z.string().min(1, "Enter your name").max(120),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(5, "Enter a phone number").max(40),
  billingAddress: z.string().min(5, "Enter a billing address").max(500),
  website: z.string().optional(),
};

export const absenteeBidFormSchema = z.object({
  ...contactFields,
  maxHammerBid: z.string().min(1, "Enter your maximum hammer bid"),
});

export type AbsenteeBidFormValues = z.infer<typeof absenteeBidFormSchema>;

export type OnsiteParticipationContext = {
  saleTitle: string;
  lotNumber: number | null;
  lotTitle: string;
  lotUrl: string;
};

export function buildAbsenteeMailto(
  ctx: OnsiteParticipationContext,
  values: AbsenteeBidFormValues,
  supportEmail: string,
): string {
  const subject = encodeURIComponent(
    `Absentee bid: ${ctx.saleTitle} — Lot ${ctx.lotNumber ?? ""} ${ctx.lotTitle}`,
  );
  const body = encodeURIComponent(
    [
      "I would like to place a confidential absentee bid for:",
      "",
      `Sale: ${ctx.saleTitle}`,
      `Lot Number: ${ctx.lotNumber ?? "N/A"}`,
      `Lot Title: ${ctx.lotTitle}`,
      `Lot URL: ${ctx.lotUrl}`,
      "",
      `Maximum Hammer Price Bid: ${values.maxHammerBid} (excluding buyer's premium and taxes)`,
      "",
      `Name: ${values.name}`,
      `Email: ${values.email}`,
      `Phone: ${values.phone}`,
      `Billing Address: ${values.billingAddress}`,
    ].join("\n"),
  );
  return `mailto:${supportEmail}?subject=${subject}&body=${body}`;
}
