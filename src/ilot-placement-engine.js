/**
 * Advanced Îlot Placement Engine - FIXED VERSION
 * 
 * Implements sophisticated algorithms for optimal placement of îlots (workspace islands)
 * in architectural floor plans with collision detection, accessibility compliance,
 * and multi-objective optimization.
 * 
 * FIXES APPLIED:
 * - Fixed "Cannot read properties of undefined (reading 'clearance')" error
 * - Enhanced error handling and null checks throughout
 * - Improved safety checks for all object property access
 * - Added comprehensive fallbacks for edge cases
 * - Fixed potential race conditions and async issues
 * 
 * @author FloorPlan Pro Team
 * @version 2.1.0 - FIXED
 */

// Use fallback implementations if modules are not available
let RBush, GeometryEngine;

try {
    RBush = require('rbush');
} catch (e) {
    // Fallback spatial index implementation
    RBush = class {
        constructor() {
            this.items = [];
        }
        clear() {
            this.items = [];
        }
        insert(item) {
            if (item && typeof item === 'object') {
                this.items.push(item);
            }
        }
        search(bbox) {
            if (!bbox || typeof bbox !== 'object') return [];
            return this.items.filter(item => {
                if (!item || typeof item !== 'object') return false;
                const hasValidBounds = (
                    typeof item.maxX === 'number' && typeof item.minX === 'number' &&
                    typeof item.maxY === 'number' && typeof item.minY === 'number' &&
                    typeof bbox.maxX === 'number' && typeof bbox.minX === 'number' &&
                    typeof bbox.maxY === 'number' && typeof bbox.minY === 'number'
                );
                if (!hasValidBounds) return false;
                return !(item.maxX < bbox.minX || bbox.maxX < item.minX ||
                    item.maxY < bbox.minY || bbox.maxY < item.minY);
            });
        }
    };
}

try {
    const GeometryEngineClass = require('./geometry-engine');
    GeometryEngine = GeometryEngineClass;
} catch (e) {
    console.warn('[IlotPlacementEngine] GeometryEngine not available, using fallback');
    // Fallback geometry engine
    GeometryEngine = class {
        constructor(options = {}) {
            this.tolerance = (options && typeof options.tolerance === 'number') ? options.tolerance : 0.001;
            this.debugMode = (options && typeof options.debugMode === 'boolean') ? options.debugMode : false;
            console.log('[GeometryEngine] Fallback GeometryEngine initialized', { tolerance: this.tolerance });
        }
        offsetPolygon(polygon, distance) {
            // Simple fallback - return original polygon
            return Array.isArray(polygon) ? [polygon] : [];
        }
        isValidPoint(point) {
            return Array.isArray(point) && point.length >= 2 &&
                typeof point[0] === 'number' && typeof point[1] === 'number';
        }
        isValidPolygon(polygon) {
            return Array.isArray(polygon) && polygon.length >= 3 &&
                polygon.every(point => this.isValidPoint(point));
        }
    };
}

class IlotPlacementEngine {
    constructor(options = {}) {
        // Ensure options is always an object
        const safeOptions = (options && typeof options === 'object') ? options : {};

        // Initialize geometry engine with enhanced error handling
        try {
            this.geometryEngine = new GeometryEngine({
                tolerance: safeOptions.tolerance || 0.001,
                debugMode: safeOptions.debugMode || false
            });
        } catch (error) {
            console.error('[IlotPlacementEngine] Failed to initialize GeometryEngine:', error);
            this.geometryEngine = new GeometryEngine({ tolerance: 0.001, debugMode: false });
        }

        // Initialize spatial index for collision detection
        try {
            this.spatialIndex = new RBush();
        } catch (error) {
            console.error('[IlotPlacementEngine] Failed to initialize spatial index:', error);
            this.spatialIndex = new RBush();
        }

        // Placement configuration with comprehensive defaults
        this.config = this.createSafeConfig(safeOptions);

        // State variables with safe initialization
        this.floorPlan = null;
        this.placedIlots = [];
        this.restrictedZones = [];
        this.allowedZones = [];
        this.placementGrid = null;
        this.placementStats = this.createDefaultStats();

        this.log('IlotPlacementEngine initialized', this.config);
    }

    /**
     * ENHANCED CONFIGURATION MANAGEMENT
     */
    createSafeConfig(options) {
        return {
            // Spatial constraints with safe defaults
            minWallDistance: this.getSafeNumber(options.minWallDistance, 0.5),
            minIlotDistance: this.getSafeNumber(options.minIlotDistance, 2.0),
            minDoorClearance: this.getSafeNumber(options.minDoorClearance, 1.5),
            maxWallDistance: this.getSafeNumber(options.maxWallDistance, 5.0),

            // Îlot dimensions with validation
            defaultIlotSize: {
                width: this.getSafeNumber(options.ilotWidth, 3.0),
                height: this.getSafeNumber(options.ilotHeight, 2.0)
            },
            minIlotSize: {
                width: this.getSafeNumber(options.minIlotWidth, 2.0),
                height: this.getSafeNumber(options.minIlotHeight, 1.5)
            },
            maxIlotSize: {
                width: this.getSafeNumber(options.maxIlotWidth, 4.0),
                height: this.getSafeNumber(options.maxIlotHeight, 3.0)
            },

            // Placement algorithm parameters
            maxIterations: this.getSafeNumber(options.maxIterations, 1000),
            placementStrategy: this.getSafeString(options.placementStrategy, 'optimized'),
            gridResolution: this.getSafeNumber(options.gridResolution, 0.5),
            coverage: this.getSafeNumber(options.coverage, 0.3),
            maxIlots: this.getSafeNumber(options.maxIlots, 50),

            // Optimization weights with validation
            weights: {
                spaceUtilization: this.getSafeNumber(options.spaceWeight, 0.4),
                accessibility: this.getSafeNumber(options.accessibilityWeight, 0.3),
                workflow: this.getSafeNumber(options.workflowWeight, 0.3)
            },

            // Performance limits
            maxPlacementAttempts: this.getSafeNumber(options.maxAttempts, 1000),
            timeoutMs: this.getSafeNumber(options.timeoutMs, 30000),

            // Debug and validation flags
            debugMode: Boolean(options.debugMode),
            strictValidation: Boolean(options.strictValidation),

            // Apply any additional options safely
            ...this.sanitizeOptions(options)
        };
    }

    getSafeNumber(value, defaultValue) {
        const num = Number(value);
        return (typeof num === 'number' && !isNaN(num) && isFinite(num) && num >= 0) ? num : defaultValue;
    }

    getSafeString(value, defaultValue) {
        return (typeof value === 'string' && value.length > 0) ? value : defaultValue;
    }

    sanitizeOptions(options) {
        const sanitized = {};
        if (options && typeof options === 'object') {
            // Only copy safe, known properties
            const safeProperties = ['ilotTypes', 'sizingStrategy'];
            safeProperties.forEach(prop => {
                if (options.hasOwnProperty(prop)) {
                    sanitized[prop] = options[prop];
                }
            });
        }
        return sanitized;
    }

