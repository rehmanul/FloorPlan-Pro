// Real-time Collaboration System
class CollaborationSystem {
    constructor(viewer, socket) {
        this.viewer = viewer;
        this.socket = socket;
        this.collaborators = new Map();
        this.activeSession = null;
        this.changes = [];
        this.cursors = new Map();
        this.isHost = false;
    }

    // Initialize collaboration session
    async initializeSession(sessionId, userInfo) {
        console.log('🤝 Initializing collaboration session...');
        
        this.activeSession = {
            id: sessionId,
            host: userInfo.id,
            participants: new Map(),
            startTime: new Date(),
            permissions: {
                edit: ['host', 'editor'],
                view: ['host', 'editor', 'viewer'],
                comment: ['host', 'editor', 'viewer']
            }
        };
        
        // Join session
        await this.joinSession(userInfo);
        
        // Setup real-time listeners
        this.setupCollaborationListeners();
        
        // Initialize shared state
        this.initializeSharedState();
        
        console.log(`✅ Collaboration session ${sessionId} initialized`);
    }

    // Join existing session
    async joinSession(userInfo) {
        const participant = {
            id: userInfo.id,
            name: userInfo.name,
            role: userInfo.role || 'viewer',
            avatar: userInfo.avatar,
            cursor: { x: 0, y: 0, z: 0 },
            camera: this.viewer.getCamera(),
            joinTime: new Date(),
            isActive: true
        };
        
        this.collaborators.set(userInfo.id, participant);
        
        // Notify server
        this.socket.emit('join-session', {
            sessionId: this.activeSession.id,
            participant
        });
        
        // Create cursor visualization
        this.createCollaboratorCursor(participant);
    }

    // Setup real-time event listeners
    setupCollaborationListeners() {
        // User joined
        this.socket.on('user-joined', (participant) => {
            this.onUserJoined(participant);
        });
        
        // User left
        this.socket.on('user-left', (userId) => {
            this.onUserLeft(userId);
        });
        
        // Design changes
        this.socket.on('design-change', (change) => {
            this.onDesignChange(change);
        });
        
        // Camera sync
        this.socket.on('camera-update', (cameraData) => {
            this.onCameraUpdate(cameraData);
        });
        
        // Cursor movement
        this.socket.on('cursor-move', (cursorData) => {
            this.onCursorMove(cursorData);
        });
        
        // Comments
        this.socket.on('comment-added', (comment) => {
            this.onCommentAdded(comment);
        });
        
        // Selection sync
        this.socket.on('selection-change', (selectionData) => {
            this.onSelectionChange(selectionData);
        });
    }

