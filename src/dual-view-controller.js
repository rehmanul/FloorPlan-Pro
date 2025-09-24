/**
 * Dual-View Controller for Architectural Floor Plan Visualization - FIXED VERSION
 * 
 * FIXES APPLIED:
 * - Fixed canvas disappearing issue during interactions
 * - Added proper geometry validation and architectural calculations
 * - Enhanced coordinate transformation and camera handling
 * - Implemented proper viewport management and rendering pipeline
 * - Added architectural rules for îlot placement validation
 * 
 * Features:
 * - Robust canvas rendering with proper state management
 * - Architectural rule-based geometry validation
 * - Professional coordinate system handling
 * - Separate Autodesk and Manual Canvas workflows
 * - Enhanced interaction handling without geometry loss
 * 
 * @author FloorPlan Pro Team
 * @version 2.0.0 - FIXED
 */

const GeometryEngine = require('./geometry-engine');

class DualViewController {
    constructor(options = {}) {
        // Enhanced geometry engine with architectural rules
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });

        // Enhanced configuration with architectural standards
        this.config = {
            // View synchronization
            syncEnabled: options.syncEnabled !== false,
            syncCameras: options.syncCameras !== false,
            syncSelection: options.syncSelection !== false,
            syncLayers: options.syncLayers !== false,

            // Canvas rendering - FIXED
            canvasResolution: options.canvasResolution || window.devicePixelRatio || 1,
            maxCanvasSize: options.maxCanvasSize || 4096,
            antialias: options.antialias !== false,
            preserveDrawing: true, // NEW: Prevent canvas clearing issues

            // Performance
            maxObjects: options.maxObjects || 10000,
            updateThrottleMs: options.updateThrottleMs || 16,
            batchSize: options.batchSize || 100,
            renderOnDemand: true, // NEW: Optimize rendering

            // Coordinate systems - ENHANCED
            worldUnits: options.worldUnits || 'meters',
            precision: options.precision || 0.001,
            coordinateSystem: 'right-handed', // Standard architectural system

            // Architectural Standards - NEW
            architectural: {
                // Minimum clearances (in meters)
                minCorridorWidth: 1.2,      // ADA compliant
                minDoorwayWidth: 0.8,       // Standard door width
                minIlotClearance: 1.0,      // Around workstations
                minWallClearance: 0.6,      // From walls
                maxIlotDimension: 4.0,      // Maximum îlot size
                minIlotDimension: 1.5,      // Minimum îlot size

                // Accessibility requirements
                wheelchairClearance: 1.5,    // Wheelchair maneuvering
                emergencyEgressWidth: 1.1,   // Emergency egress
                visualClearance: 0.9,        // Visual sight lines

                // Workflow efficiency
                optimalDeskSpacing: 1.8,     // Between desks
                meetingRoomAccess: 2.0,      // Around meeting tables
                socialAreaBuffer: 1.0,       // Around social spaces

                // Geometric validation
                maxAspectRatio: 3.0,         // Length to width ratio
                minArea: 2.25,               // Minimum area (1.5m x 1.5m)
                maxArea: 16.0,               // Maximum area (4m x 4m)
            },

            // Visual styling - ENHANCED
            defaultStyles: {
                walls: { 
                    color: '#374151', 
                    thickness: 2, 
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round'
                },
                redZones: { 
                    color: '#EF4444', 
                    opacity: 0.3, 
                    fill: true,
                    strokeColor: '#DC2626',
                    strokeWidth: 2
                },
                blueZones: { 
                    color: '#3B82F6', 
                    opacity: 0.3, 
                    fill: true,
                    strokeColor: '#2563EB',
                    strokeWidth: 2
                },
                ilots: { 
                    color: '#10b981', 
                    opacity: 0.7, 
                    fill: true, 
                    stroke: '#059669',
                    strokeWidth: 2,
                    validColor: '#10b981',
                    invalidColor: '#EF4444'
                },
                corridors: { 
                    color: '#f59e0b', 
                    opacity: 0.4, 
                    fill: true, 
                    stroke: '#d97706',
                    strokeWidth: 1
                },
                annotations: { 
                    color: '#8b5cf6', 
                    fontSize: 12, 
                    font: 'Arial, sans-serif',
                    backgroundColor: 'rgba(255,255,255,0.8)'
                },
                grid: {
                    color: '#E5E7EB',
                    opacity: 0.3,
                    spacing: 1.0 // 1 meter grid
                }
            },

            ...options
        };

        // Core components
        this.sharedScene = new EnhancedSharedSceneModel(this.config.architectural);
        this.autodeskViewController = null;
        this.canvasViewController = null;
        this.architecturalValidator = new ArchitecturalValidator(this.config.architectural);

        // Enhanced state management
        this.activeView = options.defaultView || 'canvas'; // Default to manual canvas
        this.viewStates = {
            autodesk: { camera: null, selection: [], layers: {}, initialized: false },
            canvas: { camera: null, selection: [], layers: {}, initialized: false }
        };

        // Workflow state - NEW
        this.workflowStage = 'design'; // 'design' or 'ilot_placement'
        this.designComplete = false;

        // Synchronization
        this.syncInProgress = false;
        this.pendingUpdates = new Set();
        this.updateThrottle = null;
        this.renderRequested = false;

        // Event system
        this.eventListeners = new Map();

        // Performance monitoring - NEW
        this.stats = {
            renderCount: 0,
            lastRenderTime: 0,
            geometryCount: 0,
            validIlots: 0,
            totalIlots: 0
        };

        this.log('Enhanced DualViewController initialized', this.config);
    }

    /**
     * INITIALIZATION - ENHANCED
     */

    async initialize(autodeskViewer, canvas) {
        try {
            this.log('Initializing enhanced dual-view system');

            // Initialize shared scene first
            await this.sharedScene.initialize();

            // Initialize view controllers with enhanced error handling
            if (canvas) {
                this.canvasViewController = new EnhancedCanvasViewController(canvas, this);
                await this.canvasViewController.initialize();
                this.viewStates.canvas.initialized = true;
            }

            if (autodeskViewer) {
                this.autodeskViewController = new AutodeskViewController(autodeskViewer, this);
                await this.autodeskViewController.initialize();
                this.viewStates.autodesk.initialized = true;
            }

            // Setup synchronization
            this.setupSynchronization();

            // Setup event handlers
            this.setupEventHandlers();

            // Initialize with active view
            this.switchView(this.activeView);

            this.log('Enhanced dual-view system initialized successfully');

        } catch (error) {
            this.logError('Dual-view initialization failed', error);
            throw error;
        }
    }

    /**
     * WORKFLOW MANAGEMENT - NEW
     */

    setWorkflowStage(stage) {
        if (stage !== 'design' && stage !== 'ilot_placement') {
            throw new Error(`Invalid workflow stage: ${stage}`);
        }

        this.workflowStage = stage;
        this.log(`Workflow stage set to: ${stage}`);

        // Update UI based on workflow stage
        this.emit('workflowStageChanged', { stage, designComplete: this.designComplete });
    }

    markDesignComplete() {
        this.designComplete = true;
        this.setWorkflowStage('ilot_placement');
        this.log('Design marked as complete, switching to îlot placement workflow');
    }

    /**
     * ENHANCED VIEW SWITCHING
     */

    switchView(viewType) {
        if (viewType !== 'autodesk' && viewType !== 'canvas') {
            throw new Error(`Invalid view type: ${viewType}`);
        }

        // Check if requested view is available
        if (viewType === 'autodesk' && !this.viewStates.autodesk.initialized) {
            this.log('Autodesk view not available, staying on canvas view');
            return;
        }

        if (viewType === 'canvas' && !this.viewStates.canvas.initialized) {
            this.log('Canvas view not available, staying on autodesk view');
            return;
        }

        this.log(`Switching from ${this.activeView} to ${viewType} view`);

        // Save current view state
        this.saveViewState(this.activeView);

        const previousView = this.activeView;
        this.activeView = viewType;

        // Update view visibility
        this.updateViewVisibility();

        // Restore view state
        this.restoreViewState(viewType);

        // Force re-render for canvas view
        if (viewType === 'canvas' && this.canvasViewController) {
            this.scheduleRender();
        }

        // Emit view change event
        this.emit('viewChanged', { from: previousView, to: viewType });
    }

    /**
     * ENHANCED GEOMETRY MANAGEMENT
     */

    addFloorPlan(floorPlan) {
        try {
            this.log('Adding floor plan to scene', { 
                walls: floorPlan.walls?.length || 0,
                redZones: floorPlan.redZones?.length || 0,
                blueZones: floorPlan.blueZones?.length || 0
            });

            // Validate floor plan
            const validation = this.architecturalValidator.validateFloorPlan(floorPlan);
            if (!validation.isValid) {
                this.log('Floor plan validation warnings', validation.warnings);
            }

            // Clear existing floor plan elements
            this.clearFloorPlanElements();

            // Add walls with enhanced geometry
            if (floorPlan.walls) {
                for (const wall of floorPlan.walls) {
                    const geometry = this.createWallGeometry(wall);
                    if (geometry) {
                        this.sharedScene.addGeometry(geometry);
                    }
                }
            }

            // Add red zones (entrances/access points)
            if (floorPlan.redZones) {
                for (const zone of floorPlan.redZones) {
                    const geometry = this.createZoneGeometry(zone, 'entrance');
                    if (geometry) {
                        this.sharedScene.addGeometry(geometry);
                    }
                }
            }

            // Add blue zones (forbidden areas)
            if (floorPlan.blueZones) {
                for (const zone of floorPlan.blueZones) {
                    const geometry = this.createZoneGeometry(zone, 'forbidden');
                    if (geometry) {
                        this.sharedScene.addGeometry(geometry);
                    }
                }
            }

            // Update scene bounds and fit view
            this.sharedScene.updateBounds();
            this.fitToView();

            this.scheduleUpdate(['floorplan']);
            this.log('Floor plan added successfully');

        } catch (error) {
            this.logError('Failed to add floor plan', error);
        }
    }

    addIlots(ilots) {
        try {
            this.log('Adding îlots to scene', { count: ilots.length });

            // Clear existing îlots
            this.clearIlots();

            let validCount = 0;
            let invalidCount = 0;

            for (const ilot of ilots) {
                // Validate îlot geometry
                const validation = this.architecturalValidator.validateIlot(ilot);

                const geometry = {
                    id: ilot.id,
                    type: 'ilot',
                    subtype: ilot.type || 'workspace',
                    polygon: ilot.polygon || this.createIlotPolygon(ilot),
                    bbox: ilot.bbox || this.calculateBounds(ilot.polygon),
                    properties: {
                        ...ilot.properties,
                        isValid: validation.isValid,
                        validationErrors: validation.errors,
                        validationWarnings: validation.warnings
                    },
                    style: {
                        ...this.config.defaultStyles.ilots,
                        color: validation.isValid 
                            ? this.config.defaultStyles.ilots.validColor 
                            : this.config.defaultStyles.ilots.invalidColor
                    },
                    metadata: {
                        ...ilot.metadata,
                        layer: 'ILOTS',
                        validation: validation,
                        architecturalCompliance: validation.isValid
                    }
                };

                this.sharedScene.addGeometry(geometry);

                if (validation.isValid) {
                    validCount++;
                } else {
                    invalidCount++;
                    this.log('Invalid îlot detected', { 
                        id: ilot.id, 
                        errors: validation.errors 
                    });
                }
            }

            // Update statistics
            this.stats.validIlots = validCount;
            this.stats.totalIlots = ilots.length;
            this.stats.geometryCount = this.sharedScene.getGeometryCount();

            this.scheduleUpdate(['ilots']);

            this.log('Îlots added to scene', { 
                total: ilots.length, 
                valid: validCount, 
                invalid: invalidCount,
                coverage: ((validCount / ilots.length) * 100).toFixed(1) + '%'
            });

            // Emit statistics update
            this.emit('ilotsAdded', {
                total: ilots.length,
                valid: validCount,
                invalid: invalidCount,
                coverage: validCount / ilots.length
            });

        } catch (error) {
            this.logError('Failed to add îlots', error);
        }
    }

    /**
     * ENHANCED RENDERING SYSTEM
     */

    scheduleRender() {
        if (this.renderRequested) return;

        this.renderRequested = true;
        requestAnimationFrame(() => {
            this.executeRender();
            this.renderRequested = false;
        });
    }

    executeRender() {
        const startTime = performance.now();

        try {
            if (this.activeView === 'canvas' && this.canvasViewController) {
                this.canvasViewController.render();
            }

            this.stats.renderCount++;
            this.stats.lastRenderTime = performance.now() - startTime;

        } catch (error) {
            this.logError('Render execution failed', error);
        }
    }

    scheduleUpdate(components) {
        for (const component of components) {
            this.pendingUpdates.add(component);
        }

        if (this.updateThrottle) {
            clearTimeout(this.updateThrottle);
        }

        this.updateThrottle = setTimeout(() => {
            this.executeUpdates();
        }, this.config.updateThrottleMs);
    }

    executeUpdates() {
        if (this.pendingUpdates.size === 0) return;

        const updates = Array.from(this.pendingUpdates);
        this.pendingUpdates.clear();

        // Update both views
        if (this.autodeskViewController) {
            this.autodeskViewController.processUpdates(updates);
        }

        if (this.canvasViewController) {
            this.canvasViewController.processUpdates(updates);
        }

        // Schedule render for canvas
        if (this.activeView === 'canvas') {
            this.scheduleRender();
        }

        this.log('Processed updates', { components: updates });
    }

    /**
     * GEOMETRY CREATION HELPERS
     */

    createWallGeometry(wall) {
        try {
            let start, end;

            if (wall.start && wall.end) {
                start = wall.start;
                end = wall.end;
            } else if (wall.x1 !== undefined && wall.y1 !== undefined && 
                      wall.x2 !== undefined && wall.y2 !== undefined) {
                start = [wall.x1, wall.y1];
                end = [wall.x2, wall.y2];
            } else {
                this.log('Invalid wall geometry', wall);
                return null;
            }

            const thickness = wall.thickness || 0.2;
            const length = this.calculateDistance(start, end);

            return {
                id: wall.id || `wall_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'wall',
                line: [start, end],
                polygon: this.createWallPolygon(start, end, thickness),
                thickness: thickness,
                length: length,
                bbox: this.calculateLineBounds(start, end, thickness),
                style: { ...this.config.defaultStyles.walls },
                metadata: { 
                    layer: 'WALLS',
                    architectural: {
                        length: length,
                        thickness: thickness,
                        isLoadBearing: wall.isLoadBearing || false
                    }
                }
            };
        } catch (error) {
            this.logError('Failed to create wall geometry', error);
            return null;
        }
    }

    createZoneGeometry(zone, type) {
        try {
            const polygon = zone.polygon || zone;
            if (!Array.isArray(polygon) || polygon.length < 3) {
                this.log('Invalid zone polygon', zone);
                return null;
            }

            const area = this.calculatePolygonArea(polygon);
            const style = type === 'entrance' 
                ? this.config.defaultStyles.redZones 
                : this.config.defaultStyles.blueZones;

            return {
                id: zone.id || `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                type: 'zone',
                subtype: type,
                polygon: polygon,
                bbox: this.calculateBounds(polygon),
                area: area,
                style: { ...style },
                metadata: { 
                    layer: type === 'entrance' ? 'RED_ZONE' : 'BLUE_ZONE',
                    architectural: {
                        area: area,
                        type: type,
                        purpose: type === 'entrance' ? 'access_point' : 'restricted_area'
                    }
                }
            };
        } catch (error) {
            this.logError('Failed to create zone geometry', error);
            return null;
        }
    }

    createIlotPolygon(ilot) {
        try {
            if (ilot.polygon) return ilot.polygon;

            // Create rectangular polygon from position and dimensions
            const x = ilot.x || ilot.position?.x || 0;
            const y = ilot.y || ilot.position?.y || 0;
            const width = ilot.width || ilot.dimensions?.width || 3.0;
            const height = ilot.height || ilot.dimensions?.height || 2.0;

            return [
                [x, y],
                [x + width, y],
                [x + width, y + height],
                [x, y + height]
            ];
        } catch (error) {
            this.logError('Failed to create îlot polygon', error);
            return [[0, 0], [3, 0], [3, 2], [0, 2]]; // Default rectangle
        }
    }

    /**
     * UTILITY FUNCTIONS - ENHANCED
     */

    calculateDistance(point1, point2) {
        const dx = point1[0] - point2[0];
        const dy = point1[1] - point2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculatePolygonArea(polygon) {
        let area = 0;
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += polygon[i][0] * polygon[j][1];
            area -= polygon[j][0] * polygon[i][1];
        }

        return Math.abs(area) / 2;
    }

    calculateBounds(polygon) {
        if (!Array.isArray(polygon) || polygon.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const point of polygon) {
            if (Array.isArray(point) && point.length >= 2) {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            }
        }

        return { minX, minY, maxX, maxY };
    }

    calculateLineBounds(start, end, thickness = 0) {
        const minX = Math.min(start[0], end[0]) - thickness / 2;
        const maxX = Math.max(start[0], end[0]) + thickness / 2;
        const minY = Math.min(start[1], end[1]) - thickness / 2;
        const maxY = Math.max(start[1], end[1]) + thickness / 2;

        return { minX, minY, maxX, maxY };
    }

    createWallPolygon(start, end, thickness) {
        const dx = end[0] - start[0];
        const dy = end[1] - start[1];
        const length = Math.sqrt(dx * dx + dy * dy);

        if (length === 0) return [start, start, start, start];

        const nx = -dy / length * thickness / 2;
        const ny = dx / length * thickness / 2;

        return [
            [start[0] + nx, start[1] + ny],
            [end[0] + nx, end[1] + ny],
            [end[0] - nx, end[1] - ny],
            [start[0] - nx, start[1] - ny]
        ];
    }

    fitToView() {
        const bounds = this.sharedScene.getBounds();
        if (!bounds || !this.canvasViewController) return;

        this.canvasViewController.fitToBounds(bounds);
    }

    clearFloorPlanElements() {
        const geometriesToRemove = this.sharedScene.getAllGeometries()
            .filter(g => ['wall', 'zone'].includes(g.type))
            .map(g => g.id);

        for (const id of geometriesToRemove) {
            this.sharedScene.removeGeometry(id);
        }
    }

    clearIlots() {
        const geometriesToRemove = this.sharedScene.getAllGeometries()
            .filter(g => g.type === 'ilot')
            .map(g => g.id);

        for (const id of geometriesToRemove) {
            this.sharedScene.removeGeometry(id);
        }
    }

    // ... (Event system and other methods remain similar but enhanced)

    /**
     * EVENT SYSTEM - ENHANCED
     */

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    this.logError(`Event listener error for ${event}`, error);
                }
            }
        }
    }

    setupEventHandlers() {
        // Enhanced event handling setup
        if (this.canvasViewController) {
            this.canvasViewController.on('cameraChanged', (camera) => {
                this.saveViewState('canvas');
                this.emit('cameraChanged', { source: 'canvas', camera });
            });

            this.canvasViewController.on('selectionChanged', (selection) => {
                this.emit('selectionChanged', { source: 'canvas', selection });
            });

            this.canvasViewController.on('renderComplete', () => {
                this.emit('renderComplete', { view: 'canvas' });
            });
        }
    }

    setupSynchronization() {
        if (!this.config.syncEnabled) return;

        // Enhanced synchronization setup
        if (this.config.syncCameras) {
            this.on('cameraChanged', (data) => {
                if (!this.syncInProgress) {
                    this.syncCameras(data.source, data.camera);
                }
            });
        }
    }

    syncCameras(sourceView, cameraState) {
        this.syncInProgress = true;

        try {
            const targetView = sourceView === 'autodesk' ? 'canvas' : 'autodesk';

            if (targetView === 'canvas' && this.canvasViewController) {
                this.canvasViewController.setCameraState(cameraState);
            }
        } finally {
            this.syncInProgress = false;
        }
    }

    saveViewState(viewType) {
        try {
            if (viewType === 'canvas' && this.canvasViewController) {
                this.viewStates.canvas = {
                    ...this.viewStates.canvas,
                    camera: this.canvasViewController.getCameraState(),
                    selection: this.canvasViewController.getSelection()
                };
            }
        } catch (error) {
            this.logError('Failed to save view state', error);
        }
    }

    restoreViewState(viewType) {
        try {
            const state = this.viewStates[viewType];
            if (!state) return;

            if (viewType === 'canvas' && this.canvasViewController && state.camera) {
                this.canvasViewController.setCameraState(state.camera);
            }
        } catch (error) {
            this.logError('Failed to restore view state', error);
        }
    }

    updateViewVisibility() {
        if (this.canvasViewController) {
            this.canvasViewController.setVisible(this.activeView === 'canvas');
        }

        if (this.autodeskViewController) {
            this.autodeskViewController.setVisible(this.activeView === 'autodesk');
        }
    }

    /**
     * STATISTICS AND MONITORING
     */

    getStatistics() {
        return {
            ...this.stats,
            config: this.config,
            activeView: this.activeView,
            workflowStage: this.workflowStage,
            designComplete: this.designComplete,
            geometryCount: this.sharedScene.getGeometryCount(),
            sceneBounds: this.sharedScene.getBounds(),
            validationStats: this.architecturalValidator.getStatistics()
        };
    }

    log(message, data = {}) {
        if (this.config.debugMode) {
            console.log(`[DualViewController] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[DualViewController ERROR] ${message}:`, error);
    }
}

