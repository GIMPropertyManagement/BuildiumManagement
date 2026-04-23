import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { buildiumProxy } from '../functions/buildium-proxy/resource';

/**
 * Custom query that proxies authenticated Cognito users to the Buildium REST
 * API via a Lambda function. Credentials are stored as Amplify secrets and
 * never reach the browser. Only whitelisted paths are allowed (see handler).
 */
const schema = a
  .schema({
    buildiumFetch: a
      .query()
      .arguments({
        path: a.string().required(),
        queryJson: a.string(),
        fetchAll: a.boolean(),
      })
      .returns(a.string())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(buildiumProxy)),
  })
  .authorization((allow) => [allow.authenticated()]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
