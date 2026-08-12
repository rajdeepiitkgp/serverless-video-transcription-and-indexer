import * as z from 'zod';

/**
 * Tolerant schema for the Azure Video Indexer "Get Video Index" JSON.
 *
 * Only the fields the insight parsers consume are declared; everything else the
 * service returns (OCR, faces, sentiments, …) is stripped. Downstream evolution of
 * the VI payload therefore can't break parsing unless it touches these fields —
 * which is exactly what the fixture suite would catch.
 */
export const viInstanceSchema = z.object({
  start: z.string(),
  end: z.string(),
  adjustedStart: z.string().optional(),
  adjustedEnd: z.string().optional(),
});

export const viTranscriptItemSchema = z.object({
  text: z.string(),
  instances: z.array(viInstanceSchema).default([]),
});

export const viKeywordSchema = z.object({
  text: z.string(),
  confidence: z.number().optional(),
});

export const viTopicSchema = z.object({
  name: z.string(),
  confidence: z.number().optional(),
  instances: z.array(viInstanceSchema).default([]),
});

export const viSceneSchema = z.object({
  instances: z.array(viInstanceSchema).default([]),
});

export const viInsightsSchema = z.object({
  duration: z.string().optional(),
  sourceLanguage: z.string().optional(),
  transcript: z.array(viTranscriptItemSchema).optional(),
  keywords: z.array(viKeywordSchema).optional(),
  topics: z.array(viTopicSchema).optional(),
  scenes: z.array(viSceneSchema).optional(),
});

export const viVideoSchema = z.object({
  id: z.string().nullish(),
  state: z.string(),
  thumbnailId: z.string().nullish(),
  failureCode: z.string().optional(),
  failureMessage: z.string().optional(),
  insights: viInsightsSchema.optional(),
});

export const viIndexSchema = z.object({
  id: z.string().nullish(),
  name: z.string().optional(),
  state: z.string(),
  durationInSeconds: z.number().optional(),
  summarizedInsights: z
    .object({
      duration: z.object({ seconds: z.number() }).optional(),
      thumbnailId: z.string().optional(),
    })
    .optional(),
  videos: z.array(viVideoSchema),
});

export type ViInstance = z.infer<typeof viInstanceSchema>;
export type ViVideo = z.infer<typeof viVideoSchema>;
export type ViIndex = z.infer<typeof viIndexSchema>;

/** Validates an untrusted VI response at the boundary (docs/style-guide.md). */
export function parseViIndex(json: unknown): ViIndex {
  return viIndexSchema.parse(json);
}
