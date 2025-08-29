# FloorPlan Pro - Interactive CAD Floor Design System

A comprehensive web-based solution for creating interactive floor designs with intelligent space management, virtual navigation, and real-time design collaboration.

## 🌟 Features

### 🏗️ Advanced Floor Analysis
- **Intelligent Space Recognition**: Automatically detects and categorizes rooms, corridors, and functional areas
- **Room Classification**: Identifies office spaces, meeting rooms, kitchens, bathrooms, and circulation areas
- **Corridor Mapping**: Extracts hallways and passage routes for optimal navigation planning
- **Area Calculations**: Computes precise room areas and circulation space metrics
- **Accessibility Analysis**: Evaluates compliance with accessibility standards

### 🎯 Smart Space Management (Ilots System)
- **Algorithmic Placement**: Intelligently places work islands, meeting zones, and social areas
- **Density Optimization**: Configurable density settings for optimal space utilization
- **Multi-Type Support**: Work stations, meeting areas, social zones, and break spaces
- **Capacity Planning**: Calculates seating capacity and space requirements for each zone
- **Visual Indicators**: Color-coded visualization system for different space types

### 🚶 Virtual Navigation & Tours
- **Interactive Tours**: Start guided tours from any room or entrance point
- **Room-to-Room Navigation**: Click-to-navigate between spaces with optimal pathfinding
- **Path Visualization**: Shows optimal routes through corridors and spaces
- **Multiple View Modes**: 3D perspective, floor plan view, and immersive walkthrough
- **Keyboard Controls**: WASD navigation for seamless user experience

### 🎮 Interactive Controls & UI
- **Navigation Panel**: Complete tour control interface with room selection
- **Real-time Updates**: Live location tracking during virtual tours
- **Speed Control**: Adjustable navigation speed for different user preferences
- **Accessibility Features**: Full keyboard and mouse support
- **Responsive Design**: Works across desktop, tablet, and mobile devices

### 🔧 Real-time Design Management
- **Live Editing**: Real-time modification of design elements
- **Element Properties**: Detailed property panels for walls, doors, windows, and furniture
- **Material Library**: Comprehensive material database with properties
- **Design Layers**: Organized layer system for different building systems
- **Export Capabilities**: Multiple export formats for design data

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- CAD API credentials (see Configuration section)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/rehmanul/-FloorPlan-Pro-DeDe-.git
cd FloorPlan-Pro-DeDe-
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# CAD API Credentials
APS_CLIENT_ID=your_client_id_here
APS_CLIENT_SECRET=your_client_secret_here

# Server Configuration
PORT=3001
NODE_ENV=production
```

4. **Start the application**
```bash
npm start
```

5. **Access the application**
Open your browser and navigate to `http://localhost:3001`

## 📁 Project Structure

```
FloorPlan-Pro/
├── public/                 # Static frontend files
│   └── index.html         # Main application interface
├── src/                   # Source code modules
│   ├── autodesk-design-extractor.js  # CAD data extraction
│   ├── design-manager.js             # Design management logic
│   ├── floor-analyzer.js             # Spatial analysis engine
│   └── navigation-controller.js      # Navigation system
├── uploads/               # Temporary file storage
├── config/               # Configuration files
├── server.js            # Main server application
├── package.json         # Project dependencies
├── Dockerfile          # Container configuration
├── render.yaml         # Deployment configuration
└── README.md           # This file
```

## 🎯 Usage Guide

### 1. File Upload & Processing
- **Supported Formats**: DXF, DWG, RVT, IFC, STEP, STP
- **Upload Methods**: Drag-and-drop or click to browse
- **Processing**: Automatic translation to web-viewable format
- **Status Tracking**: Real-time processing status updates

### 2. Floor Plan Analysis
- **Automatic Analysis**: Spatial analysis starts after file load
- **Room Detection**: Identifies and categorizes all spaces
- **Navigation Paths**: Generates optimal movement routes
- **Accessibility Reports**: Compliance and improvement suggestions

### 3. Space Management (Ilots)
- **Generate Ilots**: Click "Generate Ilots" for optimized placement
- **Configuration**: Adjust density, types, and spacing in the panel
- **Visual Feedback**: Color-coded zones with detailed information
- **Interactive Selection**: Click ilots for detailed specifications

### 4. Virtual Tours & Navigation
- **Start Tours**: Begin navigation from any room or entrance
- **Room Navigation**: Use room list for quick movement between spaces
- **Keyboard Controls**: 
  - `W/↑` - Move forward
  - `S/↓` - Move backward  
  - `A/←` - Turn left
  - `D/→` - Turn right
  - `ESC` - Stop tour
- **View Modes**: Switch between 3D, 2D, and walkthrough modes

## 🔧 API Endpoints

### File Processing
- `POST /api/jobs` - Upload and process CAD files
- `GET /api/jobs/:urn/status` - Check processing status
- `GET /api/auth/token` - Get viewer access token

