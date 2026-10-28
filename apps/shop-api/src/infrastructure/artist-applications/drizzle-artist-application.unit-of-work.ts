import type { Database } from "@auction/db";
import type {
  ArtistApplicationUnitOfWork,
  Clock,
} from "../../application/artist-applications/artist-application.ports.js";
import type { ShopUnitOfWorkFactory } from "../../application/ports/shop-unit-of-work.js";
import { shopPhaseDbSession } from "../drizzle-shop-transaction-effects.js";
import { createDrizzleApplicantDirectory } from "./artist-application-adapters.js";
import { createDrizzleArtistApplicationStore } from "./drizzle-artist-application.store.js";
import { createDrizzleArtistOnboarding } from "./drizzle-artist-onboarding.js";
import {
  type ArtistApplicationLinks,
  createOutboxArtistApplicationNotifier,
} from "./outbox-artist-application.notifier.js";

/** Binds every artist application port to one shop transaction. */
export function createDrizzleArtistApplicationUnitOfWork(
  uow: ShopUnitOfWorkFactory,
  options: {
    resolveMediaUrl: (value: string | null | undefined) => string | null;
    links: ArtistApplicationLinks;
    clock: Clock;
  },
): ArtistApplicationUnitOfWork {
  return {
    run: (fn) =>
      uow.run((tx) => {
        const db = shopPhaseDbSession(tx) as Database;
        return fn({
          applications: createDrizzleArtistApplicationStore(db, {
            resolveMediaUrl: options.resolveMediaUrl,
          }),
          applicants: createDrizzleApplicantDirectory(db),
          onboarding: createDrizzleArtistOnboarding(tx, {
            resolveMediaUrl: options.resolveMediaUrl,
          }),
          notifier: createOutboxArtistApplicationNotifier(db, options.links, () =>
            options.clock.now(),
          ),
          audit: tx.audit,
        });
      }),
  };
}
