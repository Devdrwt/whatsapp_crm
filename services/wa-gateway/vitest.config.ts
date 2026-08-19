import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // config.ts validates the environment at module load and throws when
    // anything required is missing, so the test process needs a complete
    // (dummy) set before the first import. WA_DATA_DIR points somewhere
    // harmless — the media/store modules are mocked in the suites that
    // would otherwise touch the filesystem.
    env: {
      WA_GATEWAY_TOKEN: 'test-token',
      WA_GATEWAY_SECRET: 'test-secret',
      WA_WEBHOOK_URL: 'http://app:3000/api/whatsapp/webhook',
      WA_DATA_DIR: './.test-data',
      LOG_LEVEL: 'silent',
    },
    clearMocks: true,
  },
})
