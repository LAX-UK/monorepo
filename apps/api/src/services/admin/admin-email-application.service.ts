import type { IEmailObservabilityRepository } from "@auction/persistence";
import type { IAdminEmailApplicationService } from "../interfaces/admin-routes.js";

export class AdminEmailApplicationService implements IAdminEmailApplicationService {
  constructor(private readonly emailObservabilityRepository: IEmailObservabilityRepository) {}

  listOutbox(input: Parameters<IEmailObservabilityRepository["listOutbox"]>[0]) {
    return this.emailObservabilityRepository.listOutbox(input);
  }

  listEvents(input: Parameters<IEmailObservabilityRepository["listEvents"]>[0]) {
    return this.emailObservabilityRepository.listEvents(input);
  }

  listSuppressions(input: Parameters<IEmailObservabilityRepository["listSuppressions"]>[0]) {
    return this.emailObservabilityRepository.listSuppressions(input);
  }

  deleteSuppression(input: { emailHash: string }): Promise<void> {
    return this.emailObservabilityRepository.deleteSuppression(input);
  }

  async deleteSuppressionsBulk(emailHashes: string[]): Promise<number> {
    for (const emailHash of emailHashes) {
      await this.emailObservabilityRepository.deleteSuppression({ emailHash });
    }
    return emailHashes.length;
  }
}
