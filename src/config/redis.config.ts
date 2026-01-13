import { ConfigService } from '@nestjs/config';

const baseRedis = (config: ConfigService) => {
  const host = config.get<string>('REDIS_HOST');
  const port = Number(config.get<string>('REDIS_PORT'));

  if (!host) throw new Error('REDIS_HOST missing');
  if (!Number.isInteger(port) || port <= 0)
    throw new Error('REDIS_PORT invalid');

  return {
    host,
    port,
    password: config.get<string>('REDIS_PASSWORD'),
    tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
  };
};

export const createAppRedisOptions = (config: ConfigService) => ({
  ...baseRedis(config),
  enableReadyCheck: true,
  maxRetriesPerRequest: 3,
});

export const createBullRedisOptions = (config: ConfigService) => ({
  ...baseRedis(config),
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});
