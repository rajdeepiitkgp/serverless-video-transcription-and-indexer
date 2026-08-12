import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UploadView } from '@/components/upload/upload-view';
import { type UploadItem } from '@/lib/uploads/uploads-provider';

const { api } = vi.hoisted(() => ({
  api: {
    uploads: [] as UploadItem[],
    startUpload: vi.fn(),
    confirmUpload: vi.fn(),
    cancelUpload: vi.fn(),
    dismissUpload: vi.fn(),
  },
}));

vi.mock('@/lib/uploads/uploads-provider', () => ({
  useUploads: () => api,
}));

const buildItem = (overrides: Partial<UploadItem>): UploadItem => ({
  key: 'k1',
  uploadId: 'upl-1',
  fileName: 'clip.mkv',
  sizeBytes: 1024,
  progress: 0,
  phase: 'requesting',
  error: null,
  ...overrides,
});

describe('UploadView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.uploads = [];
  });

  it('starts an upload per chosen file', async () => {
    render(<UploadView />);
    const input = screen.getByLabelText('Choose video files');
    const first = new File(['a'], 'a.mp4', { type: 'video/mp4' });
    const second = new File(['b'], 'b.mp4', { type: 'video/mp4' });
    await userEvent.upload(input, [first, second]);
    expect(api.startUpload).toHaveBeenCalledTimes(2);
  });

  it('confirms a warned non-playable upload through the dialog', async () => {
    api.uploads = [buildItem({ phase: 'awaiting-confirmation' })];
    render(<UploadView />);

    expect(screen.getByText("This format can't be previewed in the browser")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Upload anyway' }));
    expect(api.confirmUpload).toHaveBeenCalledWith('k1');
  });

  it('cancels a warned upload from the dialog', async () => {
    api.uploads = [buildItem({ phase: 'awaiting-confirmation' })];
    render(<UploadView />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel upload' }));
    expect(api.cancelUpload).toHaveBeenCalledWith('k1');
  });

  it('lets finished rows be cleared', async () => {
    api.uploads = [buildItem({ phase: 'done', progress: 1 })];
    render(<UploadView />);
    await userEvent.click(screen.getByRole('button', { name: 'Clear clip.mkv from the list' }));
    expect(api.dismissUpload).toHaveBeenCalledWith('k1');
  });

  it('shows the failure reason on a failed row', () => {
    api.uploads = [buildItem({ phase: 'failed', error: 'The file is empty.' })];
    render(<UploadView />);
    expect(screen.getByRole('alert')).toHaveTextContent('The file is empty.');
  });
});
