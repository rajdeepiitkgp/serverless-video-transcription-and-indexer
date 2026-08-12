/** The results container: insights.json + transcript.vtt artifacts (plan §2 flow note 5). */
export interface ResultsStore {
  write(blobName: string, body: string | Uint8Array, contentType: string): Promise<void>;
}