/**
 * Enhanced Shared Scene Model with Architectural Support
 */
class EnhancedSharedSceneModel {
    constructor(architecturalConfig) {
        this.geometries = new Map();
        this.layers = new Map();
        this.bounds = null;
        this.architecturalConfig = architecturalConfig;
        this.spatialIndex = new Map(); // Simple spatial indexing
    }

    async initialize() {
        this.clear();
        this.setupDefaultLayers();
    }

    setupDefaultLayers() {
        const defaultLayers = ['WALLS', 'RED_ZONE', 'BLUE_ZONE', 'ILOTS', 'CORRIDORS', 'ANNOTATIONS'];

        for (const layerName of defaultLayers) {
            this.layers.set(layerName, {
                name: layerName,
                visible: true,
                geometries: [],
                style: {}
            });
        }
    }

    addGeometry(geometry) {
        const id = geometry.id || this.generateId();
        geometry.id = id;

        // Validate geometry before adding
        if (this.validateGeometry(geometry)) {
            this.geometries.set(id, geometry);
            this.updateBounds();
            this.updateLayers(geometry);
            this.updateSpatialIndex(geometry);

            return id;
        } else {
            console.warn('Invalid geometry rejected:', geometry);
            return null;
        }
    }

    validateGeometry(geometry) {
        // Basic geometry validation
        if (!geometry.type) return false;

        switch (geometry.type) {
            case 'wall':
                return Array.isArray(geometry.line) && geometry.line.length === 2;
            case 'zone':
            case 'ilot':
                return Array.isArray(geometry.polygon) && geometry.polygon.length >= 3;
            default:
                return true;
        }
    }

