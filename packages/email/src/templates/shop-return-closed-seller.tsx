import { Layout } from "../components/Layout.js";
import { TextBlock } from "../components/TextBlock.js";
import type { TemplateVarsByName } from "../types.js";

type Vars = TemplateVarsByName["shop-return-closed-seller"];

export const subject = (vars: Vars) => `${vars.artworkTitle} has been returned to you`;

const STOCK_COPY: Record<Vars["stockOutcome"], (print: string) => string> = {
  back_on_sale: (print) =>
    `${print} came back to the gallery and is back in your stock. It is on sale again.`,
  in_stock_not_on_sale: (print) =>
    `${print} came back to the gallery and is back in your stock. It is not on sale at the moment because its sale authority has changed.`,
  written_off: (print) =>
    `${print} came back to the gallery damaged, so we have written it off. It will not be offered for sale again.`,
};

const PAYOUT_COPY: Record<Vars["payout"], string> = {
  none: "No payout was due for this sale, so your payouts are not affected.",
  withheld: "The sale was refunded, so no payout will be made for it.",
  recovered:
    "The sale was refunded after your payout had been paid, so the amount will be taken from a later payout.",
};

export default function ShopReturnClosedSellerEmail(vars: Vars) {
  const print = `${vars.artworkTitle} (${vars.editionLabel})`;
  return (
    <Layout
      category="auction"
      eyebrow="Return"
      preview={`${print} has been returned to you`}
      title="A returned print has been received"
    >
      <TextBlock>{STOCK_COPY[vars.stockOutcome](print)}</TextBlock>
      <TextBlock>{PAYOUT_COPY[vars.payout]}</TextBlock>
    </Layout>
  );
}
