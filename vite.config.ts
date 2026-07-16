import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    allowedHosts: ['alfred.local', 'noema.local', '.local', 'promisnotebook.tail117b73.ts.net', '.ts.net']
  },
  // NOTE: vitest uses vitest.config.ts (not this file) when it exists.
  // The test block below is overridden by vitest.config.ts.
  test: {
    include: ['tests/**/*.{test,spec}.{js,ts}']
  }
});
