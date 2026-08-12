import { Play } from 'lucide-react';
import { type Metadata } from 'next';

import { Section } from '@/components/layout/section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/video/status-chip';
import { Timecode } from '@/components/video/timecode';
import { cn } from '@/lib/cn';

export const metadata: Metadata = { title: 'Design reference' };

/*
 * "Signal" style tile (plan §4) — the sign-off artifact that gates the rest of M4.
 * Everything here renders from the live tokens, so flipping the theme toggle reviews
 * both modes.
 */

const SWATCHES = [
  { token: 'canvas', swatch: 'bg-canvas', dark: '#131110', light: '#F5F4F1', role: 'Page ground' },
  {
    token: 'surface',
    swatch: 'bg-surface',
    dark: '#1C1916',
    light: '#FFFFFF',
    role: 'Panels, decks, cards',
  },
  {
    token: 'raised',
    swatch: 'bg-raised',
    dark: '#262119',
    light: '#FBFAF7',
    role: 'Hover states, chips',
  },
  {
    token: 'line',
    swatch: 'bg-line',
    dark: '#37312A',
    light: '#DFDAD1',
    role: 'Hairlines, borders',
  },
  { token: 'fg', swatch: 'bg-fg', dark: '#EFE9DF', light: '#211D18', role: 'Primary text' },
  {
    token: 'fg-muted',
    swatch: 'bg-fg-muted',
    dark: '#B3A996',
    light: '#5D564A',
    role: 'Secondary text',
  },
  {
    token: 'accent',
    swatch: 'bg-accent',
    dark: '#F7A928',
    light: '#8F5A00',
    role: 'Signal amber — active, links',
  },
  {
    token: 'accent-solid',
    swatch: 'bg-accent-solid',
    dark: '#F7A928',
    light: '#F7A928',
    role: 'Amber fills — record light, CTAs',
  },
  {
    token: 'status-idle',
    swatch: 'bg-status-idle',
    dark: '#9FB0BF',
    light: '#526271',
    role: 'Uploaded — cold footage',
  },
  {
    token: 'status-busy',
    swatch: 'bg-status-busy',
    dark: '#F7A928',
    light: '#8A5800',
    role: 'Indexing — amber pulse',
  },
  {
    token: 'status-ok',
    swatch: 'bg-status-ok',
    dark: '#4CC38A',
    light: '#1A7F4E',
    role: 'Processed',
  },
  {
    token: 'status-err',
    swatch: 'bg-status-err',
    dark: '#F4695F',
    light: '#BE3D37',
    role: 'Failed',
  },
] as const;

/* Deterministic pseudo-waveform for the progress demo; ~60% "played". */
const WAVEFORM_HEIGHTS = [
  'h-2',
  'h-4',
  'h-3',
  'h-6',
  'h-5',
  'h-3',
  'h-6',
  'h-4',
  'h-2',
  'h-5',
  'h-6',
  'h-3',
  'h-4',
  'h-6',
  'h-2',
  'h-5',
  'h-4',
  'h-6',
  'h-3',
  'h-5',
  'h-2',
  'h-4',
  'h-6',
  'h-5',
  'h-3',
  'h-4',
  'h-2',
  'h-6',
  'h-4',
  'h-3',
] as const;
const WAVEFORM_PLAYED = 18;

const DECK_LINES = [
  { time: '00:03:58', text: 'the quarterly numbers before we move to the roadmap.', active: false },
  { time: '00:04:12', text: 'Now, the part everyone came for: the launch date.', active: true },
  { time: '00:04:19', text: "We're locking it to the second week of October.", active: false },
  { time: '00:04:26', text: 'Marketing kicks off the teaser campaign next Monday.', active: false },
] as const;

