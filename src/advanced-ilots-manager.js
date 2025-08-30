// Advanced Ilots (Space Islands) Management System
class AdvancedIlotsManager {
    constructor(viewer, roomDetector) {
        this.viewer = viewer;
        this.roomDetector = roomDetector;
        this.ilots = [];
        this.configurations = {
            density: 0.3,
            minDistance: 2.0,
            types: ['work', 'meeting', 'social', 'break', 'focus', 'collaboration'],
            optimization: 'balanced' // 'density', 'comfort', 'efficiency'
        };
    }

    // Generate optimized ilots placement
    async generateOptimizedIlots(config = {}) {
        console.log('🏝️ Generating optimized ilots...');
        
        this.configurations = { ...this.configurations, ...config };
        
        // Get room data
        const rooms = this.roomDetector.rooms || await this.roomDetector.detectRooms();
        
        // Generate ilots for each suitable room
        this.ilots = [];
        for (const room of rooms) {
            if (this.isRoomSuitableForIlots(room)) {
                const roomIlots = await this.generateRoomIlots(room);
                this.ilots.push(...roomIlots);
            }
        }
        
        // Apply global optimization
        this.ilots = await this.optimizeGlobalPlacement(this.ilots);
        
        // Visualize ilots
        this.visualizeIlots();
        
        console.log(`✅ Generated ${this.ilots.length} optimized ilots`);
        return this.ilots;
    }

    // Check if room is suitable for ilots
    isRoomSuitableForIlots(room) {
        const suitableTypes = ['office', 'meeting_room', 'general_space'];
        return suitableTypes.includes(room.type) && room.area > 15;
    }

    // Generate ilots for a specific room
    async generateRoomIlots(room) {
        const roomIlots = [];
        const availableArea = room.area * 0.7; // 70% usable area
        const ilotArea = this.calculateOptimalIlotSize(room);
        const maxIlots = Math.floor(availableArea / ilotArea);
        
        // Determine ilot types based on room function
        const ilotTypes = this.determineIlotTypes(room);
        
        for (let i = 0; i < maxIlots; i++) {
            const position = this.calculateOptimalPosition(room, i, maxIlots);
            const ilotType = ilotTypes[i % ilotTypes.length];
            
            const ilot = {
                id: `ilot_${room.id}_${i}`,
                roomId: room.id,
                type: ilotType,
                position,
                capacity: this.calculateIlotCapacity(ilotType),
                equipment: this.getIlotEquipment(ilotType),
                accessibility: this.assessIlotAccessibility(position, room),
                efficiency: this.calculateEfficiencyScore(position, room),
                metadata: {
                    created: new Date().toISOString(),
                    optimizationLevel: this.configurations.optimization
                }
            };
            
            roomIlots.push(ilot);
        }
        
        return roomIlots;
    }

    // Calculate optimal ilot size
    calculateOptimalIlotSize(room) {
        const baseSize = 12; // 12 sqm base size
        const roomFactor = Math.min(room.area / 50, 2); // Scale with room size
        return baseSize * roomFactor;
    }

    // Determine appropriate ilot types for room
    determineIlotTypes(room) {
        const typeMap = {
            'office': ['work', 'focus', 'collaboration'],
            'meeting_room': ['meeting', 'collaboration', 'presentation'],
            'general_space': ['work', 'meeting', 'social', 'break']
        };
        
        return typeMap[room.type] || ['work', 'meeting'];
    }

    // Calculate optimal position using advanced algorithms
    calculateOptimalPosition(room, index, total) {
        const center = room.center;
        const roomSize = room.bbox.size();
        
        // Use grid-based positioning with optimization
        const cols = Math.ceil(Math.sqrt(total));
        const rows = Math.ceil(total / cols);
        
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        // Calculate position with spacing
        const spacing = this.configurations.minDistance;
        const x = center.x - (roomSize.x * 0.3) + (col * spacing);
        const y = center.y - (roomSize.y * 0.3) + (row * spacing);
        
        return {
            x: x + (Math.random() - 0.5) * 0.5, // Small random offset
            y: y + (Math.random() - 0.5) * 0.5,
            z: center.z
        };
    }

