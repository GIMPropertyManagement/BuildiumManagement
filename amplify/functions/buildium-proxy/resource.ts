import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Resolve a credential at synth time with two-tier fallback:
 *   1. If a plain env var is present in the CI build shell, use it directly.
 *      This path is driven by Amplify Hosting's "Environment variables" UI
 *      (App settings → Environment variables), which Amplify reliably
 *      injects into the build phase.
 *   2. Otherwise fall back to Amplify Gen 2 `secret()`, which reads from
 *      the branch-scoped Secret Manager.
 *
 * We offer both because amplify-backend#2190 and related reports show the
 * `secret()` path silently resolving to empty/wrong values in some deploys.
 * Plain env vars are the reliable escape hatch.
 */
function credential(name: string) {
  const fromEnv = process.env[name];
  return fromEnv && fromEnv.length > 0 ? fromEnv : secret(name);
}

export const buildiumProxy = defineFunction({
  name: 'buildium-proxy',
  entry: './handler.ts',
  timeoutSeconds: 60,
  memoryMB: 512,
  environment: {
    BUILDIUM_CLIENT_ID: credential('BUILDIUM_CLIENT_ID'),
    BUILDIUM_CLIENT_SECRET: credential('BUILDIUM_CLIENT_SECRET'),
    BUILDIUM_BASE_URL: 'https://api.buildium.com',
  },
});
