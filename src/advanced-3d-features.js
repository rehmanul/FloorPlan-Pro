// Advanced 3D Features - Production Implementation
class Advanced3DFeatures {
    constructor(viewer) {
        this.viewer = viewer;
        this.annotations = new Map();
        this.measurements = new Map();
        this.sectionPlanes = [];
        this.animations = new Map();
        this.customExtensions = new Map();
        this.init();
    }

    async init() {
        await this.loadExtensions();
        this.setupCustomTools();
        this.setupEventHandlers();
        this.initializeAnnotationSystem();
        this.initializeMeasurementTools();
        this.setupSectionPlanes();
        this.initializeAnimationSystem();
    }

    async loadExtensions() {
        const extensions = [
            'Autodesk.Measure',
            'Autodesk.Section',
            'Autodesk.Explode',
            'Autodesk.BimWalk',
            'Autodesk.Hypermodeling',
            'Autodesk.ModelStructurePanel',
            'Autodesk.PropertiesPanel',
            'Autodesk.LayerManager'
        ];

        for (const extension of extensions) {
            try {
                await this.viewer.loadExtension(extension);
                console.log(`Loaded extension: ${extension}`);
            } catch (error) {
                console.warn(`Failed to load extension ${extension}:`, error);
            }
        }
    }

    setupCustomTools() {
        // Custom annotation tool
        this.annotationTool = new AnnotationTool(this.viewer);
        this.viewer.toolController.registerTool(this.annotationTool);

        // Custom measurement tool
        this.advancedMeasureTool = new AdvancedMeasureTool(this.viewer);
        this.viewer.toolController.registerTool(this.advancedMeasureTool);

        // Custom section tool
        this.sectionTool = new SectionTool(this.viewer);
        this.viewer.toolController.registerTool(this.sectionTool);

        // Custom walkthrough tool
        this.walkthroughTool = new WalkthroughTool(this.viewer);
        this.viewer.toolController.registerTool(this.walkthroughTool);
    }

    setupEventHandlers() {
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (event) => {
            this.onSelectionChanged(event);
        });

        this.viewer.addEventListener(Autodesk.Viewing.ISOLATE_EVENT, (event) => {
            this.onIsolateEvent(event);
        });

        this.viewer.addEventListener(Autodesk.Viewing.HIDE_EVENT, (event) => {
            this.onHideEvent(event);
        });