    // Calculate ilot capacity based on type
    calculateIlotCapacity(type) {
        const capacities = {
            work: 4,
            meeting: 8,
            social: 12,
            break: 6,
            focus: 2,
            collaboration: 10,
            presentation: 20
        };
        
        return capacities[type] || 4;
    }

    // Get equipment for ilot type
    getIlotEquipment(type) {
        const equipment = {
            work: ['desks', 'chairs', 'monitors', 'storage'],
            meeting: ['table', 'chairs', 'whiteboard', 'projector'],
            social: ['seating', 'coffee_table', 'plants'],
            break: ['seating', 'tables', 'microwave', 'refrigerator'],
            focus: ['desk', 'chair', 'privacy_screen', 'lighting'],
            collaboration: ['modular_furniture', 'whiteboards', 'screens'],
            presentation: ['podium', 'screen', 'seating', 'audio_system']
        };
        
        return equipment[type] || ['basic_furniture'];
    }

    // Assess ilot accessibility
    assessIlotAccessibility(position, room) {
        // Calculate distance to room entrance
        const distanceToEntrance = this.calculateDistanceToEntrance(position, room);
        
        return {
            wheelchairAccessible: distanceToEntrance < 15,
            pathClearance: 'adequate',
            proximityScore: Math.max(0, 1 - (distanceToEntrance / 20)),
            accessibilityRating: distanceToEntrance < 10 ? 'excellent' : 
                                distanceToEntrance < 20 ? 'good' : 'fair'
        };
    }

    // Calculate efficiency score
    calculateEfficiencyScore(position, room) {
        const centerDistance = this.calculateDistance(position, room.center);
        const roomRadius = Math.max(room.width, room.height) / 2;
        
        // Efficiency based on position within room
        const positionScore = Math.max(0, 1 - (centerDistance / roomRadius));
        
        // Add factors for natural light, ventilation, etc.
        const lightingScore = this.estimateLightingQuality(position, room);
        const ventilationScore = this.estimateVentilation(position, room);
        
        return (positionScore + lightingScore + ventilationScore) / 3;
    }

    // Global optimization of ilot placement
    async optimizeGlobalPlacement(ilots) {
        console.log('🔧 Applying global optimization...');
        
        // Apply optimization algorithm based on configuration
        switch (this.configurations.optimization) {
            case 'density':
                return this.optimizeForDensity(ilots);
            case 'comfort':
                return this.optimizeForComfort(ilots);
            case 'efficiency':
                return this.optimizeForEfficiency(ilots);
            default:
                return this.optimizeBalanced(ilots);
        }
    }

    // Density optimization
    optimizeForDensity(ilots) {
        // Maximize number of ilots while maintaining minimum distances
        return ilots.filter(ilot => {
            const conflicts = this.checkIlotConflicts(ilot, ilots);
            return conflicts.length === 0;
        });
    }

    // Comfort optimization
    optimizeForComfort(ilots) {
        // Prioritize spacing and accessibility
        return ilots.map(ilot => ({
            ...ilot,
            position: this.adjustForComfort(ilot.position, ilot.roomId),
            comfortScore: this.calculateComfortScore(ilot)
        }));
    }

    // Efficiency optimization
    optimizeForEfficiency(ilots) {
        // Optimize for workflow and productivity
        return ilots.sort((a, b) => b.efficiency - a.efficiency);
    }

    // Balanced optimization
    optimizeBalanced(ilots) {
        // Balance all factors
        return ilots.map(ilot => ({
            ...ilot,
            overallScore: this.calculateOverallScore(ilot)
        })).sort((a, b) => b.overallScore - a.overallScore);
    }

    // Visualize ilots in the viewer
    visualizeIlots() {
        console.log('🎨 Visualizing ilots...');
        
        this.ilots.forEach(ilot => {
            this.createIlotVisualization(ilot);
        });
    }

