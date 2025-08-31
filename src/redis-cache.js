// Redis Caching Strategy - Production Implementation
const redis = require('redis');
const crypto = require('crypto');

class RedisCacheManager {
    constructor() {
        this.client = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            retry_strategy: (options) => {
                if (options.error && options.error.code === 'ECONNREFUSED') {
                    return new Error('Redis server connection refused');
                }
                if (options.total_retry_time > 1000 * 60 * 60) {
                    return new Error('Retry time exhausted');
                }
                if (options.attempt > 10) {
                    return undefined;
                }
                return Math.min(options.attempt * 100, 3000);
            }
        });

        this.client.on('error', (err) => {
            console.error('Redis Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('Redis Client Connected');
        });
    }

    // Generate cache key
    generateKey(prefix, data) {
        const hash = crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
        return `${prefix}:${hash}`;
    }

    // Cache floor plan analysis
    async cacheFloorPlanAnalysis(urn, analysisData) {
        const key = this.generateKey('floorplan', { urn });
        await this.client.setex(key, 3600, JSON.stringify(analysisData)); // 1 hour TTL
        return key;
    }

    async getFloorPlanAnalysis(urn) {
        const key = this.generateKey('floorplan', { urn });
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Cache îlot generation results
    async cacheIlotGeneration(urn, config, ilots) {
        const key = this.generateKey('ilots', { urn, config });
        await this.client.setex(key, 1800, JSON.stringify(ilots)); // 30 minutes TTL
        return key;
    }

    async getIlotGeneration(urn, config) {
        const key = this.generateKey('ilots', { urn, config });
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Cache corridor network
    async cacheCorridorNetwork(urn, corridors) {
        const key = this.generateKey('corridors', { urn });
        await this.client.setex(key, 1800, JSON.stringify(corridors)); // 30 minutes TTL
        return key;
    }

    async getCorridorNetwork(urn) {
        const key = this.generateKey('corridors', { urn });
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Cache pathfinding results
    async cachePathfindingResult(start, end, path) {
        const key = this.generateKey('pathfinding', { start, end });
        await this.client.setex(key, 600, JSON.stringify(path)); // 10 minutes TTL
        return key;
    }

    async getPathfindingResult(start, end) {
        const key = this.generateKey('pathfinding', { start, end });
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Cache 3D model data
    async cache3DModelData(urn, modelData) {
        const key = this.generateKey('3dmodel', { urn });
        await this.client.setex(key, 7200, JSON.stringify(modelData)); // 2 hours TTL
        return key;
    }

    async get3DModelData(urn) {
        const key = this.generateKey('3dmodel', { urn });
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Session caching for real-time collaboration
    async cacheUserSession(sessionId, userData) {
        const key = `session:${sessionId}`;
        await this.client.setex(key, 86400, JSON.stringify(userData)); // 24 hours TTL
        return key;
    }

    async getUserSession(sessionId) {
        const key = `session:${sessionId}`;
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Collaboration state caching
    async cacheCollaborationState(roomId, state) {
        const key = `collab:${roomId}`;
        await this.client.setex(key, 3600, JSON.stringify(state)); // 1 hour TTL
        return key;
    }

    async getCollaborationState(roomId) {
        const key = `collab:${roomId}`;
        const cached = await this.client.get(key);
        return cached ? JSON.parse(cached) : null;
    }

    // Bulk operations
    async cacheBulk(operations) {
        const pipeline = this.client.pipeline();
        
        operations.forEach(op => {
            switch (op.type) {
                case 'set':
                    pipeline.setex(op.key, op.ttl || 3600, JSON.stringify(op.data));
                    break;
                case 'get':
                    pipeline.get(op.key);
                    break;
                case 'del':
                    pipeline.del(op.key);
                    break;
            }
        });
        
        return await pipeline.exec();
    }

    // Cache invalidation
    async invalidatePattern(pattern) {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(...keys);
        }
        return keys.length;
    }

    async invalidateFloorPlanCache(urn) {
        return await this.invalidatePattern(`*:*${urn}*`);
    }

    // Cache statistics
    async getCacheStats() {
        const info = await this.client.info('memory');
        const keyspace = await this.client.info('keyspace');
        
        return {
            memory: this.parseRedisInfo(info),
            keyspace: this.parseRedisInfo(keyspace),
            timestamp: new Date().toISOString()
        };
    }

    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const result = {};
        
        lines.forEach(line => {
            if (line.includes(':')) {
                const [key, value] = line.split(':');
                result[key] = isNaN(value) ? value : Number(value);
            }
        });
        
        return result;
    }

    // Cleanup expired keys
    async cleanup() {
        const patterns = [
            'floorplan:*',
            'ilots:*',
            'corridors:*',
            'pathfinding:*',
            '3dmodel:*'
        ];
        
        let totalCleaned = 0;
        for (const pattern of patterns) {
            const keys = await this.client.keys(pattern);
            for (const key of keys) {
                const ttl = await this.client.ttl(key);
                if (ttl === -1) { // No expiration set
                    await this.client.expire(key, 3600); // Set 1 hour expiration
                    totalCleaned++;
                }
            }
        }
        
        return totalCleaned;
    }

    // Close connection
    async close() {
        await this.client.quit();
    }
}

// Cache middleware for Express
function cacheMiddleware(cacheManager, ttl = 300) {
    return async (req, res, next) => {
        const key = cacheManager.generateKey('api', {
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            query: req.query
        });
        
        try {
            const cached = await cacheManager.client.get(key);
            if (cached) {
                return res.json(JSON.parse(cached));
            }
            
            // Store original res.json
            const originalJson = res.json;
            res.json = function(data) {
                // Cache the response
                cacheManager.client.setex(key, ttl, JSON.stringify(data));
                return originalJson.call(this, data);
            };
            
            next();
        } catch (error) {
            console.error('Cache middleware error:', error);
            next();
        }
    };
}

module.exports = {
    RedisCacheManager,
    cacheMiddleware
};