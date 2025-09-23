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
/**
 * Geometry Engine for spatial operations and calculations
 * Provides utilities for geometric computations needed by placement and corridor systems
 */

class GeometryEngine {
    constructor(options = {}) {
        this.tolerance = options.tolerance || 0.001;
        this.debugMode = options.debugMode || false;
    }

    /**
     * Calculate bounding box of a polygon or set of points
     * @param {Array} points - Array of points [[x,y], [x,y], ...]
     * @returns {Object} Bounding box {minX, minY, maxX, maxY}
     */
    calculateBoundingBox(points) {
        if (!points || points.length === 0) {
            return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const point of points) {
            const x = point[0];
            const y = point[1];
            
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }

        return { minX, minY, maxX, maxY };
    }

    /**
     * Check if a point is inside a polygon using ray casting algorithm
     * @param {Array} point - Point [x, y]
     * @param {Array} polygon - Polygon vertices [[x,y], [x,y], ...]
     * @returns {boolean} True if point is inside polygon
     */
    pointInPolygon(point, polygon) {
        if (!polygon || polygon.length < 3) return false;
        
        const x = point[0];
        const y = point[1];
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0];
            const yi = polygon[i][1];
            const xj = polygon[j][0];
            const yj = polygon[j][1];

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Calculate distance between two points
     * @param {Array} point1 - First point [x, y]
     * @param {Array} point2 - Second point [x, y]
     * @returns {number} Distance
     */
    calculateDistance(point1, point2) {
        const dx = point2[0] - point1[0];
        const dy = point2[1] - point1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate area of a polygon using shoelace formula
     * @param {Array} polygon - Polygon vertices [[x,y], [x,y], ...]
     * @returns {number} Area
     */
    calculatePolygonArea(polygon) {
        if (!polygon || polygon.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i][0] * polygon[j][1];
            area -= polygon[j][0] * polygon[i][1];
        }
        return Math.abs(area) / 2;
    }

    /**
     * Check if two polygons overlap
     * @param {Array} poly1 - First polygon
     * @param {Array} poly2 - Second polygon
     * @returns {boolean} True if polygons overlap
     */
    polygonsOverlap(poly1, poly2) {
        // Check if any vertex of poly1 is inside poly2
        for (const vertex of poly1) {
            if (this.pointInPolygon(vertex, poly2)) {
                return true;
            }
        }
        
        // Check if any vertex of poly2 is inside poly1
        for (const vertex of poly2) {
            if (this.pointInPolygon(vertex, poly1)) {
                return true;
            }
        }
        
        // Check for edge intersections
        return this.polygonEdgesIntersect(poly1, poly2);
    }

    /**
     * Check if edges of two polygons intersect
     * @param {Array} poly1 - First polygon
     * @param {Array} poly2 - Second polygon
     * @returns {boolean} True if edges intersect
     */
    polygonEdgesIntersect(poly1, poly2) {
        for (let i = 0; i < poly1.length; i++) {
            const edge1Start = poly1[i];
            const edge1End = poly1[(i + 1) % poly1.length];
            
            for (let j = 0; j < poly2.length; j++) {
                const edge2Start = poly2[j];
                const edge2End = poly2[(j + 1) % poly2.length];
                
                if (this.linesIntersect(edge1Start, edge1End, edge2Start, edge2End)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if two line segments intersect
     * @param {Array} line1Start - Start of first line [x, y]
     * @param {Array} line1End - End of first line [x, y]
     * @param {Array} line2Start - Start of second line [x, y]
     * @param {Array} line2End - End of second line [x, y]
     * @returns {boolean} True if lines intersect
     */
    linesIntersect(line1Start, line1End, line2Start, line2End) {
        const orientation = (p, q, r) => {
            const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
            if (Math.abs(val) < this.tolerance) return 0; // Collinear
            return (val > 0) ? 1 : 2; // Clockwise or Counterclockwise
        };

        const onSegment = (p, q, r) => {
            return q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
                   q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]);
        };

        const o1 = orientation(line1Start, line1End, line2Start);
        const o2 = orientation(line1Start, line1End, line2End);
        const o3 = orientation(line2Start, line2End, line1Start);
        const o4 = orientation(line2Start, line2End, line1End);

        // General case
        if (o1 !== o2 && o3 !== o4) return true;

        // Special cases for collinear points
        if (o1 === 0 && onSegment(line1Start, line2Start, line1End)) return true;
        if (o2 === 0 && onSegment(line1Start, line2End, line1End)) return true;
        if (o3 === 0 && onSegment(line2Start, line1Start, line2End)) return true;
        if (o4 === 0 && onSegment(line2Start, line1End, line2End)) return true;

        return false;
    }

    /**
     * Calculate minimum distance from point to polygon
     * @param {Array} point - Point [x, y]
     * @param {Array} polygon - Polygon vertices
     * @returns {number} Minimum distance
     */
    pointToPolygonDistance(point, polygon) {
        let minDistance = Infinity;
        
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            const distance = this.pointToLineDistance(point, polygon[i], polygon[j]);
            minDistance = Math.min(minDistance, distance);
        }
        
        return minDistance;
    }

    /**
     * Calculate distance from point to line segment
     * @param {Array} point - Point [x, y]
     * @param {Array} lineStart - Line start [x, y]
     * @param {Array} lineEnd - Line end [x, y]
     * @returns {number} Distance
     */
    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point[0] - lineStart[0];
        const B = point[1] - lineStart[1];
        const C = lineEnd[0] - lineStart[0];
        const D = lineEnd[1] - lineStart[1];

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) {
            // Line is a point
            return this.calculateDistance(point, lineStart);
        }
        
