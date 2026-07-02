"use client";

import type {
  BrowserClaimProofRequest,
  BrowserClaimProofResult,
  BrowserClaimProofWorkerMessage,
  BrowserProofStatus
} from "./types";

export type BrowserProofProgressHandler = (status: BrowserProofStatus) => void;

export function generateBrowserClaimProof(
  request: BrowserClaimProofRequest,
  onProgress?: BrowserProofProgressHandler
): Promise<BrowserClaimProofResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../../workers/claim-proof.worker.ts", import.meta.url), {
      type: "module"
    });

    worker.onmessage = (event: MessageEvent<BrowserClaimProofWorkerMessage>) => {
      const message = event.data;
      if (message.type === "status") {
        onProgress?.(message.status);
        return;
      }

      worker.terminate();
      if (message.type === "result") {
        resolve(message.result);
      } else {
        reject(new Error(message.error));
      }
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || "Browser proof worker failed"));
    };

    worker.postMessage({
      ...request,
      type: "prove"
    });
  });
}

