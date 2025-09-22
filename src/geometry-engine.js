/**
 * Production-Level Geometry Engine for Architectural Floor Plan Analysis
 * 
 * Core geometric operations for îlot placement, collision detection, and spatial analysis.
 * Uses industry-standard libraries for robust geometric computations.
 * 
 * Dependencies:
 * - clipper-lib: Polygon buffering and offsetting
 * - martinez-polygon-clipping: Boolean operations (union, intersection, difference)
 * - rbush: R-tree spatial indexing for efficient collision detection
 * 
 * @author FloorPlan Pro Team
 * @version 1.0.0
 */

const clipper = require('clipper-lib');
const martinez = require('martinez-polygon-clipping');
const RBush = require('rbush');

class GeometryEngine {
    constructor(options = {}) {
        this.tolerance = options.tolerance || 0.001; // Geometric tolerance in units
        this.scaleFactor = options.scaleFactor || 10000; // For clipper-lib precision
        this.spatialIndex = new RBush();
        this.debugMode = options.debugMode || false;
        
        // Initialize clipper instance
        this.clipperOffset = new clipper.ClipperOffset();
        
        this.log('GeometryEngine initialized', { tolerance: this.tolerance });
    }

    /**
     * POLYGON BUFFERING OPERATIONS
     */

    /**
     * Buffer (offset) polygon by specified distance
     * @param {Array} polygon - Array of [x, y] coordinates
     * @param {number} distance - Buffer distance (positive = expand, negative = shrink)
     * @param {Object} options - Buffer options
     * @returns {Array} Array of buffered polygons
     */
    bufferPolygon(polygon, distance, options = {}) {
        try {
            if (!this.isValidPolygon(polygon)) {
                throw new Error('Invalid polygon provided for buffering');
            }

            const joinType = options.joinType || clipper.JoinType.jtRound;
            const endType = options.endType || clipper.EndType.etClosedPolygon;
            const miterLimit = options.miterLimit || 2.0;
            const arcTolerance = options.arcTolerance || 0.25;

            // Scale polygon for clipper precision
            const scaledPolygon = this.scalePolygon(polygon, this.scaleFactor);
            const scaledDistance = distance * this.scaleFactor;

            // Clear previous operations
            this.clipperOffset.Clear();
            
            // Add polygon to clipper
            this.clipperOffset.AddPath(scaledPolygon, joinType, endType);
            
            // Execute buffering
            const solution = new clipper.Paths();
            this.clipperOffset.Execute(solution, scaledDistance);

            // Scale back and convert result
            const bufferedPolygons = solution.map(path => 
                this.scalePolygon(path.map(pt => [pt.X, pt.Y]), 1 / this.scaleFactor)
            );

            this.log('Polygon buffered', { 
                originalVertices: polygon.length, 
                distance, 
                resultPolygons: bufferedPolygons.length 
            });

            return bufferedPolygons;

        } catch (error) {
            this.logError('Polygon buffering failed', error);
            throw new Error(`Polygon buffering failed: ${error.message}`);
        }
    }

    /**
     * Buffer multiple polygons efficiently
     * @param {Array} polygons - Array of polygon arrays
     * @param {number} distance - Buffer distance
     * @param {Object} options - Buffer options
     * @returns {Array} Array of buffered polygon sets
     */
    bufferPolygons(polygons, distance, options = {}) {
        return polygons.map(polygon => this.bufferPolygon(polygon, distance, options));
    }

    /**
     * BOOLEAN OPERATIONS
     */

    /**
     * Union of two or more polygons
     * @param {Array} polygons - Array of polygons to union
     * @returns {Array} Resulting polygon(s) from union operation
     */
    unionPolygons(polygons) {
        try {
            if (!polygons || polygons.length === 0) return [];
            if (polygons.length === 1) return polygons;

            // Convert to martinez format and validate
            const validPolygons = polygons
                .filter(p => this.isValidPolygon(p))
                .map(p => this.toMartinezFormat(p));

            if (validPolygons.length === 0) {
                throw new Error('No valid polygons provided for union');
            }

            // Perform union operation
            let result = validPolygons[0];
            for (let i = 1; i < validPolygons.length; i++) {
                result = martinez.union(result, validPolygons[i]);
            }

            const unionResult = this.fromMartinezFormat(result);
            this.log('Union operation completed', { 
                inputPolygons: polygons.length, 
                outputPolygons: unionResult.length 
            });

            return unionResult;

        } catch (error) {
            this.logError('Union operation failed', error);
            return [];
        }
    }

