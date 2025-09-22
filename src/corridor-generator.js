/**
 * Corridor Generator for Architectural Floor Plans
 * 
 * Implements A* pathfinding for optimal corridor routing between entrances and key destinations.
 * Generates corridor polygons with proper width maintenance and path smoothing.
 * 
 * Features:
 * - A* pathfinding algorithm over allowed space
 * - Multi-destination corridor network generation
 * - Path smoothing and optimization
 * - Corridor width maintenance and geometry generation
 * - Integration with forbidden zones and îlot placement
 * 
 * Dependencies:
 * - GeometryEngine for spatial operations
 * 
 * @author FloorPlan Pro Team
 * @version 1.0.0
 */

const GeometryEngine = require('./geometry-engine');

class CorridorGenerator {
    constructor(options = {}) {
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });
        
        // Corridor configuration
        this.config = {
            // Corridor dimensions
            defaultWidth: options.defaultWidth || 1.8,
            minWidth: options.minWidth || 1.5,
            maxWidth: options.maxWidth || 3.0,
            
            // Pathfinding parameters
            gridResolution: options.gridResolution || 0.5, // Grid cell size in meters
            diagonalMovement: options.diagonalMovement !== false,
            diagonalCost: options.diagonalCost || 1.414, // sqrt(2)
            
            // Path optimization
            smoothingIterations: options.smoothingIterations || 3,
            maxTurnAngle: options.maxTurnAngle || 135, // degrees
            cornerRadius: options.cornerRadius || 0.3,
            
            // Connection requirements
            connectAllEntrances: options.connectAllEntrances !== false,
            requireRedundantPaths: options.requireRedundantPaths || false,
            maxPathLength: options.maxPathLength || 100, // meters
            
            // Performance limits
            maxNodes: options.maxNodes || 10000,
            timeoutMs: options.timeoutMs || 30000,
            
            ...options
        };
        
        // State variables
        this.floorPlan = null;
        this.allowedSpace = null;
        this.navigationGrid = null;
        this.corridors = [];
        this.pathNetwork = new Map();
        
        this.log('CorridorGenerator initialized', this.config);
    }

    /**
     * MAIN CORRIDOR GENERATION WORKFLOW
     */

    /**
     * Generate corridor network for floor plan
     * @param {Object} floorPlan - Floor plan with entrances and zones
     * @param {Array} allowedSpace - Available space for corridors
     * @param {Array} destinations - Key destinations to connect
     * @returns {Promise<Array>} Generated corridors
     */
    async generateCorridorNetwork(floorPlan, allowedSpace, destinations = []) {
        try {
            this.log('Starting corridor network generation');
            
            // Initialize state
            this.floorPlan = floorPlan;
            this.allowedSpace = allowedSpace;
            this.corridors = [];
            this.pathNetwork.clear();
            
            // Step 1: Create navigation grid
            await this.createNavigationGrid();
            
            // Step 2: Identify key points to connect
            const keyPoints = this.identifyKeyPoints(destinations);
            
            // Step 3: Generate path network
            await this.generatePathNetwork(keyPoints);
            
            // Step 4: Optimize path network
            await this.optimizePathNetwork();
            
            // Step 5: Generate corridor geometry
            await this.generateCorridorGeometry();
            
            // Step 6: Validate corridor network
            const validation = await this.validateCorridorNetwork();
            
            if (!validation.isValid) {
                this.logError('Corridor validation failed', validation.errors);
                // Continue with warnings but don't fail completely
            }
            
            this.log('Corridor network generation completed', {
                corridors: this.corridors.length,
                totalLength: this.calculateTotalLength(),
                coverage: this.calculateCoverage()
            });
            
            return this.corridors;
            
        } catch (error) {
            this.logError('Corridor generation failed', error);
            throw error;
        }
    }

    /**
     * NAVIGATION GRID CREATION
     */

    /**
     * Create navigation grid for pathfinding
     */
    async createNavigationGrid() {
        try {
            if (!this.allowedSpace) {
                throw new Error('No allowed space provided for navigation grid');
            }
            
            // Calculate grid bounds
            const bbox = this.geometryEngine.calculateBoundingBox(this.allowedSpace);
            const gridWidth = Math.ceil((bbox.maxX - bbox.minX) / this.config.gridResolution);
            const gridHeight = Math.ceil((bbox.maxY - bbox.minY) / this.config.gridResolution);
            
            this.log('Creating navigation grid', { 
                gridWidth, 
                gridHeight, 
                resolution: this.config.gridResolution 
            });
            
            // Initialize grid
            this.navigationGrid = {
                bbox,
                width: gridWidth,
                height: gridHeight,
                resolution: this.config.gridResolution,
                cells: new Array(gridWidth * gridHeight).fill(0)
            };
            
            // Mark walkable cells
            for (let y = 0; y < gridHeight; y++) {
                for (let x = 0; x < gridWidth; x++) {
                    const worldX = bbox.minX + (x + 0.5) * this.config.gridResolution;
                    const worldY = bbox.minY + (y + 0.5) * this.config.gridResolution;
                    const point = [worldX, worldY];
                    
                    // Check if point is in allowed space
                    if (this.geometryEngine.pointInPolygon(point, this.allowedSpace)) {
                        // Check corridor width clearance
                        if (this.hasCorridorClearance(point)) {
                            this.setGridCell(x, y, 1); // Walkable
                        }
                    }
                }
            }
            
            const walkableCells = this.navigationGrid.cells.filter(cell => cell === 1).length;
            this.log('Navigation grid created', { 
                totalCells: this.navigationGrid.cells.length,
                walkableCells,
                walkableRatio: walkableCells / this.navigationGrid.cells.length
            });
            
        } catch (error) {
            this.logError('Navigation grid creation failed', error);
            throw error;
        }
    }

    /**
     * Check if point has enough clearance for corridor
     * @param {Array} point - Point to check
     * @returns {boolean} True if has clearance
     */
    hasCorridorClearance(point) {
        const radius = this.config.defaultWidth / 2;
        const checkPoints = [
            [point[0] - radius, point[1]],
            [point[0] + radius, point[1]],
            [point[0], point[1] - radius],
            [point[0], point[1] + radius]
        ];
        
        return checkPoints.every(checkPoint => 
            this.geometryEngine.pointInPolygon(checkPoint, this.allowedSpace)
        );
    }

    /**
     * A* PATHFINDING IMPLEMENTATION
     */

    /**
     * Find path between two points using A* algorithm
     * @param {Array} start - Start point [x, y]
     * @param {Array} end - End point [x, y]
     * @param {Object} options - Pathfinding options
     * @returns {Array|null} Path as array of points, or null if no path found
     */
    async findPath(start, end, options = {}) {
        try {
            const startTime = Date.now();
            
            // Convert world coordinates to grid coordinates
            const startGrid = this.worldToGrid(start);
            const endGrid = this.worldToGrid(end);
            
            if (!this.isValidGridCell(startGrid.x, startGrid.y) || 
                !this.isValidGridCell(endGrid.x, endGrid.y)) {
                return null;
            }
            
            // Initialize A* data structures
            const openSet = new PriorityQueue();
            const closedSet = new Set();
            const gScore = new Map();
            const fScore = new Map();
            const cameFrom = new Map();
            
            const startKey = `${startGrid.x},${startGrid.y}`;
            const endKey = `${endGrid.x},${endGrid.y}`;
            
            // Initialize start node
            openSet.enqueue(startGrid, 0);
            gScore.set(startKey, 0);
            fScore.set(startKey, this.heuristic(startGrid, endGrid));
            
            let nodesExplored = 0;
            
            while (!openSet.isEmpty() && nodesExplored < this.config.maxNodes) {
                // Check timeout
                if (Date.now() - startTime > this.config.timeoutMs) {
                    this.logError('Pathfinding timeout');
                    return null;
                }
                
                const current = openSet.dequeue();
                const currentKey = `${current.x},${current.y}`;
                nodesExplored++;
                
                // Goal reached
                if (currentKey === endKey) {
                    const path = this.reconstructPath(cameFrom, current);
                    const worldPath = path.map(gridPoint => this.gridToWorld(gridPoint));
                    
                    this.log('Path found', {
                        nodesExplored,
                        pathLength: worldPath.length,
                        totalDistance: this.calculatePathDistance(worldPath)
                    });
                    
                    return worldPath;
                }
                
                closedSet.add(currentKey);
                
                // Explore neighbors
                const neighbors = this.getNeighbors(current);
                for (const neighbor of neighbors) {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    
                    if (closedSet.has(neighborKey)) continue;
                    
                    const tentativeGScore = gScore.get(currentKey) + this.getMoveCost(current, neighbor);
                    
                    if (!gScore.has(neighborKey) || tentativeGScore < gScore.get(neighborKey)) {
                        cameFrom.set(neighborKey, current);
                        gScore.set(neighborKey, tentativeGScore);
                        fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, endGrid));
                        
                        if (!openSet.contains(neighbor)) {
                            openSet.enqueue(neighbor, fScore.get(neighborKey));
                        }
                    }
                }
            }
            
            this.log('No path found', { nodesExplored });
            return null;
            
        } catch (error) {
            this.logError('Pathfinding failed', error);
            return null;
        }
    }

    /**
     * KEY POINT IDENTIFICATION
     */

    /**
     * Identify key points that need to be connected
     * @param {Array} destinations - Additional destinations
     * @returns {Array} Array of key points
     */
    identifyKeyPoints(destinations) {
        const keyPoints = [];
        
        // Add all entrances
        if (this.floorPlan.entrances) {
            for (const entrance of this.floorPlan.entrances) {
                keyPoints.push({
                    type: 'entrance',
                    position: entrance.position || entrance,
                    id: entrance.id || `entrance_${keyPoints.length}`,
                    priority: 1.0
                });
            }
        }
        
        // Add destinations
        for (const destination of destinations) {
            keyPoints.push({
                type: 'destination',
                position: destination.position,
                id: destination.id || `destination_${keyPoints.length}`,
                priority: destination.priority || 0.5
            });
        }
        
        // Add circulation nodes (intersections, key areas)
        const circulationNodes = this.identifyCirculationNodes();
        keyPoints.push(...circulationNodes);
        
        this.log('Key points identified', { 
            entrances: keyPoints.filter(p => p.type === 'entrance').length,
            destinations: keyPoints.filter(p => p.type === 'destination').length,
            circulation: keyPoints.filter(p => p.type === 'circulation').length
        });
        
        return keyPoints;
    }

    /**
     * Identify circulation nodes for network connectivity
     * @returns {Array} Circulation nodes
     */
    identifyCirculationNodes() {
        const nodes = [];
        
        if (!this.allowedSpace) return nodes;
        
        // Simple implementation: add nodes at strategic locations
        const bbox = this.geometryEngine.calculateBoundingBox(this.allowedSpace);
        const centerX = (bbox.minX + bbox.maxX) / 2;
        const centerY = (bbox.minY + bbox.maxY) / 2;
        
        // Add center node if it's in allowed space
        const center = [centerX, centerY];
        if (this.geometryEngine.pointInPolygon(center, this.allowedSpace)) {
            nodes.push({
                type: 'circulation',
                position: center,
                id: 'center_node',
                priority: 0.8
            });
        }
        
        // Add quarter points
        const quarterPoints = [
            [(bbox.minX + centerX) / 2, (bbox.minY + centerY) / 2],
            [(centerX + bbox.maxX) / 2, (bbox.minY + centerY) / 2],
            [(bbox.minX + centerX) / 2, (centerY + bbox.maxY) / 2],
            [(centerX + bbox.maxX) / 2, (centerY + bbox.maxY) / 2]
        ];
        
        quarterPoints.forEach((point, index) => {
            if (this.geometryEngine.pointInPolygon(point, this.allowedSpace)) {
                nodes.push({
                    type: 'circulation',
                    position: point,
                    id: `quarter_node_${index}`,
                    priority: 0.6
                });
            }
        });
        
        return nodes;
    }

    /**
     * PATH NETWORK GENERATION
     */

    /**
     * Generate path network connecting all key points
     * @param {Array} keyPoints - Points to connect
     */
    async generatePathNetwork(keyPoints) {
        try {
            this.log('Generating path network', { keyPoints: keyPoints.length });
            
            // Create minimum spanning tree for initial connectivity
            const mst = await this.createMinimumSpanningTree(keyPoints);
            
            // Add paths from MST to network
            for (const edge of mst) {
                const path = await this.findPath(edge.from.position, edge.to.position);
                if (path) {
                    this.addPathToNetwork(edge.from.id, edge.to.id, path, edge.weight);
                }
            }
            
            // Add redundant paths if required
            if (this.config.requireRedundantPaths) {
                await this.addRedundantPaths(keyPoints);
            }
            
            this.log('Path network generated', { 
                paths: this.pathNetwork.size,
                totalNodes: keyPoints.length
            });
            
        } catch (error) {
            this.logError('Path network generation failed', error);
            throw error;
        }
    }

    /**
     * Create minimum spanning tree for key points
     * @param {Array} keyPoints - Points to connect
     * @returns {Array} MST edges
     */
    async createMinimumSpanningTree(keyPoints) {
        const edges = [];
        
        // Calculate all possible edges
        for (let i = 0; i < keyPoints.length; i++) {
            for (let j = i + 1; j < keyPoints.length; j++) {
                const point1 = keyPoints[i];
                const point2 = keyPoints[j];
                const distance = this.geometryEngine.calculateDistance(point1.position, point2.position);
                
                edges.push({
                    from: point1,
                    to: point2,
                    weight: distance
                });
            }
        }
        
        // Sort edges by weight
        edges.sort((a, b) => a.weight - b.weight);
        
        // Kruskal's algorithm
        const mst = [];
        const parent = new Map();
        
        // Initialize union-find
        for (const point of keyPoints) {
            parent.set(point.id, point.id);
        }
        
        const find = (id) => {
            if (parent.get(id) !== id) {
                parent.set(id, find(parent.get(id)));
            }
            return parent.get(id);
        };
        
        const union = (id1, id2) => {
            const root1 = find(id1);
            const root2 = find(id2);
            if (root1 !== root2) {
                parent.set(root1, root2);
                return true;
            }
            return false;
        };
        
        // Build MST
        for (const edge of edges) {
            if (union(edge.from.id, edge.to.id)) {
                mst.push(edge);
                if (mst.length === keyPoints.length - 1) break;
            }
        }
        
        return mst;
    }

    /**
     * Add path to network
     * @param {string} fromId - Start point ID
     * @param {string} toId - End point ID
     * @param {Array} path - Path points
     * @param {number} weight - Path weight
     */
    addPathToNetwork(fromId, toId, path, weight) {
        const pathId = `${fromId}_${toId}`;
        this.pathNetwork.set(pathId, {
            id: pathId,
            from: fromId,
            to: toId,
            path,
            weight,
            length: this.calculatePathDistance(path)
        });
    }

    /**
     * PATH OPTIMIZATION
     */

    /**
     * Optimize path network
     */
    async optimizePathNetwork() {
        try {
            this.log('Optimizing path network');
            
            // Smooth all paths
            for (const [pathId, pathData] of this.pathNetwork) {
                const smoothedPath = this.smoothPath(pathData.path);
                pathData.path = smoothedPath;
                pathData.length = this.calculatePathDistance(smoothedPath);
            }
            
            // Remove redundant segments
            this.removeRedundantSegments();
            
            // Optimize intersections
            this.optimizeIntersections();
            
            this.log('Path network optimized');
            
        } catch (error) {
            this.logError('Path optimization failed', error);
        }
    }

    /**
     * Smooth path using iterative smoothing
     * @param {Array} path - Original path
     * @returns {Array} Smoothed path
     */
    smoothPath(path) {
        if (path.length < 3) return path;
        
        let smoothedPath = [...path];
        
        for (let iteration = 0; iteration < this.config.smoothingIterations; iteration++) {
            const newPath = [smoothedPath[0]]; // Keep first point
            
            for (let i = 1; i < smoothedPath.length - 1; i++) {
                const prev = smoothedPath[i - 1];
                const current = smoothedPath[i];
                const next = smoothedPath[i + 1];
                
                // Calculate smoothed position
                const smoothed = [
                    (prev[0] + 2 * current[0] + next[0]) / 4,
                    (prev[1] + 2 * current[1] + next[1]) / 4
                ];
                
                // Check if smoothed point is still in allowed space
                if (this.geometryEngine.pointInPolygon(smoothed, this.allowedSpace)) {
                    newPath.push(smoothed);
                } else {
                    newPath.push(current);
                }
            }
            
            newPath.push(smoothedPath[smoothedPath.length - 1]); // Keep last point
            smoothedPath = newPath;
        }
        
        return smoothedPath;
    }

    /**
     * CORRIDOR GEOMETRY GENERATION
     */

    /**
     * Generate corridor geometry from path network
     */
    async generateCorridorGeometry() {
        try {
            this.log('Generating corridor geometry');
            
            this.corridors = [];
            
            for (const [pathId, pathData] of this.pathNetwork) {
                const corridor = await this.createCorridorFromPath(pathData);
                if (corridor) {
                    this.corridors.push(corridor);
                }
            }
            
            // Merge overlapping corridors
            this.mergeOverlappingCorridors();
            
            this.log('Corridor geometry generated', { corridors: this.corridors.length });
            
        } catch (error) {
            this.logError('Corridor geometry generation failed', error);
            throw error;
        }
    }

    /**
     * Create corridor geometry from path
     * @param {Object} pathData - Path data
     * @returns {Object} Corridor object
     */
    async createCorridorFromPath(pathData) {
        try {
            const width = this.config.defaultWidth;
            const path = pathData.path;
            
            if (path.length < 2) return null;
            
            const corridorPolygon = this.generateCorridorPolygon(path, width);
            
            return {
                id: `corridor_${pathData.id}`,
                pathId: pathData.id,
                polygon: corridorPolygon,
                bbox: this.geometryEngine.calculateBoundingBox(corridorPolygon),
                width,
                length: pathData.length,
                area: this.geometryEngine.calculatePolygonArea(corridorPolygon),
                centerline: path,
                metadata: {
                    from: pathData.from,
                    to: pathData.to,
                    created: new Date().toISOString()
                }
            };
            
        } catch (error) {
            this.logError('Corridor creation failed', error);
            return null;
        }
    }

    /**
     * Generate corridor polygon from centerline path
     * @param {Array} path - Centerline path
     * @param {number} width - Corridor width
     * @returns {Array} Corridor polygon
     */
    generateCorridorPolygon(path, width) {
        const halfWidth = width / 2;
        const leftSide = [];
        const rightSide = [];
        
        for (let i = 0; i < path.length; i++) {
            const current = path[i];
            let direction;
            
            if (i === 0) {
                // First point: use direction to next point
                const next = path[i + 1];
                direction = this.calculateDirection(current, next);
            } else if (i === path.length - 1) {
                // Last point: use direction from previous point
                const prev = path[i - 1];
                direction = this.calculateDirection(prev, current);
            } else {
                // Middle point: average direction
                const prev = path[i - 1];
                const next = path[i + 1];
                const dir1 = this.calculateDirection(prev, current);
                const dir2 = this.calculateDirection(current, next);
                direction = (dir1 + dir2) / 2;
            }
            
            // Calculate perpendicular offset
            const perpX = Math.cos(direction + Math.PI / 2) * halfWidth;
            const perpY = Math.sin(direction + Math.PI / 2) * halfWidth;
            
            leftSide.push([current[0] + perpX, current[1] + perpY]);
            rightSide.push([current[0] - perpX, current[1] - perpY]);
        }
        
        // Combine left and right sides
        return [...leftSide, ...rightSide.reverse()];
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Calculate direction between two points
     * @param {Array} from - Start point
     * @param {Array} to - End point
     * @returns {number} Direction in radians
     */
    calculateDirection(from, to) {
        return Math.atan2(to[1] - from[1], to[0] - from[0]);
    }

    /**
     * Calculate distance of path
     * @param {Array} path - Path points
     * @returns {number} Total distance
     */
    calculatePathDistance(path) {
        let distance = 0;
        for (let i = 1; i < path.length; i++) {
            distance += this.geometryEngine.calculateDistance(path[i - 1], path[i]);
        }
        return distance;
    }

    /**
     * Convert world coordinates to grid coordinates
     * @param {Array} worldPoint - World coordinates
     * @returns {Object} Grid coordinates
     */
    worldToGrid(worldPoint) {
        const bbox = this.navigationGrid.bbox;
        const x = Math.floor((worldPoint[0] - bbox.minX) / this.config.gridResolution);
        const y = Math.floor((worldPoint[1] - bbox.minY) / this.config.gridResolution);
        return { x, y };
    }

    /**
     * Convert grid coordinates to world coordinates
     * @param {Object} gridPoint - Grid coordinates
     * @returns {Array} World coordinates
     */
    gridToWorld(gridPoint) {
        const bbox = this.navigationGrid.bbox;
        const x = bbox.minX + (gridPoint.x + 0.5) * this.config.gridResolution;
        const y = bbox.minY + (gridPoint.y + 0.5) * this.config.gridResolution;
        return [x, y];
    }

    /**
     * Check if grid cell is valid and walkable
     * @param {number} x - Grid x coordinate
     * @param {number} y - Grid y coordinate
     * @returns {boolean} True if valid and walkable
     */
    isValidGridCell(x, y) {
        if (x < 0 || x >= this.navigationGrid.width || 
            y < 0 || y >= this.navigationGrid.height) {
            return false;
        }
        
        return this.getGridCell(x, y) === 1;
    }

    /**
     * Get grid cell value
     * @param {number} x - Grid x coordinate
     * @param {number} y - Grid y coordinate
     * @returns {number} Cell value
     */
    getGridCell(x, y) {
        const index = y * this.navigationGrid.width + x;
        return this.navigationGrid.cells[index];
    }

    /**
     * Set grid cell value
     * @param {number} x - Grid x coordinate
     * @param {number} y - Grid y coordinate
     * @param {number} value - Cell value
     */
    setGridCell(x, y, value) {
        const index = y * this.navigationGrid.width + x;
        this.navigationGrid.cells[index] = value;
    }

    /**
     * Get neighbors of grid cell
     * @param {Object} cell - Grid cell coordinates
     * @returns {Array} Valid neighbor cells
     */
    getNeighbors(cell) {
        const neighbors = [];
        const directions = this.config.diagonalMovement 
            ? [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]]
            : [[-1,0], [0,-1], [0,1], [1,0]];
        
        for (const [dx, dy] of directions) {
            const x = cell.x + dx;
            const y = cell.y + dy;
            
            if (this.isValidGridCell(x, y)) {
                neighbors.push({ x, y });
            }
        }
        
        return neighbors;
    }

    /**
     * Calculate movement cost between cells
     * @param {Object} from - Source cell
     * @param {Object} to - Target cell
     * @returns {number} Movement cost
     */
    getMoveCost(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        
        if (dx === 1 && dy === 1) {
            return this.config.diagonalCost;
        }
        
        return 1.0;
    }

    /**
     * Heuristic function for A* (Manhattan distance)
     * @param {Object} from - Source cell
     * @param {Object} to - Target cell
     * @returns {number} Heuristic cost
     */
    heuristic(from, to) {
        const dx = Math.abs(to.x - from.x);
        const dy = Math.abs(to.y - from.y);
        
        if (this.config.diagonalMovement) {
            // Octile distance
            const D = 1;
            const D2 = this.config.diagonalCost;
            return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy);
        } else {
            // Manhattan distance
            return dx + dy;
        }
    }

    /**
     * Reconstruct path from A* result
     * @param {Map} cameFrom - Parent tracking map
     * @param {Object} current - Current cell
     * @returns {Array} Reconstructed path
     */
    reconstructPath(cameFrom, current) {
        const path = [current];
        
        while (cameFrom.has(`${current.x},${current.y}`)) {
            current = cameFrom.get(`${current.x},${current.y}`);
            path.unshift(current);
        }
        
        return path;
    }

    /**
     * Remove redundant path segments
     */
    removeRedundantSegments() {
        // Implementation placeholder
        // Could remove paths that are entirely covered by other paths
    }

    /**
     * Optimize intersections
     */
    optimizeIntersections() {
        // Implementation placeholder
        // Could smooth corridor intersections and create proper junction geometry
    }

    /**
     * Add redundant paths for connectivity
     * @param {Array} keyPoints - Key points
     */
    async addRedundantPaths(keyPoints) {
        // Implementation placeholder
        // Could add secondary paths for redundancy
    }

    /**
     * Merge overlapping corridors
     */
    mergeOverlappingCorridors() {
        // Implementation placeholder
        // Could merge corridors that overlap significantly
    }

    /**
     * VALIDATION
     */

    /**
     * Validate corridor network
     * @returns {Object} Validation result
     */
    async validateCorridorNetwork() {
        const errors = [];
        const warnings = [];
        
        try {
            // Check corridor width compliance
            for (const corridor of this.corridors) {
                if (corridor.width < this.config.minWidth) {
                    errors.push(`Corridor ${corridor.id} width too narrow: ${corridor.width}m`);
                }
            }
            
            // Check connectivity
            const connectivity = this.checkConnectivity();
            if (!connectivity.allConnected) {
                warnings.push('Not all entrances are connected');
            }
            
            // Check total coverage
            const coverage = this.calculateCoverage();
            if (coverage > 0.3) { // More than 30% might be excessive
                warnings.push(`High corridor coverage: ${(coverage * 100).toFixed(1)}%`);
            }
            
            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                metrics: {
                    corridorCount: this.corridors.length,
                    totalLength: this.calculateTotalLength(),
                    coverage,
                    connectivity: connectivity.score
                }
            };
            
        } catch (error) {
            return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                warnings: [],
                metrics: {}
            };
        }
    }

    /**
     * Check network connectivity
     * @returns {Object} Connectivity analysis
     */
    checkConnectivity() {
        // Simplified connectivity check
        return {
            allConnected: this.pathNetwork.size > 0,
            score: Math.min(1, this.pathNetwork.size / 10)
        };
    }

    /**
     * Calculate total corridor length
     * @returns {number} Total length
     */
    calculateTotalLength() {
        return this.corridors.reduce((total, corridor) => total + corridor.length, 0);
    }

    /**
     * Calculate corridor coverage ratio
     * @returns {number} Coverage ratio (0-1)
     */
    calculateCoverage() {
        if (!this.allowedSpace) return 0;
        
        const allowedArea = this.geometryEngine.calculatePolygonArea(this.allowedSpace);
        const corridorArea = this.corridors.reduce((total, corridor) => total + corridor.area, 0);
        
        return corridorArea / allowedArea;
    }

    /**
     * LOGGING
     */

    log(message, data = {}) {
        if (this.config.debugMode) {
            console.log(`[CorridorGenerator] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[CorridorGenerator ERROR] ${message}:`, error);
    }

    /**
     * Get generator statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            config: this.config,
            gridSize: this.navigationGrid ? 
                this.navigationGrid.width * this.navigationGrid.height : 0,
            pathCount: this.pathNetwork.size,
            corridorCount: this.corridors.length,
            totalLength: this.calculateTotalLength(),
            coverage: this.calculateCoverage()
        };
    }
}

/**
 * Priority Queue implementation for A* algorithm
 */
class PriorityQueue {
    constructor() {
        this.items = [];
    }
    
    enqueue(element, priority) {
        const item = { element, priority };
        let added = false;
        
        for (let i = 0; i < this.items.length; i++) {
            if (item.priority < this.items[i].priority) {
                this.items.splice(i, 0, item);
                added = true;
                break;
            }
        }
        
        if (!added) {
            this.items.push(item);
        }
    }
    
    dequeue() {
        return this.items.shift().element;
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
    
    contains(element) {
        return this.items.some(item => 
            item.element.x === element.x && item.element.y === element.y
        );
    }
}

module.exports = CorridorGenerator;