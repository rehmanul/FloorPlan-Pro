/**
 * Dual-View Controller for Architectural Floor Plan Visualization
 * 
 * Synchronizes Autodesk Viewer and Manual Canvas views with shared scene model.
 * Handles coordinate transformations, real-time updates, and unified interaction.
 * 
 * Features:
 * - Shared scene model for all geometric primitives
 * - Real-time synchronization between Autodesk Viewer and Canvas
 * - Coordinate system transformation handling
 * - Unified interaction model (pan, zoom, select)
 * - Layer management and visibility control
 * - Performance optimization for large datasets
 * 
 * Dependencies:
 * - GeometryEngine for spatial operations
 * - Autodesk Viewer SDK
 * - HTML5 Canvas API
 * 
 * @author FloorPlan Pro Team
 * @version 1.0.0
 */

const GeometryEngine = require('./geometry-engine');

class DualViewController {
    constructor(options = {}) {
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });
        
        // Configuration
        this.config = {
            // View synchronization
            syncEnabled: options.syncEnabled !== false,
            syncCameras: options.syncCameras !== false,
            syncSelection: options.syncSelection !== false,
            syncLayers: options.syncLayers !== false,
            
            // Canvas rendering
            canvasResolution: options.canvasResolution || 1,
            maxCanvasSize: options.maxCanvasSize || 4096,
            antialias: options.antialias !== false,
            
            // Performance
            maxObjects: options.maxObjects || 10000,
            updateThrottleMs: options.updateThrottleMs || 16, // 60fps
            batchSize: options.batchSize || 100,
            
            // Coordinate systems
            worldUnits: options.worldUnits || 'meters',
            precision: options.precision || 0.001,
            
            // Visual styling
            defaultStyles: {
                walls: { color: '#6B7280', thickness: 2, opacity: 1.0 },
                redZones: { color: '#EF4444', opacity: 0.7, fill: true },
                blueZones: { color: '#3B82F6', opacity: 0.7, fill: true },
                ilots: { color: '#10b981', opacity: 0.8, fill: true, stroke: '#059669' },
                corridors: { color: '#f59e0b', opacity: 0.6, fill: true, stroke: '#d97706' },
                annotations: { color: '#8b5cf6', fontSize: 12, font: 'Arial' }
            },
            
            ...options
        };
        
        // Core components
        this.sharedScene = new SharedSceneModel();
        this.autodeskViewController = null;
        this.canvasViewController = null;
        
        // State management
        this.activeView = 'autodesk'; // 'autodesk' or 'canvas'
        this.viewStates = {
            autodesk: { camera: null, selection: [], layers: {} },
            canvas: { camera: null, selection: [], layers: {} }
        };
        
        // Synchronization
        this.syncInProgress = false;
        this.pendingUpdates = new Set();
        this.updateThrottle = null;
        
        // Event system
        this.eventListeners = new Map();
        
        this.log('DualViewController initialized', this.config);
    }

    /**
     * INITIALIZATION
     */

    /**
     * Initialize dual-view system
     * @param {Object} autodeskViewer - Autodesk Viewer instance
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @returns {Promise<void>}
     */
    async initialize(autodeskViewer, canvas) {
        try {
            this.log('Initializing dual-view system');
            
            // Initialize view controllers
            this.autodeskViewController = new AutodeskViewController(autodeskViewer, this);
            this.canvasViewController = new CanvasViewController(canvas, this);
            
            // Setup shared scene
            await this.sharedScene.initialize();
            
            // Initialize view controllers
            await this.autodeskViewController.initialize();
            await this.canvasViewController.initialize();
            
            // Setup synchronization
            this.setupSynchronization();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            this.log('Dual-view system initialized successfully');
            
        } catch (error) {
            this.logError('Dual-view initialization failed', error);
            throw error;
        }
    }

    /**
     * Switch active view
     * @param {string} viewType - 'autodesk' or 'canvas'
     */
    switchView(viewType) {
        if (viewType !== 'autodesk' && viewType !== 'canvas') {
            throw new Error(`Invalid view type: ${viewType}`);
        }
        
        this.log(`Switching to ${viewType} view`);
        
        // Save current view state
        this.saveViewState(this.activeView);
        
        // Switch active view
        this.activeView = viewType;
        
        // Show/hide appropriate views
        this.updateViewVisibility();
        
        // Restore view state
        this.restoreViewState(viewType);
        
        // Emit view change event
        this.emit('viewChanged', { from: this.activeView, to: viewType });
    }

    /**
     * SHARED SCENE MODEL OPERATIONS
     */

    /**
     * Add geometry to shared scene
     * @param {Object} geometry - Geometry object
     * @returns {string} Geometry ID
     */
    addGeometry(geometry) {
        const id = this.sharedScene.addGeometry(geometry);
        this.scheduleUpdate(['geometry']);
        return id;
    }

    /**
     * Update geometry in shared scene
     * @param {string} id - Geometry ID
     * @param {Object} updates - Geometry updates
     */
    updateGeometry(id, updates) {
        this.sharedScene.updateGeometry(id, updates);
        this.scheduleUpdate(['geometry', id]);
    }

    /**
     * Remove geometry from shared scene
     * @param {string} id - Geometry ID
     */
    removeGeometry(id) {
        this.sharedScene.removeGeometry(id);
        this.scheduleUpdate(['geometry', id]);
    }

    /**
     * Add îlots to scene
     * @param {Array} ilots - Array of îlot objects
     */
    addIlots(ilots) {
        for (const ilot of ilots) {
            const geometry = {
                id: ilot.id,
                type: 'ilot',
                subtype: ilot.type,
                polygon: ilot.geometry.polygon,
                bbox: ilot.geometry.bbox,
                properties: ilot.properties,
                style: { ...this.config.defaultStyles.ilots },
                metadata: ilot.metadata
            };
            
            this.sharedScene.addGeometry(geometry);
        }
        
        this.scheduleUpdate(['ilots']);
        this.log('Added îlots to scene', { count: ilots.length });
    }

    /**
     * Add corridors to scene
     * @param {Array} corridors - Array of corridor objects
     */
    addCorridors(corridors) {
        for (const corridor of corridors) {
            const geometry = {
                id: corridor.id,
                type: 'corridor',
                polygon: corridor.polygon,
                bbox: corridor.bbox,
                centerline: corridor.centerline,
                width: corridor.width,
                style: { ...this.config.defaultStyles.corridors },
                metadata: corridor.metadata
            };
            
            this.sharedScene.addGeometry(geometry);
        }
        
        this.scheduleUpdate(['corridors']);
        this.log('Added corridors to scene', { count: corridors.length });
    }

    /**
     * Add floor plan elements to scene
     * @param {Object} floorPlan - Floor plan data
     */
    addFloorPlan(floorPlan) {
        // Add walls
        if (floorPlan.walls) {
            for (const wall of floorPlan.walls) {
                const geometry = {
                    id: wall.id || `wall_${Date.now()}_${Math.random()}`,
                    type: 'wall',
                    line: [wall.start, wall.end],
                    thickness: wall.thickness || 0.2,
                    style: { ...this.config.defaultStyles.walls },
                    metadata: { layer: 'WALLS' }
                };
                
                this.sharedScene.addGeometry(geometry);
            }
        }
        
        // Add red zones (entrances)
        if (floorPlan.redZones) {
            for (const zone of floorPlan.redZones) {
                const geometry = {
                    id: zone.id || `redzone_${Date.now()}_${Math.random()}`,
                    type: 'zone',
                    subtype: 'entrance',
                    polygon: zone.polygon || zone,
                    style: { ...this.config.defaultStyles.redZones },
                    metadata: { layer: 'RED_ZONE' }
                };
                
                this.sharedScene.addGeometry(geometry);
            }
        }
        
        // Add blue zones (forbidden)
        if (floorPlan.blueZones) {
            for (const zone of floorPlan.blueZones) {
                const geometry = {
                    id: zone.id || `bluezone_${Date.now()}_${Math.random()}`,
                    type: 'zone',
                    subtype: 'forbidden',
                    polygon: zone.polygon || zone,
                    style: { ...this.config.defaultStyles.blueZones },
                    metadata: { layer: 'BLUE_ZONE' }
                };
                
                this.sharedScene.addGeometry(geometry);
            }
        }
        
        this.scheduleUpdate(['floorplan']);
        this.log('Added floor plan to scene');
    }

    /**
     * SYNCHRONIZATION
     */

    /**
     * Setup synchronization between views
     */
    setupSynchronization() {
        if (!this.config.syncEnabled) return;
        
        // Camera synchronization
        if (this.config.syncCameras) {
            this.on('cameraChanged', (data) => {
                if (!this.syncInProgress) {
                    this.syncCameras(data.source, data.camera);
                }
            });
        }
        
        // Selection synchronization
        if (this.config.syncSelection) {
            this.on('selectionChanged', (data) => {
                if (!this.syncInProgress) {
                    this.syncSelection(data.source, data.selection);
                }
            });
        }
        
        // Layer synchronization
        if (this.config.syncLayers) {
            this.on('layerVisibilityChanged', (data) => {
                if (!this.syncInProgress) {
                    this.syncLayerVisibility(data.source, data.layer, data.visible);
                }
            });
        }
        
        this.log('Synchronization setup completed');
    }

    /**
     * Sync cameras between views
     * @param {string} sourceView - Source view that initiated change
     * @param {Object} cameraState - Camera state
     */
    syncCameras(sourceView, cameraState) {
        this.syncInProgress = true;
        
        try {
            const targetView = sourceView === 'autodesk' ? 'canvas' : 'autodesk';
            
            if (targetView === 'autodesk' && this.autodeskViewController) {
                this.autodeskViewController.setCameraState(cameraState);
            } else if (targetView === 'canvas' && this.canvasViewController) {
                this.canvasViewController.setCameraState(cameraState);
            }
            
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Sync selection between views
     * @param {string} sourceView - Source view
     * @param {Array} selection - Selected objects
     */
    syncSelection(sourceView, selection) {
        this.syncInProgress = true;
        
        try {
            const targetView = sourceView === 'autodesk' ? 'canvas' : 'autodesk';
            
            if (targetView === 'autodesk' && this.autodeskViewController) {
                this.autodeskViewController.setSelection(selection);
            } else if (targetView === 'canvas' && this.canvasViewController) {
                this.canvasViewController.setSelection(selection);
            }
            
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Schedule update for specific components
     * @param {Array} components - Components to update
     */
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

    /**
     * Execute pending updates
     */
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
        
        this.log('Processed updates', { components: updates });
    }

    /**
     * VIEW STATE MANAGEMENT
     */

    /**
     * Save current view state
     * @param {string} viewType - View type to save
     */
    saveViewState(viewType) {
        try {
            if (viewType === 'autodesk' && this.autodeskViewController) {
                this.viewStates.autodesk = {
                    camera: this.autodeskViewController.getCameraState(),
                    selection: this.autodeskViewController.getSelection(),
                    layers: this.autodeskViewController.getLayerStates()
                };
            } else if (viewType === 'canvas' && this.canvasViewController) {
                this.viewStates.canvas = {
                    camera: this.canvasViewController.getCameraState(),
                    selection: this.canvasViewController.getSelection(),
                    layers: this.canvasViewController.getLayerStates()
                };
            }
            
        } catch (error) {
            this.logError('Failed to save view state', error);
        }
    }

    /**
     * Restore view state
     * @param {string} viewType - View type to restore
     */
    restoreViewState(viewType) {
        try {
            const state = this.viewStates[viewType];
            if (!state) return;
            
            if (viewType === 'autodesk' && this.autodeskViewController) {
                if (state.camera) this.autodeskViewController.setCameraState(state.camera);
                if (state.selection) this.autodeskViewController.setSelection(state.selection);
                if (state.layers) this.autodeskViewController.setLayerStates(state.layers);
            } else if (viewType === 'canvas' && this.canvasViewController) {
                if (state.camera) this.canvasViewController.setCameraState(state.camera);
                if (state.selection) this.canvasViewController.setSelection(state.selection);
                if (state.layers) this.canvasViewController.setLayerStates(state.layers);
            }
            
        } catch (error) {
            this.logError('Failed to restore view state', error);
        }
    }

    /**
     * Update view visibility
     */
    updateViewVisibility() {
        // Show/hide appropriate views based on active view
        if (this.autodeskViewController) {
            this.autodeskViewController.setVisible(this.activeView === 'autodesk');
        }
        
        if (this.canvasViewController) {
            this.canvasViewController.setVisible(this.activeView === 'canvas');
        }
    }

    /**
     * EVENT SYSTEM
     */

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Handle view controller events
        if (this.autodeskViewController) {
            this.autodeskViewController.on('cameraChanged', (camera) => {
                this.emit('cameraChanged', { source: 'autodesk', camera });
            });
            
            this.autodeskViewController.on('selectionChanged', (selection) => {
                this.emit('selectionChanged', { source: 'autodesk', selection });
            });
        }
        
        if (this.canvasViewController) {
            this.canvasViewController.on('cameraChanged', (camera) => {
                this.emit('cameraChanged', { source: 'canvas', camera });
            });
            
            this.canvasViewController.on('selectionChanged', (selection) => {
                this.emit('selectionChanged', { source: 'canvas', selection });
            });
        }
    }

    /**
     * Add event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Remove event listener
     * @param {string} event - Event name
     * @param {Function} callback - Event callback
     */
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index >= 0) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
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

    /**
     * COORDINATE TRANSFORMATIONS
     */

    /**
     * Transform coordinates between views
     * @param {Array} point - Point to transform
     * @param {string} fromView - Source view
     * @param {string} toView - Target view
     * @returns {Array} Transformed point
     */
    transformCoordinates(point, fromView, toView) {
        if (fromView === toView) return point;
        
        // For now, assume same coordinate system
        // Could be enhanced with actual transformation matrices
        return point;
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Get current scene bounds
     * @returns {Object} Scene bounding box
     */
    getSceneBounds() {
        return this.sharedScene.getBounds();
    }

    /**
     * Clear all geometry
     */
    clearScene() {
        this.sharedScene.clear();
        this.scheduleUpdate(['all']);
        this.log('Scene cleared');
    }

    /**
     * Export scene data
     * @returns {Object} Scene data
     */
    exportScene() {
        return this.sharedScene.export();
    }

    /**
     * Import scene data
     * @param {Object} sceneData - Scene data
     */
    importScene(sceneData) {
        this.sharedScene.import(sceneData);
        this.scheduleUpdate(['all']);
        this.log('Scene imported');
    }

    /**
     * LOGGING
     */

    log(message, data = {}) {
        if (this.config.debugMode) {
            console.log(`[DualViewController] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[DualViewController ERROR] ${message}:`, error);
    }

    /**
     * Get controller statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            config: this.config,
            activeView: this.activeView,
            geometryCount: this.sharedScene.getGeometryCount(),
            pendingUpdates: this.pendingUpdates.size,
            eventListeners: Array.from(this.eventListeners.keys()),
            autodeskReady: !!this.autodeskViewController,
            canvasReady: !!this.canvasViewController
        };
    }
}

/**
 * Shared Scene Model
 * Manages all geometric primitives and their properties
 */
class SharedSceneModel {
    constructor() {
        this.geometries = new Map();
        this.layers = new Map();
        this.bounds = null;
    }

    async initialize() {
        this.clear();
    }

    addGeometry(geometry) {
        const id = geometry.id || this.generateId();
        geometry.id = id;
        
        this.geometries.set(id, geometry);
        this.updateBounds();
        this.updateLayers(geometry);
        
        return id;
    }

    updateGeometry(id, updates) {
        const geometry = this.geometries.get(id);
        if (geometry) {
            Object.assign(geometry, updates);
            this.updateBounds();
        }
    }

    removeGeometry(id) {
        this.geometries.delete(id);
        this.updateBounds();
    }

    getGeometry(id) {
        return this.geometries.get(id);
    }

    getAllGeometries() {
        return Array.from(this.geometries.values());
    }

    getGeometriesByType(type) {
        return this.getAllGeometries().filter(g => g.type === type);
    }

    clear() {
        this.geometries.clear();
        this.layers.clear();
        this.bounds = null;
    }

    getBounds() {
        return this.bounds;
    }

    updateBounds() {
        // Calculate overall scene bounds
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

        this.bounds = { minX, minY, maxX, maxY };
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
        this.layers.get(layer).geometries.push(geometry.id);
    }

    generateId() {
        return `geom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getGeometryCount() {
        return this.geometries.size;
    }

    export() {
        return {
            geometries: Array.from(this.geometries.values()),
            layers: Array.from(this.layers.values()),
            bounds: this.bounds
        };
    }

    import(data) {
        this.clear();
        
        if (data.geometries) {
            for (const geometry of data.geometries) {
                this.addGeometry(geometry);
            }
        }
        
        if (data.layers) {
            for (const layer of data.layers) {
                this.layers.set(layer.name, layer);
            }
        }
        
        this.bounds = data.bounds;
    }
}

/**
 * Autodesk View Controller
 * Manages Autodesk Viewer integration
 */
class AutodeskViewController {
    constructor(viewer, parent) {
        this.viewer = viewer;
        this.parent = parent;
        this.eventListeners = new Map();
    }

    async initialize() {
        // Setup Autodesk Viewer event handlers
        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Camera change events
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, () => {
            this.emit('cameraChanged', this.getCameraState());
        });

        // Selection change events
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
            this.emit('selectionChanged', event.dbIdArray);
        });
    }

    getCameraState() {
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
        // this.viewer.navigation.setRequestTransition(...)
    }

    getSelection() {
        return this.viewer.getSelection();
    }

    setSelection(selection) {
        this.viewer.select(selection);
    }

    setVisible(visible) {
        const viewerContainer = this.viewer.container;
        if (viewerContainer) {
            viewerContainer.style.display = visible ? 'block' : 'none';
        }
    }

    processUpdates(updates) {
        // Process updates for Autodesk Viewer
        // Implementation depends on specific requirements
    }

    getLayerStates() {
        // Return layer visibility states
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

/**
 * Canvas View Controller
 * Manages Canvas rendering and interaction
 */
class CanvasViewController {
    constructor(canvas, parent) {
        this.canvas = canvas;
        this.parent = parent;
        this.ctx = canvas.getContext('2d');
        this.eventListeners = new Map();
        
        // Camera state
        this.camera = {
            x: 0, y: 0, zoom: 1, rotation: 0
        };
        
        // Interaction state
        this.selection = [];
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    async initialize() {
        this.setupEventHandlers();
        this.resize();
    }

    setupEventHandlers() {
        // Mouse events for interaction
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        // Resize handling
        window.addEventListener('resize', () => this.resize());
    }

    onMouseDown(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isDragging = true;
        this.lastMouse = { x: event.clientX, y: event.clientY };
        
        // Get mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = event.clientX - rect.left;
        const canvasY = event.clientY - rect.top;
        
        // Convert to world coordinates for selection
        const worldX = (canvasX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (canvasY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        
        // Check for selection at this point
        const selectedObject = this.getObjectAtPoint([worldX, worldY]);
        if (selectedObject) {
            this.selection = [selectedObject.id];
            this.emit('selectionChanged', this.selection);
            this.render(); // Re-render to show selection
        }
    }

    onMouseMove(event) {
        event.preventDefault();
        event.stopPropagation();
        
        if (this.isDragging) {
            const dx = event.clientX - this.lastMouse.x;
            const dy = event.clientY - this.lastMouse.y;
            
            // Apply camera movement
            this.camera.x -= dx / this.camera.zoom;
            this.camera.y -= dy / this.camera.zoom;
            
            // Re-render the scene
            this.render();
            this.emit('cameraChanged', this.getCameraState());
        }
        
        this.lastMouse = { x: event.clientX, y: event.clientY };
    }

    onMouseUp(event) {
        event.preventDefault();
        event.stopPropagation();
        
        this.isDragging = false;
    }

    onWheel(event) {
        event.preventDefault();
        event.stopPropagation();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // Calculate zoom center in world coordinates
        const worldX = (mouseX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (mouseY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const oldZoom = this.camera.zoom;
        this.camera.zoom *= zoomFactor;
        
        // Clamp zoom levels
        this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom));
        
        // Adjust camera position to zoom around mouse position
        const zoomRatio = this.camera.zoom / oldZoom;
        this.camera.x = worldX - (worldX - this.camera.x) * zoomRatio;
        this.camera.y = worldY - (worldY - this.camera.y) * zoomRatio;
        
        this.render();
        this.emit('cameraChanged', this.getCameraState());
    }

    getObjectAtPoint(worldPoint) {
        try {
            const geometries = this.parent.sharedScene.getAllGeometries();
            
            for (const geometry of geometries) {
                if (this.isPointInGeometry(worldPoint, geometry)) {
                    return geometry;
                }
            }
            
            return null;
        } catch (error) {
            console.error('Error getting object at point:', error);
            return null;
        }
    }

    isPointInGeometry(point, geometry) {
        try {
            if (geometry.polygon) {
                return this.pointInPolygon(point, geometry.polygon);
            }
            
            if (geometry.line) {
                // Check if point is near line
                const [start, end] = geometry.line;
                const distToLine = this.pointToLineDistance(point, start, end);
                const thickness = geometry.thickness || 0.1;
                return distToLine <= thickness / 2;
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }

    pointInPolygon(point, polygon) {
        const [x, y] = point;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const [xi, yi] = polygon[i];
            const [xj, yj] = polygon[j];

            if (((yi > y) !== (yj > y)) && 
                (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point[0] - lineStart[0];
        const B = point[1] - lineStart[1];
        const C = lineEnd[0] - lineStart[0];
        const D = lineEnd[1] - lineStart[1];

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        if (lenSq === 0) {
            return Math.sqrt(A * A + B * B);
        }

        let param = dot / lenSq;
        param = Math.max(0, Math.min(1, param));

        const closestX = lineStart[0] + param * C;
        const closestY = lineStart[1] + param * D;

        const dx = point[0] - closestX;
        const dy = point[1] - closestY;

        return Math.sqrt(dx * dx + dy * dy);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.render();
    }

    render() {
        try {
            // Get canvas dimensions
            const canvasWidth = this.canvas.clientWidth;
            const canvasHeight = this.canvas.clientHeight;
            
            // Update canvas size if needed
            if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
            }
            
            // Clear canvas with background
            this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
            
            // Apply camera transform
            this.ctx.save();
            
            // Translate to center and apply zoom
            this.ctx.translate(canvasWidth / 2, canvasHeight / 2);
            this.ctx.scale(this.camera.zoom, this.camera.zoom);
            this.ctx.translate(-this.camera.x, -this.camera.y);
            
            // Render grid for reference
            this.renderGrid();
            
            // Get and render all geometries
            const geometries = this.parent.sharedScene.getAllGeometries();
            
            if (geometries && geometries.length > 0) {
                for (const geometry of geometries) {
                    try {
                        this.renderGeometry(geometry);
                    } catch (error) {
                        console.error('Error rendering geometry:', geometry, error);
                    }
                }
            }
            
            // Render selection highlights
            this.renderSelectionHighlights();
            
            this.ctx.restore();
            
            // Render UI elements (zoom level, etc.)
            this.renderUI();
            
        } catch (error) {
            console.error('Canvas render error:', error);
            
            // Fallback rendering
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#f8fafc';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    renderGrid() {
        const gridSize = 1.0; // 1 meter grid
        const canvasWidth = this.canvas.width / this.camera.zoom;
        const canvasHeight = this.canvas.height / this.camera.zoom;
        
        const startX = Math.floor((this.camera.x - canvasWidth / 2) / gridSize) * gridSize;
        const endX = Math.ceil((this.camera.x + canvasWidth / 2) / gridSize) * gridSize;
        const startY = Math.floor((this.camera.y - canvasHeight / 2) / gridSize) * gridSize;
        const endY = Math.ceil((this.camera.y + canvasHeight / 2) / gridSize) * gridSize;
        
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 0.5 / this.camera.zoom;
        this.ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
        
        // Vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.setLineDash([]);
    }

    renderSelectionHighlights() {
        if (this.selection.length === 0) return;
        
        const geometries = this.parent.sharedScene.getAllGeometries();
        
        for (const geometry of geometries) {
            if (this.selection.includes(geometry.id)) {
                this.ctx.save();
                this.ctx.strokeStyle = '#3b82f6';
                this.ctx.lineWidth = 3 / this.camera.zoom;
                this.ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
                
                if (geometry.polygon) {
                    this.renderPolygon(geometry.polygon, false);
                }
                
                this.ctx.restore();
            }
        }
    }

    renderUI() {
        this.ctx.save();
        this.ctx.resetTransform();
        
        // Render zoom level
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 10, 120, 30);
        
        this.ctx.fillStyle = 'white';
        this.ctx.font = '12px Inter';
        this.ctx.fillText(`Zoom: ${(this.camera.zoom * 100).toFixed(0)}%`, 20, 30);
        
        // Render coordinates
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, 50, 150, 30);
        
        this.ctx.fillStyle = 'white';
        this.ctx.fillText(`X: ${this.camera.x.toFixed(1)}, Y: ${this.camera.y.toFixed(1)}`, 20, 70);
        
        this.ctx.restore();
    }

    renderGeometry(geometry) {
        if (!geometry) return;
        
        this.ctx.save();
        
        try {
            const style = geometry.style || {};
            
            // Set style properties with fallbacks
            this.ctx.strokeStyle = style.color || '#6B7280';
            this.ctx.fillStyle = style.color || '#6B7280';
            this.ctx.lineWidth = (style.thickness || 1) / this.camera.zoom;
            this.ctx.globalAlpha = style.opacity !== undefined ? style.opacity : 1.0;
            
            // Render based on geometry type
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
                    // Generic polygon rendering
                    if (geometry.polygon) {
                        this.renderPolygon(geometry.polygon, style.fill);
                    }
                    break;
            }
            
            // Render labels if present
            if (geometry.label) {
                this.renderLabel(geometry);
            }
            
        } catch (error) {
            console.error('Error in renderGeometry:', error);
        }
        
        this.ctx.restore();
    }

    renderLabel(geometry) {
        if (!geometry.label || !geometry.polygon) return;
        
        // Calculate center of geometry
        const center = this.calculatePolygonCenter(geometry.polygon);
        
        this.ctx.save();
        this.ctx.fillStyle = '#1e293b';
        this.ctx.font = `${12 / this.camera.zoom}px Inter`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // Add background for better readability
        const metrics = this.ctx.measureText(geometry.label);
        const padding = 4 / this.camera.zoom;
        
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.fillRect(
            center[0] - metrics.width / 2 - padding,
            center[1] - 6 / this.camera.zoom - padding,
            metrics.width + padding * 2,
            12 / this.camera.zoom + padding * 2
        );
        
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillText(geometry.label, center[0], center[1]);
        
        this.ctx.restore();
    }

    calculatePolygonCenter(polygon) {
        if (!polygon || polygon.length === 0) return [0, 0];
        
        let x = 0, y = 0;
        for (const point of polygon) {
            x += point[0];
            y += point[1];
        }
        
        return [x / polygon.length, y / polygon.length];
    }

    renderWall(geometry) {
        if (geometry.line) {
            const [start, end] = geometry.line;
            this.ctx.beginPath();
            this.ctx.moveTo(start[0], start[1]);
            this.ctx.lineTo(end[0], end[1]);
            this.ctx.stroke();
        }
    }

    renderZone(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, true);
        }
    }

    renderIlot(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, true);
        }
    }

    renderCorridor(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, true);
        }
    }

    renderPolygon(polygon, fill = false) {
        this.ctx.beginPath();
        this.ctx.moveTo(polygon[0][0], polygon[0][1]);
        
        for (let i = 1; i < polygon.length; i++) {
            this.ctx.lineTo(polygon[i][0], polygon[i][1]);
        }
        
        this.ctx.closePath();
        
        if (fill) {
            this.ctx.fill();
        }
        this.ctx.stroke();
    }

    getCameraState() {
        return { ...this.camera };
    }

    setCameraState(cameraState) {
        Object.assign(this.camera, cameraState);
        this.render();
    }

    getSelection() {
        return [...this.selection];
    }

    setSelection(selection) {
        this.selection = [...selection];
        this.render();
    }

    setVisible(visible) {
        this.canvas.style.display = visible ? 'block' : 'none';
    }

    processUpdates(updates) {
        // Re-render for any updates
        this.render();
    }

    getLayerStates() {
        return {};
    }

    setLayerStates(states) {
        // Implementation for layer states
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