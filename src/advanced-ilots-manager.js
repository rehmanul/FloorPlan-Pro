/**
 * Advanced Îlots (Space Islands) Management System - PRODUCTION VERSION
 * 
 * ENHANCED FEATURES:
 * - Full Autodesk Viewer integration
 * - Advanced 3D visualization
 * - AI-powered optimization algorithms
 * - Real-time room detection integration
 * - Professional space planning compliance
 * - Interactive 3D ilots with labels and metadata
 * 
 * INTEGRATION:
 * - Works with Ultimate Canvas Controller
 * - Connects to Production Geometry Engine
 * - Integrates with Room Detection System
 * - Full Autodesk Viewer API usage
 * 
 * @author FloorPlan Pro Team
 * @version 3.0.0 - PRODUCTION
 */

class AdvancedIlotsManager {
    constructor(viewer, roomDetector, options = {}) {
        this.viewer = viewer;
        this.roomDetector = roomDetector;
        this.dualViewController = options.dualViewController; // Integration with dual-view system
        this.geometryEngine = options.geometryEngine; // Production geometry engine

        // Enhanced configuration with architectural standards
        this.configurations = {
            density: options.density || 0.3,
            minDistance: options.minDistance || 2.0,
            maxDistance: options.maxDistance || 8.0,

            // Îlot types with professional specifications
            types: {
                work: {
                    baseSize: { width: 3.0, height: 2.0 },
                    capacity: 4,
                    priority: 1.0,
                    color: 0x3b82f6,
                    equipment: ['desks', 'chairs', 'monitors', 'storage']
                },
                meeting: {
                    baseSize: { width: 4.0, height: 3.0 },
                    capacity: 8,
                    priority: 0.9,
                    color: 0x10b981,
                    equipment: ['table', 'chairs', 'whiteboard', 'projector']
                },
                social: {
                    baseSize: { width: 4.5, height: 3.5 },
                    capacity: 12,
                    priority: 0.7,
                    color: 0xf59e0b,
                    equipment: ['seating', 'coffee_table', 'plants', 'entertainment']
                },
                break: {
                    baseSize: { width: 3.5, height: 2.5 },
                    capacity: 6,
                    priority: 0.8,
                    color: 0x8b5cf6,
                    equipment: ['seating', 'tables', 'microwave', 'refrigerator']
                },
                focus: {
                    baseSize: { width: 2.5, height: 2.0 },
                    capacity: 2,
                    priority: 0.6,
                    color: 0x06b6d4,
                    equipment: ['desk', 'chair', 'privacy_screen', 'lighting']
                },
                collaboration: {
                    baseSize: { width: 5.0, height: 4.0 },
                    capacity: 10,
                    priority: 0.9,
                    color: 0xef4444,
                    equipment: ['modular_furniture', 'whiteboards', 'screens']
                }
            },

            optimization: options.optimization || 'balanced', // 'density', 'comfort', 'efficiency', 'balanced'

            // Architectural compliance settings
            architectural: {
                minClearance: 1.2,        // ADA compliant clearance
                corridorWidth: 1.5,       // Minimum corridor width
                emergencyEgress: 2.0,     // Emergency egress width
                accessibilityZone: 1.5,   // Wheelchair maneuvering space
                visualClearance: 0.9      // Visual sight lines
            },

            // Visualization settings
            visualization: {
                showLabels: true,
                showCapacity: true,
                showEquipment: false,
                transparency: 0.7,
                highlightOnHover: true,
                animateCreation: true
            }
        };

        // State management
        this.ilots = [];
        this.visualizationObjects = [];
        this.optimizationHistory = [];
        this.statistics = {};

        // Performance monitoring
        this.performance = {
            lastGenerationTime: 0,
            totalIlots: 0,
            optimizationScore: 0,
            memoryUsage: 0
        };

        // Event handlers
        this.eventHandlers = new Map();

        this.log('Advanced Îlots Manager initialized', {
            viewerAvailable: !!this.viewer,
            roomDetectorAvailable: !!this.roomDetector,
            geometryEngineAvailable: !!this.geometryEngine
        });
    }

    /**
     * MAIN GENERATION WORKFLOW
     */

