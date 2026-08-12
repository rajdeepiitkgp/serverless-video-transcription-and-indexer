import { type NextConfig } from 'next';

// Static export (plan §4): SWA serves the output, `/api/*` proxies to the linked
// webapi backend. Trailing slashes make every route a directory index, which is the
// shape SWA's static file resolution expects.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
};

// eslint-disable-next-line no-restricted-syntax -- Next.js requires a default export
export default nextConfig;