        this.viewer.addEventListener(Autodesk.Viewing.SHOW_EVENT, (event) => {
            this.onShowEvent(event);
        });
    }

    // Advanced Annotation System
    initializeAnnotationSystem() {
        this.annotationManager = new AnnotationManager(this.viewer);
    }

    createAnnotation(position, text, type = 'note', properties = {}) {
        const annotation = {
            id: this.generateId(),
            position: position,
            text: text,
            type: type,
            properties: properties,
            timestamp: new Date().toISOString(),
            author: properties.author || 'Anonymous'
        };

        this.annotations.set(annotation.id, annotation);
        this.annotationManager.addAnnotation(annotation);
        
        return annotation;
    }

    updateAnnotation(id, updates) {
        const annotation = this.annotations.get(id);
        if (annotation) {
            Object.assign(annotation, updates);
            this.annotationManager.updateAnnotation(annotation);
        }
    }

    deleteAnnotation(id) {
        const annotation = this.annotations.get(id);
        if (annotation) {
            this.annotations.delete(id);
            this.annotationManager.removeAnnotation(annotation);
        }
    }

    // Advanced Measurement Tools
    initializeMeasurementTools() {
        this.measurementManager = new MeasurementManager(this.viewer);
    }

    createMeasurement(type, points, properties = {}) {
        const measurement = {
            id: this.generateId(),
            type: type, // 'distance', 'area', 'angle', 'volume'
            points: points,
            value: this.calculateMeasurement(type, points),
            properties: properties,
            timestamp: new Date().toISOString()
        };

        this.measurements.set(measurement.id, measurement);
        this.measurementManager.addMeasurement(measurement);
        
        return measurement;
    }

    calculateMeasurement(type, points) {
        switch (type) {
            case 'distance':
                return this.calculateDistance(points[0], points[1]);
            case 'area':
                return this.calculateArea(points);
            case 'angle':
                return this.calculateAngle(points[0], points[1], points[2]);
            case 'volume':
                return this.calculateVolume(points);
            default:
                return 0;
        }
    }

    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    calculateArea(points) {
        // Calculate polygon area using shoelace formula
        let area = 0;
        const n = points.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        
        return Math.abs(area) / 2;
    }

    calculateAngle(p1, vertex, p2) {
        const v1 = { x: p1.x - vertex.x, y: p1.y - vertex.y, z: p1.z - vertex.z };
        const v2 = { x: p2.x - vertex.x, y: p2.y - vertex.y, z: p2.z - vertex.z };
        
        const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
        
        return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    }

    // Section Planes
    setupSectionPlanes() {
        this.sectionManager = new SectionManager(this.viewer);
    }

    createSectionPlane(normal, distance, name = 'Section') {
        const section = {
            id: this.generateId(),
            name: name,
            normal: normal,
            distance: distance,
            active: true,
            timestamp: new Date().toISOString()
        };

        this.sectionPlanes.push(section);
        this.sectionManager.addSection(section);
        
        return section;
    }

    updateSectionPlane(id, updates) {
        const section = this.sectionPlanes.find(s => s.id === id);
        if (section) {
            Object.assign(section, updates);
            this.sectionManager.updateSection(section);
        }
    }

    // Animation System
    initializeAnimationSystem() {
        this.animationManager = new AnimationManager(this.viewer);
    }

    createAnimation(name, keyframes, duration = 5000) {
        const animation = {
            id: this.generateId(),
            name: name,
            keyframes: keyframes,
            duration: duration,
            currentTime: 0,
            playing: false,
            loop: false
        };

        this.animations.set(animation.id, animation);
        return animation;
    }

    playAnimation(id) {
        const animation = this.animations.get(id);
        if (animation) {
            animation.playing = true;
            this.animationManager.play(animation);
        }
    }

    pauseAnimation(id) {
        const animation = this.animations.get(id);
        if (animation) {
            animation.playing = false;
            this.animationManager.pause(animation);
        }
    }

    // Camera Controls
    setCameraPosition(position, target, up) {
        this.viewer.navigation.setPosition(position);
        this.viewer.navigation.setTarget(target);
        this.viewer.navigation.setCameraUpVector(up);
    }

    createCameraBookmark(name) {
        const camera = this.viewer.navigation.getCamera();
        const bookmark = {
            id: this.generateId(),
            name: name,
            position: camera.position.clone(),
            target: camera.target.clone(),
            up: camera.up.clone(),
            fov: camera.fov,
            timestamp: new Date().toISOString()
        };

        return bookmark;
    }

    applyCameraBookmark(bookmark) {
        this.setCameraPosition(bookmark.position, bookmark.target, bookmark.up);
        this.viewer.navigation.setVerticalFov(bookmark.fov, false);
    }

    // Material and Appearance
    setMaterial(dbIds, material) {
        this.viewer.setThemingColor(dbIds, material.color, null, true);
        if (material.opacity !== undefined) {
            this.viewer.setThemingColor(dbIds, null, material.opacity, true);
        }
    }

    createCustomMaterial(properties) {
        return {
            color: properties.color || new THREE.Vector4(1, 1, 1, 1),
            opacity: properties.opacity || 1.0,
            metallic: properties.metallic || 0.0,
            roughness: properties.roughness || 0.5,
            emissive: properties.emissive || new THREE.Vector3(0, 0, 0)
        };
    }

    // Lighting Controls
    setLighting(lightingPreset) {
        const lightPresets = {
            'default': { intensity: 1.0, shadows: true },
            'bright': { intensity: 1.5, shadows: true },
            'soft': { intensity: 0.8, shadows: false },
            'dramatic': { intensity: 2.0, shadows: true, contrast: 1.2 }
        };

        const preset = lightPresets[lightingPreset] || lightPresets['default'];
        this.viewer.setLightPreset(preset.intensity);
        
        if (preset.shadows !== undefined) {
            this.viewer.setQualityLevel(preset.shadows, true);
        }
    }

    // Advanced Selection
    selectByProperties(propertyName, propertyValue) {
        return new Promise((resolve) => {
            const dbIds = [];
            
            this.viewer.search(propertyValue, (dbId) => {
                this.viewer.getProperties(dbId, (props) => {
                    const prop = props.properties.find(p => p.displayName === propertyName);
                    if (prop && prop.displayValue === propertyValue) {
                        dbIds.push(dbId);
                    }
                });
            }, () => {
                this.viewer.select(dbIds);
                resolve(dbIds);
            });
        });
    }

    // Exploded View
    createExplodedView(scale = 2.0) {
        const explodeExtension = this.viewer.getExtension('Autodesk.Explode');
        if (explodeExtension) {
            explodeExtension.explode(scale);
        }
    }

    resetExplodedView() {
        const explodeExtension = this.viewer.getExtension('Autodesk.Explode');
        if (explodeExtension) {
            explodeExtension.explode(0);
        }
    }

    // Virtual Reality Support
    enableVR() {
        if (this.viewer.getExtension('Autodesk.VR')) {
            this.viewer.getExtension('Autodesk.VR').activate();
        }
    }

    // Performance Optimization
    setRenderQuality(quality) {
        const qualitySettings = {
            'low': { antialias: false, shadows: false, reflections: false },
            'medium': { antialias: true, shadows: false, reflections: false },
            'high': { antialias: true, shadows: true, reflections: true },
            'ultra': { antialias: true, shadows: true, reflections: true, ssao: true }
        };

        const settings = qualitySettings[quality] || qualitySettings['medium'];
        this.viewer.setQualityLevel(settings.antialias, settings.shadows);
    }

    // Event Handlers
    onSelectionChanged(event) {
        const dbIds = event.dbIdArray;
        if (dbIds.length > 0) {
            this.highlightRelatedElements(dbIds);
        }
    }

    onIsolateEvent(event) {
        console.log('Elements isolated:', event.nodeIdArray);
    }

    onHideEvent(event) {
        console.log('Elements hidden:', event.nodeIdArray);
    }

    onShowEvent(event) {
        console.log('Elements shown:', event.nodeIdArray);
    }

    highlightRelatedElements(dbIds) {
        // Implement logic to highlight related elements
        // This could include connected elements, same material, etc.
    }

    // Utility Methods
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    }

    exportViewerState() {
        return {
            camera: this.viewer.navigation.getCamera(),
            selection: this.viewer.getSelection(),
            isolation: this.viewer.getIsolatedNodes(),
            hidden: this.viewer.getHiddenNodes(),
            annotations: Array.from(this.annotations.values()),
            measurements: Array.from(this.measurements.values()),
            sectionPlanes: this.sectionPlanes
        };
    }

    importViewerState(state) {
        // Restore camera
        if (state.camera) {
            this.viewer.navigation.setPosition(state.camera.position);
            this.viewer.navigation.setTarget(state.camera.target);
        }

        // Restore selection
        if (state.selection) {
            this.viewer.select(state.selection);
        }

        // Restore isolation
        if (state.isolation) {
            this.viewer.isolate(state.isolation);
        }

        // Restore annotations
        if (state.annotations) {
            state.annotations.forEach(annotation => {
                this.annotations.set(annotation.id, annotation);
                this.annotationManager.addAnnotation(annotation);
            });
        }
    }
}

