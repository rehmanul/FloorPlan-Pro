/**
 * COMPLETE CANVAS CONTROLLER FIX
 * 
 * This addresses the canvas disappearing issue and îlot placement problems
 * 
 * CRITICAL FIXES:
 * - Canvas state preservation during interactions
 * - Proper device pixel ratio handling
 * - Enhanced rendering pipeline
 * - Debugging for îlot placement issues
 * 
 * @version 3.0.0 - COMPLETE FIX
 */

class UltimateCanvasController {
    constructor(canvas, parent) {
        this.canvas = canvas;
        this.parent = parent;
        this.ctx = canvas.getContext('2d', { 
            alpha: true,
            desynchronized: true,
            preserveDrawingBuffer: true  // CRITICAL: Preserve canvas content
        });

        // Enhanced state management
        this.state = {
            initialized: false,
            rendering: false,
            lastRender: 0,
            frameCount: 0,
            needsRedraw: true
        };

        // Camera with constraints
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            minZoom: 0.1,
            maxZoom: 20,
            rotation: 0
        };

        // Interaction state
        this.interaction = {
            isDragging: false,
            isPanning: false,
            startPos: { x: 0, y: 0 },
            lastPos: { x: 0, y: 0 },
            button: -1
        };

        // Rendering configuration
        this.renderConfig = {
            gridEnabled: true,
            gridSpacing: 1.0,
            showDebugInfo: true,
            antialiasing: true,
            maxFPS: 60
        };

        // Debug information
        this.debug = {
            geometryCount: 0,
            renderTime: 0,
            lastError: null,
            interactions: 0
        };

        this.eventListeners = new Map();