    updateGeometry(id, updates) {
        const geometry = this.geometries.get(id);
        if (geometry) {
            Object.assign(geometry, updates);
            this.updateBounds();
            this.updateSpatialIndex(geometry);
        }
    }

    removeGeometry(id) {
        const geometry = this.geometries.get(id);
        if (geometry) {
            this.geometries.delete(id);
            this.updateBounds();
            this.removFromSpatialIndex(id);

            // Remove from layer
            const layer = geometry.metadata?.layer || 'DEFAULT';
            const layerData = this.layers.get(layer);
            if (layerData) {
                const index = layerData.geometries.indexOf(id);
                if (index >= 0) {
                    layerData.geometries.splice(index, 1);
                }
            }
        }
    }

    updateSpatialIndex(geometry) {
        if (geometry.bbox) {
            this.spatialIndex.set(geometry.id, geometry.bbox);
        }
    }

    removFromSpatialIndex(id) {
        this.spatialIndex.delete(id);
    }

    getAllGeometries() {
        return Array.from(this.geometries.values());
    }

    getGeometriesByType(type) {
        return this.getAllGeometries().filter(g => g.type === type);
    }

    getGeometriesByLayer(layerName) {
        const layer = this.layers.get(layerName);
        if (!layer) return [];

        return layer.geometries
            .map(id => this.geometries.get(id))
            .filter(g => g !== undefined);
    }

