import {
  ApiRequestError, uploadDocument, getGenerationJob, cancelGenerationJob, getQuestionSet,
  type GenerationJob, type QuestionSet,
} from "./api";

export type ProcessingStage = "uploading" | "extracting" | "generating" | "validating" | "opening";

export class GenerationFailureError extends ApiRequestError {
  constructor(public readonly job: GenerationJob) {
    super(job.errorMessage || "The local generation job failed. Check the saved job details in the library.",
      job.errorCode || "GENERATION_FAILED", 422, false);
  }
}

export function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 800);
    function abort() {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      reject(signal.reason);
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

interface GenerationDependencies {
  upload: typeof uploadDocument;
  poll: typeof getGenerationJob;
  cancel: typeof cancelGenerationJob;
  questionSet: typeof getQuestionSet;
  wait: typeof waitForPoll;
}
const defaults: GenerationDependencies = {
  upload: uploadDocument, poll: getGenerationJob, cancel: cancelGenerationJob,
  questionSet: getQuestionSet, wait: waitForPoll,
};

// A session owns its upload receipt, so Cancel can stop a job even if the user
// clicks while the upload response or a polling response is still in flight.
export class GenerationSession {
  private readonly controller = new AbortController();
  private uploadReceipt?: Promise<{ documentId: string; jobId: string }>;
  private cancellation?: Promise<GenerationJob | null>;
  private cancellationFailed = false;
  private deleted = false;
  cancelRequested = false;
  documentId?: string;
  jobId?: string;

  constructor(private readonly dependencies: GenerationDependencies = defaults) {}

  async start(file: File, onJob: (job: GenerationJob) => void): Promise<QuestionSet | null> {
    if (this.uploadReceipt) throw new Error("This upload has already started.");
    this.uploadReceipt = this.dependencies.upload(file);
    try {
      const receipt = await this.uploadReceipt;
      this.documentId = receipt.documentId;
      this.jobId = receipt.jobId;
      if (this.cancelRequested) return this.cancel().then(() => null);
      while (!this.cancelRequested) {
        const job = await this.dependencies.poll(receipt.jobId, this.controller.signal);
        if (this.cancelRequested) break;
        if (job.documentId !== receipt.documentId || job.id !== receipt.jobId) {
          throw new ApiRequestError("The server returned a job for a different document.", "INVALID_RESPONSE", 502);
        }
        onJob(job);
        if (job.state === "failed") throw new GenerationFailureError(job);
        if (job.state === "cancelled") return null;
        if (job.state === "ready") {
          if (!job.questionSetId) throw new ApiRequestError("The ready job has no saved question set.", "INVALID_RESPONSE", 502);
          const questions = await this.dependencies.questionSet(job.questionSetId, this.controller.signal);
          if (this.cancelRequested) break;
          if (questions.documentId !== receipt.documentId || questions.id !== job.questionSetId) {
            throw new ApiRequestError("The saved questions belong to a different document.", "INVALID_RESPONSE", 502);
          }
          return questions;
        }
        await this.dependencies.wait(this.controller.signal);
      }
    } catch (error) {
      if (!this.cancelRequested) throw error;
    }
    await this.cancel();
    return null;
  }

  cancel(retry = false): Promise<GenerationJob | null> {
    this.cancelRequested = true;
    this.controller.abort();
    if (this.deleted || !this.uploadReceipt) return Promise.resolve(null);
    if (retry && this.cancellationFailed) {
      this.cancellation = undefined;
      this.cancellationFailed = false;
    }
    if (!this.cancellation) {
      this.cancellation = this.uploadReceipt.then(async (receipt) => {
        this.documentId = receipt.documentId;
        this.jobId = receipt.jobId;
        if (this.deleted) return null;
        return this.dependencies.cancel(receipt.jobId);
      }).catch((error: unknown) => {
        this.cancellationFailed = true;
        throw error;
      });
    }
    return this.cancellation;
  }

  documentDeleted(): void {
    this.deleted = true;
    this.cancelRequested = true;
    this.controller.abort();
  }
}