        let param = dot / lenSq;
        
        let closestPoint;
        if (param < 0) {
            closestPoint = lineStart;
        } else if (param > 1) {
            closestPoint = lineEnd;
        } else {
            closestPoint = [
                lineStart[0] + param * C,
                lineStart[1] + param * D
            ];
        }
        
        return this.calculateDistance(point, closestPoint);
    }

    /**
     * Generate a rectangular polygon
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} width - Width
     * @param {number} height - Height
     * @returns {Array} Rectangle vertices
     */
    createRectangle(x, y, width, height) {
        const halfWidth = width / 2;
        const halfHeight = height / 2;
        
        return [
            [x - halfWidth, y - halfHeight],
            [x + halfWidth, y - halfHeight],
            [x + halfWidth, y + halfHeight],
            [x - halfWidth, y + halfHeight]
        ];
    }

    /**
     * Generate a circular polygon (approximated)
     * @param {number} x - Center X
     * @param {number} y - Center Y
     * @param {number} radius - Radius
     * @param {number} segments - Number of segments (default 16)
     * @returns {Array} Circle vertices
     */
    createCircle(x, y, radius, segments = 16) {
        const vertices = [];
        for (let i = 0; i < segments; i++) {
            const angle = (i * 2 * Math.PI) / segments;
            vertices.push([
                x + radius * Math.cos(angle),
                y + radius * Math.sin(angle)
            ]);
        }
        return vertices;
    }

    /**
     * Offset polygon by a distance (buffer operation)
     * @param {Array} polygon - Original polygon
     * @param {number} distance - Offset distance
     * @returns {Array} Offset polygon
     */
    offsetPolygon(polygon, distance) {
        // Simplified offset - expand each vertex outward
        const center = this.calculatePolygonCentroid(polygon);
        
        return polygon.map(vertex => {
            const dx = vertex[0] - center[0];
            const dy = vertex[1] - center[1];
            const length = Math.sqrt(dx * dx + dy * dy);
            
            if (length === 0) return vertex;
            
            const scale = (length + distance) / length;
            return [
                center[0] + dx * scale,
                center[1] + dy * scale
            ];
        });
    }

    /**
     * Calculate polygon centroid
     * @param {Array} polygon - Polygon vertices
     * @returns {Array} Centroid [x, y]
     */
    calculatePolygonCentroid(polygon) {
        if (!polygon || polygon.length === 0) return [0, 0];
        
        let x = 0, y = 0;
        for (const vertex of polygon) {
            x += vertex[0];
            y += vertex[1];
        }
        
        return [x / polygon.length, y / polygon.length];
    }

    /**
     * Check if a rectangle fits within allowed space
     * @param {number} x - Rectangle center X
     * @param {number} y - Rectangle center Y
     * @param {number} width - Rectangle width
     * @param {number} height - Rectangle height
     * @param {Array} allowedSpace - Allowed space polygon
     * @param {Array} obstacles - Array of obstacle polygons
     * @param {number} clearance - Minimum clearance distance
     * @returns {boolean} True if rectangle fits
     */
    rectangleFitsInSpace(x, y, width, height, allowedSpace, obstacles = [], clearance = 0) {
        // Create rectangle with clearance
        const rect = this.createRectangle(x, y, width + 2 * clearance, height + 2 * clearance);
        
        // Check if entirely within allowed space
        for (const vertex of rect) {
            if (!this.pointInPolygon(vertex, allowedSpace)) {
                return false;
            }
        }
        
        // Check clearance from obstacles
        for (const obstacle of obstacles) {
            if (this.polygonsOverlap(rect, obstacle)) {
                return false;
            }
        }
        
        return true;
    }
}

module.exports = GeometryEngine;
