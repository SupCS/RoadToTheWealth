import Fastify from 'fastify';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({
    service: 'rttw-api',
    status: 'ok',
  }));

  return app;
}

