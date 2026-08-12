'use client';

import { type Chapter } from '@vidx/shared';
import {
  MediaCaptionsButton,
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaMuteButton,
  MediaPipButton,
  MediaPlaybackRateButton,
  MediaPlayButton,
  MediaSeekBackwardButton,
  MediaSeekForwardButton,
  MediaTimeDisplay,
  MediaTimeRange,
  MediaVolumeRange,
} from 'media-chrome/react';
import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';

import { WatermarkOverlay } from '@/components/player/watermark-overlay';
import { buildChaptersVtt } from '@/lib/chapters-vtt';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  src: string;
  captionsUrl: string | null;
  chapters: readonly Chapter[];
  /** Watermark label — the signed-in user's email (plan §4). */
  watermark: string | null;
  /** Deep-link start position (`?t=`, used by search results). */
  initialSeconds?: number;
  onTimeUpdate?: (seconds: number) => void;
  ref?: Ref<VideoPlayerHandle>;
}

/**
 * media-chrome player themed for Signal (see `.signal-player` in globals.css):
 * custom control bar, CC toggle, playback speed, PiP, fullscreen, buffered seek bar,
 * chapters as a WebVTT track, and built-in keyboard shortcuts via MediaController.
 * Progressive playback over the SAS URL — range requests give instant seeking;
 * ABR is out of scope (plan §4, honest limits).
 */
export function VideoPlayer({
  src,
  captionsUrl,
  chapters,
  watermark,
  initialSeconds,
  onTimeUpdate,
  ref,
}: VideoPlayerProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (videoRef.current !== null) {
        videoRef.current.currentTime = seconds;
      }
    },
  }));

  // Chapters arrive as JSON; the player wants a VTT text track (plan §4). A data URI
  // keeps this a pure render derivation — no object-URL lifecycle to manage.
  const chaptersUrl =
    chapters.length === 0
      ? null
      : `data:text/vtt;charset=utf-8,${encodeURIComponent(buildChaptersVtt(chapters))}`;

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || initialSeconds === undefined || initialSeconds <= 0) {
      return;
    }
    const seek = (): void => {
      video.currentTime = initialSeconds;
    };
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      seek();
      return;
    }
    video.addEventListener('loadedmetadata', seek, { once: true });
    return () => {
      video.removeEventListener('loadedmetadata', seek);
    };
  }, [initialSeconds]);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null || onTimeUpdate === undefined) {
      return;
    }
    const handler = (): void => {
      onTimeUpdate(video.currentTime);
    };
    video.addEventListener('timeupdate', handler);
    return () => {
      video.removeEventListener('timeupdate', handler);
    };
  }, [onTimeUpdate]);

  return (
    <MediaController
      className="signal-player"
      onContextMenu={(event) => {
        // Deterrence, not DRM (plan §4) — pairs with the forensic watermark.
        event.preventDefault();
      }}
    >
      <video
        slot="media"
        ref={videoRef}
        src={src}
        crossOrigin="anonymous"
        playsInline
        controlsList="nodownload"
        preload="metadata"
      >
        {captionsUrl !== null && (
          <track default kind="captions" label="Captions" src={captionsUrl} />
        )}
        {chaptersUrl !== null && <track kind="chapters" label="Chapters" src={chaptersUrl} />}
      </video>
      {watermark !== null && <WatermarkOverlay label={watermark} />}
      <MediaControlBar>
        <MediaPlayButton />
        <MediaSeekBackwardButton seekOffset={10} />
        <MediaSeekForwardButton seekOffset={10} />
        <MediaTimeRange />
        <MediaTimeDisplay showDuration />
        <MediaMuteButton />
        <MediaVolumeRange />
        <MediaPlaybackRateButton />
        <MediaCaptionsButton />
        <MediaPipButton />
        <MediaFullscreenButton />
      </MediaControlBar>
    </MediaController>
  );
}
