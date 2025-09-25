
/**
 * CRITICAL FIX: Visual Rendering System for FloorPlan Pro
 * Fixes îlot placement visualization issues
 */

class FixedAutodeskViewerOverlay {
    constructor(viewer) {
        this.viewer = viewer;
        this.overlayMeshes = [];
        this.isInitialized = false;
        
        console.log('🎨 Fixed Autodesk Viewer Overlay initializing...');
    }
    
    async initialize() {
        try {
            if (!this.viewer || !this.viewer.impl) {
                throw new Error('Viewer not ready');
            }
            
            // Use proper Autodesk Viewer API methods
            this.scene = this.viewer.impl.scene;
            this.renderer = this.viewer.impl.renderer();
            this.camera = this.viewer.impl.camera;
            
            // Create materials for îlots
            this.materials = {
                workspace: new THREE.MeshLambertMaterial({
                    color: 0x3b82f6,
                    transparent: true,
                    opacity: 0.8
                }),
                meeting: new THREE.MeshLambertMaterial({
                    color: 0x10b981,
                    transparent: true,
                    opacity: 0.8
                }),
                social: new THREE.MeshLambertMaterial({
                    color: 0xf59e0b,
                    transparent: true,
                    opacity: 0.8
                }),
                invalid: new THREE.MeshLambertMaterial({
                    color: 0xef4444,
                    transparent: true,
                    opacity: 0.8
                })
            };
            
            this.isInitialized = true;
            console.log('✅ Fixed Autodesk Viewer Overlay initialized');
            return true;
            
        } catch (error) {
            console.error('❌ Fixed overlay initialization failed:', error);
            return false;
        }
    }
    
    addIlotsToViewer(ilots) {
        console.log(`🎨 FIXED: Adding ${ilots.length} îlots to viewer`);
        
        try {
            // Clear existing îlots
            this.clearIlots();
            
            for (const ilot of ilots) {
                this.addSingleIlotFixed(ilot);
            }
            
            // Force viewer refresh
            this.viewer.impl.invalidate(true, true);
            this.viewer.impl.sceneUpdated(true);
            
            console.log(`✅ FIXED: ${ilots.length} îlots added to viewer successfully`);
            
        } catch (error) {
            console.error('❌ FIXED: Failed to add îlots to viewer:', error);
        }
    }
    
    addSingleIlotFixed(ilot) {
        try {
            // Create îlot geometry with proper scale
            const width = (ilot.width || 3) * 30; // Scale up for visibility
            const height = (ilot.height || 2) * 30;
            const depth = 5; // Make it visible
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            
            // Select material
            const materialKey = ilot.isValid === false ? 'invalid' : (ilot.type || 'workspace');
            const material = this.materials[materialKey] || this.materials.workspace;
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position the îlot with proper scaling
            const centerX = (ilot.x || 0) * 30 + width / 2;
            const centerY = (ilot.y || 0) * 30 + height / 2;
            const centerZ = depth / 2; // Above floor level
            
            mesh.position.set(centerX, centerY, centerZ);
            
            // Add visible text label
            const labelSprite = this.createVisibleLabel(ilot);
            mesh.add(labelSprite);
            
            // Store data
            mesh.userData = {
                type: 'ilot',
                ilotData: ilot,
                id: ilot.id
            };
            
            // Add directly to main scene
            this.scene.add(mesh);
            this.overlayMeshes.push(mesh);
            
            console.log(`✅ FIXED: Added îlot ${ilot.id} at position (${centerX}, ${centerY}, ${centerZ})`);
            
        } catch (error) {
            console.error(`❌ FIXED: Failed to add îlot ${ilot.id}:`, error);
        }
    }
    
