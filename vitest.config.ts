import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: false,
    include: ["tests/**/*.spec.ts", "tests/unit/**/*.spec.ts"],
    // Smoke tests are slow + hit the network; they run via their own
    // config (npm run test:smoke).
    exclude: ["node_modules/**", "tests/smoke/**"],
    setupFiles: [],
  },
});
