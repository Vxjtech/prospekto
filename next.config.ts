import type { NextConfig } from 'next';
const nextConfig: NextConfig = {output: 'standalone', trailingSlash: true, poweredByHeader: false, images: {unoptimized: true}};
export default nextConfig;
