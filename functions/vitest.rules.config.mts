import { defineConfig } from "vitest/config";

// Needs the Firestore + Storage emulators (run via `npm run test:rules`).
export default defineConfig({
  test: {
    include: ["test/rules/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
