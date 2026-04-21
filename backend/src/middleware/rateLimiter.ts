import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';

interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
  blockSeconds: number;
  endpointKey: string;
}

function createRateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip ?? 'unknown';

    // Hash IP for privacy (simple approach)
    const hashedIp = Buffer.from(ip).toString('base64');
    const blockKey = `block:${config.endpointKey}:${hashedIp}`;
    const countKey = `rate:${config.endpointKey}:${hashedIp}`;

    try {
      // Check if IP is currently blocked
      const isBlocked = await redisClient.get(blockKey);
      if (isBlocked) {
        const ttl = await redisClient.ttl(blockKey);
        res.set({
          'X-RateLimit-Limit': String(config.maxRequests),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + ttl),
          'Retry-After': String(ttl),
        });
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Too many requests. Please wait ${ttl} seconds before retrying.`,
          retry_after: ttl,
        });
      }

      // Sliding window: increment counter
      const now = Date.now();
      const windowStart = now - config.windowSeconds * 1000;
      const pipeline = redisClient.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(countKey, '-inf', windowStart);
      // Add current request timestamp
      pipeline.zadd(countKey, now, `${now}-${Math.random()}`);
      // Count requests in window
      pipeline.zcard(countKey);
      // Set expiry on the key
      pipeline.expire(countKey, config.windowSeconds);

      const results = await pipeline.exec();
      const requestCount = results?.[2]?.[1] as number ?? 0;

      const remaining = Math.max(0, config.maxRequests - requestCount);
      const resetTime = Math.floor(Date.now() / 1000) + config.windowSeconds;

      res.set({
        'X-RateLimit-Limit': String(config.maxRequests),
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetTime),
      });

      if (requestCount > config.maxRequests) {
        // Apply block
        await redisClient.set(blockKey, '1', 'EX', config.blockSeconds);

        res.set('Retry-After', String(config.blockSeconds));
        return res.status(429).json({
          error: 'rate_limit_exceeded',
          message: `Too many requests. Please wait ${config.blockSeconds} seconds before retrying.`,
          retry_after: config.blockSeconds,
        });
      }

      next();
    } catch (err: any) {
      // If Redis is down, fail open (don't block legitimate users)
      console.error('Rate limiter error:', err.message);
      next();
    }
  };
}

// --- Per-endpoint limiters matching the PRD spec ---

export const checkLimiter = createRateLimiter({
  endpointKey: 'check',
  windowSeconds: 60,
  maxRequests: 10,
  blockSeconds: 30,
});

export const deepScanLimiter = createRateLimiter({
  endpointKey: 'deep_scan',
  windowSeconds: 300,   // 5 min
  maxRequests: 3,
  blockSeconds: 120,    // 2 min block
});

export const compareLimiter = createRateLimiter({
  endpointKey: 'compare',
  windowSeconds: 60,
  maxRequests: 5,
  blockSeconds: 60,
});

export const sourcesLimiter = createRateLimiter({
  endpointKey: 'sources',
  windowSeconds: 60,
  maxRequests: 30,
  blockSeconds: 0,      // no block, just 429
});

export const statusLimiter = createRateLimiter({
  endpointKey: 'status',
  windowSeconds: 60,
  maxRequests: 60,
  blockSeconds: 0,
});