    // Create 3D visualization for an ilot
    createIlotVisualization(ilot) {
        const geometry = new THREE.BoxGeometry(2, 2, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: this.getIlotColor(ilot.type),
            transparent: true,
            opacity: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(ilot.position.x, ilot.position.y, ilot.position.z + 0.05);
        mesh.userData = ilot;
        
        // Add label
        this.addIlotLabel(mesh, ilot);
        
        this.viewer.impl.scene.add(mesh);
        this.viewer.impl.invalidate(true);
    }

    // Get color for ilot type
    getIlotColor(type) {
        const colors = {
            work: 0x3b82f6,      // Blue
            meeting: 0x10b981,   // Green
            social: 0xf59e0b,    // Orange
            break: 0x8b5cf6,     // Purple
            focus: 0x06b6d4,     // Cyan
            collaboration: 0xef4444, // Red
            presentation: 0x84cc16   // Lime
        };
        
        return colors[type] || 0x64748b;
    }

    // Add text label to ilot
    addIlotLabel(mesh, ilot) {
        // Create text sprite for labeling
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = '#000000';
        context.font = '16px Arial';
        context.textAlign = 'center';
        context.fillText(`${ilot.type.toUpperCase()}`, canvas.width/2, 25);
        context.fillText(`Cap: ${ilot.capacity}`, canvas.width/2, 45);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        sprite.position.set(0, 0, 1);
        sprite.scale.set(2, 0.5, 1);
        mesh.add(sprite);
    }

    // Helper methods
    calculateDistance(pos1, pos2) {
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateDistanceToEntrance(position, room) {
        // Simplified - assume entrance is at room edge closest to origin
        const roomEdge = {
            x: room.center.x - room.width / 2,
            y: room.center.y - room.height / 2,
            z: room.center.z
        };
        
        return this.calculateDistance(position, roomEdge);
    }

    estimateLightingQuality(position, room) {
        // Simulate lighting quality based on position
        const distanceFromWall = Math.min(
            Math.abs(position.x - (room.center.x - room.width / 2)),
            Math.abs(position.x - (room.center.x + room.width / 2))
        );
        
        return Math.min(1, distanceFromWall / 3); // Better lighting near windows
    }

    estimateVentilation(position, room) {
        // Simulate ventilation quality
        return 0.8; // Assume good ventilation
    }

    checkIlotConflicts(ilot, allIlots) {
        return allIlots.filter(other => 
            other.id !== ilot.id && 
            this.calculateDistance(ilot.position, other.position) < this.configurations.minDistance
        );
    }

    adjustForComfort(position, roomId) {
        // Adjust position for better comfort
        return {
            ...position,
            x: position.x + (Math.random() - 0.5) * 0.2,
            y: position.y + (Math.random() - 0.5) * 0.2
        };
    }

    calculateComfortScore(ilot) {
        return ilot.accessibility.proximityScore * 0.4 + 
               ilot.efficiency * 0.6;
    }

    calculateOverallScore(ilot) {
        return (ilot.efficiency + ilot.accessibility.proximityScore + 
                (ilot.comfortScore || 0.8)) / 3;
    }

    // Export ilots data
    exportIlots() {
        return {
            ilots: this.ilots,
            configuration: this.configurations,
            statistics: {
                totalIlots: this.ilots.length,
                typeDistribution: this.getTypeDistribution(),
                averageCapacity: this.getAverageCapacity(),
                totalCapacity: this.getTotalCapacity(),
                optimizationScore: this.calculateOptimizationScore()
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

    getAverageCapacity() {
        return this.ilots.reduce((sum, ilot) => sum + ilot.capacity, 0) / this.ilots.length;
    }

    getTotalCapacity() {
        return this.ilots.reduce((sum, ilot) => sum + ilot.capacity, 0);
    }

    calculateOptimizationScore() {
        return this.ilots.reduce((sum, ilot) => sum + (ilot.overallScore || 0.8), 0) / this.ilots.length;
    }
}

module.exports = AdvancedIlotsManager;