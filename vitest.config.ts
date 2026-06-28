import { defineConfig } from 'vitest/config';

// Core tests are pure and run in a Node environment with no network.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
