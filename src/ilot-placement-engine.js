/**
 * Advanced Îlot Placement Engine for Architectural Floor Plans
 * 
 * Implements production-level îlot (island) placement with:
 * - Geometric collision detection with walls and forbidden zones
 * - Poisson-disk sampling for optimal spatial distribution
 * - Multi-constraint validation and optimization
 * - Real-time placement verification and adjustment
 * 
 * Dependencies:
 * - GeometryEngine for spatial operations
 * - Floor plan data with walls, red zones (entrances), blue zones (forbidden)
 * 
 * @author FloorPlan Pro Team
 * @version 1.0.0
 */

const GeometryEngine = require('./geometry-engine');

class IlotPlacementEngine {
    constructor(options = {}) {
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });
        
        // Placement configuration
        this.config = {
            // Minimum distances (in meters)
            minWallDistance: options.minWallDistance || 1.5,
            minIlotDistance: options.minIlotDistance || 2.0,
            minCorridorWidth: options.minCorridorWidth || 1.8,
            
            // Îlot dimensions
            defaultIlotSize: options.defaultIlotSize || { width: 3.0, height: 2.0 },
            ilotTypes: options.ilotTypes || {
                'work': { width: 3.0, height: 2.0, capacity: 4 },
                'meeting': { width: 4.0, height: 3.0, capacity: 8 },
                'social': { width: 5.0, height: 3.5, capacity: 12 },
                'break': { width: 3.5, height: 2.5, capacity: 6 },
                'focus': { width: 2.5, height: 1.8, capacity: 2 },
                'collaboration': { width: 4.5, height: 3.5, capacity: 10 }
            },
            
            // Poisson-disk sampling parameters
            poissonRadius: options.poissonRadius || 3.0,
            poissonTries: options.poissonTries || 30,
            maxIterations: options.maxIterations || 1000,
            
            // Optimization parameters
            densityWeight: options.densityWeight || 0.4,
            accessibilityWeight: options.accessibilityWeight || 0.3,
            efficiencyWeight: options.efficiencyWeight || 0.3,
            
            ...options
        };
        
        // State variables
        this.floorPlan = null;
        this.forbiddenZones = [];
        this.allowedSpace = null;
        this.placedIlots = [];
        this.placementCandidates = [];
        
        this.log('IlotPlacementEngine initialized', this.config);
    }

    /**
     * MAIN PLACEMENT WORKFLOW
     */

    /**
     * Generate optimized îlot placement for floor plan
     * @param {Object} floorPlan - Floor plan data with walls, zones, entrances
     * @param {Object} requirements - Placement requirements and constraints
     * @returns {Promise<Array>} Array of placed îlots with positions and properties
     */
    async generateOptimizedPlacement(floorPlan, requirements = {}) {
        try {
            this.log('Starting îlot placement generation');
            
            // Initialize floor plan data
            this.floorPlan = floorPlan;
            this.placedIlots = [];
            
            // Step 1: Calculate forbidden zones
            await this.calculateForbiddenZones();
            
            // Step 2: Generate allowed space
            await this.generateAllowedSpace();
            
            // Step 3: Generate placement candidates using Poisson-disk sampling
            await this.generatePlacementCandidates();
            
            // Step 4: Optimize îlot placement
            await this.optimizePlacement(requirements);
            
            // Step 5: Validate final placement
            const validationResult = await this.validatePlacement();
            
            if (!validationResult.isValid) {
                this.logError('Placement validation failed', validationResult.errors);
                throw new Error(`Placement validation failed: ${validationResult.errors.join(', ')}`);
            }
            
            this.log('Îlot placement completed', { 
                totalIlots: this.placedIlots.length,
                coverage: this.calculateCoverage(),
                efficiency: this.calculateEfficiency()
            });
            
            return this.placedIlots;
            
        } catch (error) {
            this.logError('Îlot placement generation failed', error);
            throw error;
        }
    }

    /**
     * FORBIDDEN ZONE CALCULATION
     */

    /**
     * Calculate all forbidden zones (buffered walls + red + blue zones)
     */
    async calculateForbiddenZones() {
        try {
            this.forbiddenZones = [];
            
            // 1. Buffer walls by minimum distance
            if (this.floorPlan.walls && this.floorPlan.walls.length > 0) {
                const bufferedWalls = this.floorPlan.walls.map(wall => {
                    const wallPolygon = this.wallToPolygon(wall);
                    const buffered = this.geometryEngine.bufferPolygon(
                        wallPolygon, 
                        this.config.minWallDistance
                    );
                    return buffered;
                }).flat();
                
                this.forbiddenZones.push(...bufferedWalls);
                this.log('Buffered walls added to forbidden zones', { count: bufferedWalls.length });
            }
            
            // 2. Add red zones (entrances/exits) - no buffering needed as they're already forbidden
            if (this.floorPlan.redZones && this.floorPlan.redZones.length > 0) {
                this.forbiddenZones.push(...this.floorPlan.redZones);
                this.log('Red zones added to forbidden zones', { count: this.floorPlan.redZones.length });
            }
            
            // 3. Add blue zones (forbidden areas)
            if (this.floorPlan.blueZones && this.floorPlan.blueZones.length > 0) {
                this.forbiddenZones.push(...this.floorPlan.blueZones);
                this.log('Blue zones added to forbidden zones', { count: this.floorPlan.blueZones.length });
            }
            
            // 4. Union all forbidden zones for efficiency
            if (this.forbiddenZones.length > 1) {
                this.forbiddenZones = this.geometryEngine.unionPolygons(this.forbiddenZones);
                this.log('Forbidden zones unified', { finalCount: this.forbiddenZones.length });
            }
            
        } catch (error) {
            this.logError('Forbidden zone calculation failed', error);
            throw error;
        }
    }

    /**
     * Generate allowed space for îlot placement
     */
    async generateAllowedSpace() {
        try {
            // Start with the building boundary
            let allowedSpace = this.floorPlan.boundary || this.floorPlan.outline;
            
            if (!allowedSpace) {
                throw new Error('No building boundary or outline provided');
            }
            
            // Subtract all forbidden zones from allowed space
            for (const forbiddenZone of this.forbiddenZones) {
                const difference = this.geometryEngine.differencePolygons(allowedSpace, forbiddenZone);
                if (difference.length > 0) {
                    allowedSpace = difference[0]; // Take largest remaining area
                }
            }
            
            this.allowedSpace = allowedSpace;
            
            const allowedArea = this.geometryEngine.calculatePolygonArea(this.allowedSpace);
            this.log('Allowed space calculated', { area: allowedArea });
            
        } catch (error) {
            this.logError('Allowed space generation failed', error);
            throw error;
        }
    }

    /**
     * POISSON-DISK SAMPLING
     */

    /**
     * Generate placement candidates using Poisson-disk sampling
     */
    async generatePlacementCandidates() {
        try {
            this.placementCandidates = [];
            
            if (!this.allowedSpace) {
                throw new Error('No allowed space available for candidate generation');
            }
            
            // Calculate bounding box of allowed space
            const bbox = this.geometryEngine.calculateBoundingBox(this.allowedSpace);
            
            // Initialize active list with first random point
            const activeList = [];
            const processedPoints = [];
            const grid = new Map();
            
            const cellSize = this.config.poissonRadius / Math.sqrt(2);
            const gridWidth = Math.ceil((bbox.maxX - bbox.minX) / cellSize);
            const gridHeight = Math.ceil((bbox.maxY - bbox.minY) / cellSize);
            
            // Add initial random point
            const initialPoint = this.generateRandomPointInPolygon(this.allowedSpace);
            if (initialPoint) {
                activeList.push(initialPoint);
                this.addToGrid(initialPoint, grid, bbox, cellSize);
                processedPoints.push(initialPoint);
            }
            
            let iterations = 0;
            
            // Poisson-disk sampling main loop
            while (activeList.length > 0 && iterations < this.config.maxIterations) {
                iterations++;
                
                // Pick random point from active list
                const randomIndex = Math.floor(Math.random() * activeList.length);
                const currentPoint = activeList[randomIndex];
                
                let foundValidPoint = false;
                
                // Try to place new points around current point
                for (let i = 0; i < this.config.poissonTries; i++) {
                    const newPoint = this.generatePointAroundRadius(
                        currentPoint, 
                        this.config.poissonRadius,
                        this.config.poissonRadius * 2
                    );
                    
                    if (this.isValidCandidate(newPoint, processedPoints, grid, bbox, cellSize)) {
                        activeList.push(newPoint);
                        this.addToGrid(newPoint, grid, bbox, cellSize);
                        processedPoints.push(newPoint);
                        foundValidPoint = true;
                        break;
                    }
                }
                
                // Remove current point from active list if no valid points found
                if (!foundValidPoint) {
                    activeList.splice(randomIndex, 1);
                }
            }
            
            this.placementCandidates = processedPoints;
            
            this.log('Placement candidates generated', { 
                candidateCount: this.placementCandidates.length,
                iterations 
            });
            
        } catch (error) {
            this.logError('Candidate generation failed', error);
            throw error;
        }
    }

    /**
     * PLACEMENT OPTIMIZATION
     */

    /**
     * Optimize îlot placement based on requirements
     * @param {Object} requirements - Placement requirements
     */
    async optimizePlacement(requirements) {
        try {
            const targetIlots = requirements.targetIlots || this.estimateOptimalIlotCount();
            const ilotTypeDistribution = requirements.ilotTypeDistribution || this.getDefaultTypeDistribution();
            
            // Score all candidates
            const scoredCandidates = this.placementCandidates.map(candidate => ({
                position: candidate,
                score: this.calculateCandidateScore(candidate),
                type: this.selectIlotType(candidate, ilotTypeDistribution)
            }));
            
            // Sort by score (higher is better)
            scoredCandidates.sort((a, b) => b.score - a.score);
            
            // Place îlots greedily, avoiding collisions
            let placedCount = 0;
            
            for (const candidate of scoredCandidates) {
                if (placedCount >= targetIlots) break;
                
                const ilotGeometry = this.createIlotGeometry(candidate.position, candidate.type);
                
                if (this.canPlaceIlot(ilotGeometry)) {
                    const ilot = {
                        id: `ilot_${placedCount + 1}`,
                        position: candidate.position,
                        type: candidate.type,
                        geometry: ilotGeometry,
                        properties: this.config.ilotTypes[candidate.type],
                        score: candidate.score,
                        metadata: {
                            placementOrder: placedCount + 1,
                            timestamp: new Date().toISOString()
                        }
                    };
                    
                    this.placedIlots.push(ilot);
                    placedCount++;
                }
            }
            
            this.log('Placement optimization completed', { 
                targetIlots, 
                placedIlots: placedCount,
                efficiency: placedCount / targetIlots 
            });
            
        } catch (error) {
            this.logError('Placement optimization failed', error);
            throw error;
        }
    }

    /**
     * VALIDATION AND SCORING
     */

    /**
     * Validate final placement
     * @returns {Object} Validation result
     */
    async validatePlacement() {
        const errors = [];
        
        try {
            // Check each îlot for violations
            for (const ilot of this.placedIlots) {
                // Check wall distance
                if (!this.checkMinWallDistance(ilot)) {
                    errors.push(`Îlot ${ilot.id} too close to walls`);
                }
                
                // Check forbidden zone overlap
                if (this.checkForbiddenZoneOverlap(ilot)) {
                    errors.push(`Îlot ${ilot.id} overlaps forbidden zone`);
                }
                
                // Check îlot-to-îlot collisions
                const collisions = this.checkIlotCollisions(ilot);
                if (collisions.length > 0) {
                    errors.push(`Îlot ${ilot.id} collides with îlots: ${collisions.join(', ')}`);
                }
            }
            
            // Check global constraints
            const coverage = this.calculateCoverage();
            if (coverage > 0.7) { // Max 70% coverage
                errors.push(`Space coverage too high: ${(coverage * 100).toFixed(1)}%`);
            }
            
            return {
                isValid: errors.length === 0,
                errors,
                metrics: {
                    coverage,
                    efficiency: this.calculateEfficiency(),
                    ilotCount: this.placedIlots.length
                }
            };
            
        } catch (error) {
            this.logError('Validation failed', error);
            return {
                isValid: false,
                errors: [`Validation error: ${error.message}`],
                metrics: {}
            };
        }
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Convert wall line to polygon for buffering
     * @param {Object} wall - Wall object with start and end points
     * @returns {Array} Wall polygon
     */
    wallToPolygon(wall) {
        const thickness = wall.thickness || 0.2; // Default wall thickness
        const halfThickness = thickness / 2;
        
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length === 0) return [];
        
        const unitX = dx / length;
        const unitY = dy / length;
        
        // Perpendicular vector
        const perpX = -unitY * halfThickness;
        const perpY = unitX * halfThickness;
        
        return [
            [wall.start.x + perpX, wall.start.y + perpY],
            [wall.end.x + perpX, wall.end.y + perpY],
            [wall.end.x - perpX, wall.end.y - perpY],
            [wall.start.x - perpX, wall.start.y - perpY]
        ];
    }

    /**
     * Generate random point inside polygon
     * @param {Array} polygon - Target polygon
     * @returns {Array} Random point [x, y]
     */
    generateRandomPointInPolygon(polygon) {
        const bbox = this.geometryEngine.calculateBoundingBox(polygon);
        let attempts = 0;
        
        while (attempts < 100) {
            const x = bbox.minX + Math.random() * (bbox.maxX - bbox.minX);
            const y = bbox.minY + Math.random() * (bbox.maxY - bbox.minY);
            const point = [x, y];
            
            if (this.geometryEngine.pointInPolygon(point, polygon)) {
                return point;
            }
            attempts++;
        }
        
        return null;
    }

    /**
     * Generate point around radius
     * @param {Array} center - Center point
     * @param {number} minRadius - Minimum radius
     * @param {number} maxRadius - Maximum radius
     * @returns {Array} New point
     */
    generatePointAroundRadius(center, minRadius, maxRadius) {
        const angle = Math.random() * 2 * Math.PI;
        const radius = minRadius + Math.random() * (maxRadius - minRadius);
        
        return [
            center[0] + Math.cos(angle) * radius,
            center[1] + Math.sin(angle) * radius
        ];
    }

    /**
     * Check if candidate point is valid for Poisson-disk sampling
     * @param {Array} point - Candidate point
     * @param {Array} existingPoints - Already processed points
     * @param {Map} grid - Spatial grid
     * @param {Object} bbox - Bounding box
     * @param {number} cellSize - Grid cell size
     * @returns {boolean} True if valid
     */
    isValidCandidate(point, existingPoints, grid, bbox, cellSize) {
        // Check if point is in allowed space
        if (!this.geometryEngine.pointInPolygon(point, this.allowedSpace)) {
            return false;
        }
        
        // Check minimum distance to other points using grid
        const gridX = Math.floor((point[0] - bbox.minX) / cellSize);
        const gridY = Math.floor((point[1] - bbox.minY) / cellSize);
        
        // Check surrounding grid cells
        for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
                const checkX = gridX + dx;
                const checkY = gridY + dy;
                const gridKey = `${checkX},${checkY}`;
                
                const gridPoint = grid.get(gridKey);
                if (gridPoint) {
                    const distance = this.geometryEngine.calculateDistance(point, gridPoint);
                    if (distance < this.config.poissonRadius) {
                        return false;
                    }
                }
            }
        }
        
        return true;
    }

    /**
     * Add point to spatial grid
     * @param {Array} point - Point to add
     * @param {Map} grid - Spatial grid
     * @param {Object} bbox - Bounding box
     * @param {number} cellSize - Grid cell size
     */
    addToGrid(point, grid, bbox, cellSize) {
        const gridX = Math.floor((point[0] - bbox.minX) / cellSize);
        const gridY = Math.floor((point[1] - bbox.minY) / cellSize);
        const gridKey = `${gridX},${gridY}`;
        grid.set(gridKey, point);
    }

    /**
     * Calculate candidate score for optimization
     * @param {Array} candidate - Candidate position
     * @returns {number} Score (higher is better)
     */
    calculateCandidateScore(candidate) {
        let score = 0;
        
        // Accessibility score (distance to entrances)
        const entranceScore = this.calculateEntranceAccessibility(candidate);
        score += entranceScore * this.config.accessibilityWeight;
        
        // Central position score
        const centralityScore = this.calculateCentralityScore(candidate);
        score += centralityScore * this.config.densityWeight;
        
        // Efficiency score (space utilization)
        const efficiencyScore = this.calculateEfficiencyScore(candidate);
        score += efficiencyScore * this.config.efficiencyWeight;
        
        return score;
    }

    /**
     * Calculate entrance accessibility score
     * @param {Array} position - Position to evaluate
     * @returns {number} Accessibility score (0-1)
     */
    calculateEntranceAccessibility(position) {
        if (!this.floorPlan.entrances || this.floorPlan.entrances.length === 0) {
            return 0.5; // Neutral score if no entrance data
        }
        
        let minDistance = Infinity;
        
        for (const entrance of this.floorPlan.entrances) {
            const entrancePos = entrance.position || entrance;
            const distance = this.geometryEngine.calculateDistance(position, entrancePos);
            minDistance = Math.min(minDistance, distance);
        }
        
        // Score inversely related to distance (closer is better)
        const maxReasonableDistance = 20; // 20 meters
        return Math.max(0, 1 - (minDistance / maxReasonableDistance));
    }

    /**
     * Calculate centrality score
     * @param {Array} position - Position to evaluate
     * @returns {number} Centrality score (0-1)
     */
    calculateCentralityScore(position) {
        const bbox = this.geometryEngine.calculateBoundingBox(this.allowedSpace);
        const center = [
            (bbox.minX + bbox.maxX) / 2,
            (bbox.minY + bbox.maxY) / 2
        ];
        
        const distance = this.geometryEngine.calculateDistance(position, center);
        const maxDistance = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) / 2;
        
        return Math.max(0, 1 - (distance / maxDistance));
    }

    /**
     * Calculate efficiency score
     * @param {Array} position - Position to evaluate
     * @returns {number} Efficiency score (0-1)
     */
    calculateEfficiencyScore(position) {
        // Simple implementation based on space utilization potential
        // Could be enhanced with more sophisticated metrics
        return 0.7; // Placeholder
    }

    /**
     * Create îlot geometry
     * @param {Array} position - Center position
     * @param {string} type - Îlot type
     * @returns {Object} Îlot geometry
     */
    createIlotGeometry(position, type) {
        const ilotConfig = this.config.ilotTypes[type] || this.config.defaultIlotSize;
        const halfWidth = ilotConfig.width / 2;
        const halfHeight = ilotConfig.height / 2;
        
        const polygon = [
            [position[0] - halfWidth, position[1] - halfHeight],
            [position[0] + halfWidth, position[1] - halfHeight],
            [position[0] + halfWidth, position[1] + halfHeight],
            [position[0] - halfWidth, position[1] + halfHeight]
        ];
        
        return {
            polygon,
            bbox: this.geometryEngine.calculateBoundingBox(polygon),
            area: ilotConfig.width * ilotConfig.height,
            type
        };
    }

    /**
     * Check if îlot can be placed
     * @param {Object} ilotGeometry - Îlot geometry to check
     * @returns {boolean} True if can be placed
     */
    canPlaceIlot(ilotGeometry) {
        // Check forbidden zone overlap
        for (const forbiddenZone of this.forbiddenZones) {
            if (this.geometryEngine.polygonsCollide(ilotGeometry.polygon, forbiddenZone)) {
                return false;
            }
        }
        
        // Check collision with existing îlots
        for (const existingIlot of this.placedIlots) {
            if (this.geometryEngine.polygonsCollide(ilotGeometry.polygon, existingIlot.geometry.polygon)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Select îlot type based on distribution
     * @param {Array} position - Position
     * @param {Object} distribution - Type distribution
     * @returns {string} Selected type
     */
    selectIlotType(position, distribution) {
        const types = Object.keys(distribution);
        const random = Math.random();
        let cumulative = 0;
        
        for (const type of types) {
            cumulative += distribution[type];
            if (random <= cumulative) {
                return type;
            }
        }
        
        return types[0]; // Fallback
    }

    /**
     * Get default type distribution
     * @returns {Object} Default distribution
     */
    getDefaultTypeDistribution() {
        return {
            'work': 0.4,
            'meeting': 0.2,
            'collaboration': 0.15,
            'focus': 0.1,
            'social': 0.1,
            'break': 0.05
        };
    }

    /**
     * Estimate optimal îlot count
     * @returns {number} Estimated count
     */
    estimateOptimalIlotCount() {
        if (!this.allowedSpace) return 0;
        
        const allowedArea = this.geometryEngine.calculatePolygonArea(this.allowedSpace);
        const averageIlotArea = 6; // 6 sqm average
        const targetDensity = 0.3; // 30% coverage
        
        return Math.floor((allowedArea * targetDensity) / averageIlotArea);
    }

    /**
     * Calculate space coverage
     * @returns {number} Coverage ratio (0-1)
     */
    calculateCoverage() {
        if (!this.allowedSpace) return 0;
        
        const allowedArea = this.geometryEngine.calculatePolygonArea(this.allowedSpace);
        const usedArea = this.placedIlots.reduce((total, ilot) => total + ilot.geometry.area, 0);
        
        return usedArea / allowedArea;
    }

    /**
     * Calculate placement efficiency
     * @returns {number} Efficiency score (0-1)
     */
    calculateEfficiency() {
        if (this.placedIlots.length === 0) return 0;
        
        const avgScore = this.placedIlots.reduce((sum, ilot) => sum + ilot.score, 0) / this.placedIlots.length;
        return Math.min(1, avgScore);
    }

    /**
     * VALIDATION HELPERS
     */

    /**
     * Check minimum wall distance
     * @param {Object} ilot - Îlot to check
     * @returns {boolean} True if distance is adequate
     */
    checkMinWallDistance(ilot) {
        if (!this.floorPlan.walls) return true;
        
        for (const wall of this.floorPlan.walls) {
            // Simplified distance check - could be enhanced
            const wallPolygon = this.wallToPolygon(wall);
            const distance = this.calculatePolygonDistance(ilot.geometry.polygon, wallPolygon);
            if (distance < this.config.minWallDistance) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check forbidden zone overlap
     * @param {Object} ilot - Îlot to check
     * @returns {boolean} True if overlaps forbidden zone
     */
    checkForbiddenZoneOverlap(ilot) {
        for (const forbiddenZone of this.forbiddenZones) {
            if (this.geometryEngine.polygonsCollide(ilot.geometry.polygon, forbiddenZone)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Check îlot-to-îlot collisions
     * @param {Object} ilot - Îlot to check
     * @returns {Array} Array of colliding îlot IDs
     */
    checkIlotCollisions(ilot) {
        const collisions = [];
        
        for (const otherIlot of this.placedIlots) {
            if (otherIlot.id === ilot.id) continue;
            
            if (this.geometryEngine.polygonsCollide(ilot.geometry.polygon, otherIlot.geometry.polygon)) {
                collisions.push(otherIlot.id);
            }
        }
        
        return collisions;
    }

    /**
     * Calculate distance between polygons (simplified)
     * @param {Array} polygon1 - First polygon
     * @param {Array} polygon2 - Second polygon
     * @returns {number} Distance between polygons
     */
    calculatePolygonDistance(polygon1, polygon2) {
        // Simplified implementation using closest points
        let minDistance = Infinity;
        
        for (const point1 of polygon1) {
            for (const point2 of polygon2) {
                const distance = this.geometryEngine.calculateDistance(point1, point2);
                minDistance = Math.min(minDistance, distance);
            }
        }
        
        return minDistance;
    }

    /**
     * LOGGING
     */

    log(message, data = {}) {
        if (this.config.debugMode) {
            console.log(`[IlotPlacementEngine] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[IlotPlacementEngine ERROR] ${message}:`, error);
    }

    /**
     * Get placement statistics
     * @returns {Object} Placement statistics
     */
    getStatistics() {
        return {
            config: this.config,
            forbiddenZonesCount: this.forbiddenZones.length,
            candidatesGenerated: this.placementCandidates.length,
            ilotsPlaced: this.placedIlots.length,
            coverage: this.calculateCoverage(),
            efficiency: this.calculateEfficiency(),
            allowedArea: this.allowedSpace ? this.geometryEngine.calculatePolygonArea(this.allowedSpace) : 0
        };
    }
}

module.exports = IlotPlacementEngine;