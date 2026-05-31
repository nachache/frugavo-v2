/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },

  // Marketing redirects — catch-all for paid-traffic URLs that point
  // at slugs we never built or that have been renamed. /protect was
  // used in an X ad campaign and 404'd; redirecting to the canonical
  // landing page preserves the click and the UTM params. Add more
  // here as ad campaigns rotate. statusCode 302 (temporary) so we
  // can change destinations later without browsers caching the
  // wrong target.
  async redirects() {
    return [
      {
        source: "/protect",
        destination: "/",
        permanent: false,
      },
      // Add future ad-only landing slugs here. Always 302 for
      // marketing redirects — gives us room to change the
      // destination if a campaign's funnel changes.
    ];
  },

  // Security headers are set here (not in netlify.toml) because Netlify's
  // [[headers]] config only applies to static files, not to Next.js
  // dynamic routes served by serverless functions. Next.js headers() runs
  // for every route — pages, API routes, everything.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Plaid Link runs inside a cross-origin iframe and needs a
            // long list of permissions to handle modern bank auth flows
            // (passkeys, payment redirects, fullscreen on mobile, clipboard
            // for OTP paste). Per-origin allowlists work in spec but break
            // in practice on Safari + some Chrome versions, so we open
            // these to all origins. The genuinely sensitive permissions
            // (camera, mic, geolocation) stay denied.
            value:
              "camera=(), microphone=(), geolocation=(), " +
              "fullscreen=*, " +
              "publickey-credentials-get=*, " +
              "payment=*, " +
              "clipboard-read=*, " +
              "clipboard-write=*, " +
              "accelerometer=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