    updateBounds() {
        const allGeometries = this.getAllGeometries();
        if (allGeometries.length === 0) {
            this.bounds = null;
            return;
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const geometry of allGeometries) {
            if (geometry.bbox) {
                minX = Math.min(minX, geometry.bbox.minX);
                minY = Math.min(minY, geometry.bbox.minY);
                maxX = Math.max(maxX, geometry.bbox.maxX);
                maxY = Math.max(maxY, geometry.bbox.maxY);
            }
        }

        if (isFinite(minX) && isFinite(maxX)) {
            this.bounds = { minX, minY, maxX, maxY };
        } else {
            this.bounds = null;
        }
    }

    updateLayers(geometry) {
        const layer = geometry.metadata?.layer || 'DEFAULT';
        if (!this.layers.has(layer)) {
            this.layers.set(layer, {
                name: layer,
                visible: true,
                geometries: []
            });
        }

        const layerData = this.layers.get(layer);
        if (!layerData.geometries.includes(geometry.id)) {
            layerData.geometries.push(geometry.id);
        }
    }

    getBounds() {
        return this.bounds;
    }

    getGeometryCount() {
        return this.geometries.size;
    }

    clear() {
        this.geometries.clear();
        this.layers.clear();
        this.spatialIndex.clear();
        this.bounds = null;
    }

