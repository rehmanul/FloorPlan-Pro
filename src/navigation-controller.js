// Navigation Controller - Handle virtual tours and room navigation
class NavigationController {
    constructor(viewer, floorAnalyzer) {
        this.viewer = viewer;
        this.analyzer = floorAnalyzer;
        this.isNavigating = false;
        this.currentTour = null;
        this.tourHistory = [];
        this.navigationSpeed = 1.0;
        this.viewMode = '3d'; // '3d', '2d', 'walkthrough'
    }

    // Initialize navigation system
    initialize() {
        this.setupNavigationControls();
        this.setupEventListeners();
        return this;
    }

    // Setup navigation UI controls
    setupNavigationControls() {
        const navPanel = this.createNavigationPanel();
        document.body.appendChild(navPanel);
    }

    // Create navigation control panel
    createNavigationPanel() {
        const panel = document.createElement('div');
        panel.id = 'navigationPanel';
        panel.className = 'navigation-panel';
        panel.innerHTML = `
            <div class="nav-header">
                <h3><i class="fas fa-route"></i> Navigation</h3>
                <button id="toggleNav" class="btn-icon"><i class="fas fa-chevron-down"></i></button>
            </div>
            <div class="nav-content">
                <div class="nav-section">
                    <label>View Mode:</label>
                    <select id="viewMode">
                        <option value="3d">3D View</option>
                        <option value="2d">Floor Plan</option>
                        <option value="walkthrough">Walkthrough</option>
                    </select>
                </div>
                <div class="nav-section">
                    <label>Navigation Speed:</label>
                    <input type="range" id="navSpeed" min="0.5" max="3" step="0.1" value="1">
                    <span id="speedValue">1.0x</span>
                </div>
                <div class="nav-section">
                    <button id="startTour" class="btn-primary">
                        <i class="fas fa-play"></i> Start Tour
                    </button>
                    <button id="stopTour" class="btn-secondary" disabled>
                        <i class="fas fa-stop"></i> Stop Tour
                    </button>
                </div>
                <div class="nav-section">
                    <label>Quick Navigation:</label>
                    <div id="roomList" class="room-list"></div>
                </div>
                <div class="nav-section">
                    <label>Current Location:</label>
                    <div id="currentLocation" class="location-info">Not started</div>
                </div>
            </div>
        `;
        return panel;
    }