    /**
     * Intersection of two polygons
     * @param {Array} polygon1 - First polygon
     * @param {Array} polygon2 - Second polygon
     * @returns {Array} Resulting polygon(s) from intersection
     */
    intersectionPolygons(polygon1, polygon2) {
        try {
            if (!this.isValidPolygon(polygon1) || !this.isValidPolygon(polygon2)) {
                throw new Error('Invalid polygons provided for intersection');
            }

            const p1 = this.toMartinezFormat(polygon1);
            const p2 = this.toMartinezFormat(polygon2);

            const result = martinez.intersection(p1, p2);
            const intersectionResult = this.fromMartinezFormat(result);

            this.log('Intersection operation completed', { 
                outputPolygons: intersectionResult.length 
            });

            return intersectionResult;

        } catch (error) {
            this.logError('Intersection operation failed', error);
            return [];
        }
    }

    /**
     * Difference of two polygons (A - B)
     * @param {Array} polygon1 - Base polygon
     * @param {Array} polygon2 - Polygon to subtract
     * @returns {Array} Resulting polygon(s) from difference
     */
    differencePolygons(polygon1, polygon2) {
        try {
            if (!this.isValidPolygon(polygon1) || !this.isValidPolygon(polygon2)) {
                throw new Error('Invalid polygons provided for difference');
            }

            const p1 = this.toMartinezFormat(polygon1);
            const p2 = this.toMartinezFormat(polygon2);

            const result = martinez.diff(p1, p2);
            const differenceResult = this.fromMartinezFormat(result);

            this.log('Difference operation completed', { 
                outputPolygons: differenceResult.length 
            });

            return differenceResult;

        } catch (error) {
            this.logError('Difference operation failed', error);
            return [];
        }
    }

    /**
     * SPATIAL INDEXING OPERATIONS
     */

    /**
     * Build spatial index from geometry objects
     * @param {Array} geometries - Array of geometry objects with bbox
     */
    buildSpatialIndex(geometries) {
        try {
            this.spatialIndex.clear();
            
            const indexItems = geometries.map((geom, index) => ({
                minX: geom.bbox.minX,
                minY: geom.bbox.minY,
                maxX: geom.bbox.maxX,
                maxY: geom.bbox.maxY,
                id: geom.id || index,
                geometry: geom
            }));

            this.spatialIndex.load(indexItems);
            
            this.log('Spatial index built', { itemCount: indexItems.length });

        } catch (error) {
            this.logError('Spatial index building failed', error);
            throw new Error(`Spatial index building failed: ${error.message}`);
        }
    }

    /**
     * Query spatial index for potential collisions
     * @param {Object} bbox - Bounding box to query
     * @returns {Array} Array of potentially intersecting items
     */
    querySpatialIndex(bbox) {
        try {
            const results = this.spatialIndex.search(bbox);
            this.log('Spatial query completed', { 
                bbox, 
                resultCount: results.length 
            });
            return results;

        } catch (error) {
            this.logError('Spatial query failed', error);
            return [];
        }
    }

    /**
     * COLLISION DETECTION
     */

    /**
     * Check if point is inside polygon
     * @param {Array} point - [x, y] coordinates
     * @param {Array} polygon - Array of [x, y] coordinates
     * @returns {boolean} True if point is inside polygon
     */
    pointInPolygon(point, polygon) {
        try {
            if (!this.isValidPoint(point) || !this.isValidPolygon(polygon)) {
                return false;
            }

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

        } catch (error) {
            this.logError('Point-in-polygon test failed', error);
            return false;
        }
    }

    /**
     * Check if two polygons collide
     * @param {Array} polygon1 - First polygon
     * @param {Array} polygon2 - Second polygon
     * @returns {boolean} True if polygons intersect
     */
    polygonsCollide(polygon1, polygon2) {
        try {
            // Quick bbox check first
            const bbox1 = this.calculateBoundingBox(polygon1);
            const bbox2 = this.calculateBoundingBox(polygon2);
            
            if (!this.bboxesIntersect(bbox1, bbox2)) {
                return false;
            }

            // Detailed intersection check
            const intersection = this.intersectionPolygons(polygon1, polygon2);
            return intersection.length > 0;

        } catch (error) {
            this.logError('Polygon collision detection failed', error);
            return false;
        }
    }

    /**
     * Find all collisions in geometry set
     * @param {Array} geometries - Array of geometry objects
     * @returns {Array} Array of collision pairs
     */
    findAllCollisions(geometries) {
        try {
            const collisions = [];
            
            // Build spatial index for efficient queries
            this.buildSpatialIndex(geometries);

            for (let i = 0; i < geometries.length; i++) {
                const geom1 = geometries[i];
                const bbox1 = geom1.bbox;

                // Query spatial index for potential collisions
                const candidates = this.querySpatialIndex(bbox1);

                for (const candidate of candidates) {
                    const geom2 = candidate.geometry;
                    
                    // Skip self-collision and already checked pairs
                    if (geom1.id >= geom2.id) continue;

                    // Detailed collision check
                    if (this.polygonsCollide(geom1.polygon, geom2.polygon)) {
                        collisions.push({
                            id1: geom1.id,
                            id2: geom2.id,
                            type: 'polygon_intersection'
                        });
                    }
                }
            }

            this.log('Collision detection completed', { 
                geometries: geometries.length, 
                collisions: collisions.length 
            });

            return collisions;

        } catch (error) {
            this.logError('Collision detection failed', error);
            return [];
        }
    }

