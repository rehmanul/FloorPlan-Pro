/**
 * DXF Processor for Architectural Floor Plans
 * 
 * Handles DXF import/export functionality with layer mapping and geometry conversion.
 * Supports round-trip fidelity and proper scaling/units.
 * 
 * Features:
 * - DXF file parsing and validation
 * - Layer mapping (WALLS, RED_ZONE, BLUE_ZONE, etc.)
 * - Geometry conversion between DXF and internal format
 * - Scale and unit handling
 * - Error detection and reporting
 * 
 * Dependencies:
 * - dxf-parser for parsing DXF files
 * - dxf-writer for generating DXF files
 * - GeometryEngine for spatial operations
 * 
 * @author FloorPlan Pro Team
 * @version 1.0.0
 */

const DxfParser = require('dxf-parser');
const DxfWriter = require('dxf-writer');
const GeometryEngine = require('./geometry-engine');

class DxfProcessor {
    constructor(options = {}) {
        this.geometryEngine = new GeometryEngine({
            tolerance: options.tolerance || 0.001,
            debugMode: options.debugMode || false
        });
        
        // DXF configuration
        this.config = {
            // Layer mapping
            layerMapping: {
                'WALLS': { color: 7, lineType: 'CONTINUOUS', lineWeight: 0.5 },
                'RED_ZONE': { color: 1, lineType: 'CONTINUOUS', lineWeight: 0.25 },
                'BLUE_ZONE': { color: 5, lineType: 'CONTINUOUS', lineWeight: 0.25 },
                'ILOTS': { color: 3, lineType: 'CONTINUOUS', lineWeight: 0.25 },
                'CORRIDORS': { color: 2, lineType: 'DASHED', lineWeight: 0.25 },
                'ANNOTATIONS': { color: 6, lineType: 'CONTINUOUS', lineWeight: 0.1 },
                'DIMENSIONS': { color: 4, lineType: 'CONTINUOUS', lineWeight: 0.1 }
            },
            
            // Units and scaling
            defaultUnits: 'millimeters',
            targetUnits: 'meters',
            scaleFactor: 1000, // mm to m conversion
            precision: 3,
            
            // Processing options
            mergeColinearLines: options.mergeColinearLines !== false,
            simplifyPolygons: options.simplifyPolygons !== false,
            validateGeometry: options.validateGeometry !== false,
            
            // Error handling
            strictMode: options.strictMode || false,
            skipInvalidEntities: options.skipInvalidEntities !== false,
            
            ...options
        };
        
        // Processing state
        this.parseErrors = [];
        this.warnings = [];
        this.statistics = {
            entitiesProcessed: 0,
            entitiesSkipped: 0,
            layersFound: 0,
            geometryCreated: 0
        };
        
        this.log('DxfProcessor initialized', this.config);
    }

    /**
     * DXF IMPORT FUNCTIONALITY
     */

    /**
     * Parse DXF file and extract floor plan data
     * @param {Buffer|string} dxfData - DXF file content
     * @returns {Promise<Object>} Parsed floor plan data
     */
    async parseDxfFile(dxfData) {
        try {
            this.log('Starting DXF parsing');
            this.resetStatistics();
            
            // Parse DXF content
            const parser = new DxfParser();
            const dxf = parser.parseSync(dxfData.toString());
            
            if (!dxf) {
                throw new Error('Failed to parse DXF file');
            }
            
            this.log('DXF file parsed successfully', {
                version: dxf.header?.version || 'unknown',
                layers: Object.keys(dxf.tables?.layer?.layers || {}).length,
                entities: dxf.entities?.length || 0
            });
            
            // Extract floor plan components
            const floorPlan = await this.extractFloorPlanData(dxf);
            
            // Validate extracted data
            if (this.config.validateGeometry) {
                await this.validateExtractedGeometry(floorPlan);
            }
            
            this.log('DXF parsing completed', {
                walls: floorPlan.walls?.length || 0,
                redZones: floorPlan.redZones?.length || 0,
                blueZones: floorPlan.blueZones?.length || 0,
                errors: this.parseErrors.length,
                warnings: this.warnings.length
            });
            
            return {
                floorPlan,
                metadata: this.extractMetadata(dxf),
                statistics: this.statistics,
                errors: this.parseErrors,
                warnings: this.warnings
            };
            
        } catch (error) {
            this.logError('DXF parsing failed', error);
            throw new Error(`DXF parsing failed: ${error.message}`);
        }
    }

