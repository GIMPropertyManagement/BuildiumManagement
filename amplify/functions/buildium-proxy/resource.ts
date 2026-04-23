import { defineFunction, secret } from '@aws-amplify/backend';

export const buildiumProxy = defineFunction({
  name: 'buildium-proxy',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    BUILDIUM_CLIENT_ID: secret('BUILDIUM_CLIENT_ID'),
    BUILDIUM_CLIENT_SECRET: secret('BUILDIUM_CLIENT_SECRET'),
    BUILDIUM_BASE_URL: 'https://api.buildium.com',
  },
});
