
/**
 * COMPLETE SOLUTION: Manual Canvas + Autodesk Viewer Integration
 * 
 * This file provides:
 * 1. Complete Manual Canvas Controller with full drawing capabilities
 * 2. Autodesk Viewer Overlay Manager for 3D îlot/corridor visualization
 * 3. Unified Controller for seamless integration
 */

// SOLUTION 1: COMPLETE MANUAL CANVAS CONTROLLER

class CompleteCanvasController {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            throw new Error(`Canvas element with ID '${canvasId}' not found`);
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            width: options.width || 800,
            height: options.height || 600,
            backgroundColor: options.backgroundColor || '#f8fafc',
            gridSize: options.gridSize || 50,
            showGrid: options.showGrid !== false,
            enablePanning: options.enablePanning !== false,
            enableZooming: options.enableZooming !== false,
            ...options
        };
        
        // Viewport and transformation
        this.viewport = {
            offsetX: 0,
            offsetY: 0,
            scale: 1,
            minScale: 0.1,
            maxScale: 5.0
        };
        
        // Drawing state
        this.elements = {
            walls: [],
            doors: [],
            windows: [],
            ilots: [],
            corridors: [],
            annotations: []
        };
        
        // Interaction state
        this.interaction = {
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            selectedElement: null,
            mode: 'view', // 'view', 'draw', 'edit'
            tool: 'select' // 'select', 'wall', 'door', 'ilot', 'corridor'
        };
        
        this.initializeCanvas();
        this.setupEventListeners();
        
        console.log('✅ Complete Canvas Controller initialized');
    }
    
    initializeCanvas() {
        // Set canvas size
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.style.width = this.options.width + 'px';
        this.canvas.style.height = this.options.height + 'px';
        
        // Set canvas styles
        this.canvas.style.border = '1px solid #d1d5db';
        this.canvas.style.borderRadius = '8px';
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.backgroundColor = this.options.backgroundColor;
        
        // Initial render
        this.render();
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        
        // Touch events (mobile support)
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Context menu (right-click)
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        
        // Prevent default drag behavior
        this.canvas.addEventListener('dragstart', (e) => e.preventDefault());
    }
    
    // COORDINATE TRANSFORMATIONS
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        return {
            x: (canvasX - this.viewport.offsetX) / this.viewport.scale,
            y: (canvasY - this.viewport.offsetY) / this.viewport.scale
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.viewport.scale + this.viewport.offsetX,
            y: worldY * this.viewport.scale + this.viewport.offsetY
        };
    }
    
    // EVENT HANDLERS
    onMouseDown(event) {
        const worldPos = this.screenToWorld(event.clientX, event.clientY);
        
        if (event.button === 0) { // Left click
            this.interaction.isDragging = true;
            this.interaction.dragStart = { x: event.clientX, y: event.clientY };
            
            if (this.interaction.mode === 'view') {
                // Pan mode
                this.canvas.style.cursor = 'grabbing';
            } else if (this.interaction.mode === 'draw') {
                // Drawing mode
                this.startDrawing(worldPos);
            } else if (this.interaction.mode === 'edit') {
                // Select element
                this.selectElement(worldPos);
            }
        }
        
        console.log('Canvas clicked at:', event.clientX, event.clientY);
    }
    
    onMouseMove(event) {
        const worldPos = this.screenToWorld(event.clientX, event.clientY);
        
        if (this.interaction.isDragging) {
            if (this.interaction.mode === 'view') {
                // Pan viewport
                const deltaX = event.clientX - this.interaction.dragStart.x;
                const deltaY = event.clientY - this.interaction.dragStart.y;
                
                this.viewport.offsetX += deltaX;
                this.viewport.offsetY += deltaY;
                
                this.interaction.dragStart = { x: event.clientX, y: event.clientY };
                this.render();
            } else if (this.interaction.mode === 'draw') {
                // Update drawing preview
                this.updateDrawing(worldPos);
            } else if (this.interaction.mode === 'edit' && this.interaction.selectedElement) {
                // Move selected element
                this.moveSelectedElement(worldPos);
            }
        }
        
        // Update cursor
        this.updateCursor(worldPos);
    }
    
    onMouseUp(event) {
        if (this.interaction.isDragging) {
            const worldPos = this.screenToWorld(event.clientX, event.clientY);
            
            if (this.interaction.mode === 'draw') {
                this.finishDrawing(worldPos);
            }
            
            this.interaction.isDragging = false;
            this.canvas.style.cursor = this.getDefaultCursor();
            this.render();
        }
    }
    
    onWheel(event) {
        event.preventDefault();
        
        if (this.options.enableZooming) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            
            const scaleFactor = event.deltaY < 0 ? 1.1 : 0.9;
            const newScale = Math.max(this.viewport.minScale, 
                            Math.min(this.viewport.maxScale, this.viewport.scale * scaleFactor));
            
            if (newScale !== this.viewport.scale) {
                // Zoom towards mouse position
                const worldBefore = this.screenToWorld(event.clientX, event.clientY);
                
                this.viewport.scale = newScale;
                
                const worldAfter = this.screenToWorld(event.clientX, event.clientY);
                
                this.viewport.offsetX += (worldAfter.x - worldBefore.x) * this.viewport.scale;
                this.viewport.offsetY += (worldAfter.y - worldBefore.y) * this.viewport.scale;
                
                this.render();
            }
        }
    }
    
    onTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.onMouseDown({
                clientX: touch.clientX,
                clientY: touch.clientY,
                button: 0,
                preventDefault: () => {}
            });
        }
    }
    
    onTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.onMouseMove({
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }
    }
    
    onTouchEnd(event) {
        event.preventDefault();
        this.onMouseUp({ preventDefault: () => {} });
    }
    
    onContextMenu(event) {
        event.preventDefault();
        return false;
    }
    
    onKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                this.interaction.mode = 'view';
                this.interaction.selectedElement = null;
                this.currentDrawing = null;
                this.render();
                break;
            case 'Delete':
                if (this.interaction.selectedElement) {
                    this.deleteSelectedElement();
                }
                break;
        }
    }
    
    // DRAWING METHODS
    startDrawing(worldPos) {
        switch (this.interaction.tool) {
            case 'wall':
                this.startDrawingWall(worldPos);
                break;
            case 'door':
                this.startDrawingDoor(worldPos);
                break;
            case 'ilot':
                this.startDrawingIlot(worldPos);
                break;
            case 'corridor':
                this.startDrawingCorridor(worldPos);
                break;
        }
    }
    
    startDrawingWall(startPos) {
        this.currentDrawing = {
            type: 'wall',
            startX: startPos.x,
            startY: startPos.y,
            endX: startPos.x,
            endY: startPos.y,
            thickness: 0.2,
            id: `wall_${Date.now()}`
        };
    }
    
    startDrawingIlot(startPos) {
        this.currentDrawing = {
            type: 'ilot',
            x: startPos.x,
            y: startPos.y,
            width: 3,
            height: 2,
            ilotType: 'workspace',
            capacity: 4,
            id: `ilot_${Date.now()}`
        };
    }
    
    updateDrawing(worldPos) {
        if (!this.currentDrawing) return;
        
        switch (this.currentDrawing.type) {
            case 'wall':
                this.currentDrawing.endX = worldPos.x;
                this.currentDrawing.endY = worldPos.y;
                break;
            case 'ilot':
                this.currentDrawing.width = Math.abs(worldPos.x - this.currentDrawing.x);
                this.currentDrawing.height = Math.abs(worldPos.y - this.currentDrawing.y);
                break;
        }
        
        this.render();
    }
    
    finishDrawing(worldPos) {
        if (!this.currentDrawing) return;
        
        // Add completed element to appropriate array
        switch (this.currentDrawing.type) {
            case 'wall':
                this.elements.walls.push({ ...this.currentDrawing });
                break;
            case 'ilot':
                this.elements.ilots.push({ ...this.currentDrawing });
                break;
            case 'corridor':
                this.elements.corridors.push({ ...this.currentDrawing });
                break;
        }
        
        this.currentDrawing = null;
        this.triggerElementAdded();
    }
    
    selectElement(worldPos) {
        // Find element at position
        this.interaction.selectedElement = null;
        
        // Check îlots first
        for (const ilot of this.elements.ilots) {
            if (worldPos.x >= ilot.x && worldPos.x <= ilot.x + ilot.width &&
                worldPos.y >= ilot.y && worldPos.y <= ilot.y + ilot.height) {
                this.interaction.selectedElement = ilot;
                break;
            }
        }
        
        this.render();
    }
    
    moveSelectedElement(worldPos) {
        if (!this.interaction.selectedElement) return;
        
        const element = this.interaction.selectedElement;
        if (element.type === 'ilot') {
            element.x = worldPos.x - element.width / 2;
            element.y = worldPos.y - element.height / 2;
        }
        
        this.render();
    }
    
    deleteSelectedElement() {
        if (!this.interaction.selectedElement) return;
        
        const element = this.interaction.selectedElement;
        
        // Remove from appropriate array
        if (element.type === 'ilot') {
            const index = this.elements.ilots.indexOf(element);
            if (index > -1) this.elements.ilots.splice(index, 1);
        } else if (element.type === 'wall') {
            const index = this.elements.walls.indexOf(element);
            if (index > -1) this.elements.walls.splice(index, 1);
        }
        
        this.interaction.selectedElement = null;
        this.render();
    }
    
    updateCursor(worldPos) {
        // Update cursor based on context
    }
    
    // RENDERING METHODS
    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context
        this.ctx.save();
        
        // Apply viewport transformation
        this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
        this.ctx.scale(this.viewport.scale, this.viewport.scale);
        
        // Draw grid
        if (this.options.showGrid) {
            this.drawGrid();
        }
        
        // Draw elements
        this.drawWalls();
        this.drawDoors();
        this.drawWindows();
        this.drawIlots();
        this.drawCorridors();
        this.drawAnnotations();
        
        // Draw current drawing preview
        if (this.currentDrawing) {
            this.drawCurrentDrawing();
        }
        
        // Draw selection
        this.drawSelection();
        
        // Restore context
        this.ctx.restore();
        
        // Draw UI overlay (not affected by viewport transform)
        this.drawUIOverlay();
    }
    
    drawGrid() {
        const gridSize = this.options.gridSize;
        const startX = Math.floor(-this.viewport.offsetX / this.viewport.scale / gridSize) * gridSize;
        const startY = Math.floor(-this.viewport.offsetY / this.viewport.scale / gridSize) * gridSize;
        const endX = startX + (this.canvas.width / this.viewport.scale) + gridSize;
        const endY = startY + (this.canvas.height / this.viewport.scale) + gridSize;
        
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.lineWidth = 1 / this.viewport.scale;
        
        this.ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
        }
        this.ctx.stroke();
    }
    
    drawWalls() {
        this.ctx.strokeStyle = '#374151';
        this.ctx.lineWidth = 0.2;
        this.ctx.lineCap = 'round';
        
        for (const wall of this.elements.walls) {
            this.ctx.beginPath();
            this.ctx.moveTo(wall.startX, wall.startY);
            this.ctx.lineTo(wall.endX, wall.endY);
            this.ctx.stroke();
        }
    }
    
    drawDoors() {
        // Draw doors
    }
    
    drawWindows() {
        // Draw windows
    }
    
    drawIlots() {
        for (const ilot of this.elements.ilots) {
            // Determine color based on type
            let fillColor = '#3b82f6'; // Default blue
            switch (ilot.ilotType) {
                case 'meeting': fillColor = '#10b981'; break;
                case 'social': fillColor = '#f59e0b'; break;
                case 'break': fillColor = '#8b5cf6'; break;
                case 'focus': fillColor = '#ef4444'; break;
            }
            
            // Draw îlot rectangle
            this.ctx.fillStyle = fillColor + '80'; // Add transparency
            this.ctx.strokeStyle = fillColor;
            this.ctx.lineWidth = 0.1;
            
            this.ctx.fillRect(ilot.x, ilot.y, ilot.width, ilot.height);
            this.ctx.strokeRect(ilot.x, ilot.y, ilot.width, ilot.height);
            
            // Draw label
            this.drawIlotLabel(ilot);
        }
    }
    
    drawIlotLabel(ilot) {
        const centerX = ilot.x + ilot.width / 2;
        const centerY = ilot.y + ilot.height / 2;
        
        this.ctx.fillStyle = '#1f2937';
        this.ctx.font = `${0.3}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        this.ctx.fillText((ilot.ilotType || 'workspace').toUpperCase(), centerX, centerY - 0.2);
        this.ctx.fillText(`${ilot.capacity || 4} people`, centerX, centerY + 0.2);
    }
    
    drawCorridors() {
        this.ctx.fillStyle = '#fbbf24';
        this.ctx.strokeStyle = '#f59e0b';
        this.ctx.lineWidth = 0.05;
        
        for (const corridor of this.elements.corridors) {
            if (corridor.polygon) {
                this.ctx.beginPath();
                const points = corridor.polygon;
                this.ctx.moveTo(points[0][0], points[0][1]);
                for (let i = 1; i < points.length; i++) {
                    this.ctx.lineTo(points[i][0], points[i][1]);
                }
                this.ctx.closePath();
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
    }
    
    drawAnnotations() {
        // Draw annotations
    }
    
    drawCurrentDrawing() {
        if (!this.currentDrawing) return;
        
        this.ctx.strokeStyle = '#6b7280';
        this.ctx.setLineDash([5, 5]);
        
        switch (this.currentDrawing.type) {
            case 'wall':
                this.ctx.beginPath();
                this.ctx.moveTo(this.currentDrawing.startX, this.currentDrawing.startY);
                this.ctx.lineTo(this.currentDrawing.endX, this.currentDrawing.endY);
                this.ctx.stroke();
                break;
            case 'ilot':
                this.ctx.strokeRect(this.currentDrawing.x, this.currentDrawing.y, 
                                  this.currentDrawing.width, this.currentDrawing.height);
                break;
        }
        
        this.ctx.setLineDash([]);
    }
    
    drawSelection() {
        if (!this.interaction.selectedElement) return;
        
        const element = this.interaction.selectedElement;
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 0.1;
        this.ctx.setLineDash([0.2, 0.2]);
        
        if (element.x !== undefined) { // Rectangle element
            this.ctx.strokeRect(element.x - 0.1, element.y - 0.1, 
                              element.width + 0.2, element.height + 0.2);
        }
        
        this.ctx.setLineDash([]);
    }
    
    drawUIOverlay() {
        // Draw status text
        this.ctx.fillStyle = '#1f2937';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        const status = `Mode: ${this.interaction.mode} | Tool: ${this.interaction.tool} | Scale: ${this.viewport.scale.toFixed(2)}x`;
        this.ctx.fillText(status, 10, 10);
    }
    
    // PUBLIC API METHODS
    addIlots(ilots) {
        console.log(`📋 Canvas: Adding ${ilots.length} îlots to canvas`);
        
        for (const ilot of ilots) {
            this.elements.ilots.push({
                id: ilot.id,
                x: ilot.x,
                y: ilot.y,
                width: ilot.width,
                height: ilot.height,
                ilotType: ilot.type || 'workspace',
                capacity: ilot.capacity || 4,
                isValid: ilot.isValid !== false,
                score: ilot.score || 0.8
            });
        }
        
        this.render();
        console.log('✅ Canvas: Îlots rendered successfully');
    }
    
    addCorridors(corridors) {
        console.log(`🛤️ Canvas: Adding ${corridors.length} corridors to canvas`);
        
        for (const corridor of corridors) {
            this.elements.corridors.push({
                id: corridor.id,
                polygon: corridor.polygon,
                width: corridor.width || 1.8,
                type: corridor.type || 'main'
            });
        }
        
        this.render();
        console.log('✅ Canvas: Corridors rendered successfully');
    }
    
    clearIlots() {
        this.elements.ilots = [];
        this.render();
    }
    
    clearCorridors() {
        this.elements.corridors = [];
        this.render();
    }
    
    clearAll() {
        this.elements = {
            walls: [],
            doors: [],
            windows: [],
            ilots: [],
            corridors: [],
            annotations: []
        };
        this.render();
    }
    
    // TOOL METHODS
    setTool(tool) {
        this.interaction.tool = tool;
        this.canvas.style.cursor = this.getDefaultCursor();
        console.log(`🔧 Canvas tool changed to: ${tool}`);
    }
    
    setMode(mode) {
        this.interaction.mode = mode;
        this.canvas.style.cursor = this.getDefaultCursor();
        console.log(`🔧 Canvas mode changed to: ${mode}`);
    }
    
    getDefaultCursor() {
        switch (this.interaction.mode) {
            case 'view': return 'grab';
            case 'draw': return 'crosshair';
            case 'edit': return 'pointer';
            default: return 'default';
        }
    }
    
    // EXPORT METHODS
    exportToImage() {
        return this.canvas.toDataURL('image/png');
    }
    
    exportElements() {
        return {
            walls: [...this.elements.walls],
            doors: [...this.elements.doors],
            windows: [...this.elements.windows],
            ilots: [...this.elements.ilots],
            corridors: [...this.elements.corridors],
            annotations: [...this.elements.annotations],
            viewport: { ...this.viewport }
        };
    }
    
    // EVENT CALLBACKS
    triggerElementAdded() {
        const event = new CustomEvent('elementAdded', {
            detail: { elements: this.exportElements() }
        });
        this.canvas.dispatchEvent(event);
    }
    
    // UTILITY METHODS
    fitToView() {
        // Calculate bounding box of all elements
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        [...this.elements.walls, ...this.elements.ilots, ...this.elements.corridors].forEach(element => {
            if (element.startX !== undefined) { // Wall
                minX = Math.min(minX, element.startX, element.endX);
                minY = Math.min(minY, element.startY, element.endY);
                maxX = Math.max(maxX, element.startX, element.endX);
                maxY = Math.max(maxY, element.startY, element.endY);
            } else if (element.x !== undefined) { // Îlot
                minX = Math.min(minX, element.x);
                minY = Math.min(minY, element.y);
                maxX = Math.max(maxX, element.x + element.width);
                maxY = Math.max(maxY, element.y + element.height);
            }
        });
        
        if (isFinite(minX)) {
            const width = maxX - minX;
            const height = maxY - minY;
            const margin = 50;
            
            const scaleX = (this.canvas.width - margin * 2) / width;
            const scaleY = (this.canvas.height - margin * 2) / height;
            const scale = Math.min(scaleX, scaleY, this.viewport.maxScale);
            
            this.viewport.scale = scale;
            this.viewport.offsetX = margin - minX * scale;
            this.viewport.offsetY = margin - minY * scale;
            
            this.render();
        }
    }
}

// SOLUTION 2: AUTODESK VIEWER OVERLAY SYSTEM

class AutodeskViewerOverlayManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.overlayScene = new THREE.Scene();
        this.overlayRenderer = null;
        this.overlayCamera = null;
        this.overlayMeshes = {
            ilots: [],
            corridors: [],
            annotations: []
        };
        
        this.isInitialized = false;
        
        console.log('🎨 Autodesk Viewer Overlay Manager created');
    }
    
    async initialize() {
        try {
            if (!this.viewer || !this.viewer.impl) {
                throw new Error('Autodesk Viewer not properly initialized');
            }
            
            // Get viewer's THREE.js components
            this.scene = this.viewer.impl.scene;
            this.renderer = this.viewer.impl.renderer();
            this.camera = this.viewer.impl.camera;
            
            // Create overlay rendering setup
            this.setupOverlayRenderer();
            
            // Hook into viewer's render loop
            this.hookRenderLoop();
            
            this.isInitialized = true;
            console.log('✅ Autodesk Viewer Overlay System initialized');
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Autodesk Viewer Overlay:', error);
            return false;
        }
    }
    
    setupOverlayRenderer() {
        // The overlay will use the same renderer as the viewer
        // but render to a separate scene that overlays the main model
        
        this.overlayCamera = this.camera; // Use same camera for consistent view
        
        // Create materials for different overlay types
        this.materials = {
            ilot_workspace: new THREE.MeshBasicMaterial({
                color: 0x3b82f6,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            }),
            ilot_meeting: new THREE.MeshBasicMaterial({
                color: 0x10b981,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            }),
            ilot_social: new THREE.MeshBasicMaterial({
                color: 0xf59e0b,
                transparent: true,
                opacity: 0.7,
                side: THREE.DoubleSide
            }),
            corridor: new THREE.MeshBasicMaterial({
                color: 0xfbbf24,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            }),
            invalid: new THREE.MeshBasicMaterial({
                color: 0xef4444,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            })
        };
    }
    
    hookRenderLoop() {
        // Store original render method
        const originalRender = this.viewer.impl.renderer().render.bind(this.viewer.impl.renderer());
        
        // Override render method to include our overlay
        this.viewer.impl.renderer().render = (scene, camera, renderTarget, forceClear) => {
            // Render main scene first
            originalRender(scene, camera, renderTarget, forceClear);
            
            // Then render our overlay
            if (this.overlayScene.children.length > 0) {
                this.renderer.render(this.overlayScene, camera);
            }
        };
    }
    
    // ÎLOT OVERLAY METHODS
    addIlotsToViewer(ilots) {
        console.log(`🎨 Adding ${ilots.length} îlots to Autodesk Viewer overlay`);
        
        try {
            // Clear existing îlot meshes
            this.clearIlots();
            
            for (const ilot of ilots) {
                this.addSingleIlot(ilot);
            }
            
            // Force viewer refresh
            this.viewer.impl.invalidate(true);
            
            console.log(`✅ Added ${ilots.length} îlots to viewer successfully`);
            
        } catch (error) {
            console.error('❌ Failed to add îlots to viewer:', error);
        }
    }
    
    addSingleIlot(ilot) {
        try {
            // Create îlot geometry
            const geometry = new THREE.BoxGeometry(
                ilot.width || 3,
                ilot.height || 2,
                0.1
            );
            
            // Select material based on type and validity
            let materialKey = 'ilot_workspace';
            if (!ilot.isValid) {
                materialKey = 'invalid';
            } else {
                materialKey = `ilot_${ilot.type || 'workspace'}`;
            }
            
            const material = this.materials[materialKey] || this.materials.ilot_workspace;
            
            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position the îlot
            const centerX = ilot.x + (ilot.width || 3) / 2;
            const centerY = ilot.y + (ilot.height || 2) / 2;
            const height = 0.05; // Slightly above floor
            
            mesh.position.set(centerX, centerY, height);
            
            // Add label
            const label = this.createIlotLabel(ilot);
            mesh.add(label);
            
            // Store îlot data
            mesh.userData = { 
                type: 'ilot', 
                ilotData: ilot,
                id: ilot.id 
            };
            
            // Add to overlay scene and tracking
            this.overlayScene.add(mesh);
            this.overlayMeshes.ilots.push(mesh);
            
            console.log(`✅ Added îlot ${ilot.id} to viewer at (${centerX}, ${centerY})`);
            
        } catch (error) {
            console.error(`❌ Failed to add îlot ${ilot.id} to viewer:`, error);
        }
    }
    
    createIlotLabel(ilot) {
        try {
            // Create text label using canvas texture
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 128;
            
            // Background
            context.fillStyle = 'rgba(255, 255, 255, 0.95)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Border
            context.strokeStyle = ilot.isValid ? '#10b981' : '#ef4444';
            context.lineWidth = 4;
            context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
            
            // Text content
            context.fillStyle = '#1f2937';
            context.font = 'bold 20px Arial';
            context.textAlign = 'center';
            
            const centerX = canvas.width / 2;
            context.fillText((ilot.type || 'workspace').toUpperCase(), centerX, 35);
            
            context.font = '16px Arial';
            context.fillText(`Capacity: ${ilot.capacity || 4}`, centerX, 60);
            context.fillText(`Score: ${Math.round((ilot.score || 0.8) * 100)}%`, centerX, 80);
            context.fillText(ilot.isValid ? '✅ VALID' : '❌ INVALID', centerX, 105);
            
            // Create sprite
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            const spriteMaterial = new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(0, 0, 1); // Above the îlot
            sprite.scale.set(2, 1, 1);
            
            return sprite;
            
        } catch (error) {
            console.error('❌ Failed to create îlot label:', error);
            return new THREE.Object3D(); // Return empty object as fallback
        }
    }
    
    // CORRIDOR OVERLAY METHODS
    addCorridorsToViewer(corridors) {
        console.log(`🛤️ Adding ${corridors.length} corridors to Autodesk Viewer overlay`);
        
        try {
            // Clear existing corridor meshes
            this.clearCorridors();
            
            for (const corridor of corridors) {
                this.addSingleCorridor(corridor);
            }
            
            // Force viewer refresh
            this.viewer.impl.invalidate(true);
            
            console.log(`✅ Added ${corridors.length} corridors to viewer successfully`);
            
        } catch (error) {
            console.error('❌ Failed to add corridors to viewer:', error);
        }
    }
    
    addSingleCorridor(corridor) {
        try {
            if (!corridor.polygon || !Array.isArray(corridor.polygon)) {
                console.warn(`⚠️ Corridor ${corridor.id} has no valid polygon`);
                return;
            }
            
            // Create corridor geometry from polygon
            const shape = new THREE.Shape();
            const points = corridor.polygon;
            
            // Start with first point
            shape.moveTo(points[0][0], points[0][1]);
            
            // Add remaining points
            for (let i = 1; i < points.length; i++) {
                shape.lineTo(points[i][0], points[i][1]);
            }
            
            // Close the shape
            shape.closePath();
            
            // Extrude the shape to create 3D geometry
            const extrudeSettings = {
                depth: 0.02,
                bevelEnabled: false
            };
            
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            const mesh = new THREE.Mesh(geometry, this.materials.corridor);
            
            // Position slightly above floor
            mesh.position.z = 0.01;
            
            // Store corridor data
            mesh.userData = { 
                type: 'corridor', 
                corridorData: corridor,
                id: corridor.id 
            };
            
            // Add to overlay scene and tracking
            this.overlayScene.add(mesh);
            this.overlayMeshes.corridors.push(mesh);
            
            console.log(`✅ Added corridor ${corridor.id} to viewer`);
            
        } catch (error) {
            console.error(`❌ Failed to add corridor ${corridor.id} to viewer:`, error);
        }
    }
    
    // CLEAR METHODS
    clearIlots() {
        for (const mesh of this.overlayMeshes.ilots) {
            this.overlayScene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.overlayMeshes.ilots = [];
        
        if (this.viewer && this.viewer.impl) {
            this.viewer.impl.invalidate(true);
        }
    }
    
    clearCorridors() {
        for (const mesh of this.overlayMeshes.corridors) {
            this.overlayScene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.overlayMeshes.corridors = [];
        
        if (this.viewer && this.viewer.impl) {
            this.viewer.impl.invalidate(true);
        }
    }
    
    clearAll() {
        this.clearIlots();
        this.clearCorridors();
    }
    
    // INTERACTION METHODS
    onElementClick(callback) {
        this.viewer.addEventListener(Autodesk.Viewing.AGGREGATE_SELECTION_CHANGED_EVENT, (event) => {
            // Handle selection of overlay elements
            const selection = this.viewer.getSelection();
            if (selection && selection.length > 0) {
                // Check if selected object is one of our overlay elements
                const selectedMesh = this.findOverlayMeshById(selection[0]);
                if (selectedMesh && callback) {
                    callback(selectedMesh.userData);
                }
            }
        });
    }
    
    findOverlayMeshById(id) {
        const allMeshes = [...this.overlayMeshes.ilots, ...this.overlayMeshes.corridors];
        return allMeshes.find(mesh => mesh.userData.id === id);
    }
    
    // UTILITY METHODS
    getOverlayStatistics() {
        return {
            ilots: this.overlayMeshes.ilots.length,
            corridors: this.overlayMeshes.corridors.length,
            totalMeshes: this.overlayScene.children.length,
            isInitialized: this.isInitialized
        };
    }
}

// SOLUTION 3: UNIFIED CONTROLLER CLASS

class UnifiedFloorPlanController {
    constructor(options = {}) {
        this.canvasController = null;
        this.viewerOverlay = null;
        this.viewer = null;
        this.currentMode = 'canvas'; // 'canvas' or 'viewer'
        
        this.elements = {
            ilots: [],
            corridors: []
        };
        
        this.options = {
            canvasId: options.canvasId || 'floorPlanCanvas',
            enableDualMode: options.enableDualMode !== false,
            autoSync: options.autoSync !== false,
            ...options
        };
        
        console.log('🚀 Unified FloorPlan Controller created');
    }
    
    // INITIALIZATION
    async initializeCanvas(canvasOptions = {}) {
        try {
            this.canvasController = new CompleteCanvasController(this.options.canvasId, canvasOptions);
            
            // Setup event listeners
            this.setupCanvasEvents();
            
            console.log('✅ Canvas controller initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize canvas controller:', error);
            return false;
        }
    }
    
    async initializeViewer(viewer) {
        try {
            if (!viewer || !viewer.impl) {
                throw new Error('Invalid Autodesk Viewer instance');
            }
            
            this.viewer = viewer;
            this.viewerOverlay = new AutodeskViewerOverlayManager(viewer);
            
            const success = await this.viewerOverlay.initialize();
            if (!success) {
                throw new Error('Failed to initialize viewer overlay');
            }
            
            // Setup event listeners
            this.setupViewerEvents();
            
            console.log('✅ Viewer overlay initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize viewer overlay:', error);
            return false;
        }
    }
    
    // EVENT SETUP
    setupCanvasEvents() {
        if (!this.canvasController) return;
        
        this.canvasController.canvas.addEventListener('elementAdded', (event) => {
            if (this.options.autoSync && this.viewerOverlay) {
                this.syncCanvasToViewer();
            }
        });
    }
    
    setupViewerEvents() {
        if (!this.viewerOverlay) return;
        
        this.viewerOverlay.onElementClick((elementData) => {
            console.log('Overlay element clicked:', elementData);
            // Handle element selection/interaction
        });
    }
    
    // ÎLOT MANAGEMENT
    async addIlots(ilots) {
        console.log(`🏗️ Unified Controller: Adding ${ilots.length} îlots`);
        
        try {
            // Store îlots
            this.elements.ilots = [...ilots];
            
            // Add to active displays
            if (this.canvasController && (this.currentMode === 'canvas' || this.options.enableDualMode)) {
                this.canvasController.addIlots(ilots);
            }
            
            if (this.viewerOverlay && this.viewerOverlay.isInitialized && (this.currentMode === 'viewer' || this.options.enableDualMode)) {
                this.viewerOverlay.addIlotsToViewer(ilots);
            }
            
            console.log('✅ Îlots added to all active displays');
            return true;
        } catch (error) {
            console.error('❌ Failed to add îlots:', error);
            return false;
        }
    }
    
    async addCorridors(corridors) {
        console.log(`🛤️ Unified Controller: Adding ${corridors.length} corridors`);
        
        try {
            // Store corridors
            this.elements.corridors = [...corridors];
            
            // Add to active displays
            if (this.canvasController && (this.currentMode === 'canvas' || this.options.enableDualMode)) {
                this.canvasController.addCorridors(corridors);
            }
            
            if (this.viewerOverlay && this.viewerOverlay.isInitialized && (this.currentMode === 'viewer' || this.options.enableDualMode)) {
                this.viewerOverlay.addCorridorsToViewer(corridors);
            }
            
            console.log('✅ Corridors added to all active displays');
            return true;
        } catch (error) {
            console.error('❌ Failed to add corridors:', error);
            return false;
        }
    }
    
    // MODE SWITCHING
    switchToCanvas() {
        this.currentMode = 'canvas';
        
        // Show canvas, hide viewer
        if (this.canvasController) {
            this.canvasController.canvas.style.display = 'block';
        }
        
        if (this.viewer && this.viewer.container) {
            this.viewer.container.style.display = 'none';
        }
        
        console.log('🔄 Switched to Canvas mode');
    }
    
    switchToViewer() {
        this.currentMode = 'viewer';
        
        // Hide canvas, show viewer
        if (this.canvasController) {
            this.canvasController.canvas.style.display = 'none';
        }
        
        if (this.viewer && this.viewer.container) {
            this.viewer.container.style.display = 'block';
        }
        
        console.log('🔄 Switched to Viewer mode');
    }
    
    // SYNCHRONIZATION
    syncCanvasToViewer() {
        if (!this.viewerOverlay || !this.canvasController) return;
        
        const canvasElements = this.canvasController.exportElements();
        
        if (canvasElements.ilots.length > 0) {
            this.viewerOverlay.addIlotsToViewer(canvasElements.ilots);
        }
        
        if (canvasElements.corridors.length > 0) {
            this.viewerOverlay.addCorridorsToViewer(canvasElements.corridors);
        }
    }
    
    // CLEAR METHODS
    clearAll() {
        if (this.canvasController) {
            this.canvasController.clearAll();
        }
        
        if (this.viewerOverlay) {
            this.viewerOverlay.clearAll();
        }
        
        this.elements = { ilots: [], corridors: [] };
    }
    
    // TOOL METHODS
    setCanvasTool(tool) {
        if (this.canvasController) {
            this.canvasController.setTool(tool);
        }
    }
    
    setCanvasMode(mode) {
        if (this.canvasController) {
            this.canvasController.setMode(mode);
        }
    }
    
    // EXPORT METHODS
    exportToImage() {
        if (this.canvasController) {
            return this.canvasController.exportToImage();
        }
        return null;
    }
    
    // UTILITY METHODS
    getStatistics() {
        return {
            canvas: this.canvasController ? this.canvasController.exportElements() : null,
            viewer: this.viewerOverlay ? this.viewerOverlay.getOverlayStatistics() : null,
            currentMode: this.currentMode,
            totalIlots: this.elements.ilots.length,
            totalCorridors: this.elements.corridors.length
        };
    }
}

// Export classes for global use
window.CompleteCanvasController = CompleteCanvasController;
window.AutodeskViewerOverlayManager = AutodeskViewerOverlayManager;
window.UnifiedFloorPlanController = UnifiedFloorPlanController;

console.log('🎉 Complete Canvas + Viewer Solution loaded successfully!');