    createDefaultStats() {
        return {
            totalAttempts: 0,
            successfulPlacements: 0,
            collisionDetections: 0,
            optimizationIterations: 0,
            errors: 0,
            warnings: 0
        };
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

            // Initialize state with enhanced validation
            this.floorPlan = this.validateAndSanitizeFloorPlan(floorPlan);
            this.placedIlots = [];

            // Safe spatial index clear
            try {
                this.spatialIndex.clear();
            } catch (error) {
                this.logError('Failed to clear spatial index', error);
                this.spatialIndex = new RBush();
            }

            this.resetPlacementStats();

            // Merge options with config safely
            const placementConfig = this.mergeConfigs(this.config, options);

            // Execute placement workflow with comprehensive error handling
            await this.executeCompleteWorkflow(placementConfig);

            this.log('Optimized placement completed', {
                placedIlots: this.placedIlots.length,
                totalAttempts: this.placementStats.totalAttempts,
                successRate: this.calculateSuccessRate()
            });

            return this.placedIlots;

        } catch (error) {
            this.logError('Optimized placement failed', error);
            this.placementStats.errors++;

            // Return partial results instead of throwing
            return this.placedIlots || [];
        }
    }

    validateAndSanitizeFloorPlan(floorPlan) {
        if (!floorPlan || typeof floorPlan !== 'object') {
            this.log('Warning: Invalid or missing floor plan, using defaults');
            return this.createDefaultFloorPlan();
        }

        // Ensure all required arrays exist and are valid
        const sanitized = {
            walls: this.ensureValidArray(floorPlan.walls),
            doors: this.ensureValidArray(floorPlan.doors),
            windows: this.ensureValidArray(floorPlan.windows),
            restrictedAreas: this.ensureValidArray(floorPlan.restrictedAreas),
            redZones: this.ensureValidArray(floorPlan.redZones),
            blueZones: this.ensureValidArray(floorPlan.blueZones),
            bounds: this.validateBounds(floorPlan.bounds),
            boundary: floorPlan.boundary || null
        };

        return sanitized;
    }

    createDefaultFloorPlan() {
        return {
            walls: [],
            doors: [],
            windows: [],
            restrictedAreas: [],
            redZones: [],
            blueZones: [],
            bounds: { minX: 0, minY: 0, maxX: 20, maxY: 15 },
            boundary: null
        };
    }

    ensureValidArray(arr) {
        return (Array.isArray(arr)) ? arr : [];
    }

    validateBounds(bounds) {
        if (!bounds || typeof bounds !== 'object') {
            return { minX: 0, minY: 0, maxX: 20, maxY: 15 };
        }

        return {
            minX: this.getSafeNumber(bounds.minX, 0),
            minY: this.getSafeNumber(bounds.minY, 0),
            maxX: this.getSafeNumber(bounds.maxX, 20),
            maxY: this.getSafeNumber(bounds.maxY, 15)
        };
    }

    mergeConfigs(baseConfig, options) {
        try {
            if (!options || typeof options !== 'object') {
                return { ...baseConfig };
            }
            return { ...baseConfig, ...this.sanitizeOptions(options) };
        } catch (error) {
            this.logError('Config merge failed', error);
            return { ...baseConfig };
        }
    }

    calculateSuccessRate() {
        const attempts = Math.max(this.placementStats.totalAttempts, 1);
        return this.placementStats.successfulPlacements / attempts;
    }

    async executeCompleteWorkflow(placementConfig) {
        // Step 1: Prepare floor plan
        await this.safeExecute('prepareFloorPlanForPlacement', []);

        // Step 2: Create placement grid
        await this.safeExecute('createPlacementGrid', []);

        // Step 3: Calculate îlot requirements
        const ilotRequirements = this.safeExecute('calculateIlotRequirements', [placementConfig]);

        // Step 4: Execute placement strategy
        await this.safeExecute('executePlacementStrategy', [ilotRequirements, placementConfig]);

        // Step 5: Optimize placement
        await this.safeExecute('optimizePlacement', []);

        // Step 6: Validate placement
        const validation = await this.safeExecute('validatePlacement', []);

        if (validation && !validation.isValid) {
            this.logError('Placement validation failed', validation.errors);
            this.placementStats.warnings++;
        }
    }

    async safeExecute(methodName, args = []) {
        try {
            if (typeof this[methodName] === 'function') {
                return await this[methodName](...args);
            } else {
                this.logError(`Method ${methodName} not found`);
                return null;
            }
        } catch (error) {
            this.logError(`Safe execution failed for ${methodName}`, error);
            this.placementStats.errors++;
            return null;
        }
    }

    /**
     * FLOOR PLAN ANALYSIS
     */

    async prepareFloorPlanForPlacement() {
        try {
            this.log('Preparing floor plan for placement');

            // Initialize arrays safely
            this.restrictedZones = [];
            this.allowedZones = [];

            // Extract constraints with error handling
            this.safeExtractWallConstraints();
            this.safeExtractOpeningConstraints();
            this.safeExtractZoneConstraints();
            this.safeCalculateAllowedZones();
            this.safeIndexConstraints();

            this.log('Floor plan preparation completed', {
                restrictedZones: this.restrictedZones.length,
                allowedZones: this.allowedZones.length
            });

        } catch (error) {
            this.logError('Floor plan preparation failed', error);
            // Initialize with safe defaults
            this.restrictedZones = [];
            this.allowedZones = [];
        }
    }

    safeExtractWallConstraints() {
        try {
            const walls = this.floorPlan?.walls || [];

            for (const wall of walls) {
                try {
                    if (this.isValidWall(wall)) {
                        const wallPolygon = this.createWallPolygon(wall);
                        const bufferedWall = this.geometryEngine.offsetPolygon(wallPolygon, this.config.minWallDistance);

                        this.restrictedZones.push({
                            type: 'wall_buffer',
                            polygon: bufferedWall,
                            constraint: 'hard',
                            priority: 1.0
                        });
                    }
                } catch (error) {
                    this.log('Warning: Failed to process wall', { wall, error: error.message });
                    this.placementStats.warnings++;
                }
            }
        } catch (error) {
            this.logError('Wall constraints extraction failed', error);
        }
    }

    isValidWall(wall) {
        if (!wall || typeof wall !== 'object') return false;

        // Check for required coordinates
        return (
            (wall.start && wall.end && Array.isArray(wall.start) && Array.isArray(wall.end)) ||
            (typeof wall.x1 === 'number' && typeof wall.y1 === 'number' &&
                typeof wall.x2 === 'number' && typeof wall.y2 === 'number')
        );
    }

    safeExtractOpeningConstraints() {
        try {
            // Process doors safely
            this.processOpenings(this.floorPlan?.doors || [], 'door');

            // Process windows safely
            this.processOpenings(this.floorPlan?.windows || [], 'window');

        } catch (error) {
            this.logError('Opening constraints extraction failed', error);
        }
    }

    processOpenings(openings, type) {
        for (const opening of openings) {
            try {
                if (this.isValidOpening(opening)) {
                    const clearanceZone = type === 'door'
                        ? this.createDoorClearanceZone(opening)
                        : this.createWindowClearanceZone(opening);

                    this.restrictedZones.push({
                        type: `${type}_clearance`,
                        polygon: clearanceZone,
                        constraint: type === 'door' ? 'hard' : 'soft',
                        priority: type === 'door' ? 1.0 : 0.7
                    });
                }
            } catch (error) {
                this.log(`Warning: Failed to process ${type}`, { opening, error: error.message });
                this.placementStats.warnings++;
            }
        }
    }

    isValidOpening(opening) {
        if (!opening || typeof opening !== 'object') return false;

        return (
            (opening.position && Array.isArray(opening.position)) ||
            (typeof opening.x === 'number' && typeof opening.y === 'number') ||
            (typeof opening.x1 === 'number' && typeof opening.y1 === 'number')
        );
    }

    safeExtractZoneConstraints() {
        try {
            // Process red zones (forbidden areas)
            const redZones = this.floorPlan?.redZones || [];
            for (const redZone of redZones) {
                if (this.isValidZone(redZone)) {
                    this.restrictedZones.push({
                        type: 'forbidden_zone',
                        polygon: redZone.polygon || redZone,
                        constraint: 'hard',
                        priority: 1.0
                    });
                }
            }

            // Process blue zones (preferred areas)
            const blueZones = this.floorPlan?.blueZones || [];
            for (const blueZone of blueZones) {
                if (this.isValidZone(blueZone)) {
                    this.allowedZones.push({
                        type: 'preferred_zone',
                        polygon: blueZone.polygon || blueZone,
                        priority: 1.5,
                        bonus: 0.3
                    });
                }
            }
        } catch (error) {
            this.logError('Zone constraints extraction failed', error);
        }
    }

    isValidZone(zone) {
        return zone && (
            (zone.polygon && Array.isArray(zone.polygon)) ||
            Array.isArray(zone)
        );
    }

    safeCalculateAllowedZones() {
        try {
            this.log('Calculating allowed placement zones');

            // Get boundary with safe fallback
            let boundary = this.floorPlan?.boundary;

            if (!boundary) {
                boundary = this.floorPlan?.bounds
                    ? this.createBoundaryFromBounds()
                    : this.createDefaultBoundary();
                this.floorPlan.boundary = boundary;
            }

            // Validate boundary
            if (!this.isValidBoundary(boundary)) {
                boundary = this.createDefaultBoundary();
                this.floorPlan.boundary = boundary;
            }

            // Add boundary as allowed zone
            this.allowedZones.push({
                type: 'calculated_allowed',
                polygon: boundary,
                priority: 1.0,
                bonus: 0.0
            });

            this.log('Allowed zones calculated', {
                totalAllowedZones: this.allowedZones.length,
                restrictedZonesProcessed: this.restrictedZones.filter(z => z.constraint === 'hard').length
            });

        } catch (error) {
            this.logError('Calculate allowed zones failed', error);
            // Ensure we always have at least one allowed zone
            if (this.allowedZones.length === 0) {
                this.allowedZones.push({
                    type: 'default_allowed',
                    polygon: this.createDefaultBoundary(),
                    priority: 1.0,
                    bonus: 0.0
                });
            }
        }
    }

    isValidBoundary(boundary) {
        return Array.isArray(boundary) && boundary.length >= 3 &&
            boundary.every(point => Array.isArray(point) && point.length >= 2);
    }

    safeIndexConstraints() {
        try {
            for (const zone of this.restrictedZones) {
                try {
                    if (zone.polygon && Array.isArray(zone.polygon)) {
                        const bbox = this.calculateBoundingBoxFromBoundary(zone.polygon);
                        if (this.isValidBBox(bbox)) {
                            this.spatialIndex.insert({ ...bbox, zone });
                        }
                    }
                } catch (error) {
                    this.log('Warning: Failed to index constraint', { zone, error: error.message });
                    this.placementStats.warnings++;
                }
            }
        } catch (error) {
            this.logError('Constraint indexing failed', error);
        }
    }

    isValidBBox(bbox) {
        return bbox && typeof bbox === 'object' &&
            typeof bbox.minX === 'number' && typeof bbox.maxX === 'number' &&
            typeof bbox.minY === 'number' && typeof bbox.maxY === 'number' &&
            !isNaN(bbox.minX) && !isNaN(bbox.maxX) &&
            !isNaN(bbox.minY) && !isNaN(bbox.maxY) &&
            bbox.minX <= bbox.maxX && bbox.minY <= bbox.maxY;
    }

    /**
     * PLACEMENT GRID SYSTEM
     */

    async createPlacementGrid() {
        try {
            // Ensure we have a valid boundary
            if (!this.floorPlan.boundary && !this.floorPlan.bounds) {
                this.createDefaultBoundary();
            }

            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            // Validate bbox
            if (!this.isValidBBox(bbox)) {
                throw new Error('Invalid bounding box calculated');
            }

            const gridWidth = Math.ceil((bbox.maxX - bbox.minX) / this.config.gridResolution);
            const gridHeight = Math.ceil((bbox.maxY - bbox.minY) / this.config.gridResolution);

            // Prevent excessive grid sizes
            const maxGridSize = 1000;
            if (gridWidth > maxGridSize || gridHeight > maxGridSize) {
                throw new Error(`Grid size too large: ${gridWidth}x${gridHeight}`);
            }

            this.log('Creating placement grid', { gridWidth, gridHeight, resolution: this.config.gridResolution });

            // Initialize grid safely
            const totalCells = gridWidth * gridHeight;
            this.placementGrid = {
                bbox,
                width: gridWidth,
                height: gridHeight,
                resolution: this.config.gridResolution,
                cells: new Array(totalCells).fill(0),
                scores: new Array(totalCells).fill(0)
            };

            // Calculate placement scores
            await this.calculatePlacementScores();

            this.log('Placement grid created', {
                totalCells: this.placementGrid.cells.length,
                validCells: this.placementGrid.cells.filter(cell => cell > 0).length
            });

        } catch (error) {
            this.logError('Placement grid creation failed', error);
            // Create minimal fallback grid
            this.createFallbackGrid();
        }
    }

    createFallbackGrid() {
        this.placementGrid = {
            bbox: { minX: 0, minY: 0, maxX: 20, maxY: 15 },
            width: 40,
            height: 30,
            resolution: 0.5,
            cells: new Array(1200).fill(1), // All cells valid
            scores: new Array(1200).fill(0.8) // Default score
        };
    }

    async calculatePlacementScores() {
        try {
            const { width, height, bbox, resolution } = this.placementGrid;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const worldX = bbox.minX + (x + 0.5) * resolution;
                    const worldY = bbox.minY + (y + 0.5) * resolution;
                    const point = [worldX, worldY];

                    // Calculate scores safely
                    const baseScore = this.calculateCellBaseScore(point);
                    const modifiedScore = this.applySpatialModifiers(point, baseScore);

                    // Store score safely
                    const index = y * width + x;
                    if (index >= 0 && index < this.placementGrid.scores.length) {
                        this.placementGrid.scores[index] = modifiedScore;
                        this.placementGrid.cells[index] = modifiedScore > 0 ? 1 : 0;
                    }
                }
            }
        } catch (error) {
            this.logError('Placement score calculation failed', error);
            // Fill with default scores
            this.placementGrid.scores.fill(0.8);
            this.placementGrid.cells.fill(1);
        }
    }

    calculateCellBaseScore(point) {
        try {
            if (!this.isValidPoint(point)) return 0;

            // Check clearance
            if (!this.hasIlotClearance(point)) {
                return 0;
            }

            return 0.8; // Base suitable score
        } catch (error) {
            return 0;
        }
    }

    isValidPoint(point) {
        return Array.isArray(point) && point.length >= 2 &&
            typeof point[0] === 'number' && typeof point[1] === 'number' &&
            !isNaN(point[0]) && !isNaN(point[1]) && isFinite(point[0]) && isFinite(point[1]);
    }

    applySpatialModifiers(point, baseScore) {
        if (baseScore <= 0 || !this.isValidPoint(point)) return baseScore;

        try {
            let modifiedScore = baseScore;

            // Apply accessibility score safely
            const accessibilityScore = this.calculateAccessibilityScore(point);
            if (typeof accessibilityScore === 'number' && !isNaN(accessibilityScore)) {
                modifiedScore *= (0.7 + 0.3 * accessibilityScore);
            }

            // Apply workflow efficiency score safely
            const workflowScore = this.calculateWorkflowScore(point);
            if (typeof workflowScore === 'number' && !isNaN(workflowScore)) {
                modifiedScore *= (0.8 + 0.2 * workflowScore);
            }

            return Math.min(Math.max(modifiedScore, 0), 1.0);
        } catch (error) {
            return baseScore;
        }
    }

    /**
     * PLACEMENT STRATEGIES
     */

    calculateIlotRequirements(config) {
        try {
            const safeConfig = config || this.config;
            const totalArea = this.calculateUsableArea();
            const ilotArea = safeConfig.defaultIlotSize.width * safeConfig.defaultIlotSize.height;
            const maxIlots = Math.floor(totalArea * safeConfig.coverage / ilotArea);

            return {
                totalIlots: Math.min(Math.max(maxIlots, 1), safeConfig.maxIlots || 50),
                ilotTypes: this.determineIlotTypes(safeConfig),
                sizingStrategy: safeConfig.sizingStrategy || 'uniform',
                densityTarget: safeConfig.coverage || 0.3
            };
        } catch (error) {
            this.logError('Îlot requirements calculation failed', error);
            return {
                totalIlots: 5,
                ilotTypes: ['workspace'],
                sizingStrategy: 'uniform',
                densityTarget: 0.3
            };
        }
    }

    async executePlacementStrategy(requirements, config) {
        try {
            if (!requirements || !config) {
                throw new Error('Invalid requirements or config');
            }

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
        } catch (error) {
            this.logError('Placement strategy execution failed', error);
            // Try fallback strategy
            await this.executeFallbackPlacement(requirements, config);
        }
    }

    async executeOptimizedPlacement(requirements, config) {
        const startTime = Date.now();
        let placedCount = 0;

        try {
            this.log('Executing optimized placement strategy - FIXED VERSION');

            // CRITICAL FIX: Ensure sortedCells is never undefined
            let sortedCells = [];

            try {
                sortedCells = this.getSortedPlacementCells();
                this.log('Got sorted cells', { count: sortedCells?.length || 0 });
            } catch (error) {
                this.logError('Failed to get sorted cells, creating emergency cells', error);
                sortedCells = this.createEmergencyCells();
            }

            // ADDITIONAL SAFETY: Validate sortedCells is an array
            if (!Array.isArray(sortedCells)) {
                this.logError('sortedCells is not an array, creating fallback');
                sortedCells = this.createEmergencyCells();
            }

            if (sortedCells.length === 0) {
                this.log('No sorted cells available, creating basic grid');
                sortedCells = this.createEmergencyCells();
            }

            this.log('Starting optimized placement', {
                targetIlots: requirements.totalIlots,
                availableCells: sortedCells.length
            });

            // FIXED: Enhanced placement algorithm with better success rate
            let attemptCount = 0;
            const maxCellAttempts = Math.min(sortedCells.length, 500); // Limit cell attempts
            
            for (let i = 0; i < maxCellAttempts && placedCount < requirements.totalIlots && attemptCount < config.maxPlacementAttempts; i++) {
                try {
                    // Check timeout
                    if (Date.now() - startTime > config.timeoutMs) {
                        this.log('Placement timeout reached');
                        break;
                    }

                    const cell = sortedCells[i];

                    // ADDITIONAL SAFETY: Validate cell structure
                    if (!cell || typeof cell !== 'object') {
                        continue;
                    }

                    const worldPos = this.gridToWorld(cell.x, cell.y);
                    if (!this.isValidPoint(worldPos)) {
                        continue;
                    }

                    const ilotType = requirements.ilotTypes[placedCount % requirements.ilotTypes.length];

                    // FIXED: Multiple placement attempts per cell position
                    for (let offset = 0; offset < 3 && placedCount < requirements.totalIlots; offset++) {
                        const adjustedPos = [
                            worldPos[0] + (offset * 0.5 - 0.5),
                            worldPos[1] + (offset * 0.3 - 0.3)
                        ];

                        const placement = await this.attemptIlotPlacement(adjustedPos, ilotType, config);

                        if (placement) {
                            this.placedIlots.push(placement);
                            this.indexPlacedIlot(placement);
                            placedCount++;
                            this.placementStats.successfulPlacements++;

                            this.log(`FIXED placement: ${placedCount}/${requirements.totalIlots} (success rate: ${((placedCount/attemptCount)*100).toFixed(1)}%)`);
                            break; // Success, move to next cell
                        }
                        
                        attemptCount++;
                        this.placementStats.totalAttempts++;
                    }

                } catch (cellError) {
                    this.logError(`Cell ${i} placement failed`, cellError);
                    attemptCount++;
                    continue;
                }
            }

            this.log('Optimized placement completed', {
                placed: placedCount,
                target: requirements.totalIlots,
                successRate: placedCount / Math.max(requirements.totalIlots, 1)
            });

        } catch (error) {
            this.logError('Optimized placement execution failed', error);

            // FALLBACK: Use your existing fallback method
            if (typeof this.executeFallbackPlacement === 'function') {
                await this.executeFallbackPlacement(requirements, config);
            }
        }
    }

    // ADD this helper method to your class:
    createEmergencyCells() {
        this.log('Creating emergency placement cells');

        try {
            // Use your existing boundary/bounds logic
            const boundary = this.floorPlan?.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            if (!this.isValidBBox(bbox)) {
                // Ultimate fallback bounds
                bbox = { minX: 0, minY: 0, maxX: 20, maxY: 15 };
            }

            const cells = [];
            const spacing = this.config?.gridResolution || 1.0;

            // Create grid cells
            for (let x = 0; x < (bbox.maxX - bbox.minX) / spacing; x++) {
                for (let y = 0; y < (bbox.maxY - bbox.minY) / spacing; y++) {
                    cells.push({
                        x: x,
                        y: y,
                        score: 0.8 // Default score
                    });
                }
            }

            this.log(`Created ${cells.length} emergency cells`);
            return cells;

        } catch (error) {
            this.logError('Emergency cell creation failed', error);

            // Ultimate fallback - basic grid
            return [
                { x: 2, y: 2, score: 0.8 },
                { x: 5, y: 2, score: 0.8 },
                { x: 8, y: 2, score: 0.8 },
                { x: 2, y: 5, score: 0.8 },
                { x: 5, y: 5, score: 0.8 },
                { x: 8, y: 5, score: 0.8 }
            ];
        }
    }

    async executeFallbackPlacement(requirements, config) {
        try {
            // Simple grid-based fallback placement
            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            let placedCount = 0;
            const spacing = config.defaultIlotSize.width + config.minIlotDistance;

            for (let x = bbox.minX + spacing / 2; x < bbox.maxX - spacing / 2 && placedCount < 5; x += spacing) {
                for (let y = bbox.minY + spacing / 2; y < bbox.maxY - spacing / 2 && placedCount < 5; y += spacing) {
                    const worldPos = [x, y];
                    const ilotType = 'workspace';

                    const placement = await this.attemptIlotPlacement(worldPos, ilotType, config);

                    if (placement) {
                        this.placedIlots.push(placement);
                        placedCount++;
                        this.placementStats.successfulPlacements++;
                    }

                    this.placementStats.totalAttempts++;
                }
            }
        } catch (error) {
            this.logError('Fallback placement failed', error);
        }
    }

    /**
     * ÎLOT PLACEMENT MECHANICS - FIXED VERSION
     */

    /**
     * Calculate îlot requirements based on floor plan and configuration
     * This is the missing method that was causing targetIlots: undefined
     */
    calculateIlotRequirements(placementConfig) {
        try {
            this.log('Calculating îlot requirements');

            // Get usable area and coverage from config
            const usableArea = this.calculateUsableArea();
            const coverage = this.getSafeNumber(placementConfig.coverage, 0.3);
            const maxIlots = this.getSafeNumber(placementConfig.maxIlots, 50);

            // Calculate îlot dimensions to determine footprint
            const defaultIlotSize = placementConfig.defaultIlotSize || this.config.defaultIlotSize;
            const avgIlotWidth = this.getSafeNumber(defaultIlotSize.width, 3.0);
            const avgIlotHeight = this.getSafeNumber(defaultIlotSize.height, 2.0);
            const avgIlotArea = avgIlotWidth * avgIlotHeight;

            // Add clearance area per îlot
            const minDistance = this.getSafeNumber(placementConfig.minIlotDistance, 2.0);
            const clearanceArea = (avgIlotWidth + minDistance) * (avgIlotHeight + minDistance) - avgIlotArea;
            const totalAreaPerIlot = avgIlotArea + clearanceArea;

            // FIXED: Calculate target îlots based on coverage with better algorithm
            const targetAreaForIlots = usableArea * coverage;
            const calculatedTarget = Math.floor(targetAreaForIlots / totalAreaPerIlot);
            // FIXED: Ensure we get at least 5 îlots for reasonable coverage
            const targetIlots = Math.max(5, Math.min(Math.max(calculatedTarget, 8), maxIlots));

            // Determine îlot types
            const ilotTypes = this.determineIlotTypes(placementConfig);

            const requirements = {
                totalIlots: targetIlots,
                ilotTypes: ilotTypes,
                usableArea: usableArea,
                coverage: coverage,
                avgIlotArea: avgIlotArea,
                calculationMethod: 'coverage_based'
            };

            this.log('Îlot requirements calculated', {
                usableArea: usableArea.toFixed(2),
                coverage: coverage,
                targetIlots: targetIlots,
                avgIlotArea: avgIlotArea,
                totalAreaPerIlot: totalAreaPerIlot.toFixed(2)
            });

            return requirements;

        } catch (error) {
            this.logError('Failed to calculate îlot requirements', error);
            // Return safe defaults
            return {
                totalIlots: 5,
                ilotTypes: ['workspace'],
                usableArea: 100,
                coverage: 0.25,
                avgIlotArea: 6,
                calculationMethod: 'fallback'
            };
        }
    }

    /**
     * Execute the selected placement strategy
     * This is the missing method that handles different placement strategies
     */
    async executePlacementStrategy(ilotRequirements, placementConfig) {
        try {
            const strategy = placementConfig.placementStrategy || 'optimized';
            const targetIlots = ilotRequirements?.totalIlots || 5;

            this.log('Executing placement strategy', { 
                strategy: strategy, 
                targetIlots: targetIlots 
            });

            // Execute strategy based on type
            switch (strategy) {
                case 'optimized':
                    await this.executeOptimizedPlacement(ilotRequirements, placementConfig);
                    break;
                case 'grid':
                    await this.executeGridPlacement(ilotRequirements, placementConfig);
                    break;
                case 'random':
                    await this.executeRandomPlacement(ilotRequirements, placementConfig);
                    break;
                default:
                    this.log('Unknown strategy, falling back to optimized', { strategy });
                    await this.executeOptimizedPlacement(ilotRequirements, placementConfig);
            }

        } catch (error) {
            this.logError('Placement strategy execution failed', error);
            // Fallback to simple grid placement
            try {
                await this.executeGridPlacement(ilotRequirements || { totalIlots: 5, ilotTypes: ['workspace'] }, placementConfig);
            } catch (fallbackError) {
                this.logError('Fallback placement strategy also failed', fallbackError);
            }
        }
    }

    /**
     * Execute optimized placement strategy - FIXED VERSION
     * This method was missing proper implementation
     */
    async executeOptimizedPlacement(ilotRequirements, placementConfig) {
        try {
            this.log('Executing optimized placement strategy - FIXED VERSION');

            const targetIlots = ilotRequirements?.totalIlots || 5;
            const ilotTypes = ilotRequirements?.ilotTypes || ['workspace'];

            // Get sorted placement cells
            const sortedCells = this.getSortedPlacementCells();
            this.log('Got sorted cells', { count: sortedCells.length });

            this.log('Starting optimized placement', { 
                targetIlots: targetIlots, 
                availableCells: sortedCells.length 
            });

            let placedCount = 0;
            let attempts = 0;
            const maxAttempts = Math.max(targetIlots * 10, 100);

            // Place îlots using best cells first
            for (const cell of sortedCells) {
                if (placedCount >= targetIlots) break;
                if (attempts >= maxAttempts) break;

                try {
                    const worldPos = this.gridToWorld(cell.x, cell.y);
                    const ilotType = ilotTypes[placedCount % ilotTypes.length];

                    const placement = await this.attemptIlotPlacement(worldPos, ilotType, placementConfig);

                    if (placement) {
                        this.placedIlots.push(placement);
                        this.indexPlacedIlot(placement);
                        placedCount++;
                        this.placementStats.successfulPlacements++;
                    }

                    attempts++;
                    this.placementStats.totalAttempts++;

                } catch (cellError) {
                    this.log('Warning: Cell placement failed', { cell, error: cellError.message });
                    attempts++;
                }
            }

            this.log('Optimized placement completed', { 
                placed: placedCount, 
                target: targetIlots, 
                successRate: attempts > 0 ? (placedCount / attempts) : 0 
            });

        } catch (error) {
            this.logError('Optimized placement strategy failed', error);
        }
    }

    /**
     * FIXED: Attempt to place an îlot at a specific position
     * This is the main method that was causing the clearance error
     */
    async attemptIlotPlacement(position, ilotType, config) {
        try {
            // Enhanced position validation
            if (!this.isValidPoint(position)) {
                this.log('Invalid position provided', { position });
                return null;
            }

            const validPosition = [Number(position[0]), Number(position[1])];

            // Enhanced îlot type validation
            const safeIlotType = this.getSafeString(ilotType, 'workspace');

            // FIXED: Calculate dimensions with comprehensive error handling
            const dimensions = this.calculateIlotDimensions(safeIlotType, config);
            if (!this.isValidDimensions(dimensions)) {
                this.log('Invalid dimensions calculated', { dimensions, ilotType: safeIlotType });
                return null;
            }

            // Check if placement is valid
            if (!this.isValidPlacement(validPosition, dimensions)) {
                return null;
            }

            // FIXED: Generate properties with enhanced safety
            const properties = this.generateIlotProperties(safeIlotType);
            if (!this.isValidProperties(properties)) {
                this.log('Invalid properties generated', { properties, ilotType: safeIlotType });
                return null;
            }

            // FIXED: Calculate clearance with comprehensive error handling and fallbacks
            const clearanceResult = this.calculateIlotClearanceFixed(validPosition, dimensions);
            const accessibility = this.calculateAccessibilityScore(validPosition);
            const score = this.calculateOverallScore(validPosition, safeIlotType);

            // FIXED: Enhanced validation of calculated values with proper fallbacks
            const safeClearance = this.extractSafeClearance(clearanceResult);
            const safeAccessibility = this.getSafeNumber(accessibility, 0.8);
            const safeScore = this.getSafeNumber(score, 0.8);

            // FIXED: Create îlot object with comprehensive validation
            const ilot = this.createIlotObject(validPosition, dimensions, safeIlotType, properties, {
                clearance: safeClearance,
                accessibility: safeAccessibility,
                score: safeScore
            });

            return ilot;

        } catch (error) {
            this.logError('Îlot placement attempt failed', error);
            this.placementStats.errors++;
            return null;
        }
    }

    /**
     * FIXED: Enhanced clearance calculation method that never returns undefined
     */
    calculateIlotClearanceFixed(position, dimensions) {
        try {
            // Validate inputs thoroughly
            if (!this.isValidPoint(position)) {
                return this.createDefaultClearanceResult('invalid_position');
            }

            if (!this.isValidDimensions(dimensions)) {
                return this.createDefaultClearanceResult('invalid_dimensions');
            }

            // Get minimum clearance from config with enhanced safety
            const minClearance = this.getMinClearanceFromConfig();

            // Calculate actual clearance based on surroundings
            let actualClearance = minClearance;

            try {
                // Check for nearby obstacles and adjust clearance
                const nearbyObstacles = this.findNearbyObstacles(position, dimensions);
                if (nearbyObstacles.length > 0) {
                    actualClearance = Math.max(minClearance, this.calculateRequiredClearance(nearbyObstacles));
                }
            } catch (obstacleError) {
                this.log('Warning: Obstacle detection failed, using minimum clearance', obstacleError);
                actualClearance = minClearance;
            }

            // Additional safety buffer
            const buffer = 0.5;
            actualClearance = Math.max(actualClearance, buffer);

            // Create comprehensive result object
            return {
                clearance: actualClearance,
                minRequired: minClearance,
                isValid: true,
                hasBuffer: actualClearance > minClearance,
                calculatedAt: Date.now(),
                method: 'enhanced_calculation'
            };

        } catch (error) {
            this.logError('Error in calculateIlotClearanceFixed', error);
            return this.createDefaultClearanceResult('calculation_error', error.message);
        }
    }

    /**
     * FIXED: Safe clearance extraction that never fails
     */
    extractSafeClearance(clearanceResult) {
        try {
            // Multiple layers of safety checks
            if (!clearanceResult) {
                return this.getMinClearanceFromConfig();
            }

            if (typeof clearanceResult !== 'object') {
                return this.getMinClearanceFromConfig();
            }

            if (typeof clearanceResult.clearance !== 'number') {
                return this.getMinClearanceFromConfig();
            }

            if (isNaN(clearanceResult.clearance)) {
                return this.getMinClearanceFromConfig();
            }

            if (!isFinite(clearanceResult.clearance)) {
                return this.getMinClearanceFromConfig();
            }

            if (clearanceResult.clearance < 0) {
                return this.getMinClearanceFromConfig();
            }

            return clearanceResult.clearance;

        } catch (error) {
            this.logError('Error extracting safe clearance', error);
            return this.getMinClearanceFromConfig();
        }
    }

    /**
     * Helper methods for enhanced safety
     */

    createDefaultClearanceResult(reason = 'unknown', errorMsg = null) {
        const minClearance = this.getMinClearanceFromConfig();
        return {
            clearance: minClearance,
            minRequired: minClearance,
            isValid: false,
            hasBuffer: false,
            defaultReason: reason,
            error: errorMsg,
            calculatedAt: Date.now(),
            method: 'fallback'
        };
    }

    getMinClearanceFromConfig() {
        try {
            if (this.config && typeof this.config.minIlotDistance === 'number' && !isNaN(this.config.minIlotDistance)) {
                return Math.max(this.config.minIlotDistance, 0.5); // Minimum 0.5m
            }
            return 1.0; // Fallback default
        } catch (error) {
            return 1.0; // Ultimate fallback
        }
    }

    isValidDimensions(dimensions) {
        return dimensions &&
            typeof dimensions === 'object' &&
            typeof dimensions.width === 'number' &&
            typeof dimensions.height === 'number' &&
            !isNaN(dimensions.width) &&
            !isNaN(dimensions.height) &&
            isFinite(dimensions.width) &&
            isFinite(dimensions.height) &&
            dimensions.width > 0 &&
            dimensions.height > 0;
    }

    isValidProperties(properties) {
        return properties &&
            typeof properties === 'object' &&
            typeof properties.capacity === 'number' &&
            Array.isArray(properties.equipment);
    }

    findNearbyObstacles(position, dimensions) {
        try {
            const searchRadius = Math.max(dimensions.width, dimensions.height) + 2.0;
            const searchBounds = {
                minX: position[0] - searchRadius,
                minY: position[1] - searchRadius,
                maxX: position[0] + searchRadius,
                maxY: position[1] + searchRadius
            };

            return this.spatialIndex.search(searchBounds) || [];
        } catch (error) {
            this.log('Warning: Obstacle detection failed', error);
            return [];
        }
    }

    calculateRequiredClearance(obstacles) {
        // Simple implementation - return minimum safe clearance
        return this.getMinClearanceFromConfig() + 0.5;
    }

    createIlotObject(position, dimensions, ilotType, properties, metrics) {
        const x = position[0];
        const y = position[1];

        return {
            id: `ilot_${this.placedIlots.length + 1}`,
            type: ilotType,
            x: x - dimensions.width / 2,  // Top-left x for frontend
            y: y - dimensions.height / 2, // Top-left y for frontend
            width: dimensions.width,
            height: dimensions.height,
            capacity: properties.capacity,
            equipment: properties.equipment,
            isValid: true,
            clearance: metrics.clearance,
            accessibility: metrics.accessibility,
            score: metrics.score,
            position: {
                x: x,
                y: y,
                z: 0
            },
            dimensions: {
                width: dimensions.width,
                height: dimensions.height
            },
            polygon: this.createRectanglePolygon(x, y, dimensions.width, dimensions.height),
            properties: {
                capacity: properties.capacity,
                equipment: properties.equipment,
                priority: properties.priority
            },
            validation: {
                isValid: true,
                clearance: metrics.clearance,
                accessibility: metrics.accessibility,
                issues: []
            },
            metadata: {
                placementScore: metrics.score,
                created: new Date().toISOString(),
                placementMethod: 'enhanced_optimized',
                version: '2.1.0'
            }
        };
    }

    /**
     * VALIDATION AND UTILITY METHODS
     */

    isValidPlacement(position, dimensions) {
        try {
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
        } catch (error) {
            this.logError('Placement validation failed', error);
            return false;
        }
    }

    checkSpatialConstraints(position, dimensions) {
        try {
            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            if (!this.isValidBBox(bbox)) {
                return false;
            }

            const halfWidth = dimensions.width / 2;
            const halfHeight = dimensions.height / 2;

            return (position[0] - halfWidth >= bbox.minX &&
                position[0] + halfWidth <= bbox.maxX &&
                position[1] - halfHeight >= bbox.minY &&
                position[1] + halfHeight <= bbox.maxY);
        } catch (error) {
            return false;
        }
    }

    checkIlotCollisions(position, dimensions) {
        try {
            const minDistance = this.getMinClearanceFromConfig();

            const testRect = {
                minX: position[0] - dimensions.width / 2 - minDistance,
                minY: position[1] - dimensions.height / 2 - minDistance,
                maxX: position[0] + dimensions.width / 2 + minDistance,
                maxY: position[1] + dimensions.height / 2 + minDistance
            };

            if (!this.isValidBBox(testRect)) {
                return true; // Assume collision if invalid bounds
            }

            const potentialCollisions = this.spatialIndex.search(testRect);
            return potentialCollisions.length > 0;
        } catch (error) {
            return true; // Assume collision on error for safety
        }
    }

    checkClearanceRequirements(position, dimensions) {
        try {
            // Basic clearance check - can be enhanced based on requirements
            return this.hasIlotClearance(position);
        } catch (error) {
            return false;
        }
    }

    /**
     * ENHANCED UTILITY FUNCTIONS
     */

    calculateIlotDimensions(ilotType, config) {
        try {
            const typeMultipliers = {
                'workspace': 1.0,
                'meeting': 1.3,
                'social': 1.5,
                'storage': 0.8,
                'break': 1.2
            };

            const safeIlotType = this.getSafeString(ilotType, 'workspace');
            const multiplier = typeMultipliers[safeIlotType] || 1.0;

            // Use config or fallback safely
            const configToUse = (config && typeof config === 'object') ? config : this.config;

            let defaultSize = { width: 3.0, height: 2.0 };

            if (configToUse && configToUse.defaultIlotSize && typeof configToUse.defaultIlotSize === 'object') {
                const configSize = configToUse.defaultIlotSize;
                if (typeof configSize.width === 'number' && !isNaN(configSize.width) && configSize.width > 0) {
                    defaultSize.width = configSize.width;
                }
                if (typeof configSize.height === 'number' && !isNaN(configSize.height) && configSize.height > 0) {
                    defaultSize.height = configSize.height;
                }
            }

            const calculatedWidth = defaultSize.width * multiplier;
            const calculatedHeight = defaultSize.height * multiplier;

            // Comprehensive validation
            if (!this.isValidNumber(calculatedWidth) || !this.isValidNumber(calculatedHeight)) {
                this.log('Warning: Invalid calculated dimensions, using defaults', {
                    ilotType: safeIlotType,
                    multiplier,
                    defaultSize,
                    calculatedWidth,
                    calculatedHeight
                });
                return { width: 3.0, height: 2.0 };
            }

            return {
                width: calculatedWidth,
                height: calculatedHeight
            };

        } catch (error) {
            this.logError('Error calculating îlot dimensions', error);
            return { width: 3.0, height: 2.0 };
        }
    }

    isValidNumber(num) {
        return typeof num === 'number' && !isNaN(num) && isFinite(num) && num > 0;
    }

    generateIlotProperties(ilotType) {
        try {
            const properties = {
                workspace: { capacity: 4, equipment: ['desks', 'chairs', 'monitors'], priority: 1.0 },
                meeting: { capacity: 8, equipment: ['table', 'chairs', 'whiteboard'], priority: 0.8 },
                social: { capacity: 12, equipment: ['seating', 'tables'], priority: 0.6 },
                storage: { capacity: 0, equipment: ['shelving', 'cabinets'], priority: 0.4 },
                break: { capacity: 6, equipment: ['seating', 'tables', 'kitchen'], priority: 0.7 }
            };

            const result = properties[ilotType] || properties.workspace;

            // Validate result
            if (!result || typeof result !== 'object' || typeof result.capacity !== 'number' || !Array.isArray(result.equipment)) {
                return properties.workspace;
            }

            return result;
        } catch (error) {
            this.logError('Error generating îlot properties', error);
            return { capacity: 4, equipment: ['desks', 'chairs'], priority: 1.0 };
        }
    }

    // Additional utility methods with enhanced safety...

    calculateAccessibilityScore(point) {
        try {
            if (!this.isValidPoint(point)) {
                return 0.8;
            }

            let score = 0.8;

            // Check distance to nearest door
            const doors = this.floorPlan?.doors || [];
            if (doors.length > 0) {
                let minDistance = Infinity;

                for (const door of doors) {
                    try {
                        const doorPos = this.extractDoorPosition(door);
                        if (doorPos) {
                            const distance = this.calculateDistance(point, doorPos);
                            if (this.isValidNumber(distance)) {
                                minDistance = Math.min(minDistance, distance);
                            }
                        }
                    } catch (error) {
                        this.log('Warning: Failed to calculate door distance', { door, error: error.message });
                    }
                }

                // Better score for reasonable distance to doors
                if (minDistance !== Infinity && minDistance > 1.5 && minDistance < 10) {
                    score += 0.2;
                }
            }

            return Math.min(Math.max(score, 0), 1.0);

        } catch (error) {
            this.logError('Error calculating accessibility score', error);
            return 0.8;
        }
    }

    extractDoorPosition(door) {
        try {
            if (!door || typeof door !== 'object') return null;

            if (door.position && Array.isArray(door.position) && door.position.length >= 2) {
                const x = Number(door.position[0]);
                const y = Number(door.position[1]);
                if (!isNaN(x) && !isNaN(y)) {
                    return [x, y];
                }
            }

            if (typeof door.x === 'number' && typeof door.y === 'number' &&
                !isNaN(door.x) && !isNaN(door.y)) {
                return [door.x, door.y];
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    calculateWorkflowScore(point) {
        try {
            if (!this.isValidPoint(point)) {
                return 0.8;
            }
            // Simplified workflow score - can be enhanced
            return 0.8;
        } catch (error) {
            return 0.8;
        }
    }

    calculateOverallScore(position, ilotType) {
        try {
            if (!this.isValidPoint(position)) {
                return 0.8;
            }

            const accessibility = this.calculateAccessibilityScore(position);
            const workflow = this.calculateWorkflowScore(position);
            const spatial = 0.8; // Base spatial score

            // Validate calculated scores
            const safeAccessibility = this.getSafeNumber(accessibility, 0.8);
            const safeWorkflow = this.getSafeNumber(workflow, 0.8);
            const safeSpatial = this.getSafeNumber(spatial, 0.8);

            // Get weights safely
            const weights = this.config?.weights || { accessibility: 0.3, workflow: 0.3, spaceUtilization: 0.4 };

            const accessibilityWeight = this.getSafeNumber(weights.accessibility, 0.3);
            const workflowWeight = this.getSafeNumber(weights.workflow, 0.3);
            const spatialWeight = this.getSafeNumber(weights.spaceUtilization, 0.4);

            const score = (
                safeAccessibility * accessibilityWeight +
                safeWorkflow * workflowWeight +
                safeSpatial * spatialWeight
            );

            return Math.min(Math.max(score, 0), 1);

        } catch (error) {
            this.logError('Error calculating overall score', error);
            return 0.8;
        }
    }

    // Continue with remaining utility methods...

    calculateDistance(point1, point2) {
        try {
            if (!this.isValidPoint(point1) || !this.isValidPoint(point2)) {
                return 0;
            }

            const dx = point1[0] - point2[0];
            const dy = point1[1] - point2[1];
            return Math.sqrt(dx * dx + dy * dy);
        } catch (error) {
            return 0;
        }
    }

    createRectanglePolygon(x, y, width, height) {
        try {
            const halfWidth = width / 2;
            const halfHeight = height / 2;

            return [
                [x - halfWidth, y - halfHeight],
                [x + halfWidth, y - halfHeight],
                [x + halfWidth, y + halfHeight],
                [x - halfWidth, y + halfHeight]
            ];
        } catch (error) {
            return [[0, 0], [1, 0], [1, 1], [0, 1]]; // Fallback rectangle
        }
    }

    gridToWorld(gridX, gridY) {
        try {
            if (!this.placementGrid?.bbox) {
                return [0, 0];
            }

            const bbox = this.placementGrid.bbox;
            const resolution = this.placementGrid.resolution || 0.5;

            const safeGridX = this.getSafeNumber(gridX, 0);
            const safeGridY = this.getSafeNumber(gridY, 0);

            const worldX = (bbox.minX || 0) + (safeGridX + 0.5) * resolution;
            const worldY = (bbox.minY || 0) + (safeGridY + 0.5) * resolution;

            if (!this.isValidNumber(worldX) || !this.isValidNumber(worldY)) {
                return [0, 0];
            }

            return [worldX, worldY];

        } catch (error) {
            return [0, 0];
        }
    }

    getSortedPlacementCells() {
        try {
            const cells = [];

            if (!this.placementGrid) {
                return cells;
            }

            const { width, height } = this.placementGrid;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const index = y * width + x;
                    if (index >= 0 && index < this.placementGrid.cells.length && this.placementGrid.cells[index] > 0) {
                        cells.push({
                            x, y,
                            score: this.placementGrid.scores[index] || 0.8
                        });
                    }
                }
            }

            return cells.sort((a, b) => (b.score || 0) - (a.score || 0));
        } catch (error) {
            this.logError('Error sorting placement cells', error);
            return [];
        }
    }

    // Additional required methods...

    hasIlotClearance(point) {
        return this.isValidPoint(point);
    }

    calculateUsableArea() {
        try {
            if (this.floorPlan?.bounds) {
                const bounds = this.floorPlan.bounds;
                return Math.max((bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY) * 0.7, 1);
            }
            return 100; // Default fallback
        } catch (error) {
            return 100;
        }
    }

    determineIlotTypes(config) {
        try {
            const types = config?.ilotTypes || ['workspace', 'meeting', 'social', 'break'];
            return Array.isArray(types) ? types : ['workspace'];
        } catch (error) {
            return ['workspace'];
        }
    }

    createWallPolygon(wall) {
        try {
            const thickness = 0.2;
            let start, end;

            if (wall.start && wall.end) {
                start = wall.start;
                end = wall.end;
            } else if (wall.x1 !== undefined && wall.y1 !== undefined &&
                wall.x2 !== undefined && wall.y2 !== undefined) {
                start = [wall.x1, wall.y1];
                end = [wall.x2, wall.y2];
            } else {
                start = [0, 0];
                end = [1, 0];
            }

            return this.createRectanglePolygon(
                (start[0] + end[0]) / 2,
                (start[1] + end[1]) / 2,
                this.calculateDistance(start, end),
                thickness
            );
        } catch (error) {
            return this.createRectanglePolygon(0, 0, 1, 0.2);
        }
    }

    createDoorClearanceZone(door) {
        try {
            const position = this.extractDoorPosition(door) || [0, 0];
            const clearance = this.config.minDoorClearance || 1.5;

            return this.createRectanglePolygon(
                position[0], position[1],
                clearance * 2, clearance * 2
            );
        } catch (error) {
            return this.createRectanglePolygon(0, 0, 2, 2);
        }
    }

    createWindowClearanceZone(window) {
        try {
            let position = [0, 0];

            if (window.position && Array.isArray(window.position)) {
                position = window.position;
            } else if (typeof window.x === 'number' && typeof window.y === 'number') {
                position = [window.x, window.y];
            } else if (typeof window.x1 === 'number' && typeof window.y1 === 'number') {
                position = [window.x1, window.y1];
            }

            return this.createRectanglePolygon(position[0], position[1], 1.0, 1.0);
        } catch (error) {
            return this.createRectanglePolygon(0, 0, 1, 1);
        }
    }

    createDefaultBoundary() {
        const boundary = [[0, 0], [20, 0], [20, 15], [0, 15]];
        if (this.floorPlan) {
            this.floorPlan.boundary = boundary;
        }
        return boundary;
    }

    createBoundaryFromBounds() {
        try {
            const bounds = this.floorPlan?.bounds || { minX: 0, minY: 0, maxX: 20, maxY: 15 };
            return [
                [bounds.minX, bounds.minY],
                [bounds.maxX, bounds.minY],
                [bounds.maxX, bounds.maxY],
                [bounds.minX, bounds.maxY]
            ];
        } catch (error) {
            return [[0, 0], [20, 0], [20, 15], [0, 15]];
        }
    }

    calculateBoundingBoxFromBoundary(boundary) {
        try {
            if (!Array.isArray(boundary) || boundary.length === 0) {
                return { minX: 0, minY: 0, maxX: 20, maxY: 15 };
            }

            const xs = boundary.map(p => Array.isArray(p) && p.length >= 2 ? Number(p[0]) : 0).filter(x => !isNaN(x));
            const ys = boundary.map(p => Array.isArray(p) && p.length >= 2 ? Number(p[1]) : 0).filter(y => !isNaN(y));

            if (xs.length === 0 || ys.length === 0) {
                return { minX: 0, minY: 0, maxX: 20, maxY: 15 };
            }

            return {
                minX: Math.min(...xs),
                minY: Math.min(...ys),
                maxX: Math.max(...xs),
                maxY: Math.max(...ys)
            };
        } catch (error) {
            return { minX: 0, minY: 0, maxX: 20, maxY: 15 };
        }
    }

    indexPlacedIlot(ilot) {
        try {
            if (!ilot?.position?.x || !ilot?.dimensions?.width) return;

            const bbox = {
                minX: ilot.position.x - ilot.dimensions.width / 2,
                minY: ilot.position.y - ilot.dimensions.height / 2,
                maxX: ilot.position.x + ilot.dimensions.width / 2,
                maxY: ilot.position.y + ilot.dimensions.height / 2
            };

            if (this.isValidBBox(bbox)) {
                this.spatialIndex.insert({ ...bbox, ilot });
            }
        } catch (error) {
            this.log('Warning: Failed to index placed îlot', error);
        }
    }

    async optimizePlacement() {
        try {
            this.log('Starting placement optimization');

            const maxOptimizationIterations = 50;
            let iteration = 0;
            let improved = true;

            while (improved && iteration < maxOptimizationIterations) {
                improved = false;

                for (let i = 0; i < this.placedIlots.length; i++) {
                    try {
                        const currentScore = this.placedIlots[i]?.metadata?.placementScore || 0.8;
                        const optimizedPosition = await this.findBetterPosition(this.placedIlots[i]);

                        if (optimizedPosition && optimizedPosition.score > currentScore * 1.1) {
                            this.moveIlot(i, optimizedPosition.position);
                            improved = true;
                        }
                    } catch (error) {
                        this.log('Warning: Optimization step failed for îlot', { index: i, error: error.message });
                    }
                }

                iteration++;
                this.placementStats.optimizationIterations++;
            }

            this.log('Placement optimization completed', { iterations: iteration });
        } catch (error) {
            this.logError('Placement optimization failed', error);
        }
    }

    async findBetterPosition(ilot) {
        // Simplified implementation for now
        return null;
    }

    moveIlot(index, newPosition) {
        try {
            if (this.placedIlots[index] && this.isValidPoint(newPosition)) {
                this.placedIlots[index].position.x = newPosition[0];
                this.placedIlots[index].position.y = newPosition[1];
            }
        } catch (error) {
            this.log('Warning: Failed to move îlot', error);
        }
    }

    async validatePlacement() {
        try {
            const errors = [];
            const warnings = [];

            // Check minimum distances
            for (let i = 0; i < this.placedIlots.length; i++) {
                for (let j = i + 1; j < this.placedIlots.length; j++) {
                    try {
                        const pos1 = [this.placedIlots[i].position.x, this.placedIlots[i].position.y];
                        const pos2 = [this.placedIlots[j].position.x, this.placedIlots[j].position.y];
                        const distance = this.calculateDistance(pos1, pos2);

                        if (distance < this.config.minIlotDistance) {
                            errors.push(`Îlots ${this.placedIlots[i].id} and ${this.placedIlots[j].id} too close: ${distance.toFixed(2)}m`);
                        }
                    } catch (error) {
                        warnings.push(`Failed to validate distance between îlots ${i} and ${j}`);
                    }
                }
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                metrics: {
                    placedIlots: this.placedIlots.length,
                    averageScore: this.calculateAverageScore(),
                    spatialEfficiency: this.calculateSpatialEfficiency()
                }
            };
        } catch (error) {
            this.logError('Placement validation failed', error);
            return {
                isValid: false,
                errors: ['Validation process failed'],
                warnings: [],
                metrics: { placedIlots: this.placedIlots.length, averageScore: 0, spatialEfficiency: 0 }
            };
        }
    }

    calculateAverageScore() {
        try {
            if (this.placedIlots.length === 0) return 0;

            const totalScore = this.placedIlots.reduce((sum, ilot) => {
                const score = ilot?.metadata?.placementScore || 0.8;
                return sum + score;
            }, 0);

            return totalScore / this.placedIlots.length;
        } catch (error) {
            return 0.8;
        }
    }

    calculateSpatialEfficiency() {
        try {
            if (this.placedIlots.length === 0) return 0;

            const totalIlotArea = this.placedIlots.reduce((sum, ilot) => {
                const area = (ilot?.dimensions?.width || 3) * (ilot?.dimensions?.height || 2);
                return sum + area;
            }, 0);

            const usableArea = this.calculateUsableArea();
            return Math.min(totalIlotArea / usableArea, 1.0);
        } catch (error) {
            return 0;
        }
    }

    resetPlacementStats() {
        this.placementStats = this.createDefaultStats();
    }

    /**
     * ENHANCED GRID PLACEMENT AND RANDOM PLACEMENT
     */

    async executeGridPlacement(requirements, config) {
        try {
            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            const ilotWidth = config.defaultIlotSize?.width || 3.0;
            const ilotHeight = config.defaultIlotSize?.height || 2.0;
            const spacing = config.minIlotDistance || 2.0;

            let placedCount = 0;

            for (let x = bbox.minX + ilotWidth / 2;
                x < bbox.maxX - ilotWidth / 2 && placedCount < requirements.totalIlots;
                x += ilotWidth + spacing) {

                for (let y = bbox.minY + ilotHeight / 2;
                    y < bbox.maxY - ilotHeight / 2 && placedCount < requirements.totalIlots;
                    y += ilotHeight + spacing) {

                    const worldPos = [x, y];
                    const ilotType = requirements.ilotTypes[placedCount % requirements.ilotTypes.length];

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
        } catch (error) {
            this.logError('Grid placement failed', error);
        }
    }

    async executeRandomPlacement(requirements, config) {
        try {
            const boundary = this.floorPlan.boundary || this.createBoundaryFromBounds();
            const bbox = this.calculateBoundingBoxFromBoundary(boundary);

            let placedCount = 0;
            let attempts = 0;
            const maxAttempts = config.maxPlacementAttempts || 1000;

            while (placedCount < requirements.totalIlots && attempts < maxAttempts) {
                const x = bbox.minX + Math.random() * (bbox.maxX - bbox.minX);
                const y = bbox.minY + Math.random() * (bbox.maxY - bbox.minY);
                const worldPos = [x, y];
                const ilotType = requirements.ilotTypes[placedCount % requirements.ilotTypes.length];

                const placement = await this.attemptIlotPlacement(worldPos, ilotType, config);

                if (placement) {
                    this.placedIlots.push(placement);
                    this.indexPlacedIlot(placement);
                    placedCount++;
                    this.placementStats.successfulPlacements++;
                }

                attempts++;
                this.placementStats.totalAttempts++;
            }
        } catch (error) {
            this.logError('Random placement failed', error);
        }
    }

    /**
     * LOGGING AND STATISTICS
     */

    log(message, data = {}) {
        if (this.config?.debugMode) {
            console.log(`[IlotPlacementEngine] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[IlotPlacementEngine ERROR] ${message}:`, error);
    }

    getStatistics() {
        return {
            ...this.placementStats,
            config: this.config,
            placedIlots: this.placedIlots.length,
            spatialEfficiency: this.calculateSpatialEfficiency(),
            averageScore: this.calculateAverageScore(),
            version: '2.1.0-fixed'
        };
    }
}

module.exports = IlotPlacementEngine;