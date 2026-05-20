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
            value:
              // Deny things we don't use.
              "camera=(), microphone=(), geolocation=(), " +
              // Allow features Plaid Link needs inside its cross-origin
              // iframe. Without these, Plaid Link fails to open on some
              // institutions or device combinations.
              'fullscreen=(self "https://cdn.plaid.com" "https://link.plaid.com"), ' +
              'clipboard-read=(self "https://cdn.plaid.com"), ' +
              'clipboard-write=(self "https://cdn.plaid.com"), ' +
              'accelerometer=(self "https://cdn.plaid.com")',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
