/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
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

  // ── Security headers ─────────────────────────────────────────
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: [
          {
            // Allow framing only by Telegram web clients
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
            // Note: X-Frame-Options ALLOWALL is needed for Telegram WebApp iframe.
            // We rely on CSP frame-ancestors for finer-grained control.
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: self + Telegram SDK + inline for Next.js
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://telegram.org",
              // Styles: self + Google Fonts + inline for styled-components / tailwind
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: self + Sanity CDN + Unsplash + data URIs
              "img-src 'self' https://cdn.sanity.io https://images.unsplash.com data: blob:",
              // Fonts: self + Google Fonts CDN
              "font-src 'self' https://fonts.gstatic.com",
              // API / fetch: self + Sanity API
              "connect-src 'self' https://*.sanity.io https://*.api.sanity.io wss://*.sanity.io https://telegram.org",
              // Media (video, 3D models)
              "media-src 'self' https://cdn.sanity.io blob:",
              // Allow Telegram to embed us
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