        // Initialize immediately
        this.initialize();
    }

    async initialize() {
        try {
            console.log('[UltimateCanvasController] Initializing...');

            // Setup canvas with proper sizing
            this.setupCanvas();

            // Setup event handlers
            this.setupEventHandlers();

            // Setup resize observer for better responsiveness
            this.setupResizeObserver();

            // Initial render
            this.scheduleRender();

            this.state.initialized = true;

            console.log('[UltimateCanvasController] Initialized successfully');

        } catch (error) {
            console.error('[UltimateCanvasController] Initialization failed:', error);
            this.debug.lastError = error;
        }
    }

    setupCanvas() {
        // Get actual canvas dimensions
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        // Set actual size in memory (scaled for high DPI)
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        // Set display size (CSS)
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        // Scale context to handle high DPI
        this.ctx.scale(dpr, dpr);

        // Set initial canvas properties
        this.ctx.imageSmoothingEnabled = this.renderConfig.antialiasing;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        console.log('[UltimateCanvasController] Canvas setup:', {
            displaySize: `${rect.width}x${rect.height}`,
            actualSize: `${this.canvas.width}x${this.canvas.height}`,
            dpr
        });
    }

    setupEventHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this), { passive: false });
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this), { passive: false });
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this), { passive: false });
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Touch events for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });

        // Keyboard events
        this.canvas.setAttribute('tabindex', '0');
        this.canvas.addEventListener('keydown', this.onKeyDown.bind(this));

        // Visibility changes
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.scheduleRender();
            }
        });

        console.log('[UltimateCanvasController] Event handlers setup complete');
    }

    setupResizeObserver() {
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.handleResize();
            });
            this.resizeObserver.observe(this.canvas);
        } else {
            // Fallback for older browsers
            window.addEventListener('resize', () => this.handleResize());
        }
    }

    handleResize() {
        // Debounce resize handling
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = setTimeout(() => {
            this.setupCanvas();
            this.scheduleRender();
        }, 100);
    }

    // INTERACTION HANDLERS - ENHANCED

    onMouseDown(event) {
        event.preventDefault();

        const pos = this.getEventPosition(event);

        this.interaction = {
            isDragging: true,
            isPanning: event.button === 0, // Left button
            startPos: pos,
            lastPos: pos,
            button: event.button
        };

        this.canvas.style.cursor = 'grabbing';
        this.debug.interactions++;

        console.log('[UltimateCanvasController] Mouse down:', pos);
    }

    onMouseMove(event) {
        event.preventDefault();

        const pos = this.getEventPosition(event);

        if (this.interaction.isDragging && this.interaction.isPanning) {
            const dx = pos.x - this.interaction.lastPos.x;
            const dy = pos.y - this.interaction.lastPos.y;

            // Apply pan with proper scaling
            this.camera.x -= dx / this.camera.zoom;
            this.camera.y -= dy / this.camera.zoom;

            this.scheduleRender();
            this.emit('cameraChanged', this.getCameraState());
        }

        this.interaction.lastPos = pos;
    }

    onMouseUp(event) {
        event.preventDefault();

        this.interaction.isDragging = false;
        this.interaction.isPanning = false;
        this.canvas.style.cursor = 'default';

        console.log('[UltimateCanvasController] Mouse up');
    }

    onWheel(event) {
        event.preventDefault();

        const pos = this.getEventPosition(event);
        const worldPos = this.screenToWorld(pos.x, pos.y);

        // Calculate zoom
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.camera.minZoom, 
                       Math.min(this.camera.maxZoom, this.camera.zoom * zoomFactor));

        if (newZoom !== this.camera.zoom) {
            this.camera.zoom = newZoom;

            // Keep world position under mouse constant
            const newWorldPos = this.screenToWorld(pos.x, pos.y);
            this.camera.x += worldPos[0] - newWorldPos[0];
            this.camera.y += worldPos[1] - newWorldPos[1];

            this.scheduleRender();
            this.emit('cameraChanged', this.getCameraState());
        }

        console.log('[UltimateCanvasController] Wheel:', { 
            zoom: this.camera.zoom.toFixed(2),
            pos: worldPos
        });
    }

    // Touch events for mobile support
    onTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.onMouseDown({ 
                preventDefault: () => {}, 
                clientX: touch.clientX, 
                clientY: touch.clientY, 
                button: 0 
            });
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.onMouseMove({ 
                preventDefault: () => {}, 
                clientX: touch.clientX, 
                clientY: touch.clientY 
            });
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        this.onMouseUp({ preventDefault: () => {} });
    }

    onKeyDown(event) {
        switch (event.key) {
            case 'r':
            case 'R':
                this.resetView();
                break;
            case 'g':
            case 'G':
                this.renderConfig.gridEnabled = !this.renderConfig.gridEnabled;
                this.scheduleRender();
                break;
            case 'd':
            case 'D':
                this.renderConfig.showDebugInfo = !this.renderConfig.showDebugInfo;
                this.scheduleRender();
                break;
        }
    }

    // RENDERING SYSTEM - COMPLETELY REWRITTEN

    scheduleRender() {
        if (this.state.needsRedraw) return;

        this.state.needsRedraw = true;
        requestAnimationFrame(() => this.render());
    }

    render() {
        if (!this.state.initialized) return;
        if (this.state.rendering) return;

        this.state.rendering = true;
        this.state.needsRedraw = false;

        const startTime = performance.now();

        try {
            // Clear entire canvas
            this.clearCanvas();

            // Save context state
            this.ctx.save();

            // Apply camera transformation
            this.applyCamera();

            // Render content in layers
            this.renderContent();

            // Restore context state
            this.ctx.restore();

            // Render UI elements (not affected by camera)
            this.renderUI();

            // Update statistics
            this.updateRenderStats(startTime);

            this.emit('renderComplete');

        } catch (error) {
            console.error('[UltimateCanvasController] Render failed:', error);
            this.debug.lastError = error;
        } finally {
            this.state.rendering = false;
        }
    }

    clearCanvas() {
        const rect = this.canvas.getBoundingClientRect();

        // Clear with background color
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        // Alternative: transparent clear
        // this.ctx.clearRect(0, 0, rect.width, rect.height);
    }

    applyCamera() {
        const rect = this.canvas.getBoundingClientRect();

        // Move to center
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

    renderContent() {
        try {
            // Render grid first
            if (this.renderConfig.gridEnabled) {
                this.renderGrid();
            }

            // Get geometries from parent
            const geometries = this.parent?.sharedScene?.getAllGeometries() || [];
            this.debug.geometryCount = geometries.length;

            if (geometries.length === 0) {
                this.renderNoContentMessage();
                return;
            }

            // Render geometries by type/layer
            this.renderGeometriesByLayer(geometries);

        } catch (error) {
            console.error('[UltimateCanvasController] Content render failed:', error);
            this.renderErrorMessage(error);
        }
    }

    renderGrid() {
        const bounds = this.getVisibleBounds();
        const spacing = this.renderConfig.gridSpacing;

        this.ctx.save();
        this.ctx.strokeStyle = '#e2e8f0';
        this.ctx.lineWidth = 1 / this.camera.zoom;
        this.ctx.globalAlpha = 0.5;

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

    renderGeometriesByLayer(geometries) {
        // Group by layer
        const layers = new Map();

        for (const geom of geometries) {
            const layer = geom.metadata?.layer || 'DEFAULT';
            if (!layers.has(layer)) {
                layers.set(layer, []);
            }
            layers.get(layer).push(geom);
        }

        // Render in order
        const layerOrder = ['WALLS', 'RED_ZONE', 'BLUE_ZONE', 'CORRIDORS', 'ILOTS', 'ANNOTATIONS'];

        for (const layerName of layerOrder) {
            if (layers.has(layerName)) {
                this.renderLayer(layers.get(layerName), layerName);
            }
        }

        // Render any remaining layers
        for (const [layerName, geometries] of layers) {
            if (!layerOrder.includes(layerName)) {
                this.renderLayer(geometries, layerName);
            }
        }
    }

    renderLayer(geometries, layerName) {
        this.ctx.save();

        for (const geometry of geometries) {
            if (this.isGeometryVisible(geometry)) {
                this.renderGeometry(geometry);
            }
        }

        this.ctx.restore();
    }

    renderGeometry(geometry) {
        this.ctx.save();

        try {
            const style = geometry.style || {};

            // Apply style
            this.applyStyle(style);

            // Render based on type
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
                    this.renderGeneric(geometry);
                    break;
            }

        } catch (error) {
            console.warn('[UltimateCanvasController] Failed to render geometry:', geometry.id, error);
        }

        this.ctx.restore();
    }

    applyStyle(style) {
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
    }

    renderWall(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, true, true);
        } else if (geometry.line) {
            const [start, end] = geometry.line;
            this.ctx.beginPath();
            this.ctx.moveTo(start[0], start[1]);
            this.ctx.lineTo(end[0], end[1]);
            this.ctx.stroke();
        }
    }

    renderZone(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false, true);
        }
    }

    renderIlot(geometry) {
        if (geometry.polygon) {
            // Fill first
            if (geometry.style?.fill !== false) {
                this.renderPolygon(geometry.polygon, true, false);
            }

            // Then stroke
            this.renderPolygon(geometry.polygon, false, true);

            // Add validation indicator if invalid
            if (geometry.properties?.isValid === false) {
                this.renderValidationIndicator(geometry);
            }

            // Add label
            this.renderIlotLabel(geometry);
        }
    }

    renderCorridor(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false, true);
        }
    }

    renderGeneric(geometry) {
        if (geometry.polygon) {
            this.renderPolygon(geometry.polygon, geometry.style?.fill !== false, true);
        }
    }

    renderPolygon(polygon, fill = false, stroke = true) {
        if (!Array.isArray(polygon) || polygon.length < 3) return;

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
        const size = 0.3 / this.camera.zoom;

        this.ctx.save();
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 3 / this.camera.zoom;

        // Draw X
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - size, centerY - size);
        this.ctx.lineTo(centerX + size, centerY + size);
        this.ctx.moveTo(centerX + size, centerY - size);
        this.ctx.lineTo(centerX - size, centerY + size);
        this.ctx.stroke();

        this.ctx.restore();
    }

    renderIlotLabel(geometry) {
        if (!geometry.bbox || this.camera.zoom < 0.5) return;

        const centerX = (geometry.bbox.minX + geometry.bbox.maxX) / 2;
        const centerY = (geometry.bbox.minY + geometry.bbox.maxY) / 2;

        this.ctx.save();
        this.ctx.fillStyle = '#374151';
        this.ctx.font = `${12 / this.camera.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        const label = geometry.id || 'Îlot';
        this.ctx.fillText(label, centerX, centerY);

        this.ctx.restore();
    }

    renderNoContentMessage() {
        this.ctx.save();
        this.ctx.fillStyle = '#9ca3af';
        this.ctx.font = `${24 / this.camera.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.fillText('No content to display', 0, 0);
        this.ctx.fillText('Load a floor plan to begin', 0, 30 / this.camera.zoom);

        this.ctx.restore();
    }

    renderErrorMessage(error) {
        this.ctx.save();
        this.ctx.fillStyle = '#ef4444';
        this.ctx.font = `${16 / this.camera.zoom}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.fillText('Render Error:', 0, -15 / this.camera.zoom);
        this.ctx.fillText(error.message.substring(0, 50), 0, 15 / this.camera.zoom);

        this.ctx.restore();
    }

    renderUI() {
        if (!this.renderConfig.showDebugInfo) return;

        this.ctx.save();
        this.ctx.fillStyle = '#1f2937';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';

        const info = [
            `Zoom: ${this.camera.zoom.toFixed(2)}x`,
            `Position: ${this.camera.x.toFixed(1)}, ${this.camera.y.toFixed(1)}`,
            `Geometries: ${this.debug.geometryCount}`,
            `Render Time: ${this.debug.renderTime.toFixed(1)}ms`,
            `FPS: ${this.state.frameCount}`,
            `Interactions: ${this.debug.interactions}`
        ];

        for (let i = 0; i < info.length; i++) {
            this.ctx.fillText(info[i], 10, 10 + i * 15);
        }

        this.ctx.restore();
    }

    // UTILITY FUNCTIONS

    getEventPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

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

    isGeometryVisible(geometry) {
        if (!geometry.bbox) return true;

        const viewBounds = this.getVisibleBounds();
        const geomBounds = geometry.bbox;

        return !(geomBounds.maxX < viewBounds.minX || 
                geomBounds.minX > viewBounds.maxX ||
                geomBounds.maxY < viewBounds.minY || 
                geomBounds.minY > viewBounds.maxY);
    }

    resetView() {
        this.camera.x = 0;
        this.camera.y = 0;
        this.camera.zoom = 1;
        this.camera.rotation = 0;

        this.scheduleRender();
        this.emit('cameraChanged', this.getCameraState());
    }

    fitToView() {
        const sceneBounds = this.parent?.sharedScene?.getBounds();
        if (!sceneBounds) return;

        const rect = this.canvas.getBoundingClientRect();
        const padding = 50;

        const boundsWidth = sceneBounds.maxX - sceneBounds.minX;
        const boundsHeight = sceneBounds.maxY - sceneBounds.minY;

        if (boundsWidth === 0 || boundsHeight === 0) return;

        const scaleX = (rect.width - padding * 2) / boundsWidth;
        const scaleY = (rect.height - padding * 2) / boundsHeight;

        this.camera.zoom = Math.min(scaleX, scaleY, this.camera.maxZoom);
        this.camera.x = (sceneBounds.minX + sceneBounds.maxX) / 2;
        this.camera.y = (sceneBounds.minY + sceneBounds.maxY) / 2;

        this.scheduleRender();
        this.emit('cameraChanged', this.getCameraState());
    }

    updateRenderStats(startTime) {
        this.debug.renderTime = performance.now() - startTime;
        this.state.frameCount++;
        this.state.lastRender = Date.now();

        // Reset frame count every second
        if (!this.fpsInterval) {
            this.fpsInterval = setInterval(() => {
                this.state.frameCount = 0;
            }, 1000);
        }
    }

    // PUBLIC API

    getCameraState() {
        return { ...this.camera };
    }

    setCameraState(cameraState) {
        Object.assign(this.camera, cameraState);
        this.scheduleRender();
    }

    getSelection() {
        return [];
    }

    setSelection(selection) {
        // Implementation for selection
        this.scheduleRender();
    }

    setVisible(visible) {
        this.canvas.style.display = visible ? 'block' : 'none';
        if (visible) {
            this.scheduleRender();
        }
    }

    processUpdates(updates) {
        console.log('[UltimateCanvasController] Processing updates:', updates);
        this.scheduleRender();
    }

    // EVENT SYSTEM

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
                    console.error(`[UltimateCanvasController] Event listener error for ${event}:`, error);
                }
            }
        }
    }

    // DEBUGGING

    getDebugInfo() {
        return {
            state: this.state,
            camera: this.camera,
            debug: this.debug,
            renderConfig: this.renderConfig,
            canvasSize: {
                display: `${this.canvas.style.width}x${this.canvas.style.height}`,
                actual: `${this.canvas.width}x${this.canvas.height}`
            }
        };
    }

    // CLEANUP

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        if (this.fpsInterval) {
            clearInterval(this.fpsInterval);
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }

        this.eventListeners.clear();

        console.log('[UltimateCanvasController] Destroyed');
    }
}

module.exports = UltimateCanvasController;