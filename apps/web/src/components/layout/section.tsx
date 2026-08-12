import { type ReactNode } from 'react';

/** Console section: mono eyebrow title running into a scanline rule. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): React.JSX.Element {
  return (
    <section aria-label={title} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h2 className="shrink-0 font-mono text-xs font-medium tracking-widest text-fg-muted">
          {title}
        </h2>
        <div className="scanline flex-1" role="presentation" />
      </div>
      {children}
    </section>
  );
}