    // Initialize shared state
    initializeSharedState() {
        // Sync viewer events
        this.viewer.addEventListener(Autodesk.Viewing.CAMERA_CHANGE_EVENT, (e) => {
            this.broadcastCameraChange(e.camera);
        });
        
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
            this.broadcastSelectionChange(e.dbIdArray);
        });
        
        // Track mouse movement for cursor sync
        this.viewer.container.addEventListener('mousemove', (e) => {
            this.broadcastCursorMove(e);
        });
    }

    // Handle user joined
    onUserJoined(participant) {
        console.log(`👤 ${participant.name} joined the session`);
        
        this.collaborators.set(participant.id, participant);
        this.createCollaboratorCursor(participant);
        this.updateParticipantsList();
        
        // Show notification
        this.showNotification(`${participant.name} joined the session`, 'info');
    }

    // Handle user left
    onUserLeft(userId) {
        const participant = this.collaborators.get(userId);
        if (participant) {
            console.log(`👤 ${participant.name} left the session`);
            
            this.removeCollaboratorCursor(userId);
            this.collaborators.delete(userId);
            this.updateParticipantsList();
            
            this.showNotification(`${participant.name} left the session`, 'info');
        }
    }

    // Handle design changes
    onDesignChange(change) {
        console.log('🔄 Applying design change:', change);
        
        // Apply change to local model
        this.applyDesignChange(change);
        
        // Add to change history
        this.changes.push({
            ...change,
            appliedAt: new Date(),
            appliedBy: 'remote'
        });
        
        // Update UI
        this.updateChangeHistory();
    }

    // Apply design change to viewer
    applyDesignChange(change) {
        switch (change.type) {
            case 'element-add':
                this.addElement(change.data);
                break;
            case 'element-modify':
                this.modifyElement(change.data);
                break;
            case 'element-delete':
                this.deleteElement(change.data);
                break;
            case 'material-change':
                this.changeMaterial(change.data);
                break;
            case 'transform':
                this.transformElement(change.data);
                break;
        }
    }

    // Broadcast design change
    broadcastDesignChange(changeType, data) {
        const change = {
            id: this.generateChangeId(),
            type: changeType,
            data,
            userId: this.getCurrentUserId(),
            timestamp: new Date(),
            sessionId: this.activeSession.id
        };
        
        this.socket.emit('design-change', change);
        
        // Add to local history
        this.changes.push({
            ...change,
            appliedBy: 'local'
        });
    }

    // Handle camera updates
    onCameraUpdate(cameraData) {
        if (cameraData.userId !== this.getCurrentUserId()) {
            const participant = this.collaborators.get(cameraData.userId);
            if (participant) {
                participant.camera = cameraData.camera;
                this.updateCollaboratorIndicator(participant);
            }
        }
    }

    // Broadcast camera change
    broadcastCameraChange(camera) {
        this.socket.emit('camera-update', {
            userId: this.getCurrentUserId(),
            camera: {
                position: camera.position,
                target: camera.target,
                up: camera.up
            },
            timestamp: new Date()
        });
    }

    // Handle cursor movement
    onCursorMove(cursorData) {
        if (cursorData.userId !== this.getCurrentUserId()) {
            const cursor = this.cursors.get(cursorData.userId);
            if (cursor) {
                this.updateCursorPosition(cursor, cursorData.position);
            }
        }
    }

    // Broadcast cursor movement
    broadcastCursorMove(mouseEvent) {
        const rect = this.viewer.container.getBoundingClientRect();
        const position = {
            x: (mouseEvent.clientX - rect.left) / rect.width,
            y: (mouseEvent.clientY - rect.top) / rect.height
        };
        
        this.socket.emit('cursor-move', {
            userId: this.getCurrentUserId(),
            position,
            timestamp: new Date()
        });
    }

    // Handle selection changes
    onSelectionChange(selectionData) {
        if (selectionData.userId !== this.getCurrentUserId()) {
            // Highlight selection from other user
            this.highlightRemoteSelection(selectionData);
        }
    }

    // Broadcast selection change
    broadcastSelectionChange(dbIdArray) {
        this.socket.emit('selection-change', {
            userId: this.getCurrentUserId(),
            selection: dbIdArray,
            timestamp: new Date()
        });
    }

    // Create collaborator cursor
    createCollaboratorCursor(participant) {
        const cursorElement = document.createElement('div');
        cursorElement.className = 'collaborator-cursor';
        cursorElement.style.cssText = `
            position: absolute;
            width: 20px;
            height: 20px;
            background: ${this.getUserColor(participant.id)};
            border-radius: 50%;
            pointer-events: none;
            z-index: 1000;
            transition: all 0.1s ease;
        `;
        
        const nameLabel = document.createElement('div');
        nameLabel.textContent = participant.name;
        nameLabel.style.cssText = `
            position: absolute;
            top: 25px;
            left: -20px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            white-space: nowrap;
        `;
        
        cursorElement.appendChild(nameLabel);
        document.body.appendChild(cursorElement);
        
        this.cursors.set(participant.id, cursorElement);
    }

    // Update cursor position
    updateCursorPosition(cursorElement, position) {
        const rect = this.viewer.container.getBoundingClientRect();
        cursorElement.style.left = `${rect.left + position.x * rect.width}px`;
        cursorElement.style.top = `${rect.top + position.y * rect.height}px`;
    }

    // Remove collaborator cursor
    removeCollaboratorCursor(userId) {
        const cursor = this.cursors.get(userId);
        if (cursor) {
            cursor.remove();
            this.cursors.delete(userId);
        }
    }

    // Add comment system
    addComment(position, text) {
        const comment = {
            id: this.generateCommentId(),
            userId: this.getCurrentUserId(),
            position,
            text,
            timestamp: new Date(),
            sessionId: this.activeSession.id
        };
        
        this.socket.emit('comment-add', comment);
        this.createCommentMarker(comment);
    }

    // Handle comment added
    onCommentAdded(comment) {
        this.createCommentMarker(comment);
    }

    // Create comment marker
    createCommentMarker(comment) {
        const marker = document.createElement('div');
        marker.className = 'comment-marker';
        marker.style.cssText = `
            position: absolute;
            width: 30px;
            height: 30px;
            background: #f59e0b;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            z-index: 999;
        `;
        marker.textContent = '💬';
        
        marker.onclick = () => this.showCommentDialog(comment);
        
        // Position marker
        const screenPos = this.viewer.worldToClient(comment.position);
        marker.style.left = `${screenPos.x}px`;
        marker.style.top = `${screenPos.y}px`;
        
        this.viewer.container.appendChild(marker);
    }

    // Show comment dialog
    showCommentDialog(comment) {
        const dialog = document.createElement('div');
        dialog.className = 'comment-dialog';
        dialog.innerHTML = `
            <div class="comment-header">
                <strong>${this.getParticipantName(comment.userId)}</strong>
                <span>${new Date(comment.timestamp).toLocaleString()}</span>
            </div>
            <div class="comment-text">${comment.text}</div>
            <button onclick="this.parentElement.remove()">Close</button>
        `;
        
        document.body.appendChild(dialog);
    }

    // Permission management
    hasPermission(action, userId = null) {
        userId = userId || this.getCurrentUserId();
        const participant = this.collaborators.get(userId);
        
        if (!participant) return false;
        
        const requiredRoles = this.activeSession.permissions[action] || [];
        return requiredRoles.includes(participant.role);
    }

    // Update participants list UI
    updateParticipantsList() {
        const participantsList = document.getElementById('participantsList');
        if (!participantsList) return;
        
        participantsList.innerHTML = '';
        
        this.collaborators.forEach(participant => {
            const item = document.createElement('div');
            item.className = 'participant-item';
            item.innerHTML = `
                <div class="participant-avatar" style="background: ${this.getUserColor(participant.id)}">
                    ${participant.name.charAt(0).toUpperCase()}
                </div>
                <div class="participant-info">
                    <div class="participant-name">${participant.name}</div>
                    <div class="participant-role">${participant.role}</div>
                </div>
                <div class="participant-status ${participant.isActive ? 'active' : 'inactive'}"></div>
            `;
            
            participantsList.appendChild(item);
        });
    }

    // Utility methods
    getUserColor(userId) {
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
        const hash = userId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        return colors[hash % colors.length];
    }

    getCurrentUserId() {
        return 'current_user_id'; // Would get from auth system
    }

    getParticipantName(userId) {
        const participant = this.collaborators.get(userId);
        return participant ? participant.name : 'Unknown User';
    }

    generateChangeId() {
        return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateCommentId() {
        return `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    showNotification(message, type) {
        console.log(`📢 ${message}`);
        // Would show actual UI notification
    }

    // Cleanup
    leaveSession() {
        if (this.activeSession) {
            this.socket.emit('leave-session', {
                sessionId: this.activeSession.id,
                userId: this.getCurrentUserId()
            });
            
            // Cleanup cursors
            this.cursors.forEach(cursor => cursor.remove());
            this.cursors.clear();
            
            // Reset state
            this.collaborators.clear();
            this.activeSession = null;
            
            console.log('👋 Left collaboration session');
        }
    }
}

module.exports = CollaborationSystem;