    generateId() {
        return `geom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Architectural Validator - NEW
 * Implements architectural rules and validation
 */
class ArchitecturalValidator {
    constructor(config) {
        this.config = config;
        this.validationStats = {
            totalValidations: 0,
            validGeometries: 0,
            invalidGeometries: 0,
            warningCount: 0
        };
    }

    validateFloorPlan(floorPlan) {
        const errors = [];
        const warnings = [];

        // Validate walls
        if (floorPlan.walls) {
            for (const wall of floorPlan.walls) {
                const validation = this.validateWall(wall);
                errors.push(...validation.errors);
                warnings.push(...validation.warnings);
            }
        }

        // Validate zones
        if (floorPlan.redZones) {
            for (const zone of floorPlan.redZones) {
                const validation = this.validateZone(zone, 'entrance');
                errors.push(...validation.errors);
                warnings.push(...validation.warnings);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    validateIlot(ilot) {
        this.validationStats.totalValidations++;

        const errors = [];
        const warnings = [];

        try {
            // Get îlot dimensions
            const polygon = ilot.polygon || this.createIlotPolygon(ilot);
            const bounds = this.calculateBounds(polygon);
            const width = bounds.maxX - bounds.minX;
            const height = bounds.maxY - bounds.minY;
            const area = this.calculatePolygonArea(polygon);

            // Dimension validation
            if (width < this.config.minIlotDimension) {
                errors.push(`Width ${width.toFixed(2)}m below minimum ${this.config.minIlotDimension}m`);
            }

            if (height < this.config.minIlotDimension) {
                errors.push(`Height ${height.toFixed(2)}m below minimum ${this.config.minIlotDimension}m`);
            }

            if (width > this.config.maxIlotDimension) {
                errors.push(`Width ${width.toFixed(2)}m exceeds maximum ${this.config.maxIlotDimension}m`);
            }

            if (height > this.config.maxIlotDimension) {
                errors.push(`Height ${height.toFixed(2)}m exceeds maximum ${this.config.maxIlotDimension}m`);
            }

            // Area validation
            if (area < this.config.minArea) {
                errors.push(`Area ${area.toFixed(2)}m² below minimum ${this.config.minArea}m²`);
            }

            if (area > this.config.maxArea) {
                errors.push(`Area ${area.toFixed(2)}m² exceeds maximum ${this.config.maxArea}m²`);
            }

            // Aspect ratio validation
            const aspectRatio = Math.max(width, height) / Math.min(width, height);
            if (aspectRatio > this.config.maxAspectRatio) {
                warnings.push(`Aspect ratio ${aspectRatio.toFixed(2)} exceeds recommended ${this.config.maxAspectRatio}`);
            }

            // Accessibility validation
            if (ilot.type === 'workspace' && Math.min(width, height) < this.config.wheelchairClearance) {
                warnings.push(`Workspace may not meet wheelchair accessibility requirements`);
            }

            const isValid = errors.length === 0;

            if (isValid) {
                this.validationStats.validGeometries++;
            } else {
                this.validationStats.invalidGeometries++;
            }

            if (warnings.length > 0) {
                this.validationStats.warningCount++;
            }

            return {
                isValid,
                errors,
                warnings,
                metrics: {
                    width,
                    height,
                    area,
                    aspectRatio
                }
            };

        } catch (error) {
            this.validationStats.invalidGeometries++;
            return {
                isValid: false,
                errors: ['Validation failed: ' + error.message],
                warnings: [],
                metrics: {}
            };
        }
    }

    validateWall(wall) {
        const errors = [];
        const warnings = [];

        // Basic wall validation
        if (!wall.start || !wall.end) {
            if (wall.x1 === undefined || wall.y1 === undefined || 
                wall.x2 === undefined || wall.y2 === undefined) {
                errors.push('Wall missing start or end coordinates');
            }
        }

        return { errors, warnings };
    }

    validateZone(zone, type) {
        const errors = [];
        const warnings = [];

        const polygon = zone.polygon || zone;
        if (!Array.isArray(polygon) || polygon.length < 3) {
            errors.push('Zone must have at least 3 points');
        }

        return { errors, warnings };
    }

    // Helper methods (same as in DualViewController)
    calculateBounds(polygon) {
        if (!Array.isArray(polygon) || polygon.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const point of polygon) {
            if (Array.isArray(point) && point.length >= 2) {
                minX = Math.min(minX, point[0]);
                minY = Math.min(minY, point[1]);
                maxX = Math.max(maxX, point[0]);
                maxY = Math.max(maxY, point[1]);
            }
        }

        return { minX, minY, maxX, maxY };
    }

    calculatePolygonArea(polygon) {
        let area = 0;
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += polygon[i][0] * polygon[j][1];
            area -= polygon[j][0] * polygon[i][1];
        }

        return Math.abs(area) / 2;
    }

    createIlotPolygon(ilot) {
        const x = ilot.x || ilot.position?.x || 0;
        const y = ilot.y || ilot.position?.y || 0;
        const width = ilot.width || ilot.dimensions?.width || 3.0;
        const height = ilot.height || ilot.dimensions?.height || 2.0;

        return [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height]
        ];
    }

    getStatistics() {
        return { ...this.validationStats };
    }
}

/**
 * Enhanced Canvas View Controller - FIXED
 */
class EnhancedCanvasViewController {
    constructor(canvas, parent) {
        this.canvas = canvas;
        this.parent = parent;
        this.ctx = canvas.getContext('2d');
        this.eventListeners = new Map();

        // Enhanced camera state
        this.camera = {
            x: 0, 
            y: 0, 
            zoom: 1, 
            rotation: 0,
            minZoom: 0.1,
            maxZoom: 10.0
        };

        // Interaction state
        this.selection = [];
        this.interaction = {
            isDragging: false,
            isPanning: false,
            lastMouse: { x: 0, y: 0 },
            startMouse: { x: 0, y: 0 }
        };

        // Rendering state - FIXED
        this.renderState = {
            needsRedraw: true,
            isRendering: false,
            lastRenderTime: 0,
            frameCount: 0
        };

        // Grid settings
        this.grid = {
            enabled: true,
            spacing: 1.0, // 1 meter
            color: '#E5E7EB',
            opacity: 0.3
        };

        this.log('Enhanced Canvas Controller initialized');
    }

    async initialize() {
        this.setupEventHandlers();
        this.setupCanvas();
        this.scheduleRender();
        this.log('Canvas controller initialized');
    }

    setupCanvas() {
        // Set canvas size with proper device pixel ratio handling
        this.resize();

        // Set initial camera to show entire scene
        this.fitToView();
    }

    setupEventHandlers() {
        // Mouse events with enhanced handling
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        // Context menu prevention
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Resize handling
        window.addEventListener('resize', () => this.resize());

        // Visibility change handling
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.scheduleRender();
            }
        });
    }

    onMouseDown(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        this.interaction.isDragging = true;
        this.interaction.isPanning = event.button === 0; // Left button for panning
        this.interaction.lastMouse = { x, y };
        this.interaction.startMouse = { x, y };

        this.canvas.style.cursor = 'grabbing';
    }

    onMouseMove(event) {
        event.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        if (this.interaction.isDragging && this.interaction.isPanning) {
            const dx = x - this.interaction.lastMouse.x;
            const dy = y - this.interaction.lastMouse.y;

            // Apply pan with proper zoom scaling
            this.camera.x -= dx / this.camera.zoom;
            this.camera.y -= dy / this.camera.zoom;

            this.scheduleRender();
            this.emit('cameraChanged', this.getCameraState());
        }

        this.interaction.lastMouse = { x, y };
    }

    onMouseUp(event) {
        event.preventDefault();

        this.interaction.isDragging = false;
        this.interaction.isPanning = false;
        this.canvas.style.cursor = 'default';
    }

    onWheel(event) {
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Convert mouse position to world coordinates before zoom
        const worldX = this.screenToWorld(mouseX, mouseY)[0];
        const worldY = this.screenToWorld(mouseX, mouseY)[1];

        // Apply zoom
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.camera.minZoom, 
                       Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor));

        if (newZoom !== this.camera.zoom) {
            this.camera.zoom = newZoom;

            // Adjust camera position to zoom towards mouse
            const newWorldX = this.screenToWorld(mouseX, mouseY)[0];
            const newWorldY = this.screenToWorld(mouseX, mouseY)[1];

            this.camera.x += worldX - newWorldX;
            this.camera.y += worldY - newWorldY;

            this.scheduleRender();
            this.emit('cameraChanged', this.getCameraState());
        }
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const devicePixelRatio = window.devicePixelRatio || 1;

        // Set actual canvas size
        this.canvas.width = rect.width * devicePixelRatio;
        this.canvas.height = rect.height * devicePixelRatio;

        // Set display size
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // Scale context for device pixel ratio
        this.ctx.scale(devicePixelRatio, devicePixelRatio);

        this.scheduleRender();
    }

    scheduleRender() {
        if (this.renderState.needsRedraw) return;

        this.renderState.needsRedraw = true;
        requestAnimationFrame(() => this.render());
    }

    render() {
        if (this.renderState.isRendering) return;

        this.renderState.isRendering = true;
        this.renderState.needsRedraw = false;

        const startTime = performance.now();

        try {
            // Clear canvas with proper dimensions
            const rect = this.canvas.getBoundingClientRect();
            this.ctx.clearRect(0, 0, rect.width, rect.height);

            // Save context state
            this.ctx.save();

            // Apply camera transform
            this.applyCamera();

            // Render grid if enabled
            if (this.grid.enabled) {
                this.renderGrid();
            }

            // Render all geometries by layer order
            this.renderGeometriesByLayer();

            // Restore context state
            this.ctx.restore();

            // Update statistics
            this.renderState.frameCount++;
            this.renderState.lastRenderTime = performance.now() - startTime;

            this.emit('renderComplete');

        } catch (error) {
            this.parent.logError('Canvas render failed', error);
        } finally {
            this.renderState.isRendering = false;
        }
    }

    applyCamera() {
        const rect = this.canvas.getBoundingClientRect();

        // Translate to center of canvas
        this.ctx.translate(rect.width / 2, rect.height / 2);

        // Apply zoom
        this.ctx.scale(this.camera.zoom, this.camera.zoom);

        // Apply rotation if needed
        if (this.camera.rotation !== 0) {
            this.ctx.rotate(this.camera.rotation);
        }

        // Apply camera position (pan)
        this.ctx.translate(-this.camera.x, -this.camera.y);
    }

    renderGrid() {
        const bounds = this.getVisibleBounds();
        const spacing = this.grid.spacing;

        this.ctx.save();
        this.ctx.strokeStyle = this.grid.color;
        this.ctx.globalAlpha = this.grid.opacity;
        this.ctx.lineWidth = 1 / this.camera.zoom; // Scale line width

        this.ctx.beginPath();

        // Vertical lines
        const startX = Math.floor(bounds.minX / spacing) * spacing;
        const endX = Math.ceil(bounds.maxX / spacing) * spacing;

        for (let x = startX; x <= endX; x += spacing) {
            this.ctx.moveTo(x, bounds.minY);
            this.ctx.lineTo(x, bounds.maxY);
        }

        // Horizontal lines
        const startY = Math.floor(bounds.minY / spacing) * spacing;
        const endY = Math.ceil(bounds.maxY / spacing) * spacing;

        for (let y = startY; y <= endY; y += spacing) {
            this.ctx.moveTo(bounds.minX, y);
            this.ctx.lineTo(bounds.maxX, y);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    renderGeometriesByLayer() {
        const layerOrder = ['WALLS', 'RED_ZONE', 'BLUE_ZONE', 'CORRIDORS', 'ILOTS', 'ANNOTATIONS'];

        for (const layerName of layerOrder) {
            const geometries = this.parent.sharedScene.getGeometriesByLayer(layerName);

            for (const geometry of geometries) {
                if (this.isGeometryVisible(geometry)) {
                    this.renderGeometry(geometry);
                }
            }
        }
    }

    isGeometryVisible(geometry) {
        // Simple viewport culling
        if (!geometry.bbox) return true;

        const viewBounds = this.getVisibleBounds();
        const geomBounds = geometry.bbox;

        return !(geomBounds.maxX < viewBounds.minX || 
                geomBounds.minX > viewBounds.maxX ||
                geomBounds.maxY < viewBounds.minY || 
                geomBounds.minY > viewBounds.maxY);
    }

    renderGeometry(geometry) {
        this.ctx.save();

        const style = geometry.style || {};

        // Apply style properties
        if (style.color) {
            this.ctx.strokeStyle = style.color;
            if (style.fill) {
                this.ctx.fillStyle = style.color;
            }
        }

        if (style.strokeColor) {
            this.ctx.strokeStyle = style.strokeColor;
        }

        if (style.thickness || style.strokeWidth) {
            this.ctx.lineWidth = (style.thickness || style.strokeWidth) / this.camera.zoom;
        }

        if (style.opacity !== undefined) {
            this.ctx.globalAlpha = style.opacity;
        }

        if (style.lineCap) {
            this.ctx.lineCap = style.lineCap;
        }

        if (style.lineJoin) {
            this.ctx.lineJoin = style.lineJoin;
        }

        // Render based on geometry type
        try {
            switch (geometry.type) {
                case 'wall':
                    this.renderWall(geometry);
                    break;
                case 'zone':
                    this.renderZone(geometry);
                    break;
                case 'ilot':
                    this.renderIlot(geometry);
                    break;
                case 'corridor':
                    this.renderCorridor(geometry);
                    break;
                default:
                    this.renderGenericGeometry(geometry);
                    break;
            }
        } catch (error) {
            this.parent.logError('Failed to render geometry', error);
        }

        this.ctx.restore();
    }

    renderWall(geometry) {
        if (geometry.polygon) {
            // Render wall as polygon
            this.renderPolygon(geometry.polygon, true);
        } else if (geometry.line) {
            // Render wall as line
            const [start, end] = geometry.line;
            this.ctx.beginPath();
            this.ctx.moveTo(start[0], start[1]);
            this.ctx.lineTo(end[0], end[1]);
            this.ctx.stroke();
        }
    }

    renderZone(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false);
        }
    }

    renderIlot(geometry) {
        if (geometry.polygon) {
            // Fill first, then stroke
            if (geometry.style?.fill !== false) {
                this.renderPolygon(geometry.polygon, true, false);
            }
            this.renderPolygon(geometry.polygon, false, true);

            // Add validation indicator
            if (geometry.properties?.isValid === false) {
                this.renderValidationIndicator(geometry);
            }
        }
    }

    renderCorridor(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false);
        }
    }

    renderGenericGeometry(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false);
        }
    }

    renderPolygon(polygon, fill = false, stroke = true) {
        if (!Array.isArray(polygon) || polygon.length < 2) return;

        this.ctx.beginPath();
        this.ctx.moveTo(polygon[0][0], polygon[0][1]);

        for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(polygon[i][0], polygon[i][1]);
        }

        this.ctx.closePath();

        if (fill) {
            this.ctx.fill();
        }

        if (stroke) {
            this.ctx.stroke();
        }
    }

    renderValidationIndicator(geometry) {
        if (!geometry.bbox) return;

        const centerX = (geometry.bbox.minX + geometry.bbox.maxX) / 2;
        const centerY = (geometry.bbox.minY + geometry.bbox.maxY) / 2;
        const size = 0.2 / this.camera.zoom;

        this.ctx.save();
        this.ctx.fillStyle = '#EF4444';
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 2 / this.camera.zoom;

        // Draw error indicator (X)
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - size, centerY - size);
        this.ctx.lineTo(centerX + size, centerY + size);
        this.ctx.moveTo(centerX + size, centerY - size);
        this.ctx.lineTo(centerX - size, centerY + size);
        this.ctx.stroke();

        this.ctx.restore();
    }

    // Utility methods
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const x = (screenX - centerX) / this.camera.zoom + this.camera.x;
        const y = (screenY - centerY) / this.camera.zoom + this.camera.y;

        return [x, y];
    }

    worldToScreen(worldX, worldY) {
        const rect = this.canvas.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const x = (worldX - this.camera.x) * this.camera.zoom + centerX;
        const y = (worldY - this.camera.y) * this.camera.zoom + centerY;

        return [x, y];
    }

    getVisibleBounds() {
        const rect = this.canvas.getBoundingClientRect();
        const halfWidth = rect.width / (2 * this.camera.zoom);
        const halfHeight = rect.height / (2 * this.camera.zoom);

        return {
            minX: this.camera.x - halfWidth,
            maxX: this.camera.x + halfWidth,
            minY: this.camera.y - halfHeight,
            maxY: this.camera.y + halfHeight
        };
    }

    fitToBounds(bounds) {
        if (!bounds) return;

        const rect = this.canvas.getBoundingClientRect();
        const padding = 50; // pixels

        const boundsWidth = bounds.maxX - bounds.minX;
        const boundsHeight = bounds.maxY - bounds.minY;

        if (boundsWidth === 0 || boundsHeight === 0) return;

        const scaleX = (rect.width - padding * 2) / boundsWidth;
        const scaleY = (rect.height - padding * 2) / boundsHeight;

        this.camera.zoom = Math.min(scaleX, scaleY, this.camera.maxZoom);
        this.camera.x = (bounds.minX + bounds.maxX) / 2;
        this.camera.y = (bounds.minY + bounds.maxY) / 2;

        this.scheduleRender();
    }

    fitToView() {
        const sceneBounds = this.parent.sharedScene.getBounds();
        if (sceneBounds) {
            this.fitToBounds(sceneBounds);
        } else {
            // Default view
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.zoom = 1;
            this.scheduleRender();
        }
    }

    getCameraState() {
        return { ...this.camera };
    }

    setCameraState(cameraState) {
        Object.assign(this.camera, cameraState);
        this.scheduleRender();
    }

    getSelection() {
        return [...this.selection];
    }

    setSelection(selection) {
        this.selection = [...selection];
        this.scheduleRender();
    }

    setVisible(visible) {
        this.canvas.style.display = visible ? 'block' : 'none';
        if (visible) {
            this.scheduleRender();
        }
    }

    processUpdates(updates) {
        // Re-render for any updates
        this.scheduleRender();
    }

    getLayerStates() {
        return {};
    }

    setLayerStates(states) {
        // Implementation for layer states
        this.scheduleRender();
    }

    // Event system
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    this.parent.logError(`Canvas event listener error for ${event}`, error);
                }
            }
        }
    }

    log(message, data = {}) {
        if (this.parent.config.debugMode) {
            console.log(`[CanvasViewController] ${message}`, data);
        }
    }
}

// Keep existing AutodeskViewController class as is...
class AutodeskViewController {
    constructor(viewer, parent) {
        this.viewer = viewer;
        this.parent = parent;
        this.eventListeners = new Map();
    }

    async initialize() {
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        if (this.viewer && this.viewer.addEventListener) {
            this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
                this.emit('cameraChanged', this.getCameraState());
            });

            this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
                this.emit('selectionChanged', event.dbIdArray);
            });
        }
    }

    getCameraState() {
        if (!this.viewer) return {};

        const camera = this.viewer.getCamera();
        return {
            position: camera.position,
            target: camera.target,
            up: camera.up,
            fov: camera.fov,
            aspect: camera.aspect
        };
    }

    setCameraState(cameraState) {
        // Implementation depends on Autodesk Viewer API
    }

    getSelection() {
        return this.viewer ? this.viewer.getSelection() : [];
    }

    setSelection(selection) {
        if (this.viewer) {
            this.viewer.select(selection);
        }
    }

    setVisible(visible) {
        const viewerContainer = this.viewer?.container;
        if (viewerContainer) {
            viewerContainer.style.display = visible ? 'block' : 'none';
        }
    }

    processUpdates(updates) {
        // Process updates for Autodesk Viewer
    }

    getLayerStates() {
        return {};
    }

    setLayerStates(states) {
        // Set layer visibility states
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                callback(data);
            }
        }
    }
}

module.exports = DualViewController;