    // Setup event listeners
    setupEventListeners() {
        // View mode change
        document.getElementById('viewMode')?.addEventListener('change', (e) => {
            this.setViewMode(e.target.value);
        });

        // Navigation speed
        const speedSlider = document.getElementById('navSpeed');
        speedSlider?.addEventListener('input', (e) => {
            this.navigationSpeed = parseFloat(e.target.value);
            document.getElementById('speedValue').textContent = `${this.navigationSpeed}x`;
        });

        // Tour controls
        document.getElementById('startTour')?.addEventListener('click', () => {
            this.startGuidedTour();
        });

        document.getElementById('stopTour')?.addEventListener('click', () => {
            this.stopTour();
        });

        // Panel toggle
        document.getElementById('toggleNav')?.addEventListener('click', () => {
            this.toggleNavigationPanel();
        });

        // Viewer selection events
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
            this.onSelectionChanged(event);
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardNavigation(e);
        });
    }

    // Start guided tour
    async startGuidedTour() {
        if (!this.analyzer.rooms.length) {
            await this.analyzer.analyzeFloorPlan();
        }

        if (!this.analyzer.rooms.length) {
            this.showNotification('No rooms found in the floor plan', 'warning');
            return;
        }

        // Start from the first room or entrance
        const startRoom = this.findEntranceRoom() || this.analyzer.rooms[0];
        this.currentTour = this.analyzer.startTour(startRoom.id, 'guided');
        
        if (this.currentTour) {
            this.isNavigating = true;
            this.updateNavigationUI();
            this.populateRoomList();
            this.showNotification(`Tour started from ${startRoom.name}`, 'success');
            
            // Enable stop button, disable start button
            document.getElementById('startTour').disabled = true;
            document.getElementById('stopTour').disabled = false;
        }
    }

    // Stop current tour
    stopTour() {
        this.isNavigating = false;
        this.currentTour = null;
        this.analyzer.currentPath = null;
        
        // Reset UI
        document.getElementById('startTour').disabled = false;
        document.getElementById('stopTour').disabled = true;
        document.getElementById('currentLocation').textContent = 'Tour stopped';
        
        this.showNotification('Tour stopped', 'info');
    }

    // Navigate to specific room
    async navigateToRoom(roomId) {
        if (!this.currentTour) {
            await this.startGuidedTour();
        }

        const targetRoom = this.analyzer.rooms.find(r => r.id === roomId);
        if (!targetRoom) {
            this.showNotification('Room not found', 'error');
            return;
        }

        const path = this.analyzer.navigateToRoom(roomId);
        if (path) {
            this.showNotification(`Navigating to ${targetRoom.name}`, 'info');
            this.updateCurrentLocation(targetRoom.name);
        } else {
            this.showNotification(`Cannot find path to ${targetRoom.name}`, 'warning');
        }
    }

    // Set view mode
    setViewMode(mode) {
        this.viewMode = mode;
        
        switch (mode) {
            case '2d':
                this.viewer.setViewType(Autodesk.Viewing.VIEW_TYPES.PLAN);
                break;
            case '3d':
                this.viewer.setViewType(Autodesk.Viewing.VIEW_TYPES.PERSPECTIVE);
                break;
            case 'walkthrough':
                this.enableWalkthroughMode();
                break;
        }
    }

    // Enable walkthrough mode
    enableWalkthroughMode() {
        this.viewer.setViewType(Autodesk.Viewing.VIEW_TYPES.PERSPECTIVE);
        
        // Set camera to human eye level
        const camera = this.viewer.getCamera();
        camera.position.z = 1.7; // Human eye level (1.7m)
        this.viewer.setCamera(camera);
        
        // Enable first-person navigation
        this.viewer.setNavigationTool('orbit');
    }

    // Handle room selection
    onSelectionChanged(event) {
        const selection = event.dbIdArray;
        if (selection.length > 0) {
            const dbId = selection[0];
            const room = this.analyzer.rooms.find(r => r.id === dbId);
            
            if (room) {
                this.highlightRoom(room);
                this.showRoomInfo(room);
            }
        }
    }

    // Highlight selected room
    highlightRoom(room) {
        // Clear previous highlights
        this.viewer.clearThemingColors();
        
        // Highlight selected room
        this.viewer.setThemingColor(room.id, new THREE.Vector4(0.2, 0.8, 0.2, 0.8));
        
        // Show room ilots if any
        const roomIlots = this.analyzer.ilots.filter(ilot => ilot.roomId === room.id);
        roomIlots.forEach(ilot => {
            this.visualizeIlot(ilot);
        });
    }

    // Show room information
    showRoomInfo(room) {
        const roomIlots = this.analyzer.ilots.filter(ilot => ilot.roomId === room.id);
        const info = `
            <strong>${room.name}</strong><br>
            Type: ${room.type}<br>
            Area: ${this.analyzer.calculateRoomArea(room.bbox).toFixed(1)} m²<br>
            Ilots: ${roomIlots.length}<br>
            Accessible: ${room.accessible ? 'Yes' : 'No'}
        `;
        
        this.showTooltip(info, room.center);
    }

    // Visualize ilot placement
    visualizeIlot(ilot) {
        // Create visual marker for ilot
        const geometry = new THREE.BoxGeometry(1, 1, 0.1);
        const material = new THREE.MeshBasicMaterial({ 
            color: this.getIlotColor(ilot.type),
            transparent: true,
            opacity: 0.7
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(ilot.position);
        
        // Add to viewer scene
        this.viewer.impl.scene.add(mesh);
        this.viewer.impl.invalidate(true);
    }

    // Get color for ilot type
    getIlotColor(type) {
        const colors = {
            work: 0x3b82f6,    // Blue
            meeting: 0x10b981,  // Green
            social: 0xf59e0b    // Orange
        };
        return colors[type] || 0x64748b;
    }

    // Handle keyboard navigation
    handleKeyboardNavigation(event) {
        if (!this.isNavigating) return;

        switch (event.key) {
            case 'ArrowUp':
            case 'w':
                this.moveForward();
                break;
            case 'ArrowDown':
            case 's':
                this.moveBackward();
                break;
            case 'ArrowLeft':
            case 'a':
                this.turnLeft();
                break;
            case 'ArrowRight':
            case 'd':
                this.turnRight();
                break;
            case 'Escape':
                this.stopTour();
                break;
        }
    }

    // Movement methods
    moveForward() {
        const camera = this.viewer.getCamera();
        const direction = camera.getWorldDirection(new THREE.Vector3());
        const speed = this.navigationSpeed * 0.5;
        
        camera.position.add(direction.multiplyScalar(speed));
        this.viewer.setCamera(camera);
    }

    moveBackward() {
        const camera = this.viewer.getCamera();
        const direction = camera.getWorldDirection(new THREE.Vector3());
        const speed = this.navigationSpeed * 0.5;
        
        camera.position.add(direction.multiplyScalar(-speed));
        this.viewer.setCamera(camera);
    }

    turnLeft() {
        const camera = this.viewer.getCamera();
        camera.rotation.z += 0.05 * this.navigationSpeed;
        this.viewer.setCamera(camera);
    }

    turnRight() {
        const camera = this.viewer.getCamera();
        camera.rotation.z -= 0.05 * this.navigationSpeed;
        this.viewer.setCamera(camera);
    }

    // UI Helper methods
    populateRoomList() {
        const roomList = document.getElementById('roomList');
        if (!roomList) return;

        roomList.innerHTML = '';
        this.analyzer.rooms.forEach(room => {
            const roomButton = document.createElement('button');
            roomButton.className = 'room-button';
            roomButton.innerHTML = `<i class="fas fa-door-open"></i> ${room.name}`;
            roomButton.onclick = () => this.navigateToRoom(room.id);
            roomList.appendChild(roomButton);
        });
    }

    updateNavigationUI() {
        if (this.currentTour) {
            const currentRoom = this.analyzer.rooms.find(r => r.id === this.currentTour.currentRoom);
            this.updateCurrentLocation(currentRoom?.name || 'Unknown');
        }
    }

    updateCurrentLocation(locationName) {
        const locationElement = document.getElementById('currentLocation');
        if (locationElement) {
            locationElement.textContent = locationName;
        }
    }

    toggleNavigationPanel() {
        const panel = document.getElementById('navigationPanel');
        const content = panel.querySelector('.nav-content');
        const toggle = document.getElementById('toggleNav');
        
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.innerHTML = '<i class="fas fa-chevron-down"></i>';
        } else {
            content.style.display = 'none';
            toggle.innerHTML = '<i class="fas fa-chevron-up"></i>';
        }
    }

    findEntranceRoom() {
        return this.analyzer.rooms.find(room => 
            room.name.toLowerCase().includes('entrance') ||
            room.name.toLowerCase().includes('lobby') ||
            room.name.toLowerCase().includes('entry')
        );
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    showTooltip(content, position) {
        // Implementation for showing tooltips at 3D positions
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-3d';
        tooltip.innerHTML = content;
        
        // Convert 3D position to screen coordinates
        const screenPos = this.viewer.worldToClient(position);
        tooltip.style.left = `${screenPos.x}px`;
        tooltip.style.top = `${screenPos.y}px`;
        
        document.body.appendChild(tooltip);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            tooltip.remove();
        }, 5000);
    }
}

module.exports = NavigationController;