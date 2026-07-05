import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    csrf: {
      checkOrigin: false
    }
  },
  vite: {
    server: {
      allowedHosts: ['alfred.local', '.local', '192.168.0.231']
    }
  }
};

export default config;