    createVisibleLabel(ilot) {
        try {
            // Create large, visible label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 256;
            
            // White background with border
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.strokeStyle = ilot.isValid === false ? '#ef4444' : '#10b981';
            context.lineWidth = 8;
            context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
            
            // Large, bold text
            context.fillStyle = '#1f2937';
            context.font = 'bold 36px Arial';
            context.textAlign = 'center';
            
            const centerX = canvas.width / 2;
            context.fillText((ilot.type || 'workspace').toUpperCase(), centerX, 60);
            
            context.font = '28px Arial';
            context.fillText(`ID: ${ilot.id}`, centerX, 110);
            context.fillText(`Capacity: ${ilot.capacity || 4}`, centerX, 150);
            context.fillText(`Size: ${ilot.width}×${ilot.height}m`, centerX, 190);
            context.fillText(ilot.isValid === false ? '❌ INVALID' : '✅ VALID', centerX, 230);
            
            // Create sprite with large scale
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(0, 0, 20); // High above îlot
            sprite.scale.set(40, 20, 1); // Large scale
            
            return sprite;
            
        } catch (error) {
            console.error('❌ Failed to create label:', error);
            return new THREE.Object3D();
        }
    }
    
    clearIlots() {
        for (const mesh of this.overlayMeshes) {
            this.scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) mesh.material.dispose();
        }
        this.overlayMeshes = [];
        
        if (this.viewer && this.viewer.impl) {
            this.viewer.impl.invalidate(true, true);
        }
    }
}

