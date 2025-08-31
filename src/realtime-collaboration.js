// Real-time Collaboration System - Production Implementation
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class RealtimeCollaborationServer extends EventEmitter {
    constructor(server) {
        super();
        this.wss = new WebSocket.Server({ server });
        this.rooms = new Map();
        this.users = new Map();
        this.cursors = new Map();
        this.annotations = new Map();
        this.changes = new Map();
        this.init();
    }

    init() {
        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        // Cleanup inactive rooms every 5 minutes
        setInterval(() => {
            this.cleanupInactiveRooms();
        }, 5 * 60 * 1000);
    }

    handleConnection(ws, req) {
        const userId = uuidv4();
        const user = {
            id: userId,
            ws: ws,
            roomId: null,
            name: 'Anonymous',
            cursor: { x: 0, y: 0, z: 0 },
            lastActivity: Date.now(),
            permissions: ['view', 'annotate', 'measure']
        };

        this.users.set(userId, user);
        console.log(`User ${userId} connected`);

        ws.on('message', (data) => {
            this.handleMessage(userId, data);
        });

        ws.on('close', () => {
            this.handleDisconnection(userId);
        });

        ws.on('error', (error) => {
            console.error(`WebSocket error for user ${userId}:`, error);
        });

        // Send welcome message
        this.sendToUser(userId, {
            type: 'connected',
            userId: userId,
            timestamp: Date.now()
        });
    }

    handleMessage(userId, data) {
        try {
            const message = JSON.parse(data);
            const user = this.users.get(userId);
            
            if (!user) return;

            user.lastActivity = Date.now();

            switch (message.type) {
                case 'join_room':
                    this.handleJoinRoom(userId, message);
                    break;
                case 'leave_room':
                    this.handleLeaveRoom(userId);
                    break;
                case 'cursor_move':
                    this.handleCursorMove(userId, message);
                    break;
                case 'selection_change':
                    this.handleSelectionChange(userId, message);
                    break;
                case 'annotation_create':
                    this.handleAnnotationCreate(userId, message);
                    break;
                case 'annotation_update':
                    this.handleAnnotationUpdate(userId, message);
                    break;
                case 'annotation_delete':
                    this.handleAnnotationDelete(userId, message);
                    break;
                case 'measurement_create':
                    this.handleMeasurementCreate(userId, message);
                    break;
                case 'view_change':
                    this.handleViewChange(userId, message);
                    break;
                case 'chat_message':
                    this.handleChatMessage(userId, message);
                    break;
                case 'user_update':
                    this.handleUserUpdate(userId, message);
                    break;
                case 'request_sync':
                    this.handleSyncRequest(userId);
                    break;
                default:
                    console.warn(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    handleJoinRoom(userId, message) {
        const { roomId, userName, floorPlanUrn } = message;
        const user = this.users.get(userId);
        
        if (!user) return;

        // Leave current room if in one
        if (user.roomId) {
            this.handleLeaveRoom(userId);
        }

        // Create room if it doesn't exist
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                floorPlanUrn: floorPlanUrn,
                users: new Set(),
                annotations: new Map(),
                measurements: new Map(),
                cursors: new Map(),
                selections: new Map(),
                chatHistory: [],
                createdAt: Date.now(),
                lastActivity: Date.now()
            });
        }

        const room = this.rooms.get(roomId);
        room.users.add(userId);
        room.lastActivity = Date.now();

        user.roomId = roomId;
        user.name = userName || 'Anonymous';

        // Send room state to new user
        this.sendRoomState(userId, roomId);

        // Notify other users in room
        this.broadcastToRoom(roomId, {
            type: 'user_joined',
            user: {
                id: userId,
                name: user.name,
                cursor: user.cursor
            },
            timestamp: Date.now()
        }, userId);

        console.log(`User ${userId} (${user.name}) joined room ${roomId}`);
    }

    handleLeaveRoom(userId) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.users.delete(userId);
            room.cursors.delete(userId);
            room.selections.delete(userId);

            // Notify other users
            this.broadcastToRoom(user.roomId, {
                type: 'user_left',
                userId: userId,
                timestamp: Date.now()
            }, userId);

            // Remove room if empty
            if (room.users.size === 0) {
                this.rooms.delete(user.roomId);
                console.log(`Room ${user.roomId} removed (empty)`);
            }
        }

        user.roomId = null;
        console.log(`User ${userId} left room`);
    }

    handleCursorMove(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const { x, y, z } = message.position;
        user.cursor = { x, y, z };

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.cursors.set(userId, { x, y, z, timestamp: Date.now() });

            // Broadcast cursor position to other users
            this.broadcastToRoom(user.roomId, {
                type: 'cursor_update',
                userId: userId,
                position: { x, y, z },
                timestamp: Date.now()
            }, userId);
        }
    }

    handleSelectionChange(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.selections.set(userId, {
                dbIds: message.dbIds,
                timestamp: Date.now()
            });

            // Broadcast selection to other users
            this.broadcastToRoom(user.roomId, {
                type: 'selection_changed',
                userId: userId,
                userName: user.name,
                dbIds: message.dbIds,
                timestamp: Date.now()
            }, userId);
        }
    }

    handleAnnotationCreate(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId || !user.permissions.includes('annotate')) return;

        const annotationId = uuidv4();
        const annotation = {
            id: annotationId,
            position: message.position,
            text: message.text,
            type: message.annotationType || 'note',
            author: user.name,
            authorId: userId,
            timestamp: Date.now(),
            properties: message.properties || {}
        };

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.annotations.set(annotationId, annotation);

            // Broadcast to all users in room
            this.broadcastToRoom(user.roomId, {
                type: 'annotation_created',
                annotation: annotation,
                timestamp: Date.now()
            });

            console.log(`Annotation created by ${user.name} in room ${user.roomId}`);
        }
    }

    handleAnnotationUpdate(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const room = this.rooms.get(user.roomId);
        if (!room) return;

        const annotation = room.annotations.get(message.annotationId);
        if (!annotation) return;

        // Check permissions (only author or admin can edit)
        if (annotation.authorId !== userId && !user.permissions.includes('admin')) {
            return;
        }

        // Update annotation
        Object.assign(annotation, message.updates, {
            lastModified: Date.now(),
            lastModifiedBy: user.name
        });

        // Broadcast update
        this.broadcastToRoom(user.roomId, {
            type: 'annotation_updated',
            annotationId: message.annotationId,
            updates: message.updates,
            timestamp: Date.now()
        });
    }

    handleAnnotationDelete(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const room = this.rooms.get(user.roomId);
        if (!room) return;

        const annotation = room.annotations.get(message.annotationId);
        if (!annotation) return;

        // Check permissions
        if (annotation.authorId !== userId && !user.permissions.includes('admin')) {
            return;
        }

        room.annotations.delete(message.annotationId);

        // Broadcast deletion
        this.broadcastToRoom(user.roomId, {
            type: 'annotation_deleted',
            annotationId: message.annotationId,
            timestamp: Date.now()
        });
    }

    handleMeasurementCreate(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId || !user.permissions.includes('measure')) return;

        const measurementId = uuidv4();
        const measurement = {
            id: measurementId,
            type: message.measurementType,
            points: message.points,
            value: message.value,
            units: message.units || 'mm',
            author: user.name,
            authorId: userId,
            timestamp: Date.now()
        };

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.measurements.set(measurementId, measurement);

            // Broadcast to all users
            this.broadcastToRoom(user.roomId, {
                type: 'measurement_created',
                measurement: measurement,
                timestamp: Date.now()
            });
        }
    }

    handleViewChange(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        // Broadcast view change to other users
        this.broadcastToRoom(user.roomId, {
            type: 'view_changed',
            userId: userId,
            userName: user.name,
            camera: message.camera,
            timestamp: Date.now()
        }, userId);
    }

    handleChatMessage(userId, message) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        const chatMessage = {
            id: uuidv4(),
            text: message.text,
            author: user.name,
            authorId: userId,
            timestamp: Date.now()
        };

        const room = this.rooms.get(user.roomId);
        if (room) {
            room.chatHistory.push(chatMessage);

            // Keep only last 100 messages
            if (room.chatHistory.length > 100) {
                room.chatHistory = room.chatHistory.slice(-100);
            }

            // Broadcast chat message
            this.broadcastToRoom(user.roomId, {
                type: 'chat_message',
                message: chatMessage,
                timestamp: Date.now()
            });
        }
    }

    handleUserUpdate(userId, message) {
        const user = this.users.get(userId);
        if (!user) return;

        // Update user properties
        if (message.name) user.name = message.name;
        if (message.permissions) user.permissions = message.permissions;

        // Broadcast user update to room
        if (user.roomId) {
            this.broadcastToRoom(user.roomId, {
                type: 'user_updated',
                user: {
                    id: userId,
                    name: user.name,
                    permissions: user.permissions
                },
                timestamp: Date.now()
            }, userId);
        }
    }

    handleSyncRequest(userId) {
        const user = this.users.get(userId);
        if (!user || !user.roomId) return;

        this.sendRoomState(userId, user.roomId);
    }

    handleDisconnection(userId) {
        const user = this.users.get(userId);
        if (user) {
            this.handleLeaveRoom(userId);
            this.users.delete(userId);
            console.log(`User ${userId} disconnected`);
        }
    }

    sendRoomState(userId, roomId) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        const roomUsers = Array.from(room.users).map(uid => {
            const u = this.users.get(uid);
            return u ? {
                id: uid,
                name: u.name,
                cursor: u.cursor,
                permissions: u.permissions
            } : null;
        }).filter(Boolean);

        this.sendToUser(userId, {
            type: 'room_state',
            room: {
                id: roomId,
                floorPlanUrn: room.floorPlanUrn,
                users: roomUsers,
                annotations: Array.from(room.annotations.values()),
                measurements: Array.from(room.measurements.values()),
                cursors: Object.fromEntries(room.cursors),
                selections: Object.fromEntries(room.selections),
                chatHistory: room.chatHistory.slice(-50) // Last 50 messages
            },
            timestamp: Date.now()
        });
    }

    sendToUser(userId, message) {
        const user = this.users.get(userId);
        if (user && user.ws.readyState === WebSocket.OPEN) {
            user.ws.send(JSON.stringify(message));
        }
    }

    broadcastToRoom(roomId, message, excludeUserId = null) {
        const room = this.rooms.get(roomId);
        if (!room) return;

        room.users.forEach(userId => {
            if (userId !== excludeUserId) {
                this.sendToUser(userId, message);
            }
        });
    }

    cleanupInactiveRooms() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes

        for (const [roomId, room] of this.rooms.entries()) {
            if (now - room.lastActivity > inactiveThreshold) {
                this.rooms.delete(roomId);
                console.log(`Cleaned up inactive room: ${roomId}`);
            }
        }

        // Cleanup inactive users
        for (const [userId, user] of this.users.entries()) {
            if (now - user.lastActivity > inactiveThreshold) {
                this.handleDisconnection(userId);
            }
        }
    }

    getRoomStats() {
        return {
            totalRooms: this.rooms.size,
            totalUsers: this.users.size,
            rooms: Array.from(this.rooms.values()).map(room => ({
                id: room.id,
                userCount: room.users.size,
                annotationCount: room.annotations.size,
                measurementCount: room.measurements.size,
                lastActivity: room.lastActivity
            }))
        };
    }
}

