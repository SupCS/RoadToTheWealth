# Railway setup

## Services

Use one Railway project with:

- PostgreSQL service;
- RTTW API service deployed from this repository with root directory `apps/api`.

Set API variables:

- `DATABASE_URL`: reference the PostgreSQL service variable;
- `CORS_ORIGIN`: allowed development/production origins where applicable;
- `AUTH_SECRET`: a long random secret added when authentication is implemented;
- `NODE_ENV=production`.

Railway supplies `PORT`; do not hard-code it. The included `railway.json` uses the API health endpoint.

## Deployment sequence

1. Push the repository to a private Git provider repository.
2. Create a Railway project and add PostgreSQL.
3. Add a service from the repository and set its root to `apps/api`.
4. Reference PostgreSQL's `DATABASE_URL` from the API service.
5. Deploy and verify `https://<service-domain>/health`.
6. Put that HTTPS domain in the mobile app's local `EXPO_PUBLIC_API_URL`.

Database migrations must run as an explicit deploy/pre-deploy command once the schema is introduced. Do not automatically destroy or reset production data.

