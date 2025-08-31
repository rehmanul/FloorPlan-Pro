// Mobile Responsive Implementation - Production Ready
class MobileResponsiveManager {
    constructor() {
        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1200
        };
        this.currentDevice = this.detectDevice();
        this.touchHandlers = new Map();
        this.gestureRecognizer = new GestureRecognizer();
        this.init();
    }

    init() {
        this.setupViewportMeta();
        this.setupResponsiveCSS();
        this.setupTouchHandlers();
        this.setupOrientationHandling();
        this.setupMobileNavigation();
        this.optimizeForMobile();
    }

    detectDevice() {
        const width = window.innerWidth;
        if (width <= this.breakpoints.mobile) return 'mobile';
        if (width <= this.breakpoints.tablet) return 'tablet';
        return 'desktop';
    }

    setupViewportMeta() {
        let viewport = document.querySelector('meta[name="viewport"]');
        if (!viewport) {
            viewport = document.createElement('meta');
            viewport.name = 'viewport';
            document.head.appendChild(viewport);
        }
        viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
    }

    setupResponsiveCSS() {
        const style = document.createElement('style');
        style.textContent = `
            /* Mobile-first responsive design */
            @media (max-width: 768px) {
                .app-container {
                    grid-template-columns: 1fr !important;
                    grid-template-rows: auto 1fr auto;
                }
                
                .sidebar {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100vh;
                    z-index: 1000;
                    transform: translateX(-100%);
                    transition: transform 0.3s ease;
                }
                
                .sidebar.mobile-open {
                    transform: translateX(0);
                }
                
                .sidebar-right {
                    left: auto;
                    right: 0;
                    transform: translateX(100%);
                }
                
                .sidebar-right.mobile-open {
                    transform: translateX(0);
                }
                
                .header {
                    padding: 0.75rem 1rem;
                    flex-wrap: wrap;
                }
                
                .header-center {
                    order: 3;
                    width: 100%;
                    margin-top: 0.5rem;
                    justify-content: space-around;
                }
                
                .header-btn {
                    padding: 0.5rem 0.75rem;
                    font-size: 0.875rem;
                }
                
                .upload-btn {
                    padding: 0.5rem 1rem;
                    font-size: 0.875rem;
                }
                
                .logo {
                    font-size: 1.25rem;
                }
                
                .panel-content {
                    padding: 1rem;
                }
                
                .btn {
                    padding: 0.875rem 1rem;
                    font-size: 0.875rem;
                }
                
                .list-item {
                    padding: 0.75rem;
                    font-size: 0.875rem;
                }
                
                .toolbar {
                    bottom: 20px;
                    top: auto;
                    left: 50%;
                    transform: translateX(-50%);
                    flex-direction: row;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 0.5rem;
                    border-radius: 25px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                }
                
                .tool-btn {
                    width: 35px;
                    height: 35px;
                    margin: 0 0.25rem;
                }
                
                .legend {
                    position: fixed;
                    top: auto;
                    bottom: 80px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                    font-size: 0.75rem;
                }
                
                .notification {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    min-width: auto;
                    font-size: 0.875rem;
                }
                
                #forgeViewer {
                    touch-action: pan-x pan-y pinch-zoom;
                }
                
                .mobile-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 999;
                    display: none;
                }
                
                .mobile-overlay.active {
                    display: block;
                }
            }
            
            @media (max-width: 480px) {
                .header {
                    padding: 0.5rem;
                }
                
                .header-center {
                    gap: 0.25rem;
                }
                
                .header-btn {
                    padding: 0.4rem 0.6rem;
                    font-size: 0.75rem;
                }
                
                .logo {
                    font-size: 1rem;
                }
                
                .panel-content {
                    padding: 0.75rem;
                }
                
                .analysis-stats {
                    grid-template-columns: 1fr;
                }
                
                .export-options {
                    grid-template-columns: 1fr;
                }
            }
            
            @media (orientation: landscape) and (max-height: 500px) {
                .header {
                    padding: 0.5rem 1rem;
                }
                
                .sidebar {
                    width: 300px;
                }
                
                .toolbar {
                    left: 20px;
                    transform: none;
                    flex-direction: column;
                }
            }
        `;
        document.head.appendChild(style);
    }

    setupTouchHandlers() {
        // Enhanced touch handling for CAD viewer
        const viewer = document.getElementById('forgeViewer');
        const canvas = document.getElementById('floorPlanCanvas');
        
        [viewer, canvas].forEach(element => {
            if (element) {
                this.addTouchSupport(element);
            }
        });
    }

    addTouchSupport(element) {
        let touchStartTime = 0;
        let touchStartPos = { x: 0, y: 0 };
        let lastTouchEnd = 0;
        let isMultiTouch = false;
        let initialDistance = 0;
        let initialScale = 1;

        // Touch start
        element.addEventListener('touchstart', (e) => {
            touchStartTime = Date.now();
            touchStartPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY
            };
            
            if (e.touches.length > 1) {
                isMultiTouch = true;
                initialDistance = this.getDistance(e.touches[0], e.touches[1]);
                initialScale = this.getCurrentScale(element);
            } else {
                isMultiTouch = false;
            }
            
            e.preventDefault();
        }, { passive: false });

        // Touch move
        element.addEventListener('touchmove', (e) => {
            if (isMultiTouch && e.touches.length > 1) {
                // Pinch zoom
                const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
                const scale = (currentDistance / initialDistance) * initialScale;
                this.handlePinchZoom(element, scale);
            } else if (e.touches.length === 1) {
                // Pan
                const deltaX = e.touches[0].clientX - touchStartPos.x;
                const deltaY = e.touches[0].clientY - touchStartPos.y;
                this.handlePan(element, deltaX, deltaY);
            }
            
            e.preventDefault();
        }, { passive: false });

        // Touch end
        element.addEventListener('touchend', (e) => {
            const touchEndTime = Date.now();
            const touchDuration = touchEndTime - touchStartTime;
            
            // Double tap detection
            if (touchDuration < 300 && (touchEndTime - lastTouchEnd) < 300) {
                this.handleDoubleTap(element, touchStartPos);
            }
            
            // Long press detection
            if (touchDuration > 500 && !isMultiTouch) {
                this.handleLongPress(element, touchStartPos);
            }
            
            lastTouchEnd = touchEndTime;
            isMultiTouch = false;
            
            e.preventDefault();
        }, { passive: false });
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getCurrentScale(element) {
        const transform = window.getComputedStyle(element).transform;
        if (transform === 'none') return 1;
        
        const matrix = transform.match(/matrix\(([^)]+)\)/);
        if (matrix) {
            const values = matrix[1].split(',');
            return parseFloat(values[0]);
        }
        return 1;
    }

    handlePinchZoom(element, scale) {
        if (element.id === 'forgeViewer' && window.viewer) {
            // Use Autodesk Viewer's zoom
            const navigation = window.viewer.navigation;
            navigation.setZoomTowardsPivot(scale);
        } else {
            // Canvas zoom
            element.style.transform = `scale(${Math.max(0.5, Math.min(5, scale))})`;
        }
    }

    handlePan(element, deltaX, deltaY) {
        if (element.id === 'forgeViewer' && window.viewer) {
            // Use Autodesk Viewer's pan
            const navigation = window.viewer.navigation;
            navigation.panRelative(deltaX, deltaY);
        } else {
            // Canvas pan
            const currentTransform = element.style.transform || '';
            const translateMatch = currentTransform.match(/translate\(([^)]+)\)/);
            
            let currentX = 0, currentY = 0;
            if (translateMatch) {
                const values = translateMatch[1].split(',');
                currentX = parseFloat(values[0]) || 0;
                currentY = parseFloat(values[1]) || 0;
            }
            
            element.style.transform = `translate(${currentX + deltaX}px, ${currentY + deltaY}px)`;
        }
    }

    handleDoubleTap(element, position) {
        if (element.id === 'forgeViewer' && window.viewer) {
            window.viewer.fitToView();
        } else {
            // Reset canvas view
            element.style.transform = '';
        }
        
        this.showNotification('View reset', 'info', 1000);
    }

    handleLongPress(element, position) {
        // Show context menu
        this.showContextMenu(position.x, position.y);
    }

    showContextMenu(x, y) {
        const menu = document.createElement('div');
        menu.className = 'mobile-context-menu';
        menu.style.cssText = `
            position: fixed;
            top: ${y}px;
            left: ${x}px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 2000;
            padding: 0.5rem 0;
            min-width: 150px;
        `;
        
        const options = [
            { text: 'Fit to View', action: () => this.fitToView() },
            { text: 'Reset Zoom', action: () => this.resetZoom() },
            { text: 'Toggle Legend', action: () => this.toggleLegend() }
        ];
        
        options.forEach(option => {
            const item = document.createElement('div');
            item.textContent = option.text;
            item.style.cssText = `
                padding: 0.75rem 1rem;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            `;
            item.onclick = () => {
                option.action();
                document.body.removeChild(menu);
            };
            menu.appendChild(item);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu after 3 seconds or on touch outside
        setTimeout(() => {
            if (document.body.contains(menu)) {
                document.body.removeChild(menu);
            }
        }, 3000);
    }

    setupOrientationHandling() {
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleOrientationChange();
            }, 100);
        });
        
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }

    handleOrientationChange() {
        const newDevice = this.detectDevice();
        if (newDevice !== this.currentDevice) {
            this.currentDevice = newDevice;
            this.optimizeForDevice();
        }
        
        // Resize viewer
        if (window.viewer) {
            setTimeout(() => {
                window.viewer.resize();
                window.viewer.fitToView();
            }, 200);
        }
        
        // Resize canvas
        const canvas = document.getElementById('floorPlanCanvas');
        if (canvas && window.canvas) {
            window.canvas.resizeCanvas();
        }
    }

    handleResize() {
        this.handleOrientationChange();
    }

    setupMobileNavigation() {
        // Add mobile menu buttons
        const header = document.querySelector('.header-left');
        if (header) {
            const leftMenuBtn = this.createMobileMenuButton('left');
            const rightMenuBtn = this.createMobileMenuButton('right');
            
            header.insertBefore(leftMenuBtn, header.firstChild);
            header.appendChild(rightMenuBtn);
        }
        
        // Add overlay for mobile menus
        const overlay = document.createElement('div');
        overlay.className = 'mobile-overlay';
        overlay.onclick = () => this.closeMobileMenus();
        document.body.appendChild(overlay);
    }

    createMobileMenuButton(side) {
        const button = document.createElement('button');
        button.className = `mobile-menu-btn mobile-menu-${side}`;
        button.innerHTML = `<i class="fas fa-bars"></i>`;
        button.style.cssText = `
            display: none;
            background: none;
            border: none;
            font-size: 1.2rem;
            color: var(--primary);
            cursor: pointer;
            padding: 0.5rem;
        `;
        
        // Show only on mobile
        const mediaQuery = window.matchMedia('(max-width: 768px)');
        const updateVisibility = () => {
            button.style.display = mediaQuery.matches ? 'block' : 'none';
        };
        mediaQuery.addListener(updateVisibility);
        updateVisibility();
        
        button.onclick = () => this.toggleMobileMenu(side);
        
        return button;
    }

    toggleMobileMenu(side) {
        const sidebar = document.getElementById(side === 'left' ? 'leftSidebar' : 'rightSidebar');
        const overlay = document.querySelector('.mobile-overlay');
        
        if (sidebar.classList.contains('mobile-open')) {
            this.closeMobileMenus();
        } else {
            this.closeMobileMenus(); // Close other menus first
            sidebar.classList.add('mobile-open');
            overlay.classList.add('active');
        }
    }

    closeMobileMenus() {
        document.querySelectorAll('.sidebar').forEach(sidebar => {
            sidebar.classList.remove('mobile-open');
        });
        document.querySelector('.mobile-overlay').classList.remove('active');
    }

    optimizeForMobile() {
        if (this.currentDevice === 'mobile') {
            // Reduce animation complexity
            document.documentElement.style.setProperty('--animation-duration', '0.2s');
            
            // Optimize touch targets
            this.optimizeTouchTargets();
            
            // Reduce visual effects
            this.reduceVisualEffects();
            
            // Optimize performance
            this.optimizePerformance();
        }
    }

    optimizeTouchTargets() {
        const buttons = document.querySelectorAll('.btn, .header-btn, .tool-btn, .export-btn');
        buttons.forEach(button => {
            const rect = button.getBoundingClientRect();
            if (rect.height < 44) { // iOS minimum touch target
                button.style.minHeight = '44px';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
            }
        });
    }

    reduceVisualEffects() {
        const style = document.createElement('style');
        style.textContent = `
            @media (max-width: 768px) {
                * {
                    transition-duration: 0.2s !important;
                }
                
                .btn::before,
                .sidebar-toggle:hover,
                .list-item:hover {
                    display: none !important;
                }
                
                .notification,
                .legend,
                .sidebar-panel {
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    optimizePerformance() {
        // Reduce render frequency on mobile
        if (window.canvas && window.canvas.render) {
            const originalRender = window.canvas.render;
            let renderTimeout;
            
            window.canvas.render = function(...args) {
                clearTimeout(renderTimeout);
                renderTimeout = setTimeout(() => {
                    originalRender.apply(this, args);
                }, 16); // ~60fps
            };
        }
    }

    optimizeForDevice() {
        switch (this.currentDevice) {
            case 'mobile':
                this.optimizeForMobile();
                break;
            case 'tablet':
                this.optimizeForTablet();
                break;
            case 'desktop':
                this.optimizeForDesktop();
                break;
        }
    }

    optimizeForTablet() {
        // Tablet-specific optimizations
        document.documentElement.style.setProperty('--sidebar-width', '280px');
    }

    optimizeForDesktop() {
        // Desktop-specific optimizations
        document.documentElement.style.setProperty('--sidebar-width', '320px');
        document.documentElement.style.setProperty('--animation-duration', '0.3s');
    }

    // Utility methods
    fitToView() {
        if (window.viewer) {
            window.viewer.fitToView();
        } else if (window.canvas) {
            window.canvas.fitToView();
        }
    }

    resetZoom() {
        if (window.viewer) {
            window.viewer.navigation.setZoom(1);
        }
    }

    toggleLegend() {
        const legend = document.querySelector('.legend');
        if (legend) {
            legend.style.display = legend.style.display === 'none' ? 'block' : 'none';
        }
    }

    showNotification(message, type = 'info', duration = 2000) {
        if (window.showNotification) {
            window.showNotification(message, type, duration);
        }
    }
}

// Gesture Recognition for advanced touch interactions
class GestureRecognizer {
    constructor() {
        this.gestures = new Map();
        this.currentGesture = null;
    }

    recognizeGesture(touches) {
        if (touches.length === 1) {
            return this.recognizeSingleTouch(touches[0]);
        } else if (touches.length === 2) {
            return this.recognizeTwoFingerGesture(touches);
        }
        return null;
    }

    recognizeSingleTouch(touch) {
        // Implement single touch gesture recognition
        return 'pan';
    }

    recognizeTwoFingerGesture(touches) {
        const distance = this.getDistance(touches[0], touches[1]);
        const angle = this.getAngle(touches[0], touches[1]);
        
        // Determine if it's pinch/zoom or rotate
        if (Math.abs(distance - this.lastDistance) > Math.abs(angle - this.lastAngle)) {
            return 'pinch';
        } else {
            return 'rotate';
        }
    }

    getDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getAngle(touch1, touch2) {
        return Math.atan2(touch2.clientY - touch1.clientY, touch2.clientX - touch1.clientX);
    }
}

// Initialize mobile responsive manager
if (typeof window !== 'undefined') {
    window.mobileManager = new MobileResponsiveManager();
}

module.exports = { MobileResponsiveManager, GestureRecognizer };