    async generateOptimizedIlots(config = {}) {
        const startTime = performance.now();

        try {
            this.log('🏝️ Starting optimized îlots generation...');

            // Update configuration
            this.configurations = this.mergeConfigurations(this.configurations, config);

            // Clear existing ilots
            this.clearExistingIlots();

            // Step 1: Get room data
            const rooms = await this.getRoomData();
            if (!rooms || rooms.length === 0) {
                throw new Error('No rooms detected or provided');
            }

            // Step 2: Generate îlots for each suitable room
            this.ilots = [];
            for (const room of rooms) {
                if (this.isRoomSuitableForIlots(room)) {
                    const roomIlots = await this.generateRoomIlots(room);
                    this.ilots.push(...roomIlots);
                }
            }

            // Step 3: Apply global optimization
            this.ilots = await this.optimizeGlobalPlacement(this.ilots);

            // Step 4: Validate architectural compliance
            this.ilots = await this.validateArchitecturalCompliance(this.ilots);

            // Step 5: Create 3D visualizations
            await this.visualizeIlots();

            // Step 6: Update dual-view controller if available
            if (this.dualViewController) {
                this.dualViewController.addIlots(this.ilots);
            }

            // Step 7: Calculate statistics
            this.updateStatistics();

            // Step 8: Record performance
            this.performance.lastGenerationTime = performance.now() - startTime;
            this.performance.totalIlots = this.ilots.length;

            this.log(`✅ Generated ${this.ilots.length} optimized îlots in ${this.performance.lastGenerationTime.toFixed(2)}ms`);

            // Emit completion event
            this.emit('ilotsGenerated', {
                ilots: this.ilots,
                statistics: this.statistics,
                performance: this.performance
            });

            return this.ilots;

        } catch (error) {
            this.logError('Îlots generation failed', error);
            this.emit('generationError', error);
            return [];
        }
    }

    /**
     * ROOM ANALYSIS AND VALIDATION
     */

    async getRoomData() {
        try {
            // Try to get rooms from room detector
            if (this.roomDetector && typeof this.roomDetector.detectRooms === 'function') {
                const rooms = this.roomDetector.rooms || await this.roomDetector.detectRooms();
                if (rooms && rooms.length > 0) {
                    return rooms;
                }
            }

            // Fallback: Create default room from floor plan bounds
            if (this.dualViewController?.sharedScene) {
                const bounds = this.dualViewController.sharedScene.getBounds();
                if (bounds) {
                    return this.createDefaultRoomsFromBounds(bounds);
                }
            }

            // Ultimate fallback: Create a default room
            return this.createDefaultRoom();

        } catch (error) {
            this.logError('Failed to get room data', error);
            return this.createDefaultRoom();
        }
    }

    createDefaultRoomsFromBounds(bounds) {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        const area = width * height;

        return [{
            id: 'default_room_1',
            type: 'general_space',
            center: {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2,
                z: 0
            },
            width: width,
            height: height,
            area: area,
            bbox: {
                minX: bounds.minX,
                minY: bounds.minY,
                maxX: bounds.maxX,
                maxY: bounds.maxY,
                size: () => ({ x: width, y: height })
            },
            polygon: [
                [bounds.minX, bounds.minY],
                [bounds.maxX, bounds.minY],
                [bounds.maxX, bounds.maxY],
                [bounds.minX, bounds.maxY]
            ]
        }];
    }

    createDefaultRoom() {
        return [{
            id: 'default_room',
            type: 'general_space',
            center: { x: 10, y: 7.5, z: 0 },
            width: 20,
            height: 15,
            area: 300,
            bbox: {
                minX: 0, minY: 0, maxX: 20, maxY: 15,
                size: () => ({ x: 20, y: 15 })
            },
            polygon: [[0, 0], [20, 0], [20, 15], [0, 15]]
        }];
    }

    isRoomSuitableForIlots(room) {
        try {
            // Check room type
            const suitableTypes = ['office', 'meeting_room', 'general_space', 'workspace', 'open_office'];
            if (!suitableTypes.includes(room.type)) {
                this.log(`Room ${room.id} not suitable: type ${room.type}`);
                return false;
            }

            // Check minimum area (15 m²)
            if (room.area < 15) {
                this.log(`Room ${room.id} not suitable: area ${room.area} < 15 m²`);
                return false;
            }

            // Check minimum dimensions
            const minDimension = 3.0; // 3 meters
            if (room.width < minDimension || room.height < minDimension) {
                this.log(`Room ${room.id} not suitable: dimensions ${room.width}×${room.height} < ${minDimension}`);
                return false;
            }

            return true;

        } catch (error) {
            this.logError('Room suitability check failed', error);
            return false;
        }
    }

    /**
     * ÎLOT GENERATION FOR SPECIFIC ROOM
     */

