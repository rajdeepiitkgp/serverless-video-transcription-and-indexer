/** Skeleton for the watch page while metadata loads. */
export function LoadingPanel({ label }: { label: string }): React.JSX.Element {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="aspect-video rounded-md bg-surface motion-safe:animate-pulse" />
          <div className="h-6 w-2/3 rounded-sm bg-surface motion-safe:animate-pulse" />
          <div className="h-4 w-1/3 rounded-sm bg-surface motion-safe:animate-pulse" />
        </div>
        <div className="hidden rounded-md bg-surface motion-safe:animate-pulse lg:block" />
      </div>
    </div>
  );
}