    /**
     * Extract floor plan data from parsed DXF
     * @param {Object} dxf - Parsed DXF object
     * @returns {Promise<Object>} Floor plan data
     */
    async extractFloorPlanData(dxf) {
        const floorPlan = {
            walls: [],
            redZones: [],
            blueZones: [],
            entrances: [],
            boundary: null,
            annotations: []
        };
        
        if (!dxf.entities) {
            this.warnings.push('No entities found in DXF file');
            return floorPlan;
        }
        
        // Process entities by layer
        for (const entity of dxf.entities) {
            try {
                this.statistics.entitiesProcessed++;
                
                const layer = entity.layer || 'DEFAULT';
                const processed = await this.processEntity(entity, layer);
                
                if (processed) {
                    this.categorizeGeometry(processed, layer, floorPlan);
                    this.statistics.geometryCreated++;
                } else if (!this.config.skipInvalidEntities) {
                    this.parseErrors.push(`Failed to process entity on layer ${layer}`);
                }
                
            } catch (error) {
                this.statistics.entitiesSkipped++;
                const errorMsg = `Entity processing error: ${error.message}`;
                
                if (this.config.strictMode) {
                    throw new Error(errorMsg);
                } else {
                    this.parseErrors.push(errorMsg);
                }
            }
        }
        
        // Post-process geometry
        await this.postProcessGeometry(floorPlan);
        
        return floorPlan;
    }

    /**
     * Process individual DXF entity
     * @param {Object} entity - DXF entity
     * @param {string} layer - Layer name
     * @returns {Promise<Object|null>} Processed geometry
     */
    async processEntity(entity, layer) {
        switch (entity.type) {
            case 'LINE':
                return this.processLine(entity);
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return this.processPolyline(entity);
            case 'CIRCLE':
                return this.processCircle(entity);
            case 'ARC':
                return this.processArc(entity);
            case 'TEXT':
            case 'MTEXT':
                return this.processText(entity);
            case 'INSERT':
                return this.processInsert(entity);
            default:
                this.warnings.push(`Unsupported entity type: ${entity.type}`);
                return null;
        }
    }

    /**
     * Process LINE entity
     * @param {Object} entity - LINE entity
     * @returns {Object} Processed line geometry
     */
    processLine(entity) {
        const start = this.convertPoint(entity.start);
        const end = this.convertPoint(entity.end);
        
        return {
            type: 'line',
            geometry: {
                start,
                end,
                length: this.geometryEngine.calculateDistance(start, end)
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                lineType: entity.lineType
            }
        };
    }

    /**
     * Process POLYLINE/LWPOLYLINE entity
     * @param {Object} entity - Polyline entity
     * @returns {Object} Processed polyline geometry
     */
    processPolyline(entity) {
        const vertices = entity.vertices || [];
        const points = vertices.map(vertex => this.convertPoint(vertex));
        
        // Handle closed polylines
        const isClosed = entity.closed || 
            (points.length > 2 && 
             this.geometryEngine.calculateDistance(points[0], points[points.length - 1]) < this.config.tolerance);
        
        return {
            type: isClosed ? 'polygon' : 'polyline',
            geometry: {
                points,
                closed: isClosed,
                area: isClosed ? this.geometryEngine.calculatePolygonArea(points) : 0
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                lineType: entity.lineType
            }
        };
    }

    /**
     * Process CIRCLE entity
     * @param {Object} entity - Circle entity
     * @returns {Object} Processed circle geometry
     */
    processCircle(entity) {
        const center = this.convertPoint(entity.center);
        const radius = entity.radius * this.getScaleFactor();
        
        // Convert circle to polygon approximation
        const segments = Math.max(16, Math.ceil(radius * 4)); // More segments for larger circles
        const points = [];
        
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * 2 * Math.PI;
            points.push([
                center[0] + Math.cos(angle) * radius,
                center[1] + Math.sin(angle) * radius
            ]);
        }
        
