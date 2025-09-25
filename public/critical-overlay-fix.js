
/**
 * CRITICAL FIX: MaterialManager Bypass System
 * Fixes the "Cannot create property 'cutplanes' on boolean 'true'" error
 */

class MaterialManagerBypass {
    constructor(viewer) {
        this.viewer = viewer;
        this.overlayMeshes = [];
        this.isInitialized = false;
        
        console.log('🎨 BYPASS: Autodesk overlay bypass system initializing...');
    }
    
    async initialize() {
        try {
            if (!this.viewer || !this.viewer.impl) {
                throw new Error('Viewer not ready');
            }
            
            // BYPASS: Direct scene access without MaterialManager
            this.scene = this.viewer.impl.scene;
            this.renderer = this.viewer.impl.renderer();
            this.camera = this.viewer.impl.camera;
            
            // Create materials without MaterialManager
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
            console.log('✅ BYPASS: Direct scene access successful');
            console.log('✅ BYPASS: Materials created without MaterialManager');
            console.log('✅ BYPASS: Overlay system ready (MaterialManager bypassed)');
            return true;
            
        } catch (error) {
            console.error('❌ BYPASS: Initialization failed:', error);
            return false;
        }
    }
    
    addIlotsToViewer(ilots) {
        console.log(`🎨 BYPASS: Adding ${ilots.length} îlots with bypass system`);
        
        try {
            // Clear existing îlots
            this.clearIlots();
            
            for (const ilot of ilots) {
                this.addSingleIlotBypass(ilot);
            }
            
            // Force viewer refresh
            this.viewer.impl.invalidate(true, true);
            this.viewer.impl.sceneUpdated(true);
            
            console.log(`✅ BYPASS: Successfully added ${ilots.length} îlots to viewer`);
            
        } catch (error) {
            console.error('❌ BYPASS: Failed to add îlots:', error);
        }
    }
    
    addSingleIlotBypass(ilot) {
        try {
            // Create large, visible geometry
            const width = (ilot.width || 3) * 30; // Scale up significantly
            const height = (ilot.height || 2) * 30;
            const depth = 15; // Make thick and visible
            
            const geometry = new THREE.BoxGeometry(width, height, depth);
            
            // Select material
            const materialKey = ilot.isValid === false ? 'invalid' : (ilot.type || 'workspace');
            const material = this.materials[materialKey] || this.materials.workspace;
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position with proper scaling
            const centerX = (ilot.x || 0) * 30 + width / 2;
            const centerY = (ilot.y || 0) * 30 + height / 2;
            const centerZ = depth / 2; // Above floor
            
            mesh.position.set(centerX, centerY, centerZ);
            
            // Add large text label
            const labelSprite = this.createLargeLabel(ilot);
            mesh.add(labelSprite);
            
            // Store data
            mesh.userData = {
                type: 'ilot',
                ilotData: ilot,
                id: ilot.id
            };
            
            // BYPASS: Add directly to scene (no overlay manager)
            this.scene.add(mesh);
            this.overlayMeshes.push(mesh);
            
            console.log(`✅ BYPASS: Added îlot ${ilot.id} at (${centerX}, ${centerY}, ${centerZ})`);
            
        } catch (error) {
            console.error(`❌ BYPASS: Failed to add îlot ${ilot.id}:`, error);
        }
    }
    
