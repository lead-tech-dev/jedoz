import bullmq from 'bullmq';
const { Queue } = bullmq;
import IORedis from 'ioredis';

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export function createRedisConnection() {
  // BullMQ recommends a dedicated connection per process.
  return new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export const QUEUE_NAMES = {
  PAYMENTS: 'payments',
};

export function createPaymentsQueue() {
  const connection = createRedisConnection();
  return new Queue(QUEUE_NAMES.PAYMENTS, { connection });
}