// Custom Tool Classes
class AnnotationTool extends Autodesk.Viewing.ToolInterface {
    constructor(viewer) {
        super();
        this.viewer = viewer;
        this.names = ['AnnotationTool'];
        this.isActive = false;
    }

    activate() {
        this.isActive = true;
        this.viewer.canvas.addEventListener('click', this.onCanvasClick.bind(this));
    }

    deactivate() {
        this.isActive = false;
        this.viewer.canvas.removeEventListener('click', this.onCanvasClick.bind(this));
    }

    onCanvasClick(event) {
        if (!this.isActive) return;
        
        const result = this.viewer.clientToWorld(event.clientX, event.clientY);
        if (result.intersectPoint) {
            this.createAnnotationDialog(result.intersectPoint);
        }
    }

    createAnnotationDialog(position) {
        const text = prompt('Enter annotation text:');
        if (text) {
            // Create annotation at position
            console.log('Creating annotation:', text, 'at', position);
        }
    }
}

class AdvancedMeasureTool extends Autodesk.Viewing.ToolInterface {
    constructor(viewer) {
        super();
        this.viewer = viewer;
        this.names = ['AdvancedMeasureTool'];
        this.measurePoints = [];
    }

    activate() {
        this.viewer.canvas.addEventListener('click', this.onCanvasClick.bind(this));
    }

    deactivate() {
        this.viewer.canvas.removeEventListener('click', this.onCanvasClick.bind(this));
        this.measurePoints = [];
    }

    onCanvasClick(event) {
        const result = this.viewer.clientToWorld(event.clientX, event.clientY);
        if (result.intersectPoint) {
            this.measurePoints.push(result.intersectPoint);
            
            if (this.measurePoints.length === 2) {
                this.createMeasurement();
                this.measurePoints = [];
            }
        }
    }

    createMeasurement() {
        const distance = this.calculateDistance(this.measurePoints[0], this.measurePoints[1]);
        console.log('Measurement created:', distance);
    }

    calculateDistance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
}

// Manager Classes
class AnnotationManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.annotations = new Map();
    }

    addAnnotation(annotation) {
        this.annotations.set(annotation.id, annotation);
        this.renderAnnotation(annotation);
    }

    updateAnnotation(annotation) {
        this.renderAnnotation(annotation);
    }

    removeAnnotation(annotation) {
        this.annotations.delete(annotation.id);
        this.removeAnnotationFromScene(annotation);
    }

    renderAnnotation(annotation) {
        // Implement 3D annotation rendering
    }

    removeAnnotationFromScene(annotation) {
        // Implement annotation removal from scene
    }
}

class MeasurementManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.measurements = new Map();
    }

    addMeasurement(measurement) {
        this.measurements.set(measurement.id, measurement);
        this.renderMeasurement(measurement);
    }

    renderMeasurement(measurement) {
        // Implement 3D measurement rendering
    }
}

class SectionManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.sections = [];
    }

    addSection(section) {
        this.sections.push(section);
        this.applySectionPlane(section);
    }

    updateSection(section) {
        this.applySectionPlane(section);
    }

    applySectionPlane(section) {
        // Implement section plane application
    }
}

class AnimationManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.activeAnimations = new Map();
    }

    play(animation) {
        this.activeAnimations.set(animation.id, animation);
        this.startAnimation(animation);
    }

    pause(animation) {
        this.activeAnimations.delete(animation.id);
    }

    startAnimation(animation) {
        // Implement animation playback
    }
}

module.exports = { Advanced3DFeatures };