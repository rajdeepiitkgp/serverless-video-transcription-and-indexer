import { type Metadata } from 'next';

import { DocsView } from '@/components/docs/docs-view';

export const metadata: Metadata = { title: 'API reference' };

export default function DocsPage(): React.JSX.Element {
  return <DocsView />;
}
