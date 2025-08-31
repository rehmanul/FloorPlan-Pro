// Performance Optimization Engine - Production Implementation
const cluster = require('cluster');
const os = require('os');

class PerformanceOptimizer {
    constructor() {
        this.renderCache = new Map();
        this.workerPool = [];
        this.batchQueue = [];
        this.processingQueue = [];
    }

    // Canvas Rendering Optimization
    optimizeCanvasRendering(canvas, entities) {
        const ctx = canvas.getContext('2d');
        const offscreenCanvas = new OffscreenCanvas(canvas.width, canvas.height);
        const offscreenCtx = offscreenCanvas.getContext('2d');
        
        // Batch static properties
        const staticProps = {
            lineWidth: 2,
            lineCap: 'round',
            lineJoin: 'round',
            globalCompositeOperation: 'source-over'
        };
        
        // Group entities by type for batch processing
        const entityGroups = this.groupEntitiesByType(entities);
        
        // Render each group with optimized batching
        Object.entries(entityGroups).forEach(([type, groupEntities]) => {
            this.renderEntityGroup(offscreenCtx, type, groupEntities, staticProps);
        });
        
        // Transfer to main canvas
        ctx.drawImage(offscreenCanvas, 0, 0);
        
        return offscreenCanvas;
    }

    groupEntitiesByType(entities) {
        return entities.reduce((groups, entity) => {
            const type = entity.type || 'default';
            if (!groups[type]) groups[type] = [];
            groups[type].push(entity);
            return groups;
        }, {});
    }

    renderEntityGroup(ctx, type, entities, staticProps) {
        ctx.save();
        Object.assign(ctx, staticProps);
        
        // Set type-specific properties once
        switch (type) {
            case 'wall':
                ctx.strokeStyle = '#6B7280';
                ctx.lineWidth = 3;
                break;
            case 'door':
                ctx.strokeStyle = '#EF4444';
                ctx.lineWidth = 2;
                break;
            case 'window':
                ctx.strokeStyle = '#3B82F6';
                ctx.lineWidth = 1.5;
                break;
        }
        
        // Batch render all entities of this type
        ctx.beginPath();
        entities.forEach(entity => {
            if (entity.x1 !== undefined) {
                ctx.moveTo(entity.x1, entity.y1);
                ctx.lineTo(entity.x2, entity.y2);
            }
        });
        ctx.stroke();
        
        ctx.restore();
    }

    // Parallel Processing Implementation
    async processRoomsInParallel(rooms, processor) {
        const numCPUs = os.cpus().length;
        const chunkSize = Math.ceil(rooms.length / numCPUs);
        const chunks = [];
        
        for (let i = 0; i < rooms.length; i += chunkSize) {
            chunks.push(rooms.slice(i, i + chunkSize));
        }
        
        const promises = chunks.map(chunk => 
            this.processChunkInWorker(chunk, processor)
        );
        
        const results = await Promise.all(promises);
        return results.flat();
    }

    async processChunkInWorker(chunk, processor) {
        return new Promise((resolve, reject) => {
            const worker = cluster.fork();
            
            worker.send({
                type: 'PROCESS_CHUNK',
                chunk: chunk,
                processor: processor.toString()
            });
            
            worker.on('message', (result) => {
                if (result.type === 'CHUNK_COMPLETE') {
                    resolve(result.data);
                    worker.kill();
                }
            });
            
            worker.on('error', reject);
            
            setTimeout(() => {
                worker.kill();
                reject(new Error('Worker timeout'));
            }, 30000);
        });
    }
}

// A* Pathfinding Algorithm Implementation
class AStarPathfinder {
    constructor(grid) {
        this.grid = grid;
        this.openSet = [];
        this.closedSet = new Set();
    }

