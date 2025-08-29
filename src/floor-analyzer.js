// Floor Design Analyzer - Extract spatial data and manage ilots
class FloorAnalyzer {
    constructor(viewer) {
        this.viewer = viewer;
        this.rooms = [];
        this.corridors = [];
        this.ilots = [];
        this.navigationPaths = [];
        this.currentPath = null;
    }

    // Analyze the loaded model for spatial elements
    async analyzeFloorPlan() {
        if (!this.viewer || !this.viewer.model) return;

        const model = this.viewer.model;
        const instanceTree = model.getInstanceTree();
        
        // Extract spatial elements
        await this.extractRooms(instanceTree);
        await this.extractCorridors(instanceTree);
        await this.generateNavigationPaths();
        
        return {
            rooms: this.rooms,
            corridors: this.corridors,
            ilots: this.ilots,
            paths: this.navigationPaths
        };
    }

    // Extract room boundaries and properties
    async extractRooms(instanceTree) {
        this.rooms = [];
        const roomTypes = ['Room', 'Space', 'Area', 'Zone'];
        
        instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
            const name = instanceTree.getNodeName(dbId);
            if (roomTypes.some(type => name?.toLowerCase().includes(type.toLowerCase()))) {
                this.viewer.model.getBoundingBox(dbId, (bbox) => {
                    if (bbox && bbox.valid) {
                        this.rooms.push({
                            id: dbId,
                            name: name || `Room ${dbId}`,
                            bbox: bbox,
                            center: bbox.center(),
                            accessible: true,
                            type: this.determineRoomType(name)
                        });
                    }
                });
            }
        }, true);
    }

    // Extract corridor paths
    async extractCorridors(instanceTree) {
        this.corridors = [];
        const corridorTypes = ['Corridor', 'Hallway', 'Passage', 'Path'];
        
        instanceTree.enumNodeChildren(instanceTree.getRootId(), (dbId) => {
            const name = instanceTree.getNodeName(dbId);
            if (corridorTypes.some(type => name?.toLowerCase().includes(type.toLowerCase()))) {
                this.viewer.model.getBoundingBox(dbId, (bbox) => {
                    if (bbox && bbox.valid) {
                        this.corridors.push({
                            id: dbId,
                            name: name || `Corridor ${dbId}`,
                            bbox: bbox,
                            path: this.generateCorridorPath(bbox),
                            width: this.calculateCorridorWidth(bbox)
                        });
                    }
                });
            }
        }, true);
    }

    // Place ilots (islands/zones) strategically
    placeIlots(config = {}) {
        const { density = 0.3, minDistance = 2.0, types = ['work', 'meeting', 'social'] } = config;
        this.ilots = [];

        this.rooms.forEach(room => {
            if (room.type === 'office' || room.type === 'open') {
                const ilotCount = Math.floor(this.calculateRoomArea(room.bbox) * density / 10);
                
                for (let i = 0; i < ilotCount; i++) {
                    const position = this.findOptimalIlotPosition(room, minDistance);
                    if (position) {
                        this.ilots.push({
                            id: `ilot_${room.id}_${i}`,
                            roomId: room.id,
                            position: position,
                            type: types[i % types.length],
                            capacity: this.calculateIlotCapacity(types[i % types.length]),
                            accessible: true
                        });
                    }
                }
            }
        });

        return this.ilots;
    }

    // Generate navigation paths between spaces
    generateNavigationPaths() {
        this.navigationPaths = [];
        
        // Connect rooms through corridors
        this.rooms.forEach(room => {
            const connectedCorridors = this.findConnectedCorridors(room);
            connectedCorridors.forEach(corridor => {
                const connectedRooms = this.findRoomsConnectedToCorridor(corridor);
                connectedRooms.forEach(targetRoom => {
                    if (targetRoom.id !== room.id) {
                        this.navigationPaths.push({
                            from: room.id,
                            to: targetRoom.id,
                            via: corridor.id,
                            path: this.calculatePath(room.center, targetRoom.center, corridor),
                            distance: this.calculateDistance(room.center, targetRoom.center)
                        });
                    }
                });
            });
        });
    }

    // Start virtual tour/navigation
    startTour(startRoomId, tourType = 'guided') {
        const startRoom = this.rooms.find(r => r.id === startRoomId);
        if (!startRoom) return null;

        const tour = {
            id: Date.now(),
            type: tourType,
            currentRoom: startRoomId,
            visitedRooms: [startRoomId],
            availablePaths: this.getAvailablePaths(startRoomId),
            position: startRoom.center
        };

        this.currentTour = tour;
        this.viewer.navigation.setPosition(startRoom.center);
        return tour;
    }

    // Navigate to specific room
    navigateToRoom(targetRoomId) {
        if (!this.currentTour) return null;

        const path = this.findShortestPath(this.currentTour.currentRoom, targetRoomId);
        if (!path) return null;

        this.currentPath = path;
        this.animateNavigation(path);
        
        this.currentTour.currentRoom = targetRoomId;
        this.currentTour.visitedRooms.push(targetRoomId);
        this.currentTour.availablePaths = this.getAvailablePaths(targetRoomId);

        return path;
    }

    // Animate camera movement along path
    animateNavigation(path) {
        if (!path || !path.path) return;

        const duration = 3000; // 3 seconds
        const steps = path.path.length;
        let currentStep = 0;

        const animate = () => {
            if (currentStep < steps) {
                const position = path.path[currentStep];
                this.viewer.navigation.setPosition(position);
                currentStep++;
                setTimeout(animate, duration / steps);
            }
        };

        animate();
    }

    // Helper methods
    determineRoomType(name) {
        const lowerName = name?.toLowerCase() || '';
        if (lowerName.includes('office')) return 'office';
        if (lowerName.includes('meeting')) return 'meeting';
        if (lowerName.includes('kitchen')) return 'kitchen';
        if (lowerName.includes('bathroom')) return 'bathroom';
        if (lowerName.includes('stair')) return 'stairs';
        return 'open';
    }

    calculateRoomArea(bbox) {
        const size = bbox.size();
        return size.x * size.y;
    }

    findOptimalIlotPosition(room, minDistance) {
        const center = room.center;
        const size = room.bbox.size();
        
        // Try to place away from walls
        const offset = Math.min(size.x, size.y) * 0.3;
        return {
            x: center.x + (Math.random() - 0.5) * offset,
            y: center.y + (Math.random() - 0.5) * offset,
            z: center.z
        };
    }

    calculateIlotCapacity(type) {
        const capacities = { work: 4, meeting: 8, social: 12 };
        return capacities[type] || 4;
    }

    findConnectedCorridors(room) {
        return this.corridors.filter(corridor => 
            this.isRoomConnectedToCorridor(room, corridor)
        );
    }

    isRoomConnectedToCorridor(room, corridor) {
        const roomBbox = room.bbox;
        const corridorBbox = corridor.bbox;
        
        // Check if bounding boxes intersect or are adjacent
        return roomBbox.intersects(corridorBbox) || 
               this.areAdjacent(roomBbox, corridorBbox);
    }

    areAdjacent(bbox1, bbox2, tolerance = 0.5) {
        const distance = bbox1.center().distanceTo(bbox2.center());
        const combinedSize = (bbox1.size().length() + bbox2.size().length()) / 2;
        return distance <= combinedSize + tolerance;
    }

    findRoomsConnectedToCorridor(corridor) {
        return this.rooms.filter(room => 
            this.isRoomConnectedToCorridor(room, corridor)
        );
    }

    calculatePath(start, end, viaCorridor) {
        // Simple path calculation - can be enhanced with A* algorithm
        const corridorCenter = viaCorridor.bbox.center();
        return [start, corridorCenter, end];
    }

    calculateDistance(point1, point2) {
        return point1.distanceTo(point2);
    }

    getAvailablePaths(roomId) {
        return this.navigationPaths.filter(path => path.from === roomId);
    }

    findShortestPath(fromRoomId, toRoomId) {
        return this.navigationPaths.find(path => 
            path.from === fromRoomId && path.to === toRoomId
        );
    }

    generateCorridorPath(bbox) {
        const start = bbox.min;
        const end = bbox.max;
        const center = bbox.center();
        
        // Generate waypoints along corridor
        return [start, center, end];
    }

    calculateCorridorWidth(bbox) {
        const size = bbox.size();
        return Math.min(size.x, size.y);
    }
}

module.exports = FloorAnalyzer;