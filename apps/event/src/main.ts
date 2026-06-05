import { lookupErrorMessage, submitErrorMessage } from "./api-error-messages.js";
import { applyPublicConfig, setRsvpCallToActionsVisible } from "./apply-event-config.js";
import { applyEventSeo } from "./apply-event-seo.js";
import { applyFooterLinks } from "./apply-footer-links.js";
import { applyPageAssets } from "./apply-page-assets.js";
import { clearEmailFromUrl, parseEmailFromUrl } from "./config.js";
import { initLotCarousel } from "./lot-carousel.js";
import { initPageEffects } from "./page-effects.js";
import { parsePassTokenFromPath } from "./pass-api.js";
import { initPassPage } from "./pass-page.js";
import {
  type OnsiteEventPublicConfig,
  type SegmentOption,
  fetchEventConfigWithRetry,
  lookupByEmail,
  submitRsvp,
} from "./rsvp-api.js";
import { RsvpFormController } from "./rsvp-form.js";
import { renderBootstrapError, renderBootstrapLoading } from "./rsvp-panel-messages.js";
import { lookupToState } from "./rsvp-state.js";

async function initRsvpPanel(mount: HTMLElement): Promise<void> {
  renderBootstrapLoading(mount);

  let config: OnsiteEventPublicConfig;
  try {
    config = await fetchEventConfigWithRetry();
  } catch {
    mount.classList.remove("rsvp-panel--loading");
    renderBootstrapError(mount, () => void initRsvpPanel(mount));
    return;
  }

  mount.classList.remove("rsvp-panel--loading");
  applyPublicConfig(config);

  let activeUser = { name: "", email: "" };
  let segmentOptions: SegmentOption[] = config.segmentOptions;
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
        clearEmailFromUrl();
      }
      controller.setState(state);
    } catch (e) {
      const code = e instanceof Error ? e.message : "lookup_failed";
      controller.setState({
        kind: "error",
        message: lookupErrorMessage(code),
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
        controller.setState({ kind: "success", result, user: activeUser, segmentOptions });
      } catch (e) {
        const code = e instanceof Error ? e.message : "submit_failed";
        controller.setState({ kind: "error", message: submitErrorMessage(code) });
      }
    },
    onRetry: () => controller.setState({ kind: "email_prompt" }),
    onChangeEmail: () => {
      activeUser = { name: "", email: "" };
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

async function bootstrap() {
  const passToken = parsePassTokenFromPath();
  if (passToken) {
    const passMount = document.getElementById("pass-root");
    if (passMount) {
      await initPassPage(passMount, passToken);
    }
    return;
  }

  applyEventSeo();
  applyPageAssets();
  applyFooterLinks();
  initPageEffects();
  void initLotCarousel();

  const mount = document.getElementById("rsvp-panel");
  if (!mount) return;

  await initRsvpPanel(mount);
}

void bootstrap();