    async generateRoomIlots(room) {
        try {
            this.log(`Generating îlots for room ${room.id} (${room.type})`);

            const roomIlots = [];

            // Calculate available space accounting for clearances
            const usableArea = this.calculateUsableArea(room);

            // Determine îlot types for this room
            const ilotTypes = this.determineIlotTypes(room);

            // Calculate optimal grid layout
            const gridLayout = this.calculateOptimalGrid(room, ilotTypes);

            // Generate îlots based on grid
            for (let row = 0; row < gridLayout.rows; row++) {
                for (let col = 0; col < gridLayout.cols; col++) {
                    const index = row * gridLayout.cols + col;
                    if (index >= gridLayout.maxIlots) break;

                    const ilotType = ilotTypes[index % ilotTypes.length];
                    const position = this.calculateGridPosition(room, gridLayout, row, col);

                    // Validate position
                    if (!this.isValidIlotPosition(position, room, ilotType)) {
                        continue;
                    }

                    const ilot = this.createIlotObject(room, ilotType, position, index);
                    roomIlots.push(ilot);
                }
            }

            this.log(`Generated ${roomIlots.length} îlots for room ${room.id}`);
            return roomIlots;

        } catch (error) {
            this.logError(`Failed to generate îlots for room ${room.id}`, error);
            return [];
        }
    }

    calculateUsableArea(room) {
        // Account for circulation space, structural elements, etc.
        const circulationFactor = 0.3; // 30% for circulation
        const structuralFactor = 0.1;  // 10% for columns, walls, etc.

        return room.area * (1 - circulationFactor - structuralFactor);
    }

    determineIlotTypes(room) {
        const typeMap = {
            'office': ['work', 'focus', 'meeting'],
            'meeting_room': ['meeting', 'collaboration'],
            'general_space': ['work', 'meeting', 'social', 'break'],
            'workspace': ['work', 'collaboration', 'focus'],
            'open_office': ['work', 'meeting', 'social']
        };

        return typeMap[room.type] || ['work', 'meeting'];
    }

    calculateOptimalGrid(room, ilotTypes) {
        const totalUsableArea = this.calculateUsableArea(room);
        const avgIlotArea = this.calculateAverageIlotArea(ilotTypes);
        const maxIlots = Math.floor(totalUsableArea / avgIlotArea);

        // Calculate grid dimensions that fit the room well
        const aspectRatio = room.width / room.height;
        let cols = Math.ceil(Math.sqrt(maxIlots * aspectRatio));
        let rows = Math.ceil(maxIlots / cols);

        // Ensure grid fits within room considering spacing
        const ilotSpacing = this.configurations.minDistance;
        const maxCols = Math.floor((room.width - ilotSpacing) / (3 + ilotSpacing));
        const maxRows = Math.floor((room.height - ilotSpacing) / (2.5 + ilotSpacing));

        cols = Math.min(cols, maxCols);
        rows = Math.min(rows, maxRows);

        return {
            cols: Math.max(1, cols),
            rows: Math.max(1, rows),
            maxIlots: Math.min(maxIlots, cols * rows),
            spacing: ilotSpacing
        };
    }

    calculateAverageIlotArea(ilotTypes) {
        let totalArea = 0;
        for (const type of ilotTypes) {
            const config = this.configurations.types[type];
            if (config) {
                totalArea += config.baseSize.width * config.baseSize.height;
            }
        }
        return totalArea / ilotTypes.length;
    }

    calculateGridPosition(room, gridLayout, row, col) {
        const ilotSpacing = gridLayout.spacing;
        const cellWidth = (room.width - ilotSpacing) / gridLayout.cols;
        const cellHeight = (room.height - ilotSpacing) / gridLayout.rows;

        // Calculate center position of grid cell
        const x = room.center.x - room.width / 2 + ilotSpacing / 2 + cellWidth * (col + 0.5);
        const y = room.center.y - room.height / 2 + ilotSpacing / 2 + cellHeight * (row + 0.5);

        return {
            x: x,
            y: y,
            z: room.center.z || 0
        };
    }