        return {
            type: 'polygon',
            geometry: {
                points,
                closed: true,
                center,
                radius,
                area: Math.PI * radius * radius
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                originalType: 'circle'
            }
        };
    }

    /**
     * Process ARC entity
     * @param {Object} entity - Arc entity
     * @returns {Object} Processed arc geometry
     */
    processArc(entity) {
        const center = this.convertPoint(entity.center);
        const radius = entity.radius * this.getScaleFactor();
        const startAngle = entity.startAngle || 0;
        const endAngle = entity.endAngle || Math.PI * 2;
        
        // Convert arc to polyline
        const segments = Math.max(8, Math.ceil(Math.abs(endAngle - startAngle) * radius));
        const points = [];
        
        for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (i / segments) * (endAngle - startAngle);
            points.push([
                center[0] + Math.cos(angle) * radius,
                center[1] + Math.sin(angle) * radius
            ]);
        }
        
        return {
            type: 'polyline',
            geometry: {
                points,
                closed: false,
                center,
                radius,
                startAngle,
                endAngle
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                originalType: 'arc'
            }
        };
    }

    /**
     * Process TEXT/MTEXT entity
     * @param {Object} entity - Text entity
     * @returns {Object} Processed text geometry
     */
    processText(entity) {
        const position = this.convertPoint(entity.position || entity.start);
        
        return {
            type: 'text',
            geometry: {
                position,
                text: entity.text || '',
                height: (entity.height || 1) * this.getScaleFactor(),
                rotation: entity.rotation || 0
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                style: entity.style
            }
        };
    }

    /**
     * Process INSERT entity (blocks)
     * @param {Object} entity - Insert entity
     * @returns {Object} Processed insert geometry
     */
    processInsert(entity) {
        const position = this.convertPoint(entity.position);
        
        return {
            type: 'insert',
            geometry: {
                position,
                name: entity.name,
                scale: entity.scale || { x: 1, y: 1, z: 1 },
                rotation: entity.rotation || 0
            },
            properties: {
                layer: entity.layer,
                color: entity.color,
                blockName: entity.name
            }
        };
    }

    /**
     * Categorize processed geometry into floor plan components
     * @param {Object} geometry - Processed geometry
     * @param {string} layer - Layer name
     * @param {Object} floorPlan - Floor plan object to populate
     */
    categorizeGeometry(geometry, layer, floorPlan) {
        const layerUpper = layer.toUpperCase();
        
        // Categorize based on layer name
        if (layerUpper.includes('WALL') || layerUpper.includes('MUUR')) {
            if (geometry.type === 'line') {
                floorPlan.walls.push({
                    id: this.generateId(),
                    start: geometry.geometry.start,
                    end: geometry.geometry.end,
                    thickness: 0.2, // Default wall thickness
                    properties: geometry.properties
                });
            }
        } else if (layerUpper.includes('RED') || layerUpper.includes('ENTRANCE') || layerUpper.includes('INGANG')) {
            if (geometry.type === 'polygon') {
                floorPlan.redZones.push({
                    id: this.generateId(),
                    polygon: geometry.geometry.points,
                    area: geometry.geometry.area,
                    properties: geometry.properties
                });
            }
        } else if (layerUpper.includes('BLUE') || layerUpper.includes('FORBIDDEN') || layerUpper.includes('VERBODEN')) {
            if (geometry.type === 'polygon') {
                floorPlan.blueZones.push({
                    id: this.generateId(),
                    polygon: geometry.geometry.points,
                    area: geometry.geometry.area,
                    properties: geometry.properties
                });
            }
        } else if (layerUpper.includes('BOUNDARY') || layerUpper.includes('OUTLINE') || layerUpper.includes('GRENS')) {
            if (geometry.type === 'polygon' && !floorPlan.boundary) {
                floorPlan.boundary = geometry.geometry.points;
            }
        } else if (geometry.type === 'text') {
            floorPlan.annotations.push({
                id: this.generateId(),
                position: geometry.geometry.position,
                text: geometry.geometry.text,
                properties: geometry.properties
            });
        }
        
        // Handle entrances (typically represented as blocks or symbols)
        if (geometry.type === 'insert' && 
            (geometry.geometry.name.toUpperCase().includes('DOOR') || 
             geometry.geometry.name.toUpperCase().includes('ENTRANCE'))) {
            floorPlan.entrances.push({
                id: this.generateId(),
                position: geometry.geometry.position,
                type: 'entrance',
                properties: geometry.properties
            });
        }
    }

    /**
     * DXF EXPORT FUNCTIONALITY
     */

    /**
     * Generate DXF file from floor plan data
     * @param {Object} floorPlan - Floor plan data
     * @param {Object} options - Export options
     * @returns {Promise<string>} DXF file content
     */
    async generateDxfFile(floorPlan, options = {}) {
        try {
            this.log('Starting DXF generation');
            
            const dxfOptions = {
                units: options.units || this.config.defaultUnits,
                precision: options.precision || this.config.precision,
                ...options
            };
            
            // Create DXF writer
            const writer = new DxfWriter(dxfOptions);
            
            // Add layers
            this.addLayersToWriter(writer);
            
            // Add geometry
            await this.addFloorPlanToWriter(writer, floorPlan);
            
            // Generate DXF content
            const dxfContent = writer.toDxfString();
            
            this.log('DXF generation completed', {
                contentLength: dxfContent.length,
                layers: Object.keys(this.config.layerMapping).length
            });
            
            return dxfContent;
            
        } catch (error) {
            this.logError('DXF generation failed', error);
            throw new Error(`DXF generation failed: ${error.message}`);
        }
    }

    /**
     * Add layers to DXF writer
     * @param {DxfWriter} writer - DXF writer instance
     */
    addLayersToWriter(writer) {
        for (const [layerName, layerConfig] of Object.entries(this.config.layerMapping)) {
            writer.addLayer(layerName, layerConfig.color, layerConfig.lineType);
        }
    }

    /**
     * Add floor plan geometry to DXF writer
     * @param {DxfWriter} writer - DXF writer instance
     * @param {Object} floorPlan - Floor plan data
     */
    async addFloorPlanToWriter(writer, floorPlan) {
        // Add walls
        if (floorPlan.walls) {
            for (const wall of floorPlan.walls) {
                const start = this.convertPointForExport(wall.start);
                const end = this.convertPointForExport(wall.end);
                
                writer.addLine(start.x, start.y, end.x, end.y)
                    .setLayer('WALLS');
            }
        }
        
        // Add red zones
        if (floorPlan.redZones) {
            for (const zone of floorPlan.redZones) {
                if (zone.polygon && zone.polygon.length > 2) {
                    const vertices = zone.polygon.map(point => this.convertPointForExport(point));
                    writer.addPolyline(vertices, true) // true = closed
                        .setLayer('RED_ZONE');
                }
            }
        }
        
        // Add blue zones
        if (floorPlan.blueZones) {
            for (const zone of floorPlan.blueZones) {
                if (zone.polygon && zone.polygon.length > 2) {
                    const vertices = zone.polygon.map(point => this.convertPointForExport(point));
                    writer.addPolyline(vertices, true)
                        .setLayer('BLUE_ZONE');
                }
            }
        }
        
        // Add boundary
        if (floorPlan.boundary && floorPlan.boundary.length > 2) {
            const vertices = floorPlan.boundary.map(point => this.convertPointForExport(point));
            writer.addPolyline(vertices, true)
                .setLayer('WALLS'); // Use WALLS layer for boundary
        }
        
        // Add îlots if present
        if (floorPlan.ilots) {
            for (const ilot of floorPlan.ilots) {
                if (ilot.geometry && ilot.geometry.polygon) {
                    const vertices = ilot.geometry.polygon.map(point => this.convertPointForExport(point));
                    writer.addPolyline(vertices, true)
                        .setLayer('ILOTS');
                }
            }
        }
        
        // Add corridors if present
        if (floorPlan.corridors) {
            for (const corridor of floorPlan.corridors) {
                if (corridor.polygon) {
                    const vertices = corridor.polygon.map(point => this.convertPointForExport(point));
                    writer.addPolyline(vertices, true)
                        .setLayer('CORRIDORS');
                }
            }
        }
        
        // Add annotations
        if (floorPlan.annotations) {
            for (const annotation of floorPlan.annotations) {
                const position = this.convertPointForExport(annotation.position);
                writer.addText(position.x, position.y, 0, annotation.text || '', 0.1)
                    .setLayer('ANNOTATIONS');
            }
        }
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Convert point coordinates with scaling
     * @param {Object|Array} point - Point to convert
     * @returns {Array} Converted point [x, y]
     */
    convertPoint(point) {
        const x = (point.x !== undefined ? point.x : point[0]) / this.getScaleFactor();
        const y = (point.y !== undefined ? point.y : point[1]) / this.getScaleFactor();
        return [x, y];
    }

    /**
     * Convert point for export (scale up)
     * @param {Array} point - Point to convert [x, y]
     * @returns {Object} Converted point {x, y}
     */
    convertPointForExport(point) {
        return {
            x: point[0] * this.getScaleFactor(),
            y: point[1] * this.getScaleFactor()
        };
    }

    /**
     * Get scale factor for unit conversion
     * @returns {number} Scale factor
     */
    getScaleFactor() {
        return this.config.scaleFactor;
    }

    /**
     * Extract metadata from DXF
     * @param {Object} dxf - Parsed DXF object
     * @returns {Object} Metadata
     */
    extractMetadata(dxf) {
        return {
            version: dxf.header?.version || 'unknown',
            units: dxf.header?.units || this.config.defaultUnits,
            created: new Date().toISOString(),
            layers: Object.keys(dxf.tables?.layer?.layers || {}),
            entityCount: dxf.entities?.length || 0,
            bounds: this.calculateBounds(dxf.entities || [])
        };
    }

    /**
     * Calculate bounds of all entities
     * @param {Array} entities - DXF entities
     * @returns {Object} Bounds object
     */
    calculateBounds(entities) {
        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;
        
        for (const entity of entities) {
            const points = this.getEntityPoints(entity);
            for (const point of points) {
                const converted = this.convertPoint(point);
                minX = Math.min(minX, converted[0]);
                minY = Math.min(minY, converted[1]);
                maxX = Math.max(maxX, converted[0]);
                maxY = Math.max(maxY, converted[1]);
            }
        }
        
        return { minX, minY, maxX, maxY };
    }

    /**
     * Get all points from an entity
     * @param {Object} entity - DXF entity
     * @returns {Array} Array of points
     */
    getEntityPoints(entity) {
        switch (entity.type) {
            case 'LINE':
                return [entity.start, entity.end];
            case 'POLYLINE':
            case 'LWPOLYLINE':
                return entity.vertices || [];
            case 'CIRCLE':
            case 'ARC':
                return [entity.center];
            case 'TEXT':
            case 'MTEXT':
                return [entity.position || entity.start];
            case 'INSERT':
                return [entity.position];
            default:
                return [];
        }
    }

    /**
     * Post-process extracted geometry
     * @param {Object} floorPlan - Floor plan data
     */
    async postProcessGeometry(floorPlan) {
        if (this.config.mergeColinearLines) {
            floorPlan.walls = this.mergeColinearWalls(floorPlan.walls);
        }
        
        if (this.config.simplifyPolygons) {
            floorPlan.redZones = this.simplifyZones(floorPlan.redZones);
            floorPlan.blueZones = this.simplifyZones(floorPlan.blueZones);
        }
    }

    /**
     * Merge colinear walls
     * @param {Array} walls - Wall array
     * @returns {Array} Merged walls
     */
    mergeColinearWalls(walls) {
        // Simple implementation - could be enhanced
        return walls;
    }

    /**
     * Simplify zone polygons
     * @param {Array} zones - Zone array
     * @returns {Array} Simplified zones
     */
    simplifyZones(zones) {
        // Simple implementation - could be enhanced
        return zones;
    }

    /**
     * Validate extracted geometry
     * @param {Object} floorPlan - Floor plan data
     */
    async validateExtractedGeometry(floorPlan) {
        // Validate walls
        if (floorPlan.walls) {
            for (const wall of floorPlan.walls) {
                if (!this.geometryEngine.isValidPoint(wall.start) || 
                    !this.geometryEngine.isValidPoint(wall.end)) {
                    this.parseErrors.push(`Invalid wall geometry: ${wall.id}`);
                }
            }
        }
        
        // Validate zones
        if (floorPlan.redZones) {
            for (const zone of floorPlan.redZones) {
                if (!this.geometryEngine.isValidPolygon(zone.polygon)) {
                    this.parseErrors.push(`Invalid red zone geometry: ${zone.id}`);
                }
            }
        }
        
        if (floorPlan.blueZones) {
            for (const zone of floorPlan.blueZones) {
                if (!this.geometryEngine.isValidPolygon(zone.polygon)) {
                    this.parseErrors.push(`Invalid blue zone geometry: ${zone.id}`);
                }
            }
        }
    }

    /**
     * Reset processing statistics
     */
    resetStatistics() {
        this.parseErrors = [];
        this.warnings = [];
        this.statistics = {
            entitiesProcessed: 0,
            entitiesSkipped: 0,
            layersFound: 0,
            geometryCreated: 0
        };
    }

    /**
     * Generate unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `dxf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * LOGGING
     */

    log(message, data = {}) {
        if (this.config.debugMode) {
            console.log(`[DxfProcessor] ${message}`, data);
        }
    }

    logError(message, error) {
        console.error(`[DxfProcessor ERROR] ${message}:`, error);
    }

    /**
     * Get processing statistics
     * @returns {Object} Statistics
     */
    getStatistics() {
        return {
            config: this.config,
            statistics: this.statistics,
            errors: this.parseErrors,
            warnings: this.warnings
        };
    }
}

module.exports = DxfProcessor;