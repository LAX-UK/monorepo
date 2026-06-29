import type { IAdminSaleroomDisplayService } from "../interfaces/admin-routes.js";
import type { IDisplayOverlayService } from "../interfaces/display-overlay-service.js";
import type { IDisplayPairingService } from "../interfaces/display-pairing-service.js";

export class AdminSaleroomDisplayApplicationService implements IAdminSaleroomDisplayService {
  constructor(
    private readonly pairing: IDisplayPairingService,
    private readonly overlay: IDisplayOverlayService,
  ) {}

  approvePairing(...args: Parameters<IDisplayPairingService["approvePairing"]>) {
    return this.pairing.approvePairing(...args);
  }

  revokePairing(...args: Parameters<IDisplayPairingService["revokePairing"]>) {
    return this.pairing.revokePairing(...args);
  }

  listDevices(...args: Parameters<IDisplayPairingService["listDevices"]>) {
    return this.pairing.listDevices(...args);
  }

  setOverlay(...args: Parameters<IDisplayOverlayService["setOverlay"]>) {
    return this.overlay.setOverlay(...args);
  }

  clearOverlay(...args: Parameters<IDisplayOverlayService["clearOverlay"]>) {
    return this.overlay.clearOverlay(...args);
  }
}
