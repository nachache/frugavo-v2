import { defineConfig } from "vitest/config";
import path from "path";

// Smoke tests run against a live deployed URL. They're slow (real
// network) and we don't want them firing on every `npm test`, so they
// live in a separate config + script:
//
//   npm run test:smoke
//   FRUGAVO_URL=https://deploy-preview-42.frugavo.com npm run test:smoke
//
// Default URL is production. Set FRUGAVO_URL to point at a preview.

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["tests/smoke/**/*.spec.ts"],
    testTimeout: 15_000,
    // No file watcher — smoke is one-shot.
    watch: false,
  },
});