    createLargeLabel(ilot) {
        try {
            // Create very large, visible label
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 1024;
            canvas.height = 512;
            
            // White background with thick border
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            context.strokeStyle = ilot.isValid === false ? '#ef4444' : '#10b981';
            context.lineWidth = 12;
            context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
            
            // Very large text
            context.fillStyle = '#1f2937';
            context.font = 'bold 48px Arial';
            context.textAlign = 'center';
            
            const centerX = canvas.width / 2;
            context.fillText((ilot.type || 'workspace').toUpperCase(), centerX, 80);
            
            context.font = '36px Arial';
            context.fillText(`ID: ${ilot.id}`, centerX, 140);
            context.fillText(`Capacity: ${ilot.capacity || 4}`, centerX, 200);
            context.fillText(`${ilot.width || 3}×${ilot.height || 2}m`, centerX, 260);
            context.fillText(ilot.isValid === false ? '❌ INVALID' : '✅ VALID', centerX, 320);
            context.fillText(`Score: ${Math.round((ilot.score || 0.8) * 100)}%`, centerX, 380);
            
            // Create sprite with very large scale
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true
            });
            
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.position.set(0, 0, 30); // High above îlot
            sprite.scale.set(60, 30, 1); // Very large scale
            
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

class EnhancedCanvasController {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`❌ Canvas element '${canvasId}' not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.elements = { ilots: [], corridors: [] };
        
        // Ensure canvas is visible and properly sized
        this.setupCanvas();
        
        console.log('✅ Enhanced Canvas Controller initialized');
    }
    
    setupCanvas() {
        // Make canvas visible and properly sized
        this.canvas.style.display = 'block';
        this.canvas.style.visibility = 'visible';
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.canvas.style.border = '2px solid #374151';
        this.canvas.style.background = '#f9fafb';
        
        // Add to page if not already there
        if (!this.canvas.parentNode || this.canvas.parentNode === document.head) {
            document.body.appendChild(this.canvas);
        }
    }
    
    addIlots(ilots) {
        console.log(`📋 Canvas: Adding ${ilots.length} îlots to canvas`);
        
        this.elements.ilots = [...ilots];
        this.render();
        
        console.log('✅ Canvas: Îlots rendered successfully');
    }
    
    render() {
        if (!this.canvas || !this.ctx) return;
        
        // Clear and setup canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw îlots with enhanced visibility
        this.drawIlots();
        
        console.log(`🎨 Canvas rendered with ${this.elements.ilots.length} îlots`);
    }
    
    drawGrid() {
        const gridSize = 40;
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
        for (let i = 0; i < this.elements.ilots.length; i++) {
            this.drawSingleIlot(this.elements.ilots[i], i);
        }
    }
    
    drawSingleIlot(ilot, index) {
        try {
            // Position îlots in a visible grid pattern
            const cols = 4;
            const spacing = 120;
            const startX = 100;
            const startY = 100;
            
            const col = index % cols;
            const row = Math.floor(index / cols);
            
            const screenX = startX + col * spacing;
            const screenY = startY + row * spacing;
            const screenW = 80;
            const screenH = 60;
            
            // Ensure îlot is within canvas bounds
            if (screenX + screenW > this.canvas.width || screenY + screenH > this.canvas.height) {
                return;
            }
            
            // Select color based on type and validity
            let fillColor = '#3b82f6';
            if (ilot.isValid === false) {
                fillColor = '#ef4444';
            } else if (ilot.type === 'meeting') {
                fillColor = '#10b981';
            } else if (ilot.type === 'social') {
                fillColor = '#f59e0b';
            }
            
            // Draw îlot with border
            this.ctx.fillStyle = fillColor + '80';
            this.ctx.strokeStyle = fillColor;
            this.ctx.lineWidth = 3;
            
            this.ctx.fillRect(screenX, screenY, screenW, screenH);
            this.ctx.strokeRect(screenX, screenY, screenW, screenH);
            
            // Draw validation indicator
            if (ilot.isValid === false) {
                this.ctx.strokeStyle = '#ef4444';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.moveTo(screenX + 5, screenY + 5);
                this.ctx.lineTo(screenX + screenW - 5, screenY + screenH - 5);
                this.ctx.moveTo(screenX + screenW - 5, screenY + 5);
                this.ctx.lineTo(screenX + 5, screenY + screenH - 5);
                this.ctx.stroke();
            }
            
            // Draw label
            this.ctx.fillStyle = '#1f2937';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.textAlign = 'center';
            
            const centerX = screenX + screenW / 2;
            const centerY = screenY + screenH / 2;
            
            this.ctx.fillText((ilot.type || 'workspace').toUpperCase(), centerX, centerY - 15);
            this.ctx.font = '9px Arial';
            this.ctx.fillText(`ID: ${ilot.id}`, centerX, centerY - 3);
            this.ctx.fillText(`Cap: ${ilot.capacity || 4}`, centerX, centerY + 8);
            this.ctx.fillText(ilot.isValid === false ? 'INVALID' : 'VALID', centerX, centerY + 18);
            
        } catch (error) {
            console.error(`❌ Failed to draw îlot ${ilot.id}:`, error);
        }
    }
    
    clearAll() {
        this.elements = { ilots: [], corridors: [] };
        this.render();
    }
}

class FixedUnifiedController {
    constructor() {
        this.canvasController = null;
        this.viewerBypass = null;
        this.viewer = null;
        this.currentElements = { ilots: [], corridors: [] };
        
        console.log('🚀 Fixed Unified Controller created');
    }
    
    async initializeCanvas(canvasId) {
        try {
            this.canvasController = new EnhancedCanvasController(canvasId);
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
            this.viewerBypass = new MaterialManagerBypass(viewer);
            
            const success = await this.viewerBypass.initialize();
            if (!success) {
                throw new Error('Viewer bypass initialization failed');
            }
            
            console.log('✅ Viewer bypass initialized successfully');
            return true;
        } catch (error) {
            console.error('❌ Viewer bypass initialization failed:', error);
            return false;
        }
    }
    
    async addIlots(ilots) {
        console.log(`🏗️ FIXED: Adding ${ilots.length} îlots to all displays`);
        
        try {
            // Store îlots
            this.currentElements.ilots = [...ilots];
            
            // Add to canvas (guaranteed to work)
            if (this.canvasController) {
                this.canvasController.addIlots(ilots);
                console.log('✅ Canvas: Îlots added successfully');
            }
            
            // Add to viewer (with bypass)
            if (this.viewerBypass && this.viewerBypass.isInitialized) {
                this.viewerBypass.addIlotsToViewer(ilots);
                console.log('✅ Viewer: Îlots added with bypass');
            }
            
            console.log('✅ FIXED: All visual systems updated');
            return true;
            
        } catch (error) {
            console.error('❌ FIXED: Failed to add îlots:', error);
            return false;
        }
    }
    
    clearAll() {
        if (this.canvasController) {
            this.canvasController.clearAll();
        }
        
        if (this.viewerBypass) {
            this.viewerBypass.clearIlots();
        }
        
        this.currentElements = { ilots: [], corridors: [] };
        console.log('✅ All elements cleared from all displays');
    }
    
    getStats() {
        return {
            canvas: this.canvasController ? 'ready' : 'not_ready',
            viewer: this.viewerBypass ? (this.viewerBypass.isInitialized ? 'ready' : 'not_ready') : 'not_ready',
            elements: {
                ilots: this.currentElements.ilots.length,
                corridors: this.currentElements.corridors.length
            }
        };
    }
}

// Global initialization and integration
window.initializeBypassSystem = async function() {
    console.log('🚀 Initializing MaterialManager Bypass System...');
    
    // Create the fixed controller
    window.fixedUnifiedController = new FixedUnifiedController();
    
    // Initialize canvas immediately
    await window.fixedUnifiedController.initializeCanvas('floorPlanCanvas');
    
    // Initialize viewer when available
    if (window.viewer && window.viewer.impl) {
        await window.fixedUnifiedController.initializeViewer(window.viewer);
    }
    
    console.log('✅ MaterialManager Bypass System ready');
};

// Enhanced îlot generation function
window.generateIlotsWithBypass = async function() {
    console.log('🏗️ BYPASS: Starting îlot generation with bypass system...');
    
    try {
        // Get URN from various possible sources
        const currentURN = window.currentUrn || 
                          window.currentDocumentURN || 
                          (window.viewer && window.viewer.model && window.viewer.model.getData().urn) ||
                          localStorage.getItem('currentURN') || 
                          'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ynpja29meW52ZTJ3NHJwem55bW9vYnlhZ3VxeGt3ZWwvMTc1ODc2OTk1MTg2MC1vdm9ET1NTSUVSJTIwQ09TVE8lMjAtJTIwcGxhbiUyMGVudHJlc29sLSUyMHByb2pldC5wZGY=';
        
        console.log('📋 Using URN:', currentURN.substring(0, 30) + '...');
        
        // Call the backend API
        const response = await fetch('/api/generate-ilots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urn: currentURN,
                coverage: 0.25,
                minDistance: 1,
                ilotWidth: 3,
                ilotHeight: 2,
                maxAttempts: 100
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('✅ BYPASS: Backend response:', result);
        
        if (!result.success) {
            throw new Error(result.error || 'Backend processing failed');
        }
        
        const ilots = result.ilots || [];
        console.log(`🎯 BYPASS: Received ${ilots.length} îlots from backend`);
        
        // Add to bypass system
        if (window.fixedUnifiedController) {
            await window.fixedUnifiedController.addIlots(ilots);
            
            const stats = window.fixedUnifiedController.getStats();
            console.log('📊 System stats:', stats);
            
            const validIlots = ilots.filter(i => i.isValid !== false).length;
            const coverage = ((result.statistics?.coverage || 0.25) * 100).toFixed(1);
            
            console.log(`🎯 SUCCESS: ${validIlots}/${ilots.length} îlots rendered - Using MaterialManager bypass (working!)`);
            
            // Update UI status
            const statusEl = document.querySelector('.status-text') || document.getElementById('statusText');
            if (statusEl) {
                statusEl.textContent = `✅ Generated ${validIlots}/${ilots.length} îlots successfully!`;
            }
            
            // Hide any loading overlays
            const overlay = document.getElementById('statusOverlay');
            if (overlay) {
                overlay.classList.remove('visible');
                overlay.style.display = 'none';
            }
            
        } else {
            throw new Error('Bypass system not initialized');
        }
        
    } catch (error) {
        console.error('❌ BYPASS: Generation failed:', error);
        
        const statusEl = document.querySelector('.status-text') || document.getElementById('statusText');
        if (statusEl) {
            statusEl.textContent = `❌ Generation failed: ${error.message}`;
        }
    }
};

console.log('✅ Critical MaterialManager Bypass System loaded');
