/**
 * RFC 6266 `Content-Disposition: attachment` value with an ASCII fallback filename
 * and an RFC 5987 `filename*` for anything beyond ASCII, so downloads keep their
 * original names in every browser.
 */
// eslint-disable-next-line no-control-regex -- ASCII fallback strips control chars too
const FALLBACK_UNSAFE = /[\u0000-\u001f\u007f"\\]/g;
const NON_ASCII = /[^\u0020-\u007e]/g;

export function attachmentDisposition(fileName: string): string {
  const fallback = fileName.replace(FALLBACK_UNSAFE, '_').replace(NON_ASCII, '_');
  const needsEncoding = fallback !== fileName;
  const base = `attachment; filename="${fallback}"`;
  return needsEncoding ? `${base}; filename*=UTF-8''${encodeURIComponent(fileName)}` : base;
}

/** `demo.mp4` → `demo.vtt` / `demo.json`; extensionless names just gain the suffix. */
export function transcriptDownloadFileName(videoName: string, format: 'vtt' | 'json'): string {
  const dot = videoName.lastIndexOf('.');
  const base = dot > 0 ? videoName.slice(0, dot) : videoName;
  return `${base}.${format}`;
}
