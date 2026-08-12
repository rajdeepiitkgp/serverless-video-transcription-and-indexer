import { describe, expect, it } from 'vitest';

import { videoDocument } from '../../test-support/builders.js';
import {
  composeFailedNotification,
  composeProcessedNotification,
  formatDuration,
  type NotificationAttachment,
} from './notification.js';

const processedDoc = videoDocument({
  status: 'Processed',
  videoId: 'vi-123',
  durationInSeconds: 127.04,
  keywords: ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'],
  topics: ['Cloud Computing'],
  processedAt: '2026-08-12T11:00:00.000Z',
});

const thumbnail: NotificationAttachment = {
  fileName: 'thumbnail.jpg',
  contentType: 'image/jpeg',
  data: new Uint8Array([0xff, 0xd8, 0xff]),
};

describe('formatDuration', () => {
  it.each([
    [0, '0:00:00'],
    [9, '0:00:09'],
    [127.04, '0:02:07'],
    [3661, '1:01:01'],
    [59.6, '0:01:00'],
  ])('formats %d seconds as %s', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });
});

describe('composeProcessedNotification', () => {
  it('builds the ✅ embed with duration, uploader, and top insights', () => {
    const { embeds } = composeProcessedNotification(processedDoc, {}, null);
    const embed = embeds[0];
    expect(embed.title).toBe('✅ demo.mp4');
    expect(embed.color).toBe(0x57f287);
    expect(embed.timestamp).toBe('2026-08-12T11:00:00.000Z');
    expect(embed.footer).toEqual({ text: 'upload upl-0001' });
    expect(embed.fields).toContainEqual({ name: 'Duration', value: '0:02:07', inline: true });
    expect(embed.fields).toContainEqual({
      name: 'Uploaded by',
      value: 'user@example.com',
      inline: true,
    });
    expect(embed.fields).toContainEqual({ name: 'Topics', value: 'Cloud Computing' });
  });

  it('lists at most five keywords', () => {
    const { embeds } = composeProcessedNotification(processedDoc, {}, null);
    const keywords = embeds[0].fields.find((field) => field.name === 'Keywords');
    expect(keywords?.value).toBe('alpha · bravo · charlie · delta · echo');
  });

  it('omits keyword/topic fields when there are none', () => {
    const bare = videoDocument({ status: 'Processed', videoId: 'vi-123' });
    const { embeds } = composeProcessedNotification(bare, {}, null);
    const names = embeds[0].fields.map((field) => field.name);
    expect(names).not.toContain('Keywords');
    expect(names).not.toContain('Topics');
  });

  it('links the title to the watch page when a base URL is configured', () => {
    const { embeds } = composeProcessedNotification(
      processedDoc,
      { watchBaseUrl: 'https://vidx.example.com/' },
      null,
    );
    expect(embeds[0].url).toBe('https://vidx.example.com/videos/watch?id=upl-0001');
  });

  it('attaches the thumbnail as a file and references it from the embed (plan §4)', () => {
    const notification = composeProcessedNotification(processedDoc, {}, thumbnail);
    expect(notification.attachment).toBe(thumbnail);
    expect(notification.embeds[0].thumbnail).toEqual({ url: 'attachment://thumbnail.jpg' });
  });

  it('omits the thumbnail reference when there is no attachment', () => {
    const notification = composeProcessedNotification(processedDoc, {}, null);
    expect(notification.attachment).toBeUndefined();
    expect(notification.embeds[0].thumbnail).toBeUndefined();
  });
});

describe('composeFailedNotification', () => {
  const failedDoc = videoDocument({
    status: 'Failed',
    videoId: 'vi-123',
    error: 'UnsupportedFileType: The file type is not supported for indexing.',
    processedAt: '2026-08-12T11:00:00.000Z',
  });

  it('builds the ❌ embed with stage, tracking id, uploader, and error', () => {
    const { embeds, attachment } = composeFailedNotification(
      failedDoc,
      'results',
      'VXT-33333333',
      {},
    );
    const embed = embeds[0];
    expect(attachment).toBeUndefined();
    expect(embed.title).toBe('❌ demo.mp4');
    expect(embed.color).toBe(0xed4245);
    expect(embed.fields).toContainEqual({
      name: 'Failed stage',
      value: 'Results processing',
      inline: true,
    });
    expect(embed.fields).toContainEqual({
      name: 'Tracking ID',
      value: '`VXT-33333333`',
      inline: true,
    });
    expect(embed.fields).toContainEqual({
      name: 'Error',
      value: 'UnsupportedFileType: The file type is not supported for indexing.',
    });
  });

  it('labels submission-stage failures', () => {
    const { embeds } = composeFailedNotification(failedDoc, 'submission', 'VXT-33333333', {});
    expect(embeds[0].fields).toContainEqual({
      name: 'Failed stage',
      value: 'Video Indexer submission',
      inline: true,
    });
  });

  it('links to App Insights when configured (plan §4)', () => {
    const { embeds } = composeFailedNotification(failedDoc, 'results', 'VXT-33333333', {
      appInsightsUrl: 'https://portal.azure.com/#insights',
    });
    expect(embeds[0].description).toBe(
      '[Open in App Insights](https://portal.azure.com/#insights)',
    );
  });

  it('omits the error field and timestamp when the document carries neither', () => {
    const noError = videoDocument({ status: 'Failed' });
    const { embeds } = composeFailedNotification(noError, 'results', 'VXT-33333333', {});
    expect(embeds[0].fields.map((field) => field.name)).not.toContain('Error');
    expect(embeds[0].description).toBeUndefined();
    expect(embeds[0].timestamp).toBeUndefined();
  });
});
