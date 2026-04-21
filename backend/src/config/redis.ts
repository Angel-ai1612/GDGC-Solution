import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('Missing REDIS_URL in .env');
}

export const redisClient = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected');
});

redisClient.on('error', (err) => {
  console.error('❌ Redis error:', err.message);
});
