import { describe, expect, it } from 'vitest';

import { captionsBlobName, diagnosticsBlobName, insightsBlobName } from './results-layout.js';

describe('results container layout', () => {
  it('places artifacts under the upload id prefix (plan §5 resultsPrefix)', () => {
    expect(insightsBlobName('upl-1')).toBe('upl-1/insights.json');
    expect(captionsBlobName('upl-1')).toBe('upl-1/transcript.vtt');
  });

  it('places diagnostics entries under {uploadId}/diagnostics/ (plan §7)', () => {
    expect(diagnosticsBlobName('upl-1', 'process-upload/01-blob-created-event.json')).toBe(
      'upl-1/diagnostics/process-upload/01-blob-created-event.json',
    );
  });
});
