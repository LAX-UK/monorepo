import type { Queue } from "bullmq";

export class UploadValidationDispatcher {
  constructor(private readonly validationQueue?: Queue) {}

  get isConfigured(): boolean {
    return this.validationQueue != null;
  }

  async enqueue(uploadId: string): Promise<void> {
    if (!this.validationQueue) return;
    await this.validationQueue.add("validate-upload", { uploadId }, { attempts: 3 });
  }
}
