import { defineConfig } from "vitest/config";

// Needs auth, firestore, functions and storage emulators (run via `npm run test:integration`).
export default defineConfig({
  test: {
    include: ["test/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