    /**
     * UTILITY FUNCTIONS
     */

    /**
     * Calculate bounding box of polygon
     * @param {Array} polygon - Array of [x, y] coordinates
     * @returns {Object} Bounding box object
     */
    calculateBoundingBox(polygon) {
        if (!this.isValidPolygon(polygon)) {
            throw new Error('Invalid polygon for bounding box calculation');
        }

        const xs = polygon.map(p => p[0]);
        const ys = polygon.map(p => p[1]);

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        };
    }

    /**
     * Check if two bounding boxes intersect
     * @param {Object} bbox1 - First bounding box
     * @param {Object} bbox2 - Second bounding box
     * @returns {boolean} True if boxes intersect
     */
    bboxesIntersect(bbox1, bbox2) {
        return !(bbox1.maxX < bbox2.minX || 
                bbox2.maxX < bbox1.minX || 
                bbox1.maxY < bbox2.minY || 
                bbox2.maxY < bbox1.minY);
    }

    /**
     * Calculate polygon area
     * @param {Array} polygon - Array of [x, y] coordinates
     * @returns {number} Polygon area
     */
    calculatePolygonArea(polygon) {
        if (!this.isValidPolygon(polygon)) return 0;

        let area = 0;
        const n = polygon.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += polygon[i][0] * polygon[j][1];
            area -= polygon[j][0] * polygon[i][1];
        }

        return Math.abs(area) / 2;
    }

    /**
     * Calculate distance between two points
     * @param {Array} point1 - First point [x, y]
     * @param {Array} point2 - Second point [x, y]
     * @returns {number} Distance between points
     */
    calculateDistance(point1, point2) {
        const dx = point1[0] - point2[0];
        const dy = point1[1] - point2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * VALIDATION FUNCTIONS
     */

    /**
     * Validate polygon structure
     * @param {Array} polygon - Polygon to validate
     * @returns {boolean} True if valid
     */
    isValidPolygon(polygon) {
        return Array.isArray(polygon) && 
               polygon.length >= 3 && 
               polygon.every(point => this.isValidPoint(point));
    }

    /**
     * Validate point structure
     * @param {Array} point - Point to validate
     * @returns {boolean} True if valid
     */
    isValidPoint(point) {
        return Array.isArray(point) && 
               point.length === 2 && 
               typeof point[0] === 'number' && 
               typeof point[1] === 'number' &&
               !isNaN(point[0]) && !isNaN(point[1]);
    }

    /**
     * FORMAT CONVERSION FUNCTIONS
     */

    /**
     * Convert polygon to martinez format
     * @param {Array} polygon - Standard polygon format
     * @returns {Array} Martinez format polygon
     */
    toMartinezFormat(polygon) {
        return [polygon.map(point => [point[0], point[1]])];
    }

    /**
     * Convert from martinez format
     * @param {Array} martinezPolygons - Martinez format result
     * @returns {Array} Array of standard format polygons
     */
    fromMartinezFormat(martinezPolygons) {
        if (!martinezPolygons || martinezPolygons.length === 0) return [];
        
        return martinezPolygons.map(polygon => {
            if (polygon.length > 0) {
                return polygon[0]; // Take exterior ring only
            }
            return [];
        }).filter(polygon => polygon.length > 0);
    }

    /**
     * Scale polygon coordinates
     * @param {Array} polygon - Polygon to scale
     * @param {number} scale - Scale factor
     * @returns {Array} Scaled polygon
     */
    scalePolygon(polygon, scale) {
        return polygon.map(point => ({
            X: Math.round(point[0] * scale),
            Y: Math.round(point[1] * scale)
        }));
    }

    /**
     * LOGGING FUNCTIONS
     */

    /**
     * Log debug information
     * @param {string} message - Log message
     * @param {Object} data - Additional data
     */
    log(message, data = {}) {
        if (this.debugMode) {
            console.log(`[GeometryEngine] ${message}`, data);
        }
    }

    /**
     * Log error information
     * @param {string} message - Error message
     * @param {Error} error - Error object
     */
    logError(message, error) {
        console.error(`[GeometryEngine ERROR] ${message}:`, error);
    }

    /**
     * Get engine statistics
     * @returns {Object} Engine statistics
     */
    getStatistics() {
        return {
            tolerance: this.tolerance,
            scaleFactor: this.scaleFactor,
            spatialIndexSize: this.spatialIndex.toJSON().children?.length || 0,
            debugMode: this.debugMode
        };
    }
}

module.exports = GeometryEngine;