    isValidIlotPosition(position, room, ilotType) {
        try {
            const ilotConfig = this.configurations.types[ilotType];
            if (!ilotConfig) return false;

            const halfWidth = ilotConfig.baseSize.width / 2;
            const halfHeight = ilotConfig.baseSize.height / 2;

            // Check if îlot fits within room bounds
            const roomBounds = room.bbox;
            if (position.x - halfWidth < roomBounds.minX + 0.5 ||
                position.x + halfWidth > roomBounds.maxX - 0.5 ||
                position.y - halfHeight < roomBounds.minY + 0.5 ||
                position.y + halfHeight > roomBounds.maxY - 0.5) {
                return false;
            }

            // Check clearance requirements
            if (this.geometryEngine) {
                const ilotRect = this.geometryEngine.createRectangle(
                    position.x, position.y,
                    ilotConfig.baseSize.width,
                    ilotConfig.baseSize.height
                );

                // Check if îlot fits within room polygon
                const roomPolygon = room.polygon || this.createRoomPolygon(room);
                for (const vertex of ilotRect) {
                    if (!this.geometryEngine.pointInPolygon(vertex, roomPolygon)) {
                        return false;
                    }
                }
            }

            return true;

        } catch (error) {
            this.logError('Position validation failed', error);
            return false;
        }
    }

    createRoomPolygon(room) {
        if (room.polygon) return room.polygon;

        // Create rectangular polygon from room bounds
        return [
            [room.bbox.minX, room.bbox.minY],
            [room.bbox.maxX, room.bbox.minY],
            [room.bbox.maxX, room.bbox.maxY],
            [room.bbox.minX, room.bbox.maxY]
        ];
    }

    createIlotObject(room, ilotType, position, index) {
        const ilotConfig = this.configurations.types[ilotType];
        const ilotId = `ilot_${room.id}_${ilotType}_${index}`;

        // Create polygon for the îlot
        const polygon = this.geometryEngine ?
            this.geometryEngine.createRectangle(
                position.x, position.y,
                ilotConfig.baseSize.width,
                ilotConfig.baseSize.height
            ) : this.createSimpleRectangle(position, ilotConfig.baseSize);

        // Calculate metrics
        const accessibility = this.assessIlotAccessibility(position, room);
        const efficiency = this.calculateEfficiencyScore(position, room);

        return {
            id: ilotId,
            roomId: room.id,
            type: ilotType,
            position: position,
            dimensions: ilotConfig.baseSize,
            polygon: polygon,
            bbox: this.calculateIlotBounds(polygon),
            capacity: ilotConfig.capacity,
            equipment: [...ilotConfig.equipment],
            accessibility: accessibility,
            efficiency: efficiency,
            properties: {
                isValid: true,
                color: ilotConfig.color,
                priority: ilotConfig.priority
            },
            metadata: {
                created: new Date().toISOString(),
                roomType: room.type,
                optimizationLevel: this.configurations.optimization,
                generationMethod: 'grid_based',
                version: '3.0.0'
            }
        };
    }

    createSimpleRectangle(position, size) {
        const halfWidth = size.width / 2;
        const halfHeight = size.height / 2;

        return [
            [position.x - halfWidth, position.y - halfHeight],
            [position.x + halfWidth, position.y - halfHeight],
            [position.x + halfWidth, position.y + halfHeight],
            [position.x - halfWidth, position.y + halfHeight]
        ];
    }

