import type { Database } from "@auction/db";
import { SellerTermsPolicy, commissionPercentToBps } from "@auction/domain";
import { gbpPenceToMajorString } from "@auction/finance-runtime";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleCommissionVatSettingReader,
  DrizzleLotReawardRepository,
  DrizzleLotRegisterLinkReader,
  DrizzleLotReofferRepository,
  DrizzleReofferStaffReader,
  DrizzleReofferViewsReader,
  DrizzleReofferWorkflowReader,
  DrizzleSellerConsentRepository,
  DrizzleSellerTermsFactsReader,
  DrizzleSoldAttentionStore,
} from "@auction/persistence/repositories";
import { RegisterArtworkPlaceGuard } from "../services/reoffer/register-artwork-place.guard.js";
import { RegisterMoneyPauseGuard } from "../services/reoffer/register-money-pause.guard.js";
import { ReofferConsentService } from "../services/reoffer/reoffer-consent.service.js";
import { lotOwnershipFromAccount } from "../services/reoffer/reoffer-lot-ownership.js";
import { ReofferOfferService } from "../services/reoffer/reoffer-offer.service.js";
import type {
  IReofferInvoicing,
  IReofferPricing,
  IReofferSellerRate,
} from "../services/reoffer/reoffer-ports.js";
import { ReofferPreviewService } from "../services/reoffer/reoffer-preview.service.js";
import { ReofferReadsService } from "../services/reoffer/reoffer-reads.service.js";
import { ReofferResponseService } from "../services/reoffer/reoffer-response.service.js";
import { settlementSellerProceeds } from "../services/reoffer/reoffer-seller-proceeds.js";
import { ReofferStartService } from "../services/reoffer/reoffer-start.service.js";
import type { ContainerPaymentsServices } from "./create-payments-services.js";
import type { ContainerPlatformServices } from "./create-platform-services.js";
import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerReofferServices = {
  start: ReofferStartService;
  consent: ReofferConsentService;
  offer: ReofferOfferService;
  response: ReofferResponseService;
  reads: ReofferReadsService;
  preview: ReofferPreviewService;
};

export function createReofferServices(input: {
  db: Database;
  platform: Pick<ContainerPlatformServices, "transactionRunner" | "lotLifecycleRecording">;
  repos: Pick<ContainerRepositories, "lotRepo">;
  payments: Pick<ContainerPaymentsServices, "lotInvoiceInitiationService" | "invoiceRaiser">;
}): ContainerReofferServices {
  const { db, platform, payments } = input;
  const sellerFacts = new DrizzleSellerTermsFactsReader(db);
  const terms = new SellerTermsPolicy(sellerFacts, new DrizzleCommissionVatSettingReader(db));
  const workflow = new DrizzleReofferWorkflowReader();
  const offers = new DrizzleLotReofferRepository();
  const consents = new DrizzleSellerConsentRepository(db);
  const reaward = new DrizzleLotReawardRepository();
  const links = new DrizzleLotRegisterLinkReader(db);
  const place = new RegisterArtworkPlaceGuard(links, new DrizzleArtworkRegisterRepository(db));
  const moneyPause = new RegisterMoneyPauseGuard(links, new DrizzleSoldAttentionStore(db));
  const base = {
    transactionRunner: platform.transactionRunner,
    workflow,
    offers,
    recorder: platform.lotLifecycleRecording,
  };

  // The same pricing the invoice uses, so the total the bidder is shown is the total they are billed.
  const pricing: IReofferPricing = {
    async priceFor({ lotId, buyerLegalEntityId, hammerPence }) {
      const found = await input.repos.lotRepo.findById(lotId);
      if (!found) throw new Error(`Lot ${lotId} not found for pricing`);
      const priced = await payments.invoiceRaiser.price({
        ...found,
        buyerLegalEntityId,
        currentPrice: gbpPenceToMajorString(hammerPence),
      });
      return {
        lines: priced.lines,
        totalPence: priced.totalPence,
        invoiceDueAt: priced.existing?.dueAt ?? null,
      };
    },
  };
  const proceeds = settlementSellerProceeds({ pricing, terms });
  // The rate of the same signed agreement the proceeds were worked out on.
  const sellerRate: IReofferSellerRate = {
    async commissionBpsFor(lotId, sellerLegalEntityId) {
      const agreement = await sellerFacts.agreementForLot(lotId, sellerLegalEntityId);
      if (!agreement?.acceptedAt || agreement.legalEntityId !== sellerLegalEntityId) return null;
      return commissionPercentToBps(agreement.commissionPercent);
    },
  };
  const invoicing: IReofferInvoicing = {
    async raiseFor(lotId) {
      await payments.lotInvoiceInitiationService.ensureForLot(lotId);
    },
  };

  return {
    start: new ReofferStartService({
      ...base,
      atg: links,
      proceeds,
      // LAX-owned stock is the seller account's own subkind, never a list kept in configuration.
      ownership: lotOwnershipFromAccount(sellerFacts),
    }),
    consent: new ReofferConsentService({ ...base, consents }),
    offer: new ReofferOfferService({ ...base, consents, atg: links, place, moneyPause }),
    response: new ReofferResponseService({
      ...base,
      consents,
      reaward,
      atg: links,
      place,
      moneyPause,
      invoicing,
      pricing,
    }),
    reads: new ReofferReadsService({
      db,
      views: new DrizzleReofferViewsReader(db),
      workflow,
      pricing,
      sellerRate,
    }),
    preview: new ReofferPreviewService({
      db,
      staff: new DrizzleReofferStaffReader(),
      workflow,
      atg: links,
    }),
  };
}
