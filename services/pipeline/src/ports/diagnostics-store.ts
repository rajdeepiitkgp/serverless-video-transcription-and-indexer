/**
 * Raw stage inputs/outputs under `{uploadId}/diagnostics/` in the results container
 * (plan §7). Callers guard writes with `captureDiagnostic` — diagnostics capture must
 * never fail the pipeline.
 */
export interface DiagnosticsStore {
  write(
    uploadId: string,
    entryName: string,
    body: string | Uint8Array,
    contentType: string,
  ): Promise<void>;
}
