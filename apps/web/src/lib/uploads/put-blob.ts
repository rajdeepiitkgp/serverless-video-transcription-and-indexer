/** The browser's direct blob PUT (plan §2 flow note 1), injectable for tests. */
export interface UploadTransport {
  put(url: string, file: File, onProgress: (fraction: number) => void): Promise<void>;
}

/**
 * XMLHttpRequest rather than fetch: fetch still has no upload-progress events, and
 * the waveform progress bar is the point. One single-shot Put Blob covers the whole
 * allowed size range (well under the service's single-PUT limit).
 */
export const xhrUploadTransport: UploadTransport = {
  put(url, file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('x-ms-blob-type', 'BlockBlob');
      xhr.setRequestHeader(
        'content-type',
        file.type === '' ? 'application/octet-stream' : file.type,
      );
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(event.loaded / event.total);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`The storage upload failed (HTTP ${String(xhr.status)}).`));
        }
      };
      xhr.onerror = () => {
        reject(new Error('The storage upload failed — check your connection and try again.'));
      };
      xhr.onabort = () => {
        reject(new Error('The upload was canceled.'));
      };
      xhr.send(file);
    });
  },
};
