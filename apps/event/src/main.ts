import { lookupErrorMessage, submitErrorMessage } from "./api-error-messages.js";
import { applyPublicConfig, setRsvpCallToActionsVisible } from "./apply-event-config.js";
import { applyEventContent, resolveEventTemplate } from "./apply-event-content.js";
import { applyEventHubSeo, applyEventSeo } from "./apply-event-seo.js";
import { applyFooterLinks } from "./apply-footer-links.js";
import { applyPageAssets } from "./apply-page-assets.js";
import { clearEmailFromUrl, parseEmailFromUrl, resolveEventSlug } from "./config.js";
import { renderEventHub } from "./event-hub.js";
import { initLotCarousel } from "./lot-carousel.js";
import { initPageEffects } from "./page-effects.js";
import { parsePassTokenFromPath } from "./pass-api.js";
import { initPassPage } from "./pass-page.js";
import { isRsvpApiError } from "./rsvp-api-error.js";
import {
  type OnsiteEventPublicConfig,
  type SegmentOption,
  fetchEventConfigWithRetry,
  lookupByEmail,
  submitRsvp,
} from "./rsvp-api.js";
import { RsvpFormController } from "./rsvp-form.js";
import { renderBootstrapError, renderBootstrapLoading } from "./rsvp-panel-messages.js";
import { type RsvpUiState, lookupToState } from "./rsvp-state.js";

async function initRsvpPanel(
  mount: HTMLElement,
  preloadedConfig?: OnsiteEventPublicConfig,
): Promise<void> {
  renderBootstrapLoading(mount);

  let config = preloadedConfig;
  if (!config) {
    try {
      config = await fetchEventConfigWithRetry();
      applyPublicConfig(config);
    } catch {
      mount.classList.remove("rsvp-panel--loading");
      renderBootstrapError(mount, () => void initRsvpPanel(mount));
      return;
    }
  }

  mount.classList.remove("rsvp-panel--loading");

  let activeUser = { name: "", email: "" };
  let segmentOptions: SegmentOption[] = config.segmentOptions;
  let activeExisting: Extract<RsvpUiState, { kind: "form" }>["existing"];
  let controller!: RsvpFormController;

  if (!config.rsvpOpen) {
    setRsvpCallToActionsVisible(false);
    controller = new RsvpFormController(mount, {
      onEmailSubmit: async () => undefined,
      onSubmit: async () => undefined,
      onRetry: () => undefined,
      onChangeEmail: () => undefined,
    });
    controller.setState({ kind: "event_closed" });
    return;
  }

  async function runEmailLookup(email: string) {
    controller.setState({ kind: "checking_email" });
    try {
      const lookup = await lookupByEmail(email);
      const state = lookupToState(lookup, email);
      if (state.kind === "form") {
        activeUser = state.user;
        segmentOptions = state.segmentOptions;
        activeExisting = state.existing;
        clearEmailFromUrl();
      }
      controller.setState(state);
    } catch (e) {
      const message = isRsvpApiError(e)
        ? e.message !== e.code
          ? e.message
          : lookupErrorMessage(e.code)
        : lookupErrorMessage(e instanceof Error ? e.message : "lookup_failed");
      controller.setState({
        kind: "error",
        message,
      });
    }
  }

  controller = new RsvpFormController(mount, {
    onEmailSubmit: runEmailLookup,
    onSubmit: async (values) => {
      controller.setState({ kind: "submitting", user: activeUser, segmentOptions });
      try {
        const result = await submitRsvp({
          email: activeUser.email,
          attendanceSegment: values.attendanceSegment,
          plusOne: values.plusOne,
          ...(values.plusOne > 0 && values.guestName ? { plusOneGuestName: values.guestName } : {}),
          ...(values.notes ? { notes: values.notes } : {}),
        });
        controller.setState({
          kind: "success",
          result,
          user: activeUser,
          segmentOptions,
          eventConfig: config,
        });
      } catch (e) {
        const message = isRsvpApiError(e)
          ? e.message !== e.code
            ? e.message
            : submitErrorMessage(e.code)
          : submitErrorMessage(e instanceof Error ? e.message : "submit_failed");
        controller.setState({
          kind: "form",
          user: activeUser,
          segmentOptions,
          ...(activeExisting ? { existing: activeExisting } : {}),
          draft: values,
          submitError: message,
        });
      }
    },
    onRetry: () => {
      const current = controller.getState();
      if (current.kind === "error") {
        controller.setState({ kind: "email_prompt" });
      }
    },
    onChangeEmail: () => {
      activeUser = { name: "", email: "" };
      activeExisting = undefined;
      clearEmailFromUrl();
      controller.setPendingEmail("");
      controller.setState({ kind: "email_prompt" });
    },
  });

  const resumeEmail = parseEmailFromUrl();
  if (resumeEmail) {
    controller.setPendingEmail(resumeEmail);
    await runEmailLookup(resumeEmail);
  } else {
    controller.setState({ kind: "email_prompt" });
  }

  if (window.location.hash === "#rsvp") {
    const target = document.getElementById("rsvp");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function showEventHub(): void {
  const eventPage = document.querySelector(".event-page");
  if (eventPage instanceof HTMLElement) eventPage.hidden = true;
  const sticky = document.getElementById("sticky-rsvp");
  if (sticky) sticky.hidden = true;
  const hubRoot = document.getElementById("event-hub-root");
  if (hubRoot) hubRoot.hidden = false;
}

async function bootstrap() {
  const passToken = parsePassTokenFromPath();
  if (passToken) {
    const passMount = document.getElementById("pass-root");
    if (passMount) {
      await initPassPage(passMount, passToken);
    }
    return;
  }

  const eventSlug = resolveEventSlug();
  if (!eventSlug) {
    showEventHub();
    applyEventHubSeo();
    applyFooterLinks();
    const hubMount = document.getElementById("event-hub-root");
    if (hubMount) {
      await renderEventHub(hubMount);
    }
    return;
  }

  let eventConfig: OnsiteEventPublicConfig | null = null;
  try {
    eventConfig = await fetchEventConfigWithRetry();
    applyPublicConfig(eventConfig);
    applyEventContent(eventConfig);
  } catch {
    /* countdown and hero copy keep bundled fallbacks */
  }

  applyEventSeo(eventConfig ?? undefined);
  applyPageAssets(eventConfig?.slug);
  applyFooterLinks(eventConfig?.opsEmail);
  initPageEffects();
  void initLotCarousel({
    saleId: eventConfig?.saleId ?? null,
    saleTitle: eventConfig?.linkedSaleTitle ?? null,
    includeModelTHighlight: eventConfig
      ? resolveEventTemplate(eventConfig.slug) === "lax001"
      : true,
  });

  const mount = document.getElementById("rsvp-panel");
  if (!mount) return;

  await initRsvpPanel(mount, eventConfig ?? undefined);
}

void bootstrap();
