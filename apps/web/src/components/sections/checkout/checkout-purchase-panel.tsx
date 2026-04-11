"use client";

import { useId, useState } from "react";

type Props = {
  hammer: string;
  buyerPremium: string;
  total: string;
  premiumPercentLabel: string;
};

export function CheckoutPurchasePanel({ hammer, buyerPremium, total, premiumPercentLabel }: Props) {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const termsId = useId();

  if (submitted) {
    return (
      <output className="block border border-primary/30 bg-primary/5 px-8 py-10 text-center">
        <p className="mb-2 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
          Request received
        </p>
        <p className="font-headline text-2xl text-on-surface">Thank you, collector.</p>
        <p className="mx-auto mt-4 max-w-md font-body text-sm text-on-surface-variant">
          Our settlements team will contact you within one business day with wire instructions and
          shipping options. Payment is due within seven days of invoice.
        </p>
      </output>
    );
  }

  return (
    <div className="space-y-10">
      <div className="border border-outline-variant/20 bg-surface-container-lowest p-8 shadow-sm">
        <h2 className="mb-8 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
          Order summary
        </h2>
        <dl className="space-y-4 font-body text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-on-surface-variant">Hammer price</dt>
            <dd className="font-headline text-lg tabular-nums text-on-surface">{hammer}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-on-surface-variant">
              Buyer&apos;s premium ({premiumPercentLabel})
            </dt>
            <dd className="font-headline text-lg tabular-nums text-primary">{buyerPremium}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-outline-variant/15 pt-4">
            <dt className="text-on-surface-variant">Shipping &amp; logistics</dt>
            <dd className="font-label text-xs uppercase tracking-widest text-secondary">
              Quoted after payment
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-outline-variant/20 pt-6">
            <dt className="font-headline text-xl text-on-surface">Total due</dt>
            <dd className="font-headline text-3xl tabular-nums text-primary">{total}</dd>
          </div>
        </dl>
      </div>

      <div className="border border-outline-variant/20 bg-surface-container-low/40 p-8">
        <h2 className="mb-4 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
          Payment
        </h2>
        <p className="mb-6 font-body text-sm leading-relaxed text-on-surface-variant">
          High-value lots are settled by bank transfer. Card payments may be available for
          qualifying invoices—your specialist will confirm options and any processing fees.
        </p>
        <p className="font-body text-sm text-on-surface">
          <span className="font-label text-[10px] uppercase tracking-widest text-primary">
            Concierge
          </span>
          <br />
          settlements@curator.example
          <br />
          <span className="text-on-surface-variant">+1 (212) 555-0142</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-y border-outline-variant/10 py-6 font-label text-[9px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            security
          </span>
          Secure escrow
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            verified
          </span>
          Certificate included
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-primary" aria-hidden>
            local_shipping
          </span>
          Insured shipping
        </span>
      </div>

      <div className="space-y-6">
        <label htmlFor={termsId} className="flex cursor-pointer items-start gap-3">
          <input
            id={termsId}
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
          />
          <span className="font-body text-sm text-on-surface-variant">
            I agree to the{" "}
            <a href="/" className="border-b border-primary/40 text-on-surface hover:border-primary">
              Terms of Sale
            </a>
            , including buyer&apos;s premium and payment deadlines.
          </span>
        </label>
        <button
          type="button"
          disabled={!termsAccepted}
          onClick={() => setSubmitted(true)}
          className="w-full bg-gradient-to-br from-primary to-primary-container py-5 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-on-primary shadow-md transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Complete purchase
        </button>
      </div>
    </div>
  );
}