// Client-side Collaboration Manager
class CollaborationClient extends EventEmitter {
    constructor(serverUrl) {
        super();
        this.serverUrl = serverUrl;
        this.ws = null;
        this.userId = null;
        this.roomId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
    }

    connect() {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.serverUrl);

                this.ws.onopen = () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    console.log('Connected to collaboration server');
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(JSON.parse(event.data));
                };

                this.ws.onclose = () => {
                    this.connected = false;
                    console.log('Disconnected from collaboration server');
                    this.attemptReconnect();
                };

                this.ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                this.userId = message.userId;
                this.emit('connected', message);
                break;
            case 'room_state':
                this.emit('roomState', message.room);
                break;
            case 'user_joined':
                this.emit('userJoined', message.user);
                break;
            case 'user_left':
                this.emit('userLeft', message.userId);
                break;
            case 'cursor_update':
                this.emit('cursorUpdate', message);
                break;
            case 'selection_changed':
                this.emit('selectionChanged', message);
                break;
            case 'annotation_created':
                this.emit('annotationCreated', message.annotation);
                break;
            case 'annotation_updated':
                this.emit('annotationUpdated', message);
                break;
            case 'annotation_deleted':
                this.emit('annotationDeleted', message.annotationId);
                break;
            case 'measurement_created':
                this.emit('measurementCreated', message.measurement);
                break;
            case 'view_changed':
                this.emit('viewChanged', message);
                break;
            case 'chat_message':
                this.emit('chatMessage', message.message);
                break;
            case 'user_updated':
                this.emit('userUpdated', message.user);
                break;
        }
    }

    joinRoom(roomId, userName, floorPlanUrn) {
        this.roomId = roomId;
        this.send({
            type: 'join_room',
            roomId: roomId,
            userName: userName,
            floorPlanUrn: floorPlanUrn
        });
    }

    leaveRoom() {
        this.send({ type: 'leave_room' });
        this.roomId = null;
    }

    updateCursor(position) {
        this.send({
            type: 'cursor_move',
            position: position
        });
    }

    updateSelection(dbIds) {
        this.send({
            type: 'selection_change',
            dbIds: dbIds
        });
    }

    createAnnotation(position, text, type = 'note', properties = {}) {
        this.send({
            type: 'annotation_create',
            position: position,
            text: text,
            annotationType: type,
            properties: properties
        });
    }

    updateAnnotation(annotationId, updates) {
        this.send({
            type: 'annotation_update',
            annotationId: annotationId,
            updates: updates
        });
    }

    deleteAnnotation(annotationId) {
        this.send({
            type: 'annotation_delete',
            annotationId: annotationId
        });
    }

    createMeasurement(type, points, value, units = 'mm') {
        this.send({
            type: 'measurement_create',
            measurementType: type,
            points: points,
            value: value,
            units: units
        });
    }

    updateView(camera) {
        this.send({
            type: 'view_change',
            camera: camera
        });
    }

    sendChatMessage(text) {
        this.send({
            type: 'chat_message',
            text: text
        });
    }

    requestSync() {
        this.send({ type: 'request_sync' });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.connect().catch(() => {
                    // Reconnection failed, will try again
                });
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('Max reconnection attempts reached');
            this.emit('reconnectFailed');
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
    }
}

module.exports = {
    RealtimeCollaborationServer,
    CollaborationClient
};