class FixedCanvasController {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`❌ Canvas element '${canvasId}' not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.elements = {
            ilots: [],
            corridors: []
        };
        
        // Set canvas size to match container
        this.resizeCanvas();
        
        // Viewport settings
        this.viewport = {
            offsetX: 50,
            offsetY: 50,
            scale: 1
        };
        
        console.log('✅ Fixed Canvas Controller initialized');
    }
    
    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width || 800;
        this.canvas.height = rect.height || 600;
    }
    
    addIlots(ilots) {
        console.log(`📋 FIXED Canvas: Adding ${ilots.length} îlots`);
        
        this.elements.ilots = [...ilots];
        this.render();
        
        console.log('✅ FIXED Canvas: Îlots rendered');
    }
    
    render() {
        if (!this.canvas || !this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set white background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw îlots
        this.drawIlots();
        
        console.log(`🎨 Canvas rendered with ${this.elements.ilots.length} îlots`);
    }
    
    drawGrid() {
        const gridSize = 50;
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.lineWidth = 1;
        
        this.ctx.beginPath();
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
        }
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
        }
        this.ctx.stroke();
    }
    
    drawIlots() {
        for (const ilot of this.elements.ilots) {
            this.drawSingleIlot(ilot);
        }
    }
    
    drawSingleIlot(ilot) {
        try {
            // Convert to screen coordinates with proper scaling
            const screenX = (ilot.x * 30) + this.viewport.offsetX;
            const screenY = (ilot.y * 30) + this.viewport.offsetY;
            const screenW = (ilot.width || 3) * 30;
            const screenH = (ilot.height || 2) * 30;
            
            // Ensure îlot is visible on canvas
            if (screenX + screenW > 0 && screenY + screenH > 0 && 
                screenX < this.canvas.width && screenY < this.canvas.height) {
                
                // Select color based on type and validity
                let fillColor = '#3b82f6';
                if (ilot.isValid === false) {
                    fillColor = '#ef4444';
                } else if (ilot.type === 'meeting') {
                    fillColor = '#10b981';
                } else if (ilot.type === 'social') {
                    fillColor = '#f59e0b';
                }
                
                // Draw îlot rectangle
                this.ctx.fillStyle = fillColor + '80'; // Add transparency
                this.ctx.strokeStyle = fillColor;
                this.ctx.lineWidth = 2;
                
                this.ctx.fillRect(screenX, screenY, screenW, screenH);
                this.ctx.strokeRect(screenX, screenY, screenW, screenH);
                
                // Draw label
                this.ctx.fillStyle = '#1f2937';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.textAlign = 'center';
                
                const centerX = screenX + screenW / 2;
                const centerY = screenY + screenH / 2;
                
                this.ctx.fillText((ilot.type || 'workspace').toUpperCase(), centerX, centerY - 10);
                this.ctx.font = '12px Arial';
                this.ctx.fillText(`ID: ${ilot.id}`, centerX, centerY + 5);
                this.ctx.fillText(`${ilot.capacity || 4} people`, centerX, centerY + 20);
            }
            
        } catch (error) {
            console.error(`❌ Failed to draw îlot ${ilot.id}:`, error);
        }
    }
    
    clearAll() {
        this.elements = { ilots: [], corridors: [] };
        this.render();
    }
    
    fitToView() {
        if (this.elements.ilots.length === 0) return;
        
        // Calculate bounds of all îlots
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const ilot of this.elements.ilots) {
            minX = Math.min(minX, ilot.x);
            minY = Math.min(minY, ilot.y);
            maxX = Math.max(maxX, ilot.x + (ilot.width || 3));
            maxY = Math.max(maxY, ilot.y + (ilot.height || 2));
        }
        
        // Add padding and center
        const padding = 2;
        const boundsWidth = (maxX - minX + padding * 2) * 30;
        const boundsHeight = (maxY - minY + padding * 2) * 30;
        
        const scaleX = this.canvas.width / boundsWidth;
        const scaleY = this.canvas.height / boundsHeight;
        const scale = Math.min(scaleX, scaleY, 2); // Max scale of 2
        
        this.viewport.scale = scale;
        this.viewport.offsetX = (this.canvas.width - boundsWidth * scale) / 2 - (minX - padding) * 30 * scale;
        this.viewport.offsetY = (this.canvas.height - boundsHeight * scale) / 2 - (minY - padding) * 30 * scale;
        
        this.render();
    }
}

class CompleteFixedController {
    constructor() {
        this.canvasController = null;
        this.viewerOverlay = null;
        this.viewer = null;
        this.currentElements = {
            ilots: [],
            corridors: []
        };
        
        console.log('🚀 Complete Fixed Controller created');
    }
    
    async initializeCanvas(canvasId) {
        try {
            this.canvasController = new FixedCanvasController(canvasId);
            console.log('✅ Canvas initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Canvas initialization failed:', error);
            return false;
        }
    }
    
    async initializeViewer(viewer) {
        try {
            if (!viewer || !viewer.impl) {
                throw new Error('Invalid viewer instance');
            }
            
            this.viewer = viewer;
            this.viewerOverlay = new FixedAutodeskViewerOverlay(viewer);
            
            const success = await this.viewerOverlay.initialize();
            if (!success) {
                throw new Error('Viewer overlay initialization failed');
            }
            
            console.log('✅ Viewer overlay initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Viewer initialization failed:', error);
            return false;
        }
    }
    
    async addIlots(ilots) {
        console.log(`🏗️ COMPLETE FIX: Adding ${ilots.length} îlots to all displays`);
        
        try {
            // Store îlots
            this.currentElements.ilots = [...ilots];
            
            // Add to canvas
            if (this.canvasController) {
                this.canvasController.addIlots(ilots);
                // Auto-fit view to show îlots
                setTimeout(() => this.canvasController.fitToView(), 100);
            }
            
            // Add to viewer
            if (this.viewerOverlay && this.viewerOverlay.isInitialized) {
                this.viewerOverlay.addIlotsToViewer(ilots);
            }
            
            console.log('✅ COMPLETE FIX: Îlots added to all displays successfully');
            return true;
            
        } catch (error) {
            console.error('❌ COMPLETE FIX: Failed to add îlots:', error);
            return false;
        }
    }
    
    clearAll() {
        if (this.canvasController) {
            this.canvasController.clearAll();
        }
        
        if (this.viewerOverlay) {
            this.viewerOverlay.clearIlots();
        }
        
        this.currentElements = { ilots: [], corridors: [] };
        console.log('✅ All elements cleared');
    }
    
    switchToCanvas() {
        document.getElementById('floorPlanCanvas').style.display = 'block';
        document.getElementById('floorPlanCanvas').style.visibility = 'visible';
        if (document.getElementById('forgeViewer')) {
            document.getElementById('forgeViewer').style.display = 'none';
        }
        console.log('🔄 Switched to Canvas mode');
    }
    
    switchToViewer() {
        document.getElementById('floorPlanCanvas').style.display = 'none';
        if (document.getElementById('forgeViewer')) {
            document.getElementById('forgeViewer').style.display = 'block';
        }
        console.log('🔄 Switched to Viewer mode');
    }
}

// Make globally available
window.FixedAutodeskViewerOverlay = FixedAutodeskViewerOverlay;
window.FixedCanvasController = FixedCanvasController;
window.CompleteFixedController = CompleteFixedController;

console.log('✅ Complete Fixed Visual Rendering System loaded');
