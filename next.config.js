/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Vercel Image Optimization is returning 402 (quota/plan). Disable Next.js
    // optimization so images load directly from their source (e.g. Sanity CDN).
    unoptimized: true,
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
