/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["framer-motion", "lucide-react"],
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