### Spatial Analysis
- `POST /api/analyze` - Perform comprehensive floor plan analysis
- `POST /api/ilots` - Generate optimized space placement
- `POST /api/navigation` - Calculate navigation paths and routes

### Design Management
- `POST /api/design/details` - Get complete design information
- `POST /api/design/save` - Save design modifications
- `POST /api/design/update` - Apply real-time updates

## ⚙️ Configuration Options

### Space Management Configuration
```javascript
{
  density: 0.3,        // Spaces per square meter
  minDistance: 2.0,    // Minimum distance between spaces (meters)
  types: ['work', 'meeting', 'social', 'break'],
  capacity: {          // Default capacities by type
    work: 4,
    meeting: 8,
    social: 12,
    break: 6
  }
}
```

### Navigation Settings
```javascript
{
  speed: 1.0,          // Navigation speed multiplier
  viewMode: '3d',      // '3d', '2d', 'walkthrough'
  tourType: 'guided',  // 'guided', 'free'
  accessibility: true  // Enable accessibility features
}
```

## 📋 Supported File Formats

| Format | Extensions | Description | Max Size |
|--------|------------|-------------|----------|
| AutoCAD | .dwg, .dxf | 2D/3D CAD drawings | 100MB |
| Revit | .rvt | Building Information Models | 100MB |
| IFC | .ifc | Industry Foundation Classes | 100MB |
| STEP | .step, .stp | 3D CAD exchange format | 100MB |

## 🌐 Browser Compatibility

- **Chrome**: 80+ (Recommended)
- **Firefox**: 75+
- **Safari**: 13+
- **Edge**: 80+
- **WebGL**: Required for 3D visualization

## 🚀 Deployment

### Render Deployment
1. Connect your GitHub repository to Render
2. Use the included `render.yaml` configuration
3. Set environment variables in Render dashboard
4. Deploy automatically on git push

### Docker Deployment
```bash
# Build the image
docker build -t floorplan-pro .

# Run the container
docker run -p 3001:3001 --env-file .env floorplan-pro
```

### Manual Deployment
```bash
# Install dependencies
npm ci --only=production

# Start the application
npm start
```

## 🔧 Performance Optimization

### Frontend Optimizations
- **Lazy Loading**: Components load on demand
- **Efficient Rendering**: Optimized 3D visualization pipeline
- **Memory Management**: Automatic cleanup of 3D resources
- **Caching**: Smart caching of processed models and textures

### Backend Optimizations
- **File Processing**: Asynchronous file handling
- **API Caching**: Response caching for frequently accessed data
- **Resource Management**: Efficient memory usage for large files
- **Error Handling**: Graceful degradation and recovery

## 🐛 Troubleshooting

### Common Issues

**File Upload Fails**
- Verify file format is supported
- Check file size is under 100MB
- Ensure API credentials are configured

**No Rooms Detected**
- File may not contain room boundary information
- Try adjusting analysis sensitivity settings
- Verify model geometry quality

**Navigation Not Working**
- Ensure tour is properly started
- Check browser WebGL support
- Verify model has loaded completely

**3D Viewer Issues**
- Update browser to latest version
- Enable hardware acceleration
- Check WebGL compatibility

### Debug Mode
Enable detailed logging by adding `?debug=true` to the URL

### Performance Issues
- Reduce model complexity for better performance
- Use lower quality settings on mobile devices
- Clear browser cache if experiencing issues

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style and conventions
- Add tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For technical support or questions:
- 📧 Create an issue on GitHub
- 📚 Check the documentation
- 💬 Join our community discussions

## 🙏 Acknowledgments

- Built with modern web technologies
- Powered by advanced 3D visualization libraries
- Inspired by the need for better space planning tools

---

**FloorPlan Pro** - Making CAD floor designs interactive, intelligent, and accessible! 🏢✨

## 📊 System Requirements

### Minimum Requirements
- **RAM**: 4GB
- **Storage**: 1GB free space
- **Network**: Stable internet connection
- **Browser**: Modern browser with WebGL support

### Recommended Requirements
- **RAM**: 8GB or higher
- **Storage**: 2GB free space
- **Network**: High-speed internet connection
- **Graphics**: Dedicated graphics card for optimal 3D performance

## 🔐 Security Features

- **Secure File Upload**: Validated file types and size limits
- **API Authentication**: Secure token-based authentication
- **Data Protection**: Temporary file cleanup and secure storage
- **CORS Protection**: Configured cross-origin resource sharing
- **Input Validation**: Comprehensive input sanitization

## 📈 Analytics & Monitoring

- **Performance Metrics**: Real-time performance monitoring
- **Usage Analytics**: User interaction tracking
- **Error Reporting**: Comprehensive error logging
- **Health Checks**: System health monitoring endpoints