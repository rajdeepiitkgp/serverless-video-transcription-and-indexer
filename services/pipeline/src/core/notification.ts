import { type TrackingId, type VideoDocument } from '@vidx/shared';

/**
 * Discord notification composition (plan §4 "Discord notifications"): pure functions
 * from a terminal document to the webhook payload. The adapter owns HTTP/multipart;
 * composing here keeps embeds TDD-able and lets the replay harness show exactly what
 * would have been sent.
 */

const DISCORD_GREEN = 0x57f287;
const DISCORD_RED = 0xed4245;
const MAX_LISTED_INSIGHTS = 5;

export interface NotificationAttachment {
  fileName: string;
  contentType: string;
  data: Uint8Array;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  title: string;
  color: number;
  fields: DiscordEmbedField[];
  url?: string;
  description?: string;
  thumbnail?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

/** What the NotificationPublisher port sends: the embed payload + optional file attachment. */
export interface VideoNotification {
  embeds: [DiscordEmbed];
  attachment?: NotificationAttachment;
}

export interface NotificationContext {
  /** SWA origin for watch-page links; omitted until the UI exists (M4/M5 wiring). */
  watchBaseUrl?: string | undefined;
  /** Portal link surfaced on failure embeds for the support flow (plan §6). */
  appInsightsUrl?: string | undefined;
}

export type FailedStage = 'submission' | 'results';

const STAGE_LABELS: Readonly<Record<FailedStage, string>> = {
  submission: 'Video Indexer submission',
  results: 'Results processing',
};

/** `H:MM:SS`, matching the timecode motif used across the UI. */
export function formatDuration(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${String(hours)}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function watchUrl(document: VideoDocument, context: NotificationContext): string | undefined {
  if (context.watchBaseUrl === undefined) return undefined;
  return `${context.watchBaseUrl.replace(/\/$/, '')}/videos/watch?id=${encodeURIComponent(document.id)}`;
}

function insightList(values: string[]): string {
  return values.slice(0, MAX_LISTED_INSIGHTS).join(' · ');
}

/** ✅ embed: name, duration, uploader, top keywords/topics, watch link, thumbnail (plan §4). */
export function composeProcessedNotification(
  document: VideoDocument,
  context: NotificationContext,
  thumbnail: NotificationAttachment | null,
): VideoNotification {
  const url = watchUrl(document, context);
  const fields: DiscordEmbedField[] = [
    { name: 'Duration', value: formatDuration(document.durationInSeconds ?? 0), inline: true },
    { name: 'Uploaded by', value: document.uploadedBy.userDetails, inline: true },
  ];
  if (document.keywords.length > 0) {
    fields.push({ name: 'Keywords', value: insightList(document.keywords) });
  }
  if (document.topics.length > 0) {
    fields.push({ name: 'Topics', value: insightList(document.topics) });
  }

  const embed: DiscordEmbed = {
    title: `✅ ${document.name}`,
    color: DISCORD_GREEN,
    fields,
    footer: { text: `upload ${document.id}` },
    ...(url === undefined ? {} : { url }),
    ...(document.processedAt === undefined ? {} : { timestamp: document.processedAt }),
    ...(thumbnail === null ? {} : { thumbnail: { url: `attachment://${thumbnail.fileName}` } }),
  };

  return { embeds: [embed], ...(thumbnail === null ? {} : { attachment: thumbnail }) };
}

/** ❌ embed: name, failed stage, tracking id, App Insights link (plan §4). */
export function composeFailedNotification(
  document: VideoDocument,
  stage: FailedStage,
  trackingId: TrackingId,
  context: NotificationContext,
): VideoNotification {
  const embed: DiscordEmbed = {
    title: `❌ ${document.name}`,
    color: DISCORD_RED,
    fields: [
      { name: 'Failed stage', value: STAGE_LABELS[stage], inline: true },
      { name: 'Tracking ID', value: `\`${trackingId}\``, inline: true },
      { name: 'Uploaded by', value: document.uploadedBy.userDetails, inline: true },
      ...(document.error === null ? [] : [{ name: 'Error', value: document.error }]),
    ],
    footer: { text: `upload ${document.id}` },
    ...(context.appInsightsUrl === undefined
      ? {}
      : { description: `[Open in App Insights](${context.appInsightsUrl})` }),
    ...(document.processedAt === undefined ? {} : { timestamp: document.processedAt }),
  };

  return { embeds: [embed] };
}
