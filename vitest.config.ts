import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // Booking tests talk to the real Neon database over a slow network.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