    findPath(start, goal) {
        const startNode = new PathNode(start.x, start.y, 0, this.heuristic(start, goal));
        this.openSet.push(startNode);
        
        while (this.openSet.length > 0) {
            // Get node with lowest f score
            this.openSet.sort((a, b) => a.f - b.f);
            const current = this.openSet.shift();
            
            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(current);
            }
            
            this.closedSet.add(`${current.x},${current.y}`);
            
            // Check neighbors
            const neighbors = this.getNeighbors(current);
            for (const neighbor of neighbors) {
                const key = `${neighbor.x},${neighbor.y}`;
                
                if (this.closedSet.has(key) || this.isObstacle(neighbor.x, neighbor.y)) {
                    continue;
                }
                
                const tentativeG = current.g + this.distance(current, neighbor);
                
                const existingNode = this.openSet.find(n => n.x === neighbor.x && n.y === neighbor.y);
                if (!existingNode) {
                    neighbor.g = tentativeG;
                    neighbor.h = this.heuristic(neighbor, goal);
                    neighbor.f = neighbor.g + neighbor.h;
                    neighbor.parent = current;
                    this.openSet.push(neighbor);
                } else if (tentativeG < existingNode.g) {
                    existingNode.g = tentativeG;
                    existingNode.f = existingNode.g + existingNode.h;
                    existingNode.parent = current;
                }
            }
        }
        
        return null; // No path found
    }

    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            {x: 0, y: 1}, {x: 1, y: 0}, {x: 0, y: -1}, {x: -1, y: 0},
            {x: 1, y: 1}, {x: 1, y: -1}, {x: -1, y: 1}, {x: -1, y: -1}
        ];
        
        for (const dir of directions) {
            const x = node.x + dir.x;
            const y = node.y + dir.y;
            
            if (this.isValidPosition(x, y)) {
                neighbors.push(new PathNode(x, y));
            }
        }
        
        return neighbors;
    }

    isValidPosition(x, y) {
        return x >= 0 && x < this.grid.width && y >= 0 && y < this.grid.height;
    }

    isObstacle(x, y) {
        return this.grid.data[y] && this.grid.data[y][x] === 1;
    }

    reconstructPath(node) {
        const path = [];
        let current = node;
        
        while (current) {
            path.unshift({x: current.x, y: current.y});
            current = current.parent;
        }
        
        return path;
    }
}

class PathNode {
    constructor(x, y, g = 0, h = 0) {
        this.x = x;
        this.y = y;
        this.g = g; // Cost from start
        this.h = h; // Heuristic cost to goal
        this.f = g + h; // Total cost
        this.parent = null;
    }
}

// Dijkstra's Algorithm Implementation
class DijkstraPathfinder {
    constructor(graph) {
        this.graph = graph;
    }

    findShortestPath(start, end) {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        // Initialize distances
        for (const node of this.graph.nodes) {
            distances.set(node.id, node.id === start ? 0 : Infinity);
            unvisited.add(node.id);
        }
        
        while (unvisited.size > 0) {
            // Find unvisited node with minimum distance
            let current = null;
            let minDistance = Infinity;
            
            for (const nodeId of unvisited) {
                if (distances.get(nodeId) < minDistance) {
                    minDistance = distances.get(nodeId);
                    current = nodeId;
                }
            }
            
            if (current === null || current === end) break;
            
            unvisited.delete(current);
            
            // Update distances to neighbors
            const neighbors = this.graph.getNeighbors(current);
            for (const neighbor of neighbors) {
                if (!unvisited.has(neighbor.id)) continue;
                
                const alt = distances.get(current) + neighbor.weight;
                if (alt < distances.get(neighbor.id)) {
                    distances.set(neighbor.id, alt);
                    previous.set(neighbor.id, current);
                }
            }
        }
        
        return this.reconstructPath(previous, start, end);
    }

    reconstructPath(previous, start, end) {
        const path = [];
        let current = end;
        
        while (current !== undefined) {
            path.unshift(current);
            current = previous.get(current);
        }
        
        return path[0] === start ? path : null;
    }
}

module.exports = {
    PerformanceOptimizer,
    AStarPathfinder,
    DijkstraPathfinder,
    PathNode
};