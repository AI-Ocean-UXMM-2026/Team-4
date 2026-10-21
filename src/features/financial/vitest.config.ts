import { fileURLToPath } from 'node:url';
// Standalone financial tests; shared/root configuration remains P5-owned.
export default {
  resolve: { alias: { '@': fileURLToPath(new URL('../../', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.tsx'],
  },
};
