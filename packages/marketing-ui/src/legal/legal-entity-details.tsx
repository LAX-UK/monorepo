import { type LegalEntity, legalEntityFacts } from "@auction/branding";
import type { ReactNode } from "react";
import { LegalPlaceholder } from "./legal-document.js";

const PLACEHOLDER = /^\[TO CONFIRM: (.+)\]$/;

function Fact({ value }: { value: string }): ReactNode {
  const placeholder = value.match(PLACEHOLDER);
  return placeholder ? <LegalPlaceholder>[TO CONFIRM: {placeholder[1]}]</LegalPlaceholder> : value;
}

export type LegalEntityDetailsProps = {
  entities: readonly LegalEntity[];
};

/**
 * "Who we are": the registered company (or companies) behind a product, with any detail not yet
 * confirmed shown as a highlighted placeholder.
 */
export function LegalEntityDetails({ entities }: LegalEntityDetailsProps) {
  return (
    <div className="lax-legal__entities">
      {entities.map((entity) => {
        const facts = legalEntityFacts(entity);
        return (
          <dl key={entity.id} className="lax-legal__entity">
            <dt>Company</dt>
            <dd>{facts.name}</dd>
            <dt>Registered in</dt>
            <dd>
              <Fact value={facts.registeredIn} />
            </dd>
            <dt>Company number</dt>
            <dd>
              <Fact value={facts.companyNumber} />
            </dd>
            <dt>Registered office</dt>
            <dd>{facts.registeredAddress}</dd>
            {facts.vatNumber === null ? null : (
              <>
                <dt>VAT number</dt>
                <dd>
                  <Fact value={facts.vatNumber} />
                </dd>
              </>
            )}
          </dl>
        );
      })}
    </div>
  );
}
