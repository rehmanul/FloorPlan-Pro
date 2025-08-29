// Design Manager - Real-time design manipulation and data access
class DesignManager {
    constructor(viewer, floorAnalyzer) {
        this.viewer = viewer;
        this.analyzer = floorAnalyzer;
        this.designData = null;
        this.realTimeMode = true;
        this.modifications = [];
        this.selectedElements = [];
    }

    // Load and display real design with all details
    async loadRealDesign(urn) {
        try {
            const response = await fetch('/api/design/details', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urn })
            });
            
            this.designData = await response.json();
            this.displayRealDesign();
            return this.designData;
        } catch (error) {
            console.error('Failed to load design details:', error);
        }
    }

    // Display real design with full interactivity
    displayRealDesign() {
        if (!this.designData) return;

        // Enable real-time editing mode
        this.enableRealTimeEditing();
        
        // Show all design elements
        this.showDesignElements();
        
        // Enable element selection and manipulation
        this.enableElementManipulation();
        
        // Display design properties panel
        this.createDesignPropertiesPanel();
    }

    // Enable real-time editing capabilities
    enableRealTimeEditing() {
        this.viewer.addEventListener(Autodesk.Viewing.SELECTION_CHANGED_EVENT, (e) => {
            this.onElementSelected(e);
        });

        this.viewer.addEventListener(Autodesk.Viewing.OBJECT_TREE_CREATED_EVENT, () => {
            this.enableContextMenu();
        });
    }

    // Show all design elements with details
    showDesignElements() {
        const elements = this.designData.elements || [];
        
        elements.forEach(element => {
            this.visualizeElement(element);
        });

        this.updateElementsList();
    }

    // Visualize individual design element
    visualizeElement(element) {
        const color = this.getElementColor(element.type);
        
        if (element.dbId) {
            this.viewer.setThemingColor(element.dbId, new THREE.Vector4(
                color.r, color.g, color.b, element.opacity || 0.8
            ));
        }

        // Add custom geometry if needed
        if (element.customGeometry) {
            this.addCustomGeometry(element);
        }
    }

    // Add custom geometry to scene
    addCustomGeometry(element) {
        const geometry = this.createGeometryFromData(element.customGeometry);
        const material = new THREE.MeshBasicMaterial({
            color: element.color || 0x3b82f6,
            transparent: true,
            opacity: element.opacity || 0.8
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(element.position.x, element.position.y, element.position.z);
        mesh.userData = element;

        this.viewer.impl.scene.add(mesh);
        this.viewer.impl.invalidate(true);
    }

    // Create geometry from element data
    createGeometryFromData(geoData) {
        switch (geoData.type) {
            case 'box':
                return new THREE.BoxGeometry(geoData.width, geoData.height, geoData.depth);
            case 'cylinder':
                return new THREE.CylinderGeometry(geoData.radius, geoData.radius, geoData.height);
            case 'sphere':
                return new THREE.SphereGeometry(geoData.radius);
            default:
                return new THREE.BoxGeometry(1, 1, 1);
        }
    }

    // Handle element selection
    onElementSelected(event) {
        const dbIds = event.dbIdArray;
        this.selectedElements = dbIds;

        if (dbIds.length > 0) {
            const element = this.findElementByDbId(dbIds[0]);
            if (element) {
                this.showElementDetails(element);
                this.enableElementEditing(element);
            }
        }
    }

    // Show detailed element information
    showElementDetails(element) {
        const detailsPanel = document.getElementById('elementDetails');
        if (!detailsPanel) return;

        detailsPanel.innerHTML = `
            <h4>${element.name || 'Element'}</h4>
            <div class="detail-group">
                <label>Type:</label>
                <input type="text" id="elementType" value="${element.type}" onchange="designManager.updateElement('type', this.value)">
            </div>
            <div class="detail-group">
                <label>Dimensions:</label>
                <input type="number" placeholder="Width" value="${element.width || ''}" onchange="designManager.updateElement('width', this.value)">
                <input type="number" placeholder="Height" value="${element.height || ''}" onchange="designManager.updateElement('height', this.value)">
                <input type="number" placeholder="Depth" value="${element.depth || ''}" onchange="designManager.updateElement('depth', this.value)">
            </div>
            <div class="detail-group">
                <label>Position:</label>
                <input type="number" placeholder="X" value="${element.position?.x || 0}" onchange="designManager.updateElement('positionX', this.value)">
                <input type="number" placeholder="Y" value="${element.position?.y || 0}" onchange="designManager.updateElement('positionY', this.value)">
                <input type="number" placeholder="Z" value="${element.position?.z || 0}" onchange="designManager.updateElement('positionZ', this.value)">
            </div>
            <div class="detail-group">
                <label>Material:</label>
                <select onchange="designManager.updateElement('material', this.value)">
                    <option value="concrete" ${element.material === 'concrete' ? 'selected' : ''}>Concrete</option>
                    <option value="steel" ${element.material === 'steel' ? 'selected' : ''}>Steel</option>
                    <option value="wood" ${element.material === 'wood' ? 'selected' : ''}>Wood</option>
                    <option value="glass" ${element.material === 'glass' ? 'selected' : ''}>Glass</option>
                </select>
            </div>
            <div class="detail-group">
                <label>Color:</label>
                <input type="color" value="${element.color || '#3b82f6'}" onchange="designManager.updateElement('color', this.value)">
            </div>
            <div class="detail-group">
                <button onclick="designManager.duplicateElement()">Duplicate</button>
                <button onclick="designManager.deleteElement()">Delete</button>
            </div>
        `;
    }

    // Update element properties in real-time
    updateElement(property, value) {
        if (this.selectedElements.length === 0) return;

        const element = this.findElementByDbId(this.selectedElements[0]);
        if (!element) return;

        // Update property
        switch (property) {
            case 'positionX':
                element.position.x = parseFloat(value);
                break;
            case 'positionY':
                element.position.y = parseFloat(value);
                break;
            case 'positionZ':
                element.position.z = parseFloat(value);
                break;
            default:
                element[property] = value;
        }

        // Apply changes immediately
        this.applyElementChanges(element);
        
        // Track modification
        this.modifications.push({
            elementId: element.id,
            property: property,
            value: value,
            timestamp: Date.now()
        });
    }

    // Apply changes to visual element
    applyElementChanges(element) {
        // Update visual representation
        this.visualizeElement(element);
        
        // Update position if changed
        if (element.position) {
            const mesh = this.findMeshByElement(element);
            if (mesh) {
                mesh.position.set(element.position.x, element.position.y, element.position.z);
                this.viewer.impl.invalidate(true);
            }
        }

        // Update color if changed
        if (element.color) {
            const color = new THREE.Color(element.color);
            this.viewer.setThemingColor(element.dbId, new THREE.Vector4(
                color.r, color.g, color.b, element.opacity || 0.8
            ));
        }
    }

    // Add new element to design
    addElement(elementData) {
        const newElement = {
            id: Date.now(),
            dbId: this.getNextDbId(),
            ...elementData,
            position: elementData.position || { x: 0, y: 0, z: 0 }
        };

        this.designData.elements.push(newElement);
        this.visualizeElement(newElement);
        this.updateElementsList();

        return newElement;
    }

    // Duplicate selected element
    duplicateElement() {
        if (this.selectedElements.length === 0) return;

        const element = this.findElementByDbId(this.selectedElements[0]);
        if (!element) return;

        const duplicate = {
            ...element,
            id: Date.now(),
            dbId: this.getNextDbId(),
            position: {
                x: element.position.x + 2,
                y: element.position.y + 2,
                z: element.position.z
            }
        };

        this.addElement(duplicate);
    }

    // Delete selected element
    deleteElement() {
        if (this.selectedElements.length === 0) return;

        const elementId = this.selectedElements[0];
        this.designData.elements = this.designData.elements.filter(e => e.dbId !== elementId);
        
        // Remove from viewer
        this.viewer.hide(elementId);
        this.updateElementsList();
        
        // Clear selection
        this.selectedElements = [];
        document.getElementById('elementDetails').innerHTML = '<p>No element selected</p>';
    }

    // Create design properties panel
    createDesignPropertiesPanel() {
        const panel = document.createElement('div');
        panel.id = 'designPropertiesPanel';
        panel.className = 'design-properties-panel';
        panel.innerHTML = `
            <div class="panel-header">
                <h3><i class="fas fa-cogs"></i> Design Properties</h3>
                <button id="toggleDesignProps" class="btn-icon"><i class="fas fa-chevron-down"></i></button>
            </div>
            <div class="panel-content">
                <div class="section">
                    <h4>Element Details</h4>
                    <div id="elementDetails">
                        <p>Select an element to view details</p>
                    </div>
                </div>
                <div class="section">
                    <h4>Add Elements</h4>
                    <button onclick="designManager.addWall()" class="btn-primary">Add Wall</button>
                    <button onclick="designManager.addDoor()" class="btn-primary">Add Door</button>
                    <button onclick="designManager.addWindow()" class="btn-primary">Add Window</button>
                    <button onclick="designManager.addFurniture()" class="btn-primary">Add Furniture</button>
                </div>
                <div class="section">
                    <h4>Design Actions</h4>
                    <button onclick="designManager.saveDesign()" class="btn-success">Save Design</button>
                    <button onclick="designManager.exportDesign()" class="btn-primary">Export</button>
                    <button onclick="designManager.undoChanges()" class="btn-secondary">Undo</button>
                </div>
                <div class="section">
                    <h4>Elements List</h4>
                    <div id="elementsList" class="elements-list"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }

    // Add predefined elements
    addWall() {
        this.addElement({
            type: 'wall',
            name: 'Wall',
            width: 0.2,
            height: 3,
            depth: 5,
            material: 'concrete',
            color: '#cccccc'
        });
    }

    addDoor() {
        this.addElement({
            type: 'door',
            name: 'Door',
            width: 0.1,
            height: 2.1,
            depth: 0.9,
            material: 'wood',
            color: '#8B4513'
        });
    }

    addWindow() {
        this.addElement({
            type: 'window',
            name: 'Window',
            width: 0.1,
            height: 1.2,
            depth: 1.5,
            material: 'glass',
            color: '#87CEEB'
        });
    }

    addFurniture() {
        this.addElement({
            type: 'furniture',
            name: 'Desk',
            width: 1.2,
            height: 0.75,
            depth: 0.6,
            material: 'wood',
            color: '#DEB887'
        });
    }

    // Save design changes
    async saveDesign() {
        try {
            const response = await fetch('/api/design/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    designData: this.designData,
                    modifications: this.modifications
                })
            });

            if (response.ok) {
                this.showNotification('Design saved successfully!', 'success');
                this.modifications = [];
            }
        } catch (error) {
            this.showNotification('Failed to save design', 'error');
        }
    }

    // Export design data
    exportDesign() {
        const exportData = {
            designData: this.designData,
            modifications: this.modifications,
            timestamp: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `design_${Date.now()}.json`;
        a.click();
    }

    // Update elements list
    updateElementsList() {
        const list = document.getElementById('elementsList');
        if (!list) return;

        list.innerHTML = '';
        this.designData.elements.forEach(element => {
            const item = document.createElement('div');
            item.className = 'element-item';
            item.innerHTML = `
                <span>${element.name || element.type}</span>
                <button onclick="designManager.selectElement(${element.dbId})">Select</button>
            `;
            list.appendChild(item);
        });
    }

    // Select element programmatically
    selectElement(dbId) {
        this.viewer.select([dbId]);
        this.viewer.fitToView([dbId]);
    }

    // Helper methods
    findElementByDbId(dbId) {
        return this.designData.elements.find(e => e.dbId === dbId);
    }

    findMeshByElement(element) {
        return this.viewer.impl.scene.children.find(child => 
            child.userData && child.userData.id === element.id
        );
    }

    getElementColor(type) {
        const colors = {
            wall: { r: 0.8, g: 0.8, b: 0.8 },
            door: { r: 0.6, g: 0.3, b: 0.1 },
            window: { r: 0.5, g: 0.8, b: 0.9 },
            furniture: { r: 0.7, g: 0.5, b: 0.3 }
        };
        return colors[type] || { r: 0.2, g: 0.5, b: 0.8 };
    }

    getNextDbId() {
        return Math.max(...this.designData.elements.map(e => e.dbId || 0)) + 1;
    }

    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `<span>${message}</span>`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}

module.exports = DesignManager;