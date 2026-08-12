import Link from 'next/link';

import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';

export default function NotFound(): React.JSX.Element {
  return (
    <div className="py-16">
      <EmptyState title="No signal on this frequency">
        <p>The page you asked for doesn't exist.</p>
        <div className="mt-4">
          <Button asChild variant="secondary" size="sm">
            <Link href="/">Back to the console</Link>
          </Button>
        </div>
      </EmptyState>
    </div>
  );
}
