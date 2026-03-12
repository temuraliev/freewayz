/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Vercel Image Optimization can return 402 when quota/plan limits are hit.
    // We rely on Sanity CDN image URLs instead.
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
