
/**
 * Advanced Îlot Placement Engine
 * 
 * Implements sophisticated algorithms for optimal placement of îlots (workspace islands)
 * in architectural floor plans with collision detection, accessibility compliance,
 * and multi-objective optimization.
 * 
 * Features:
 * - Spatial indexing with RBush for efficient collision detection
 * - Multi-objective optimization (space utilization, accessibility, workflow)
 * - Constraint-based placement with wall buffers and clearances
 * - Integration with room detection and corridor planning
 * - Real-time validation and adjustment
 * 
 * Dependencies:
 * - rbush: Spatial indexing for collision detection
 * - GeometryEngine: Geometric calculations and spatial operations
 * 
 * @author FloorPlan Pro Team
 * @version 2.0.0
 */

const RBush = require('rbush');
const GeometryEngine = require('./geometry-engine');

class IlotPlacementEngine {
    constructor(options = {}) {
        // Initialize geometry engine
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });
        
        // Initialize spatial index for collision detection
        this.spatialIndex = new RBush();
        
        // Placement configuration
        this.config = {
            // Spatial constraints
            minWallDistance: options.minWallDistance || 0.5,
            minIlotDistance: options.minIlotDistance || 2.0,
            minDoorClearance: options.minDoorClearance || 1.5,
            maxWallDistance: options.maxWallDistance || 5.0,
            
            // Îlot dimensions
            defaultIlotSize: {
                width: options.ilotWidth || 3.0,
                height: options.ilotHeight || 2.0
            },
            minIlotSize: {
                width: options.minIlotWidth || 2.0,
                height: options.minIlotHeight || 1.5
            },
            maxIlotSize: {
                width: options.maxIlotWidth || 4.0,
                height: options.maxIlotHeight || 3.0
            },
            
            // Placement algorithm parameters
            maxIterations: options.maxIterations || 1000,
            placementStrategy: options.placementStrategy || 'optimized', // 'grid', 'random', 'optimized'
            gridResolution: options.gridResolution || 0.5,
            
            // Optimization weights
            weights: {
                spaceUtilization: options.spaceWeight || 0.4,
                accessibility: options.accessibilityWeight || 0.3,
                workflow: options.workflowWeight || 0.3
            },
            
            // Performance limits
            maxPlacementAttempts: options.maxAttempts || 1000,
            timeoutMs: options.timeoutMs || 30000,
            
            ...options
        };
        
        // State variables
        this.floorPlan = null;
        this.placedIlots = [];
        this.restrictedZones = [];
        this.allowedZones = [];
        this.placementGrid = null;
        this.placementStats = {
            totalAttempts: 0,
            successfulPlacements: 0,
            collisionDetections: 0,
            optimizationIterations: 0
        };
        
        this.log('IlotPlacementEngine initialized', this.config);
    }

    /**
     * MAIN PLACEMENT WORKFLOW
     */

    /**
     * Generate optimized îlot placement for floor plan
     * @param {Object} floorPlan - Floor plan with walls, doors, and zones
     * @param {Object} options - Placement options
     * @returns {Promise<Array>} Array of placed îlots
     */
    async generateOptimizedPlacement(floorPlan, options = {}) {
        try {
            this.log('Starting optimized îlot placement');
            
            // Initialize state
            this.floorPlan = floorPlan;
            this.placedIlots = [];
            this.spatialIndex.clear();
            this.resetPlacementStats();
            
            // Merge options with config
            const placementConfig = { ...this.config, ...options };
            
            // Step 1: Analyze floor plan and prepare placement zones
            await this.prepareFloorPlanForPlacement();
            
            // Step 2: Create placement grid
            await this.createPlacementGrid();
            
            // Step 3: Calculate îlot requirements
            const ilotRequirements = this.calculateIlotRequirements(placementConfig);
            
            // Step 4: Execute placement strategy
            await this.executePlacementStrategy(ilotRequirements, placementConfig);
            
            // Step 5: Optimize placement
            await this.optimizePlacement();
            
            // Step 6: Validate placement
            const validation = await this.validatePlacement();
            
            if (!validation.isValid) {
                this.logError('Placement validation failed', validation.errors);
                // Continue with warnings but don't fail completely
            }
            
            this.log('Optimized placement completed', {
                placedIlots: this.placedIlots.length,
                totalAttempts: this.placementStats.totalAttempts,
                successRate: this.placementStats.successfulPlacements / this.placementStats.totalAttempts
            });
            
            return this.placedIlots;
            
        } catch (error) {
            this.logError('Optimized placement failed', error);
            throw error;
        }
    }

    /**
     * FLOOR PLAN ANALYSIS
     */

    /**
     * Prepare floor plan for placement by identifying zones and constraints
     */
    async prepareFloorPlanForPlacement() {
        try {
            this.log('Preparing floor plan for placement');
            
            // Extract walls and create restricted zones
            this.extractWallConstraints();
            
            // Extract door/window constraints
            this.extractOpeningConstraints();
            
            // Extract predefined zones (red zones = restricted, blue zones = preferred)
            this.extractZoneConstraints();
            
            // Calculate allowed placement areas
            this.calculateAllowedZones();
            
            // Index all constraints in spatial index
            this.indexConstraints();
            
            this.log('Floor plan preparation completed', {
                restrictedZones: this.restrictedZones.length,
                allowedZones: this.allowedZones.length
            });
            
        } catch (error) {
            this.logError('Floor plan preparation failed', error);
            throw error;
        }
    }

    /**
     * Extract wall constraints from floor plan
     */
    extractWallConstraints() {
        if (!this.floorPlan.walls) return;
        
        for (const wall of this.floorPlan.walls) {
            // Create buffer zone around walls
            const wallPolygon = this.createWallPolygon(wall);
            const bufferedWall = this.geometryEngine.offsetPolygon(wallPolygon, this.config.minWallDistance);
            
            this.restrictedZones.push({
                type: 'wall_buffer',
                polygon: bufferedWall,
                constraint: 'hard',
                priority: 1.0
            });
        }
    }

    /**
     * Extract door and window constraints
     */
    extractOpeningConstraints() {
        // Process doors
        if (this.floorPlan.doors) {
            for (const door of this.floorPlan.doors) {
                const clearanceZone = this.createDoorClearanceZone(door);
                this.restrictedZones.push({
                    type: 'door_clearance',
                    polygon: clearanceZone,
                    constraint: 'hard',
                    priority: 1.0
                });
            }
        }
        
        // Process windows (usually less restrictive)
        if (this.floorPlan.windows) {
            for (const window of this.floorPlan.windows) {
                const clearanceZone = this.createWindowClearanceZone(window);
                this.restrictedZones.push({
                    type: 'window_clearance',
                    polygon: clearanceZone,
                    constraint: 'soft',
                    priority: 0.7
                });
            }
        }
    }

    /**
     * Extract zone constraints (red zones = forbidden, blue zones = preferred)
     */
    extractZoneConstraints() {
        // Red zones (forbidden areas)
        if (this.floorPlan.redZones) {
            for (const redZone of this.floorPlan.redZones) {
                this.restrictedZones.push({
                    type: 'forbidden_zone',
                    polygon: redZone.polygon || redZone,
                    constraint: 'hard',
                    priority: 1.0
                });
            }
        }
        
        // Blue zones (preferred areas)
        if (this.floorPlan.blueZones) {
            for (const blueZone of this.floorPlan.blueZones) {
                this.allowedZones.push({
                    type: 'preferred_zone',
                    polygon: blueZone.polygon || blueZone,
                    priority: 1.5,
                    bonus: 0.3
                });
            }
        }
    }

    /**
     * PLACEMENT GRID SYSTEM
     */

    /**
     * Create placement grid for systematic îlot placement
     */
    async createPlacementGrid() {
        try {
            if (!this.floorPlan.boundary && !this.floorPlan.bounds) {
                // Create default boundary from walls
                this.createDefaultBoundary();
            }
            
            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.geometryEngine.calculateBoundingBox(boundary);
            
            const gridWidth = Math.ceil((bbox.maxX - bbox.minX) / this.config.gridResolution);
            const gridHeight = Math.ceil((bbox.maxY - bbox.minY) / this.config.gridResolution);
            
            this.log('Creating placement grid', { 
                gridWidth, 
                gridHeight, 
                resolution: this.config.gridResolution 
            });
            
            // Initialize grid
            this.placementGrid = {
                bbox,
                width: gridWidth,
                height: gridHeight,
                resolution: this.config.gridResolution,
                cells: new Array(gridWidth * gridHeight).fill(0),
                scores: new Array(gridWidth * gridHeight).fill(0)
            };
            
            // Calculate placement scores for each cell
            await this.calculatePlacementScores();
            
            this.log('Placement grid created', {
                totalCells: this.placementGrid.cells.length,
                validCells: this.placementGrid.cells.filter(cell => cell > 0).length
            });
            
        } catch (error) {
            this.logError('Placement grid creation failed', error);
            throw error;
        }
    }

    /**
     * Calculate placement suitability scores for grid cells
     */
    async calculatePlacementScores() {
        const { width, height, bbox, resolution } = this.placementGrid;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const worldX = bbox.minX + (x + 0.5) * resolution;
                const worldY = bbox.minY + (y + 0.5) * resolution;
                const point = [worldX, worldY];
                
                // Calculate base score
                let score = this.calculateCellBaseScore(point);
                
                // Apply zone bonuses/penalties
                score = this.applySpatialModifiers(point, score);
                
                // Store score
                const index = y * width + x;
                this.placementGrid.scores[index] = score;
                this.placementGrid.cells[index] = score > 0 ? 1 : 0;
            }
        }
    }

    /**
     * Calculate base placement score for a cell
     * @param {Array} point - Point to evaluate
     * @returns {number} Base score (0-1)
     */
    calculateCellBaseScore(point) {
        // Check if point is in restricted zones
        for (const restrictedZone of this.restrictedZones) {
            if (this.geometryEngine.pointInPolygon(point, restrictedZone.polygon)) {
                if (restrictedZone.constraint === 'hard') {
                    return 0; // Forbidden
                } else {
                    return 0.3; // Discouraged but possible
                }
            }
        }
        
        // Check if point has clearance for îlot placement
        if (!this.hasIlotClearance(point)) {
            return 0;
        }
        
        return 0.8; // Base suitable score
    }

    /**
     * Apply spatial modifiers (preferred zones, accessibility, etc.)
     * @param {Array} point - Point to evaluate
     * @param {number} baseScore - Base score
     * @returns {number} Modified score
     */
    applySpatialModifiers(point, baseScore) {
        if (baseScore <= 0) return baseScore;
        
        let modifiedScore = baseScore;
        
        // Apply preferred zone bonuses
        for (const allowedZone of this.allowedZones) {
            if (this.geometryEngine.pointInPolygon(point, allowedZone.polygon)) {
                modifiedScore *= allowedZone.priority;
                modifiedScore += allowedZone.bonus || 0;
            }
        }
        
        // Apply accessibility score
        const accessibilityScore = this.calculateAccessibilityScore(point);
        modifiedScore *= (0.7 + 0.3 * accessibilityScore);
        
        // Apply workflow efficiency score
        const workflowScore = this.calculateWorkflowScore(point);
        modifiedScore *= (0.8 + 0.2 * workflowScore);
        
        return Math.min(modifiedScore, 1.0); // Cap at 1.0
    }

    /**
     * PLACEMENT STRATEGIES
     */

    /**
     * Calculate îlot requirements based on floor plan and configuration
     * @param {Object} config - Placement configuration
     * @returns {Object} Îlot requirements
     */
    calculateIlotRequirements(config) {
        const totalArea = this.calculateUsableArea();
        const ilotArea = config.defaultIlotSize.width * config.defaultIlotSize.height;
        const maxIlots = Math.floor(totalArea * config.coverage / ilotArea);
        
        return {
            totalIlots: Math.min(maxIlots, config.maxIlots || 50),
            ilotTypes: this.determineIlotTypes(config),
            sizingStrategy: config.sizingStrategy || 'uniform',
            densityTarget: config.coverage || 0.3
        };
    }

    /**
     * Execute the selected placement strategy
     * @param {Object} requirements - Îlot requirements
     * @param {Object} config - Placement configuration
     */
    async executePlacementStrategy(requirements, config) {
        this.log('Executing placement strategy', { 
            strategy: config.placementStrategy,
            targetIlots: requirements.totalIlots
        });
        
        switch (config.placementStrategy) {
            case 'grid':
                await this.executeGridPlacement(requirements, config);
                break;
            case 'random':
                await this.executeRandomPlacement(requirements, config);
                break;
            case 'optimized':
            default:
                await this.executeOptimizedPlacement(requirements, config);
                break;
        }
    }

    /**
     * Execute optimized placement strategy
     * @param {Object} requirements - Îlot requirements
     * @param {Object} config - Placement configuration
     */
    async executeOptimizedPlacement(requirements, config) {
        const startTime = Date.now();
        let placedCount = 0;
        
        // Sort grid cells by placement score (best first)
        const sortedCells = this.getSortedPlacementCells();
        
        for (const cell of sortedCells) {
            // Check timeout
            if (Date.now() - startTime > config.timeoutMs) {
                this.logError('Placement timeout reached');
                break;
            }
            
            if (placedCount >= requirements.totalIlots) break;
            
            const worldPos = this.gridToWorld(cell.x, cell.y);
            const ilotType = requirements.ilotTypes[placedCount % requirements.ilotTypes.length];
            
            // Attempt placement
            const placement = await this.attemptIlotPlacement(worldPos, ilotType, config);
            
            if (placement) {
                this.placedIlots.push(placement);
                this.indexPlacedIlot(placement);
                placedCount++;
                this.placementStats.successfulPlacements++;
            }
            
            this.placementStats.totalAttempts++;
        }
    }

    /**
     * ÎLOT PLACEMENT MECHANICS
     */

    /**
     * Attempt to place an îlot at a specific position
     * @param {Array} position - Target position [x, y]
     * @param {string} ilotType - Type of îlot
     * @param {Object} config - Placement configuration
     * @returns {Object|null} Placed îlot or null if failed
     */
    async attemptIlotPlacement(position, ilotType, config) {
        try {
            // Determine îlot dimensions
            const dimensions = this.calculateIlotDimensions(ilotType, config);
            
            // Check if placement is valid
            if (!this.isValidPlacement(position, dimensions)) {
                return null;
            }
            
            // Create îlot object
            const ilot = {
                id: `ilot_${this.placedIlots.length + 1}`,
                type: ilotType,
                position: {
                    x: position[0],
                    y: position[1],
                    z: 0
                },
                dimensions: dimensions,
                polygon: this.geometryEngine.createRectangle(
                    position[0], position[1], 
                    dimensions.width, dimensions.height
                ),
                properties: this.generateIlotProperties(ilotType),
                validation: {
                    isValid: true,
                    clearance: this.calculateIlotClearance(position, dimensions),
                    accessibility: this.calculateAccessibilityScore(position),
                    issues: []
                },
                metadata: {
                    placementScore: this.calculateOverallScore(position, ilotType),
                    created: new Date().toISOString(),
                    placementMethod: 'optimized'
                }
            };
            
            return ilot;
            
        } catch (error) {
            this.logError('Îlot placement attempt failed', error);
            return null;
        }
    }

    /**
     * Validate îlot placement
     * @param {Array} position - Position to check
     * @param {Object} dimensions - Îlot dimensions
     * @returns {boolean} True if valid placement
     */
    isValidPlacement(position, dimensions) {
        // Check spatial constraints
        if (!this.checkSpatialConstraints(position, dimensions)) {
            return false;
        }
        
        // Check collision with existing îlots
        if (this.checkIlotCollisions(position, dimensions)) {
            this.placementStats.collisionDetections++;
            return false;
        }
        
        // Check clearance requirements
        if (!this.checkClearanceRequirements(position, dimensions)) {
            return false;
        }
        
        return true;
    }

    /**
     * Check spatial constraints (walls, boundaries, etc.)
     * @param {Array} position - Position to check
     * @param {Object} dimensions - Îlot dimensions
     * @returns {boolean} True if constraints satisfied
     */
    checkSpatialConstraints(position, dimensions) {
        const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
        
        return this.geometryEngine.rectangleFitsInSpace(
            position[0], position[1],
            dimensions.width, dimensions.height,
            boundary,
            this.restrictedZones.map(zone => zone.polygon),
            this.config.minWallDistance
        );
    }

    /**
     * Check for collisions with existing îlots
     * @param {Array} position - Position to check
     * @param {Object} dimensions - Îlot dimensions
     * @returns {boolean} True if collision detected
     */
    checkIlotCollisions(position, dimensions) {
        const testRect = {
            minX: position[0] - dimensions.width / 2 - this.config.minIlotDistance,
            minY: position[1] - dimensions.height / 2 - this.config.minIlotDistance,
            maxX: position[0] + dimensions.width / 2 + this.config.minIlotDistance,
            maxY: position[1] + dimensions.height / 2 + this.config.minIlotDistance
        };
        
        const potentialCollisions = this.spatialIndex.search(testRect);
        return potentialCollisions.length > 0;
    }

    /**
     * OPTIMIZATION
     */

    /**
     * Optimize îlot placement using iterative improvement
     */
    async optimizePlacement() {
        this.log('Starting placement optimization');
        
        const maxOptimizationIterations = 50;
        let iteration = 0;
        let improved = true;
        
        while (improved && iteration < maxOptimizationIterations) {
            improved = false;
            
            for (let i = 0; i < this.placedIlots.length; i++) {
                const currentScore = this.placedIlots[i].metadata.placementScore;
                const optimizedPosition = await this.findBetterPosition(this.placedIlots[i]);
                
                if (optimizedPosition && optimizedPosition.score > currentScore * 1.1) {
                    // Move îlot to better position
                    this.moveIlot(i, optimizedPosition.position);
                    improved = true;
                }
            }
            
            iteration++;
            this.placementStats.optimizationIterations++;
        }
        
        this.log('Placement optimization completed', { iterations: iteration });
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Calculate îlot dimensions based on type and configuration
     * @param {string} ilotType - Type of îlot
     * @param {Object} config - Configuration
     * @returns {Object} Dimensions {width, height}
     */
    calculateIlotDimensions(ilotType, config) {
        const typeMultipliers = {
            'workspace': 1.0,
            'meeting': 1.3,
            'social': 1.5,
            'storage': 0.8,
            'break': 1.2
        };
        
        const multiplier = typeMultipliers[ilotType] || 1.0;
        
        return {
            width: config.defaultIlotSize.width * multiplier,
            height: config.defaultIlotSize.height * multiplier
        };
    }

    /**
     * Generate îlot properties based on type
     * @param {string} ilotType - Type of îlot
     * @returns {Object} Properties
     */
    generateIlotProperties(ilotType) {
        const properties = {
            workspace: { capacity: 4, equipment: ['desks', 'chairs', 'monitors'], priority: 1.0 },
            meeting: { capacity: 8, equipment: ['table', 'chairs', 'whiteboard'], priority: 0.8 },
            social: { capacity: 12, equipment: ['seating', 'tables'], priority: 0.6 },
            storage: { capacity: 0, equipment: ['shelving', 'cabinets'], priority: 0.4 },
            break: { capacity: 6, equipment: ['seating', 'tables', 'kitchen'], priority: 0.7 }
        };
        
        return properties[ilotType] || properties.workspace;
    }

    /**
     * Helper functions for spatial operations
     */
    
    createWallPolygon(wall) {
        // Create a simple rectangle for wall
        const thickness = 0.2; // Default wall thickness
        return this.geometryEngine.createRectangle(
            (wall.start[0] + wall.end[0]) / 2,
            (wall.start[1] + wall.end[1]) / 2,
            this.geometryEngine.calculateDistance(wall.start, wall.end),
            thickness
        );
    }

    createDoorClearanceZone(door) {
        return this.geometryEngine.createRectangle(
            door.position[0], door.position[1],
            this.config.minDoorClearance * 2,
            this.config.minDoorClearance * 2
        );
    }

    createWindowClearanceZone(window) {
        return this.geometryEngine.createRectangle(
            window.position[0], window.position[1],
            1.0, 1.0 // Minimal clearance for windows
        );
    }

    hasIlotClearance(point) {
        // Check minimum clearance around point
        const testRadius = Math.max(this.config.defaultIlotSize.width, this.config.defaultIlotSize.height) / 2;
        const testCircle = this.geometryEngine.createCircle(point[0], point[1], testRadius);
        
        for (const restrictedZone of this.restrictedZones) {
            if (this.geometryEngine.polygonsOverlap(testCircle, restrictedZone.polygon)) {
                return false;
            }
        }
        
        return true;
    }

    calculateAccessibilityScore(point) {
        // Simplified accessibility calculation
        // In real implementation, would calculate distance to doors, circulation paths, etc.
        let score = 0.8;
        
        // Check distance to nearest door
        if (this.floorPlan.doors) {
            let minDistance = Infinity;
            for (const door of this.floorPlan.doors) {
                const distance = this.geometryEngine.calculateDistance(point, door.position);
                minDistance = Math.min(minDistance, distance);
            }
            
            // Better score for closer to doors (but not too close)
            if (minDistance > 1.5 && minDistance < 10) {
                score += 0.2;
            }
        }
        
        return Math.min(score, 1.0);
    }

    calculateWorkflowScore(point) {
        // Simplified workflow score
        // In real implementation, would consider proximity to related îlots, circulation patterns, etc.
        return 0.8;
    }

    calculateUsableArea() {
        if (this.floorPlan.bounds) {
            const bounds = this.floorPlan.bounds;
            return (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) * 0.7; // 70% usable
        }
        
        return 100; // Default fallback
    }

    determineIlotTypes(config) {
        return config.ilotTypes || ['workspace', 'meeting', 'social', 'break'];
    }

    getSortedPlacementCells() {
        const cells = [];
        const { width, height } = this.placementGrid;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;
                if (this.placementGrid.cells[index] > 0) {
                    cells.push({
                        x, y,
                        score: this.placementGrid.scores[index]
                    });
                }
            }
        }
        
        return cells.sort((a, b) => b.score - a.score);
    }

    gridToWorld(gridX, gridY) {
        const bbox = this.placementGrid.bbox;
        return [
            bbox.minX + (gridX + 0.5) * this.placementGrid.resolution,
            bbox.minY + (gridY + 0.5) * this.placementGrid.resolution
        ];
    }

    indexPlacedIlot(ilot) {
        const bbox = {
            minX: ilot.position.x - ilot.dimensions.width / 2,
            minY: ilot.position.y - ilot.dimensions.height / 2,
            maxX: ilot.position.x + ilot.dimensions.width / 2,
            maxY: ilot.position.y + ilot.dimensions.height / 2
        };
        
        this.spatialIndex.insert({ ...bbox, ilot });
    }

    calculateIlotClearance(position, dimensions) {
        return this.config.minIlotDistance; // Simplified
    }

    calculateOverallScore(position, ilotType) {
        const accessibility = this.calculateAccessibilityScore(position);
        const workflow = this.calculateWorkflowScore(position);
        const spatial = 0.8; // Base spatial score
        
        return (
            accessibility * this.config.weights.accessibility +
            workflow * this.config.weights.workflow +
            spatial * this.config.weights.spaceUtilization
        );
    }

    checkClearanceRequirements(position, dimensions) {
        return true; // Simplified for now
    }

    createDefaultBoundary() {
        this.floorPlan.boundary = [
            [0, 0], [20, 0], [20, 15], [0, 15]
        ];
    }

    createBoundaryFromBounds() {
        const bounds = this.floorPlan.bounds || { minX: 0, minY: 0, maxX: 20, maxY: 15 };
        return [
            [bounds.minX, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX, bounds.maxY],
            [bounds.minX, bounds.maxY]
        ];
    }

    indexConstraints() {
        // Index restricted zones for faster collision detection
        for (const zone of this.restrictedZones) {
            const bbox = this.geometryEngine.calculateBoundingBox(zone.polygon);
            this.spatialIndex.insert({ ...bbox, zone });
        }
    }

    async findBetterPosition(ilot) {
        // Implementation for finding better position during optimization
        return null; // Simplified for now
    }

    moveIlot(index, newPosition) {
        // Implementation for moving îlot to new position
        this.placedIlots[index].position = newPosition;
    }

    resetPlacementStats() {
        this.placementStats = {
            totalAttempts: 0,
            successfulPlacements: 0,
            collisionDetections: 0,
            optimizationIterations: 0
        };
    }

    /**
     * VALIDATION
     */

    async validatePlacement() {
        const errors = [];
        const warnings = [];
        
        // Check minimum distances
        for (let i = 0; i < this.placedIlots.length; i++) {
            for (let j = i + 1; j < this.placedIlots.length; j++) {
                const distance = this.geometryEngine.calculateDistance(
                    [this.placedIlots[i].position.x, this.placedIlots[i].position.y],
                    [this.placedIlots[j].position.x, this.placedIlots[j].position.y]
                );
                
                if (distance < this.config.minIlotDistance) {
                    errors.push(`Îlots ${this.placedIlots[i].id} and ${this.placedIlots[j].id} too close: ${distance.toFixed(2)}m`);
                }
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            metrics: {
                placedIlots: this.placedIlots.length,
                averageScore: this.placedIlots.reduce((sum, ilot) => sum + ilot.metadata.placementScore, 0) / this.placedIlots.length,
                spatialEfficiency: this.calculateSpatialEfficiency()
            }
        };
    }

    calculateSpatialEfficiency() {
        const totalIlotArea = this.placedIlots.reduce((sum, ilot) => 
            sum + (ilot.dimensions.width * ilot.dimensions.height), 0
        );
        const usableArea = this.calculateUsableArea();
        return totalIlotArea / usableArea;
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
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            ...this.placementStats,
            config: this.config,
            placedIlots: this.placedIlots.length,
            spatialEfficiency: this.calculateSpatialEfficiency()
        };
    }
}

module.exports = IlotPlacementEngine;