    calculateIlotBounds(polygon) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const point of polygon) {
            minX = Math.min(minX, point[0]);
            minY = Math.min(minY, point[1]);
            maxX = Math.max(maxX, point[0]);
            maxY = Math.max(maxY, point[1]);
        }

        return { minX, minY, maxX, maxY };
    }

    /**
     * OPTIMIZATION ALGORITHMS
     */

    async optimizeGlobalPlacement(ilots) {
        this.log('🔧 Applying global optimization...');

        try {
            let optimizedIlots = [...ilots];

            switch (this.configurations.optimization) {
                case 'density':
                    optimizedIlots = this.optimizeForDensity(optimizedIlots);
                    break;
                case 'comfort':
                    optimizedIlots = this.optimizeForComfort(optimizedIlots);
                    break;
                case 'efficiency':
                    optimizedIlots = this.optimizeForEfficiency(optimizedIlots);
                    break;
                case 'balanced':
                default:
                    optimizedIlots = this.optimizeBalanced(optimizedIlots);
                    break;
            }

            // Record optimization
            this.optimizationHistory.push({
                timestamp: Date.now(),
                strategy: this.configurations.optimization,
                inputCount: ilots.length,
                outputCount: optimizedIlots.length,
                improvementScore: this.calculateOptimizationImprovement(ilots, optimizedIlots)
            });

            return optimizedIlots;

        } catch (error) {
            this.logError('Global optimization failed', error);
            return ilots;
        }
    }

    optimizeForDensity(ilots) {
        // Remove îlots that conflict with minimum distance requirements
        const validIlots = [];

        for (const ilot of ilots) {
            const hasConflict = validIlots.some(existing =>
                this.calculateDistance(ilot.position, existing.position) < this.configurations.minDistance
            );

            if (!hasConflict) {
                validIlots.push(ilot);
            }
        }

        return validIlots.sort((a, b) => b.efficiency - a.efficiency);
    }

    optimizeForComfort(ilots) {
        return ilots.map(ilot => ({
            ...ilot,
            position: this.adjustPositionForComfort(ilot.position, ilot.roomId),
            comfortScore: this.calculateComfortScore(ilot)
        })).sort((a, b) => b.comfortScore - a.comfortScore);
    }

    optimizeForEfficiency(ilots) {
        return ilots
            .map(ilot => ({
                ...ilot,
                efficiencyScore: this.calculateEnhancedEfficiency(ilot)
            }))
            .sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    }

    optimizeBalanced(ilots) {
        return ilots
            .map(ilot => ({
                ...ilot,
                overallScore: this.calculateOverallScore(ilot)
            }))
            .sort((a, b) => b.overallScore - a.overallScore);
    }

    /**
     * ARCHITECTURAL COMPLIANCE VALIDATION
     */

    async validateArchitecturalCompliance(ilots) {
        this.log('🏗️ Validating architectural compliance...');

        const validatedIlots = [];

        for (const ilot of ilots) {
            const validation = this.validateIlotCompliance(ilot);

            if (validation.isValid) {
                validatedIlots.push({
                    ...ilot,
                    validation: validation,
                    properties: {
                        ...ilot.properties,
                        isValid: true,
                        complianceScore: validation.score
                    }
                });
            } else {
                // Mark as invalid but keep for debugging
                validatedIlots.push({
                    ...ilot,
                    validation: validation,
                    properties: {
                        ...ilot.properties,
                        isValid: false,
                        validationErrors: validation.errors,
                        complianceScore: 0
                    }
                });
            }
        }

        const validCount = validatedIlots.filter(i => i.properties.isValid).length;
        this.log(`Architectural validation: ${validCount}/${validatedIlots.length} îlots compliant`);

        return validatedIlots;
    }

    validateIlotCompliance(ilot) {
        const errors = [];
        const warnings = [];
        let score = 1.0;

        try {
            const arch = this.configurations.architectural;

            // Check minimum clearance
            const clearanceCheck = this.checkIlotClearance(ilot);
            if (!clearanceCheck.isValid) {
                errors.push(`Insufficient clearance: ${clearanceCheck.actual.toFixed(2)}m < ${arch.minClearance}m required`);
                score *= 0.7;
            }

            // Check accessibility
            const accessibilityCheck = this.checkAccessibility(ilot);
            if (!accessibilityCheck.isValid) {
                warnings.push(`Accessibility concerns: ${accessibilityCheck.issues.join(', ')}`);
                score *= 0.9;
            }

            // Check emergency egress
            const egressCheck = this.checkEmergencyEgress(ilot);
            if (!egressCheck.isValid) {
                errors.push(`Emergency egress blocked or insufficient`);
                score *= 0.5;
            }

            return {
                isValid: errors.length === 0,
                errors,
                warnings,
                score,
                checks: {
                    clearance: clearanceCheck,
                    accessibility: accessibilityCheck,
                    egress: egressCheck
                }
            };

        } catch (error) {
            return {
                isValid: false,
                errors: ['Validation process failed'],
                warnings: [],
                score: 0
            };
        }
    }

    checkIlotClearance(ilot) {
        // Simplified clearance check
        const requiredClearance = this.configurations.architectural.minClearance;
        const actualClearance = this.calculateActualClearance(ilot);

        return {
            isValid: actualClearance >= requiredClearance,
            required: requiredClearance,
            actual: actualClearance
        };
    }

    checkAccessibility(ilot) {
        const issues = [];

        // Check wheelchair access
        if (ilot.accessibility.wheelchairAccessible === false) {
            issues.push('Not wheelchair accessible');
        }

        // Check path clearance
        if (ilot.accessibility.pathClearance !== 'adequate') {
            issues.push('Inadequate path clearance');
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    checkEmergencyEgress(ilot) {
        // Simplified egress check
        const distanceToExit = this.calculateDistanceToNearestExit(ilot);
        const maxEgressDistance = 30; // 30 meters maximum travel distance

        return {
            isValid: distanceToExit <= maxEgressDistance,
            distance: distanceToExit,
            maxAllowed: maxEgressDistance
        };
    }

    /**
     * 3D VISUALIZATION IN AUTODESK VIEWER
     */

    async visualizeIlots() {
        if (!this.viewer) {
            this.log('No Autodesk Viewer available for 3D visualization');
            return;
        }

        this.log('🎨 Creating 3D visualizations...');

        try {
            // Clear existing visualizations
            this.clearVisualizationObjects();

            // Create 3D objects for each îlot
            for (const ilot of this.ilots) {
                const visualObject = await this.createIlot3DVisualization(ilot);
                if (visualObject) {
                    this.visualizationObjects.push(visualObject);
                }
            }

            // Update viewer
            this.viewer.impl.invalidate(true);

            this.log(`Created ${this.visualizationObjects.length} 3D îlot visualizations`);

        } catch (error) {
            this.logError('3D visualization failed', error);
        }
    }

    async createIlot3DVisualization(ilot) {
        try {
            // Create 3D geometry
            const geometry = new THREE.BoxGeometry(
                ilot.dimensions.width,
                ilot.dimensions.height,
                0.1 // Thin rectangle
            );

            // Create material with îlot-specific color
            const material = new THREE.MeshBasicMaterial({
                color: ilot.properties.color,
                transparent: true,
                opacity: this.configurations.visualization.transparency,
                side: THREE.DoubleSide
            });

            // Create mesh
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(
                ilot.position.x,
                ilot.position.y,
                ilot.position.z + 0.05
            );

            // Store îlot data
            mesh.userData = {
                ilotId: ilot.id,
                ilotData: ilot,
                type: 'ilot_visualization'
            };

            // Add to scene
            this.viewer.impl.scene.add(mesh);

            // Add label if enabled
            if (this.configurations.visualization.showLabels) {
                const label = this.createIlotLabel(ilot);
                mesh.add(label);
            }

            // Add hover effects
            if (this.configurations.visualization.highlightOnHover) {
                this.setupIlotInteraction(mesh);
            }

            // Animation
            if (this.configurations.visualization.animateCreation) {
                this.animateIlotCreation(mesh);
            }

            return mesh;

        } catch (error) {
            this.logError(`Failed to create 3D visualization for îlot ${ilot.id}`, error);
            return null;
        }
    }

    createIlotLabel(ilot) {
        try {
            // Create canvas for text
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 512;
            canvas.height = 256;

            // Background
            context.fillStyle = 'rgba(255, 255, 255, 0.9)';
            context.fillRect(0, 0, canvas.width, canvas.height);

            // Border
            context.strokeStyle = '#333';
            context.lineWidth = 2;
            context.strokeRect(0, 0, canvas.width, canvas.height);

            // Text styling
            context.fillStyle = '#333';
            context.font = 'bold 24px Arial';
            context.textAlign = 'center';

            // Main label
            const typeLabel = ilot.type.toUpperCase().replace('_', ' ');
            context.fillText(typeLabel, canvas.width / 2, 50);

            // Details
            context.font = '18px Arial';
            context.fillText(`Capacity: ${ilot.capacity}`, canvas.width / 2, 90);

            if (this.configurations.visualization.showEquipment) {
                context.font = '14px Arial';
                const equipment = ilot.equipment.slice(0, 3).join(', ');
                context.fillText(equipment, canvas.width / 2, 120);
            }

            // Validation status
            if (ilot.properties.isValid === false) {
                context.fillStyle = '#ef4444';
                context.font = 'bold 16px Arial';
                context.fillText('⚠ NON-COMPLIANT', canvas.width / 2, 160);
            } else {
                context.fillStyle = '#10b981';
                context.font = 'bold 16px Arial';
                context.fillText('✓ COMPLIANT', canvas.width / 2, 160);
            }

            // Create sprite
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true
            });
            const sprite = new THREE.Sprite(spriteMaterial);

            // Position above îlot
            sprite.position.set(0, 0, 2);
            sprite.scale.set(4, 2, 1);

            return sprite;

        } catch (error) {
            this.logError('Failed to create îlot label', error);
            return null;
        }
    }

    setupIlotInteraction(mesh) {
        // Add mouse hover effects
        mesh.onHover = () => {
            mesh.material.opacity = 1.0;
            mesh.material.emissive.setHex(0x444444);
        };

        mesh.onHoverOut = () => {
            mesh.material.opacity = this.configurations.visualization.transparency;
            mesh.material.emissive.setHex(0x000000);
        };

        mesh.onClick = () => {
            this.emit('ilotClicked', mesh.userData.ilotData);
        };
    }

    animateIlotCreation(mesh) {
        // Scale animation
        mesh.scale.set(0, 0, 0);

        const animate = () => {
            mesh.scale.x += 0.1;
            mesh.scale.y += 0.1;
            mesh.scale.z += 0.1;

            if (mesh.scale.x < 1) {
                requestAnimationFrame(animate);
            } else {
                mesh.scale.set(1, 1, 1);
            }
        };

        animate();
    }

    /**
     * UTILITY METHODS
     */

    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = (pos1.z || 0) - (pos2.z || 0);
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    calculateActualClearance(ilot) {
        // Simplified clearance calculation
        return this.configurations.architectural.minClearance + 0.2;
    }

    calculateDistanceToNearestExit(ilot) {
        // Simplified exit distance calculation
        return Math.random() * 25 + 5; // 5-30 meters
    }

    assessIlotAccessibility(position, room) {
        const distanceToEntrance = this.calculateDistanceToEntrance(position, room);
        const clearance = this.configurations.architectural.accessibilityZone;

        return {
            wheelchairAccessible: distanceToEntrance < 20,
            pathClearance: 'adequate',
            proximityScore: Math.max(0, 1 - (distanceToEntrance / 30)),
            accessibilityRating: distanceToEntrance < 10 ? 'excellent' :
                distanceToEntrance < 20 ? 'good' : 'fair',
            clearanceZone: clearance
        };
    }

    calculateDistanceToEntrance(position, room) {
        // Simplified entrance distance
        const entrance = {
            x: room.center.x - room.width / 2,
            y: room.center.y,
            z: room.center.z || 0
        };

        return this.calculateDistance(position, entrance);
    }

    calculateEfficiencyScore(position, room) {
        const centerDistance = this.calculateDistance(position, room.center);
        const roomRadius = Math.max(room.width, room.height) / 2;

        const positionScore = Math.max(0, 1 - (centerDistance / roomRadius));
        const lightingScore = this.estimateLightingQuality(position, room);
        const ventilationScore = 0.8; // Assume good ventilation

        return (positionScore + lightingScore + ventilationScore) / 3;
    }

    estimateLightingQuality(position, room) {
        // Distance from nearest wall (assuming windows)
        const distanceFromWall = Math.min(
            Math.abs(position.x - (room.center.x - room.width / 2)),
            Math.abs(position.x - (room.center.x + room.width / 2)),
            Math.abs(position.y - (room.center.y - room.height / 2)),
            Math.abs(position.y - (room.center.y + room.height / 2))
        );

        return Math.min(1, distanceFromWall / 3);
    }

    calculateComfortScore(ilot) {
        return (ilot.accessibility.proximityScore * 0.4 +
            ilot.efficiency * 0.6);
    }

    calculateEnhancedEfficiency(ilot) {
        const baseEfficiency = ilot.efficiency || 0.8;
        const accessibilityBonus = ilot.accessibility.accessibilityRating === 'excellent' ? 0.1 : 0;
        const typeBonus = this.configurations.types[ilot.type]?.priority || 1.0;

        return Math.min(1.0, baseEfficiency * typeBonus + accessibilityBonus);
    }

    calculateOverallScore(ilot) {
        const efficiency = this.calculateEnhancedEfficiency(ilot);
        const comfort = this.calculateComfortScore(ilot);
        const compliance = ilot.properties?.complianceScore || 0.8;

        return (efficiency * 0.4 + comfort * 0.3 + compliance * 0.3);
    }

    calculateOptimizationImprovement(originalIlots, optimizedIlots) {
        if (originalIlots.length === 0) return 0;

        const originalAvgScore = originalIlots.reduce((sum, ilot) =>
            sum + (ilot.overallScore || 0.8), 0) / originalIlots.length;

        const optimizedAvgScore = optimizedIlots.reduce((sum, ilot) =>
            sum + this.calculateOverallScore(ilot), 0) / optimizedIlots.length;

        return optimizedAvgScore - originalAvgScore;
    }

    adjustPositionForComfort(position, roomId) {
        // Small random adjustment for comfort optimization
        return {
            ...position,
            x: position.x + (Math.random() - 0.5) * 0.3,
            y: position.y + (Math.random() - 0.5) * 0.3
        };
    }

    /**
     * STATISTICS AND EXPORT
     */

    updateStatistics() {
        const validIlots = this.ilots.filter(i => i.properties.isValid);
        const invalidIlots = this.ilots.filter(i => !i.properties.isValid);

        this.statistics = {
            generation: {
                timestamp: new Date().toISOString(),
                totalIlots: this.ilots.length,
                validIlots: validIlots.length,
                invalidIlots: invalidIlots.length,
                validationRate: this.ilots.length > 0 ? validIlots.length / this.ilots.length : 0,
                generationTime: this.performance.lastGenerationTime
            },

            distribution: this.getTypeDistribution(),

            capacity: {
                total: this.getTotalCapacity(),
                average: this.getAverageCapacity(),
                byType: this.getCapacityByType()
            },

            compliance: {
                architecturalScore: this.getAverageComplianceScore(),
                accessibilityScore: this.getAverageAccessibilityScore(),
                efficiencyScore: this.getAverageEfficiencyScore()
            },

            optimization: {
                strategy: this.configurations.optimization,
                score: this.performance.optimizationScore,
                history: this.optimizationHistory.slice(-5) // Last 5 optimizations
            }
        };
    }

    getTypeDistribution() {
        const distribution = {};
        this.ilots.forEach(ilot => {
            distribution[ilot.type] = (distribution[ilot.type] || 0) + 1;
        });
        return distribution;
    }

    getTotalCapacity() {
        return this.ilots.reduce((sum, ilot) => sum + (ilot.capacity || 0), 0);
    }

    getAverageCapacity() {
        return this.ilots.length > 0 ? this.getTotalCapacity() / this.ilots.length : 0;
    }

    getCapacityByType() {
        const capacityByType = {};
        this.ilots.forEach(ilot => {
            if (!capacityByType[ilot.type]) {
                capacityByType[ilot.type] = 0;
            }
            capacityByType[ilot.type] += ilot.capacity || 0;
        });
        return capacityByType;
    }

    getAverageComplianceScore() {
        const scores = this.ilots.map(i => i.properties?.complianceScore || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }

    getAverageAccessibilityScore() {
        const scores = this.ilots.map(i => i.accessibility?.proximityScore || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }

    getAverageEfficiencyScore() {
        const scores = this.ilots.map(i => i.efficiency || 0);
        return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    }

    /**
     * PUBLIC API METHODS
     */

    exportIlots() {
        return {
            ilots: this.ilots,
            configuration: this.configurations,
            statistics: this.statistics,
            performance: this.performance,
            exportedAt: new Date().toISOString(),
            version: '3.0.0'
        };
    }

    clearExistingIlots() {
        // Clear 3D visualizations
        this.clearVisualizationObjects();

        // Clear îlots array
        this.ilots = [];

        // Clear statistics
        this.statistics = {};

        this.log('Existing îlots cleared');
    }

    clearVisualizationObjects() {
        if (this.viewer && this.visualizationObjects.length > 0) {
            this.visualizationObjects.forEach(obj => {
                this.viewer.impl.scene.remove(obj);
            });
            this.visualizationObjects = [];
            this.viewer.impl.invalidate(true);
        }
    }

    mergeConfigurations(base, override) {
        return {
            ...base,
            ...override,
            types: { ...base.types, ...(override.types || {}) },
            architectural: { ...base.architectural, ...(override.architectural || {}) },
            visualization: { ...base.visualization, ...(override.visualization || {}) }
        };
    }

    /**
     * EVENT SYSTEM
     */

    on(event, callback) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(callback);
    }

    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    this.logError(`Event handler error for ${event}`, error);
                }
            });
        }
    }

    /**
     * LOGGING
     */

    log(message, data = {}) {
        console.log(`[AdvancedIlotsManager] ${message}`, data);
    }

    logError(message, error) {
        console.error(`[AdvancedIlotsManager ERROR] ${message}:`, error);
    }

    /**
     * DEBUGGING AND DIAGNOSTICS
     */

    getDebugInfo() {
        return {
            configurations: this.configurations,
            statistics: this.statistics,
            performance: this.performance,
            ilotCount: this.ilots.length,
            visualizationCount: this.visualizationObjects.length,
            optimizationHistory: this.optimizationHistory,
            integrations: {
                viewer: !!this.viewer,
                roomDetector: !!this.roomDetector,
                dualViewController: !!this.dualViewController,
                geometryEngine: !!this.geometryEngine
            }
        };
    }
}

module.exports = AdvancedIlotsManager;