/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Toggle via env: set DISABLE_IMAGE_OPT=1 if you hit Vercel image quota.
    // When enabled, Next.js Image generates AVIF/WebP variants per device size.
    unoptimized: process.env.DISABLE_IMAGE_OPT === '1',
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 640, 750, 828, 1080, 1200],
    imageSizes: [80, 160, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 1 week
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
