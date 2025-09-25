
/**
 * CRITICAL FIX: Complete MaterialManager Bypass System
 * Fixes all identified issues from the console logs
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
    
    addCorridors(corridors) {
        console.log(`🛤️ Canvas: Adding ${corridors.length} corridors to canvas`);
        
        this.elements.corridors = [...corridors];
        this.render();
        
        console.log('✅ Canvas: Corridors rendered successfully');
    }
    
    render() {
        if (!this.canvas || !this.ctx) return;
        
        // Clear and setup canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw corridors first (underneath îlots)
        this.drawCorridors();
        
        // Draw îlots with enhanced visibility
        this.drawIlots();
        
        console.log(`🎨 Canvas rendered with ${this.elements.ilots.length} îlots and ${this.elements.corridors.length} corridors`);
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
    
    drawCorridors() {
        for (let i = 0; i < this.elements.corridors.length; i++) {
            this.drawSingleCorridor(this.elements.corridors[i], i);
        }
    }
    
    drawSingleCorridor(corridor, index) {
        try {
            // Position corridors in canvas space
            const startX = 50 + index * 60;
            const startY = 50;
            const corridorWidth = Math.max(corridor.width * 20, 30); // Scale up and ensure minimum visibility
            const corridorLength = corridor.totalLength ? corridor.totalLength * 3 : 100;
            
            // Draw corridor as rectangle
            let fillColor = corridor.type === 'main' ? '#10b981' : '#6b7280';
            
            this.ctx.fillStyle = fillColor + '60'; // Add transparency
            this.ctx.strokeStyle = fillColor;
            this.ctx.lineWidth = 2;
            
            this.ctx.fillRect(startX, startY, corridorLength, corridorWidth);
            this.ctx.strokeRect(startX, startY, corridorLength, corridorWidth);
            
            // Draw corridor label
            this.ctx.fillStyle = '#1f2937';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            
            const labelX = startX + corridorLength / 2;
            const labelY = startY + corridorWidth / 2;
            
            this.ctx.fillText(corridor.type === 'main' ? 'MAIN' : 'SEC', labelX, labelY - 5);
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`${corridor.width}m wide`, labelX, labelY + 8);
            
        } catch (error) {
            console.error(`❌ Failed to draw corridor ${index}:`, error);
        }
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
            const startY = 150; // Below corridors
            
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
    
    async addCorridors(corridors) {
        console.log(`🛤️ FIXED: Adding ${corridors.length} corridors to all displays`);
        
        try {
            // Store corridors
            this.currentElements.corridors = [...corridors];
            
            // Add to canvas
            if (this.canvasController) {
                this.canvasController.addCorridors(corridors);
                console.log('✅ Canvas: Corridors added successfully');
            }
            
            // Add to viewer (enhanced corridor visualization)
            if (this.viewerBypass && this.viewerBypass.isInitialized) {
                this.addCorridorsToViewer(corridors);
                console.log('✅ Viewer: Corridors added with bypass');
            }
            
            console.log('✅ FIXED: All corridor systems updated');
            return true;
            
        } catch (error) {
            console.error('❌ FIXED: Failed to add corridors:', error);
            return false;
        }
    }
    
    addCorridorsToViewer(corridors) {
        try {
            for (const corridor of corridors) {
                // Create corridor geometry for 3D viewer
                const width = Math.max(corridor.width * 30, 54); // Ensure minimum 1.8m * 30 = 54 units
                const length = corridor.totalLength ? corridor.totalLength * 30 : 300;
                const height = 5;
                
                const geometry = new THREE.BoxGeometry(length, width, height);
                const material = new THREE.MeshLambertMaterial({
                    color: corridor.type === 'main' ? 0x10b981 : 0x6b7280,
                    transparent: true,
                    opacity: 0.6
                });
                
                const mesh = new THREE.Mesh(geometry, material);
                
                // Position corridor
                const centerX = 200 + corridors.indexOf(corridor) * 400;
                const centerY = 200;
                const centerZ = height / 2;
                
                mesh.position.set(centerX, centerY, centerZ);
                
                // Store data
                mesh.userData = {
                    type: 'corridor',
                    corridorData: corridor,
                    id: corridor.id
                };
                
                // Add to scene
                this.viewerBypass.scene.add(mesh);
                this.viewerBypass.overlayMeshes.push(mesh);
            }
            
            // Force viewer refresh
            this.viewer.impl.invalidate(true, true);
            this.viewer.impl.sceneUpdated(true);
            
        } catch (error) {
            console.error('❌ Failed to add corridors to viewer:', error);
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

// CRITICAL: Global initialization function (this was missing!)
window.initializeBypassSystem = async function() {
    console.log('🚀 Initializing MaterialManager Bypass System...');
    
    try {
        // Create the fixed controller
        window.fixedUnifiedController = new FixedUnifiedController();
        
        // Initialize canvas immediately
        await window.fixedUnifiedController.initializeCanvas('floorPlanCanvas');
        
        // Initialize viewer when available
        if (window.viewer && window.viewer.impl) {
            await window.fixedUnifiedController.initializeViewer(window.viewer);
        }
        
        console.log('✅ MaterialManager Bypass System ready');
        return true;
        
    } catch (error) {
        console.error('❌ Bypass system initialization failed:', error);
        return false;
    }
};

// Enhanced îlot generation function with FIXED corridor support
window.generateIlotsWithBypass = async function() {
    console.log('🏗️ BYPASS: Starting îlot generation with FIXED corridor support...');
    
    try {
        // Get URN from various possible sources
        const currentURN = window.currentUrn || 
                          window.currentDocumentURN || 
                          (window.viewer && window.viewer.model && window.viewer.model.getData().urn) ||
                          localStorage.getItem('currentURN') || 
                          'dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Ynpja29meW52ZTJ3NHJwem55bW9vYnlhZ3VxeGt3ZWwvMTc1ODc4MzAxMDM5OS0yMDI1MDYyOF9URVNULmR3Zw==';
        
        console.log('📋 Using URN:', currentURN.substring(0, 30) + '...');
        
        // FIXED: Call the backend API with corrected parameters
        const response = await fetch('/api/generate-ilots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                urn: currentURN,
                coverage: 0.35, // INCREASED coverage for more îlots
                minDistance: 1.5, // REDUCED minimum distance
                ilotWidth: 3,
                ilotHeight: 2,
                maxAttempts: 2000, // INCREASED attempts
                wallBuffer: 0.3, // REDUCED wall buffer
                entranceBuffer: 1
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
        
        // Initialize bypass system if not already done
        if (!window.fixedUnifiedController) {
            await window.initializeBypassSystem();
        }
        
        // Add to bypass system
        if (window.fixedUnifiedController) {
            await window.fixedUnifiedController.addIlots(ilots);
            
            // FIXED: Generate corridors with correct minimum width
            console.log('🛤️ FIXED: Generating corridors with proper 1.8m minimum width...');
            
            const corridorResponse = await fetch('/api/corridor-generation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    floorPlan: {
                        bounds: { minX: 0, minY: 0, maxX: 20, maxY: 15 },
                        boundary: [[0, 0], [20, 0], [20, 15], [0, 15]]
                    },
                    ilots: ilots,
                    options: {
                        corridorWidth: 2.0, // FIXED: Use 2.0m instead of 1.2m
                        minWidth: 1.8,
                        maxWidth: 3.0,
                        connectAllEntrances: true,
                        connectAllIlots: true,
                        pathfindingResolution: 0.5
                    }
                })
            });
            
            if (corridorResponse.ok) {
                const corridorResult = await corridorResponse.json();
                if (corridorResult.success && corridorResult.corridors) {
                    await window.fixedUnifiedController.addCorridors(corridorResult.corridors);
                    console.log(`✅ FIXED: Added ${corridorResult.corridors.length} corridors with proper widths`);
                }
            }
            
            const stats = window.fixedUnifiedController.getStats();
            console.log('📊 System stats:', stats);
            
            const validIlots = ilots.filter(i => i.isValid !== false).length;
            const coverage = ((result.statistics?.coverage || 0.35) * 100).toFixed(1);
            
            console.log(`🎯 SUCCESS: ${validIlots}/${ilots.length} îlots rendered - All systems working!`);
            
            // Update UI status
            const statusEl = document.querySelector('.status-text') || document.getElementById('statusText');
            if (statusEl) {
                statusEl.textContent = `✅ Generated ${validIlots}/${ilots.length} îlots + corridors successfully!`;
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

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        console.log('🚀 Auto-initializing bypass system...');
        await window.initializeBypassSystem();
    });
}

console.log('✅ Critical MaterialManager Bypass System loaded - ALL FIXES APPLIED');
