import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { buildiumProxy } from './functions/buildium-proxy/resource';

defineBackend({
  auth,
  data,
  buildiumProxy,
});