export default function DesignPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-4 pt-6">
        <p className="font-mono text-xs tracking-widest text-accent">SIGNAL / DESIGN REFERENCE</p>
        <h1 className="max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance">
          A broadcast console, not a website.
        </h1>
        <p className="max-w-2xl text-fg-muted">
          Signal treats every video as footage with a signal to extract. Warm charcoal, one amber
          accent that means something, mono timecodes everywhere time appears, and film-strip motifs
          on anything that holds footage. Flip the theme toggle in the header — dark is
          brand-native, light is first-class.
        </p>
      </header>

      <Section title="PALETTE">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SWATCHES.map((swatch) => (
            <li key={swatch.token} className="rounded-md border border-line bg-surface p-3">
              <div className={cn('h-12 rounded-sm border border-line', swatch.swatch)} />
              <p className="mt-2 font-mono text-xs text-fg">--{swatch.token}</p>
              <p className="font-mono text-xs text-fg-faint">
                {swatch.dark} / {swatch.light}
              </p>
              <p className="mt-1 text-xs text-fg-muted">{swatch.role}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="TYPE">
        <div className="flex flex-col gap-6 rounded-md border border-line bg-surface p-6">
          <div>
            <p className="mb-1 font-mono text-xs text-fg-faint">
              SPACE GROTESK — display, footage names
            </p>
            <p className="font-display text-3xl font-semibold tracking-tight">
              Every frame logged, every word indexed.
            </p>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs text-fg-faint">INTER — body, UI copy</p>
            <p className="max-w-xl text-sm text-fg-muted">
              Upload footage, let the pipeline extract the signal, then search across every spoken
              word. Clicking a search result opens the exact moment it was said.
            </p>
          </div>
          <div>
            <p className="mb-1 font-mono text-xs text-fg-faint">
              JETBRAINS MONO — everything time-coded: timestamps, durations, tracking IDs
            </p>
            <p className="font-mono text-sm text-fg">
              00:04:12 · 01:02:47 · <span className="text-accent">VXT-a1b2c3d4</span>
            </p>
          </div>
        </div>
      </Section>

      <Section title="STATUS">
        <div className="flex flex-wrap items-center gap-3">
          <StatusChip status="Uploaded" />
          <StatusChip status="Indexing" />
          <StatusChip status="Processed" />
          <StatusChip status="Failed" />
        </div>
        <p className="max-w-xl text-xs text-fg-muted">
          Status hues carry meaning: cold slate for footage that just arrived, a pulsing amber while
          the signal is extracted, green when processed, red when failed.
        </p>
      </Section>

      <Section title="MOTIFS">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="film-frame max-w-sm">
            <div className="px-3">
              <div className="relative flex aspect-video items-center justify-center rounded-sm bg-raised">
                <Play aria-hidden className="size-8 text-fg-faint" />
                <span className="absolute right-2 bottom-2 rounded-xs bg-canvas/80 px-1.5 py-0.5">
                  <Timecode seconds={252} className="text-fg" />
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium">launch-briefing.mp4</p>
              <div className="mt-1.5 flex items-center gap-2">
                <StatusChip status="Processed" />
                <span className="text-xs text-fg-faint">2.1 GB</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 rounded-md border border-line bg-surface p-4">
            <p className="font-mono text-xs text-fg-faint">WAVEFORM PROGRESS — uploads</p>
            <div className="flex h-6 items-center gap-0.5" role="presentation">
              {WAVEFORM_HEIGHTS.map((height, index) => (
                <span
                  key={index}
                  className={cn(
                    'w-1 rounded-full',
                    height,
                    index < WAVEFORM_PLAYED ? 'bg-accent-solid' : 'bg-line-strong',
                  )}
                />
              ))}
            </div>
            <p className="font-mono text-xs text-fg-muted">
              uploading… <span className="text-accent">60%</span>
            </p>
          </div>

          <div className="flex flex-col justify-center gap-2 rounded-md border border-line bg-surface p-4">
            <p className="font-mono text-xs text-fg-faint">VU STAT TILE — dashboard</p>
            <p className="font-mono text-3xl font-semibold text-fg">
              247<span className="ml-1 text-sm text-fg-muted">min</span>
            </p>
            <div className="flex gap-1" role="presentation">
              {Array.from({ length: 10 }, (_, index) => (
                <span
                  key={index}
                  className={cn(
                    'h-3 w-1.5 rounded-xs',
                    index < 6 ? 'bg-status-ok' : index < 8 ? 'bg-status-busy' : 'bg-line',
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-fg-muted">minutes indexed this month</p>
          </div>
        </div>
      </Section>

      <Section title="TRANSCRIPT DECK">
        <div className="max-w-2xl rounded-md border border-line bg-surface py-1">
          {DECK_LINES.map((line) => (
            <div
              key={line.time}
              className={cn(
                'flex items-baseline gap-3 border-l-2 border-transparent px-4 py-1.5',
                line.active && 'border-accent-solid bg-accent-solid/10',
              )}
            >
              <span
                className={cn(
                  'shrink-0 font-mono text-xs tracking-tight',
                  line.active ? 'text-accent' : 'text-fg-faint',
                )}
              >
                {line.time}
              </span>
              <span className={cn('text-sm', line.active ? 'text-fg' : 'text-fg-muted')}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
        <p className="max-w-xl text-xs text-fg-muted">
          The signature element. A log-sheet deck with an amber playhead rail: the current line
          follows playback, and every line seeks on click. Search results deep-link straight to a
          highlighted moment.
        </p>
      </Section>

      <Section title="CONTROLS">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Upload video</Button>
          <Button variant="secondary">Download transcript</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="destructive">Delete video</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>keyword</Badge>
          <Badge variant="accent">topic</Badge>
          <Badge variant="outline">PREVIEW UNAVAILABLE</Badge>
        </div>
      </Section>
    </div>
  );
}
