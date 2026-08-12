import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MAX_UPLOAD_BYTES } from '@vidx/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type UploadTransport } from '@/lib/uploads/put-blob';
import { UploadsProvider, useUploads } from '@/lib/uploads/uploads-provider';

const { toastMock, refetchMock } = vi.hoisted(() => ({
  toastMock: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
  refetchMock: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));
vi.mock('@/lib/videos/videos-live', () => ({
  useVideosLive: () => ({ state: { status: 'loading' }, refetch: refetchMock }),
}));

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const uploadResponse = (playable: boolean): Response =>
  jsonResponse(
    {
      data: {
        uploadId: 'upl-1',
        uploadUrl: 'https://storage.example.com/videos/upl-1/a.mp4?sas=w',
        blobPath: 'videos/upl-1/a.mp4',
        playable,
        expiresAt: '2026-08-12T21:00:00Z',
      },
    },
    201,
  );

class FakeTransport implements UploadTransport {
  readonly urls: string[] = [];
  onProgress: ((fraction: number) => void) | null = null;
  private settlers: { resolve: () => void; reject: (error: Error) => void }[] = [];

  put(url: string, _file: File, onProgress: (fraction: number) => void): Promise<void> {
    this.urls.push(url);
    this.onProgress = onProgress;
    return new Promise((resolve, reject) => {
      this.settlers.push({ resolve, reject });
    });
  }

  settle(index = 0): void {
    this.settlers[index]?.resolve();
  }

  fail(index = 0): void {
    this.settlers[index]?.reject(new Error('The storage upload failed — network error.'));
  }
}

function Probe({ file }: { file: File }): React.JSX.Element {
  const { uploads, startUpload, confirmUpload, cancelUpload } = useUploads();
  return (
    <div>
      <button
        onClick={() => {
          startUpload(file);
        }}
      >
        start
      </button>
      {uploads.map((upload) => (
        <div key={upload.key} data-testid="row">
          <span data-testid="phase">{upload.phase}</span>
          <span data-testid="progress">{Math.round(upload.progress * 100)}</span>
          <button
            onClick={() => {
              confirmUpload(upload.key);
            }}
          >
            confirm
          </button>
          <button
            onClick={() => {
              cancelUpload(upload.key);
            }}
          >
            cancel
          </button>
        </div>
      ))}
    </div>
  );
}

const setup = (file: File): FakeTransport => {
  const transport = new FakeTransport();
  render(
    <UploadsProvider transport={transport}>
      <Probe file={file} />
    </UploadsProvider>,
  );
  return transport;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('UploadsProvider', () => {
  it('runs the happy path: slot, PUT with progress, done, poller poked', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(uploadResponse(true));
    vi.stubGlobal('fetch', fetchMock);
    const transport = setup(new File(['bytes'], 'a.mp4', { type: 'video/mp4' }));

    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('uploading');
    });
    expect(transport.urls).toEqual(['https://storage.example.com/videos/upl-1/a.mp4?sas=w']);

    act(() => {
      transport.onProgress?.(0.5);
    });
    expect(screen.getByTestId('progress')).toHaveTextContent('50');

    act(() => {
      transport.settle();
    });
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('done');
    });
    expect(toastMock.success).toHaveBeenCalled();
    expect(refetchMock).toHaveBeenCalled();
  });

  it('holds a non-playable upload for confirmation before any bytes move', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(uploadResponse(false));
    vi.stubGlobal('fetch', fetchMock);
    const transport = setup(new File(['bytes'], 'a.mkv', { type: '' }));

    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('awaiting-confirmation');
    });
    expect(transport.urls).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'confirm' }));
    await waitFor(() => {
      expect(transport.urls).toHaveLength(1);
    });
  });

  it('cancel deletes the just-created document', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(uploadResponse(false))
      .mockResolvedValueOnce(jsonResponse({ data: { id: 'upl-1' } }));
    vi.stubGlobal('fetch', fetchMock);
    setup(new File(['bytes'], 'a.mkv', { type: '' }));

    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('awaiting-confirmation');
    });

    await userEvent.click(screen.getByRole('button', { name: 'cancel' }));
    await waitFor(() => {
      expect(screen.queryByTestId('row')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      const [path, init] = fetchMock.mock.calls[1] ?? [];
      expect(path).toBe('/api/videos/upl-1');
      expect(init?.method).toBe('DELETE');
    });
  });

  it('marks a failed PUT and says why', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(uploadResponse(true));
    vi.stubGlobal('fetch', fetchMock);
    const transport = setup(new File(['bytes'], 'a.mp4', { type: 'video/mp4' }));

    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('uploading');
    });
    act(() => {
      transport.fail();
    });
    await waitFor(() => {
      expect(screen.getByTestId('phase')).toHaveTextContent('failed');
    });
    expect(toastMock.error).toHaveBeenCalled();
  });

  it('rejects an oversized file without calling the API', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const file = new File(['x'], 'big.mp4', { type: 'video/mp4' });
    Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES + 1 });
    setup(file);

    await userEvent.click(screen.getByRole('button', { name: 'start' }));
    expect(screen.getByTestId('phase')).toHaveTextContent('failed');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
