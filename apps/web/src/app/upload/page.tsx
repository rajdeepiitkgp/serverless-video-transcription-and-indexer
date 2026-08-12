import { type Metadata } from 'next';

import { UploadView } from '@/components/upload/upload-view';

export const metadata: Metadata = { title: 'Upload' };

export default function UploadPage(): React.JSX.Element {
  return <UploadView />;
}
