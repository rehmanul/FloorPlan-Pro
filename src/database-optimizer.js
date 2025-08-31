// Database Optimization - Production Implementation
const { Pool } = require('pg');

class DatabaseOptimizer {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }

    // Initialize database with optimized schema and indexes
    async initializeDatabase() {
        const client = await this.pool.connect();
        
        try {
            // Create optimized tables
            await this.createTables(client);
            await this.createIndexes(client);
            await this.createViews(client);
            await this.setupPartitioning(client);
            
            console.log('Database initialized with optimizations');
        } finally {
            client.release();
        }
    }

    async createTables(client) {
        // Floor plans table with JSONB for flexible data
        await client.query(`
            CREATE TABLE IF NOT EXISTS floor_plans (
                id SERIAL PRIMARY KEY,
                urn VARCHAR(255) UNIQUE NOT NULL,
                filename VARCHAR(255) NOT NULL,
                file_size BIGINT,
                upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                analysis_data JSONB,
                bounds JSONB,
                metadata JSONB,
                status VARCHAR(50) DEFAULT 'processing',
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Rooms table with spatial data
        await client.query(`
            CREATE TABLE IF NOT EXISTS rooms (
                id SERIAL PRIMARY KEY,
                floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(100),
                area DECIMAL(10,2),
                perimeter DECIMAL(10,2),
                vertices JSONB,
                center_point JSONB,
                properties JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Ilots table with placement data
        await client.query(`
            CREATE TABLE IF NOT EXISTS ilots (
                id SERIAL PRIMARY KEY,
                floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
                room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
                type VARCHAR(100) NOT NULL,
                position JSONB NOT NULL,
                dimensions JSONB NOT NULL,
                capacity INTEGER,
                configuration JSONB,
                efficiency_score DECIMAL(3,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Corridors table with network data
        await client.query(`
            CREATE TABLE IF NOT EXISTS corridors (
                id SERIAL PRIMARY KEY,
                floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
                type VARCHAR(100) NOT NULL,
                path JSONB NOT NULL,
                width DECIMAL(5,2),
                area DECIMAL(10,2),
                connects JSONB,
                accessibility_score DECIMAL(3,2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Collaboration sessions
        await client.query(`
            CREATE TABLE IF NOT EXISTS collaboration_sessions (
                id SERIAL PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                floor_plan_id INTEGER REFERENCES floor_plans(id) ON DELETE CASCADE,
                participants JSONB,
                state JSONB,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Performance metrics
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics (
                id SERIAL PRIMARY KEY,
                operation_type VARCHAR(100) NOT NULL,
                execution_time INTEGER,
                memory_usage BIGINT,
                cache_hit_rate DECIMAL(5,2),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            )
        `);
    }

    async createIndexes(client) {
        // Primary indexes for fast lookups
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_floor_plans_urn ON floor_plans(urn)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_floor_plans_user_id ON floor_plans(user_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_floor_plans_status ON floor_plans(status)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_floor_plans_created_at ON floor_plans(created_at DESC)');

        // Room indexes
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_floor_plan_id ON rooms(floor_plan_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_type ON rooms(type)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_area ON rooms(area DESC)');

        // Ilot indexes
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ilots_floor_plan_id ON ilots(floor_plan_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ilots_room_id ON ilots(room_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ilots_type ON ilots(type)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ilots_efficiency ON ilots(efficiency_score DESC)');

        // Corridor indexes
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corridors_floor_plan_id ON corridors(floor_plan_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_corridors_type ON corridors(type)');

        // JSONB indexes for fast JSON queries
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_floor_plans_analysis_gin ON floor_plans USING GIN(analysis_data)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rooms_vertices_gin ON rooms USING GIN(vertices)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ilots_position_gin ON ilots USING GIN(position)');

        // Collaboration indexes
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaboration_sessions_id ON collaboration_sessions(session_id)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collaboration_last_activity ON collaboration_sessions(last_activity DESC)');

        // Performance metrics indexes
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(operation_type)');
        await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp DESC)');
    }

    async createViews(client) {
        // Optimized view for floor plan summaries
        await client.query(`
            CREATE OR REPLACE VIEW floor_plan_summary AS
            SELECT 
                fp.id,
                fp.urn,
                fp.filename,
                fp.status,
                fp.created_at,
                COUNT(DISTINCT r.id) as room_count,
                COUNT(DISTINCT i.id) as ilot_count,
                COUNT(DISTINCT c.id) as corridor_count,
                COALESCE(SUM(r.area), 0) as total_area,
                AVG(i.efficiency_score) as avg_efficiency
            FROM floor_plans fp
            LEFT JOIN rooms r ON fp.id = r.floor_plan_id
            LEFT JOIN ilots i ON fp.id = i.floor_plan_id
            LEFT JOIN corridors c ON fp.id = c.floor_plan_id
            GROUP BY fp.id, fp.urn, fp.filename, fp.status, fp.created_at
        `);

        // Room utilization view
        await client.query(`
            CREATE OR REPLACE VIEW room_utilization AS
            SELECT 
                r.id,
                r.name,
                r.type,
                r.area,
                COUNT(i.id) as ilot_count,
                COALESCE(SUM(i.capacity), 0) as total_capacity,
                CASE 
                    WHEN r.area > 0 THEN (COUNT(i.id)::DECIMAL / r.area) * 100
                    ELSE 0 
                END as utilization_percentage
            FROM rooms r
            LEFT JOIN ilots i ON r.id = i.room_id
            GROUP BY r.id, r.name, r.type, r.area
        `);
    }

    async setupPartitioning(client) {
        // Partition performance metrics by month for better query performance
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics_y2024m01 
            PARTITION OF performance_metrics 
            FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
        `);
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS performance_metrics_y2024m02 
            PARTITION OF performance_metrics 
            FOR VALUES FROM ('2024-02-01') TO ('2024-03-01')
        `);
    }

    // Optimized queries
    async getFloorPlanWithDetails(urn) {
        const query = `
            SELECT 
                fp.*,
                json_agg(DISTINCT jsonb_build_object(
                    'id', r.id,
                    'name', r.name,
                    'type', r.type,
                    'area', r.area,
                    'vertices', r.vertices
                )) FILTER (WHERE r.id IS NOT NULL) as rooms,
                json_agg(DISTINCT jsonb_build_object(
                    'id', i.id,
                    'type', i.type,
                    'position', i.position,
                    'dimensions', i.dimensions,
                    'capacity', i.capacity
                )) FILTER (WHERE i.id IS NOT NULL) as ilots,
                json_agg(DISTINCT jsonb_build_object(
                    'id', c.id,
                    'type', c.type,
                    'path', c.path,
                    'width', c.width,
                    'area', c.area
                )) FILTER (WHERE c.id IS NOT NULL) as corridors
            FROM floor_plans fp
            LEFT JOIN rooms r ON fp.id = r.floor_plan_id
            LEFT JOIN ilots i ON fp.id = i.floor_plan_id
            LEFT JOIN corridors c ON fp.id = c.floor_plan_id
            WHERE fp.urn = $1
            GROUP BY fp.id
        `;
        
        const result = await this.pool.query(query, [urn]);
        return result.rows[0];
    }

    async bulkInsertIlots(floorPlanId, ilots) {
        const client = await this.pool.connect();
        
        try {
            await client.query('BEGIN');
            
            const insertQuery = `
                INSERT INTO ilots (floor_plan_id, room_id, type, position, dimensions, capacity, configuration, efficiency_score)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            
            for (const ilot of ilots) {
                await client.query(insertQuery, [
                    floorPlanId,
                    ilot.roomId,
                    ilot.type,
                    JSON.stringify(ilot.position),
                    JSON.stringify(ilot.dimensions),
                    ilot.capacity,
                    JSON.stringify(ilot.configuration || {}),
                    ilot.efficiencyScore || 0.8
                ]);
            }
            
            await client.query('COMMIT');
            return ilots.length;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async getOptimizedRoomQuery(floorPlanId, filters = {}) {
        let query = `
            SELECT r.*, 
                   COUNT(i.id) as ilot_count,
                   COALESCE(SUM(i.capacity), 0) as total_capacity
            FROM rooms r
            LEFT JOIN ilots i ON r.id = i.room_id
            WHERE r.floor_plan_id = $1
        `;
        
        const params = [floorPlanId];
        let paramIndex = 2;
        
        if (filters.type) {
            query += ` AND r.type = $${paramIndex}`;
            params.push(filters.type);
            paramIndex++;
        }
        
        if (filters.minArea) {
            query += ` AND r.area >= $${paramIndex}`;
            params.push(filters.minArea);
            paramIndex++;
        }
        
        query += ` GROUP BY r.id ORDER BY r.area DESC`;
        
        if (filters.limit) {
            query += ` LIMIT $${paramIndex}`;
            params.push(filters.limit);
        }
        
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    // Performance monitoring
    async recordPerformanceMetric(operationType, executionTime, memoryUsage, cacheHitRate, metadata = {}) {
        const query = `
            INSERT INTO performance_metrics (operation_type, execution_time, memory_usage, cache_hit_rate, metadata)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await this.pool.query(query, [
            operationType,
            executionTime,
            memoryUsage,
            cacheHitRate,
            JSON.stringify(metadata)
        ]);
    }

    async getPerformanceStats(hours = 24) {
        const query = `
            SELECT 
                operation_type,
                COUNT(*) as operation_count,
                AVG(execution_time) as avg_execution_time,
                MAX(execution_time) as max_execution_time,
                AVG(memory_usage) as avg_memory_usage,
                AVG(cache_hit_rate) as avg_cache_hit_rate
            FROM performance_metrics
            WHERE timestamp >= NOW() - INTERVAL '${hours} hours'
            GROUP BY operation_type
            ORDER BY avg_execution_time DESC
        `;
        
        const result = await this.pool.query(query);
        return result.rows;
    }

    // Database maintenance
    async runMaintenance() {
        const client = await this.pool.connect();
        
        try {
            // Update table statistics
            await client.query('ANALYZE floor_plans, rooms, ilots, corridors');
            
            // Vacuum old data
            await client.query('VACUUM (ANALYZE) performance_metrics');
            
            // Clean up old collaboration sessions
            await client.query(`
                DELETE FROM collaboration_sessions 
                WHERE last_activity < NOW() - INTERVAL '24 hours'
            `);
            
            console.log('Database maintenance completed');
        } finally {
            client.release();
        }
    }

    async close() {
        await this.pool.end();
    }
}

module.exports = { DatabaseOptimizer };