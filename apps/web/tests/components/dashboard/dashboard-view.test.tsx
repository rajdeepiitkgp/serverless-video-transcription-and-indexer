import { render, screen } from '@testing-library/react';
import { type StatsResponse } from '@vidx/shared';
import { describe, expect, it, vi } from 'vitest';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { type ApiQuery } from '@/lib/api/hooks';
import { type UploadItem } from '@/lib/uploads/uploads-provider';
import { type VideosLiveState } from '@/lib/videos/videos-live';

import { buildStatsResponse, buildVideoSummary } from '../../support/builders';

const { state } = vi.hoisted(() => {
  const state: {
    stats: ApiQuery<StatsResponse>;
    videos: VideosLiveState;
    uploads: UploadItem[];
  } = {
    stats: { status: 'loading', refetch: vi.fn() },
    videos: { status: 'loading' },
    uploads: [],
  };
  return { state };
});

vi.mock('@/lib/api/hooks', () => ({
  useStats: () => state.stats,
}));
vi.mock('@/lib/videos/videos-live', () => ({
  useVideosLive: () => ({ state: state.videos, refetch: vi.fn() }),
}));
vi.mock('@/lib/uploads/uploads-provider', () => ({
  useUploads: () => ({
    uploads: state.uploads,
    startUpload: vi.fn(),
    confirmUpload: vi.fn(),
    cancelUpload: vi.fn(),
    dismissUpload: vi.fn(),
  }),
}));

describe('DashboardView', () => {
  it('renders the VU tiles and pipeline strip from the stats', () => {
    state.stats = { status: 'success', data: buildStatsResponse(), refetch: vi.fn() };
    state.videos = { status: 'success', videos: [] };
    state.uploads = [];
    render(<DashboardView />);

    expect(screen.getByText('TOTAL FOOTAGE')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    // processedRate 8/12 → 67%
    expect(screen.getByText('67')).toBeInTheDocument();
    // avgIndexingSeconds 154 → edit-deck timecode
    expect(screen.getByText('00:02:34')).toBeInTheDocument();
    expect(screen.getByText('247')).toBeInTheDocument();
    expect(screen.getByText('of 600 free this month')).toBeInTheDocument();
    // Pipeline legend spells out every status with its count ("PROCESSED" also
    // labels a stat tile, hence getAllBy).
    expect(screen.getAllByText('PROCESSED').length).toBeGreaterThan(0);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('lists recent footage with stage timelines', () => {
    state.stats = { status: 'success', data: buildStatsResponse(), refetch: vi.fn() };
    state.videos = {
      status: 'success',
      videos: [
        buildVideoSummary({ id: 'v1', name: 'launch-briefing.mp4', status: 'Processed' }),
        buildVideoSummary({ id: 'v2', name: 'town-hall.mkv', status: 'Indexing' }),
      ],
    };
    state.uploads = [];
    render(<DashboardView />);

    expect(screen.getByRole('link', { name: 'launch-briefing.mp4' })).toHaveAttribute(
      'href',
      '/videos/watch?id=v1',
    );
    expect(screen.getByRole('list', { name: 'Stage: Indexing' })).toBeInTheDocument();
  });

  it('shows live upload progress rows', () => {
    state.stats = { status: 'success', data: buildStatsResponse(), refetch: vi.fn() };
    state.videos = { status: 'success', videos: [] };
    state.uploads = [
      {
        key: 'k1',
        uploadId: 'upl-1',
        fileName: 'fresh-take.mp4',
        sizeBytes: 1000,
        progress: 0.45,
        phase: 'uploading',
        error: null,
      },
    ];
    render(<DashboardView />);

    expect(screen.getByText('fresh-take.mp4')).toBeInTheDocument();
    expect(screen.getByText(/UPLOADING 45%/)).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: 'Upload progress for fresh-take.mp4' }),
    ).toHaveAttribute('aria-valuenow', '45');
  });

  it('invites the first upload when the library is empty', () => {
    state.stats = {
      status: 'success',
      data: buildStatsResponse({
        totalVideos: 0,
        statusCounts: { Uploaded: 0, Indexing: 0, Processed: 0, Failed: 0 },
        processedRate: 0,
        failedRate: 0,
        avgIndexingSeconds: null,
        minutesIndexedThisMonth: 0,
      }),
      refetch: vi.fn(),
    };
    state.videos = { status: 'success', videos: [] };
    state.uploads = [];
    render(<DashboardView />);

    expect(screen.getByText('No footage logged yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Upload video' })).toHaveAttribute('href', '/upload');
  });
});
