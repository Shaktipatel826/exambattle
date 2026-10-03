// Simple, memory-efficient rate limiter middleware for Express

const rateLimitMap = new Map();

/**
 * Creates a rate limiting middleware
 * @param {number} windowMs - Time window in milliseconds (e.g. 15 * 60 * 1000 for 15 minutes)
 * @param {number} maxRequests - Max requests allowed per window per IP/user
 * @param {string} message - Error message if rate limit exceeded
 */
export const createRateLimiter = (windowMs = 15 * 60 * 1000, maxRequests = 100, message = 'Too many requests. Please try again later.') => {
  return (req, res, next) => {
    // Key by User ID if authenticated, else IP address
    const key = req.user ? `user_${req.user.id}` : `ip_${req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message: `${message} Try again in ${retryAfterSeconds} seconds.`
      });
    }

    next();
  };
};

// Cleanup old rate limit keys periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
