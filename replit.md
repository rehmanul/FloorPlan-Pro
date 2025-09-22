# FloorPlan Pro - Replit Environment Setup

## Project Overview
FloorPlan Pro is a professional CAD analysis system that processes floor plans using Autodesk Platform Services (APS). It provides intelligent îlot placement, room detection, and real-time collaboration features.

## Recent Changes (September 22, 2025)
- **Project Import**: Successfully imported from GitHub repository
- **Node.js Upgrade**: Updated from nodejs-16 to nodejs-20 for better performance and compatibility
- **Server Configuration**: Configured server to bind to 0.0.0.0:5000 for Replit environment
- **Environment Setup**: Modified credential checking to be non-blocking for development
- **Deployment**: Configured for autoscale deployment using `npm start`

## Architecture
- **Backend**: Node.js/Express server with Socket.IO for real-time collaboration
- **Frontend**: Single-page HTML application with modern CSS and JavaScript
- **CAD Processing**: Autodesk Platform Services (APS) integration for file processing
- **File Support**: DXF, DWG, RVT, IFC, PDF files
- **Storage**: Local file uploads in `uploads/` directory

## Environment Variables Required
- `APS_CLIENT_ID`: Autodesk Platform Services Client ID
- `APS_CLIENT_SECRET`: Autodesk Platform Services Client Secret
- `PORT`: Server port (defaults to 5000)
- `NODE_ENV`: Environment setting (development/production)

## Current State
✅ Server running on port 5000
✅ Frontend accessible and responsive
✅ Dependencies installed and configured
⚠️ CAD processing features disabled (requires APS credentials)

## Next Steps
1. Add APS credentials to enable full CAD functionality
2. Test file upload and processing features
3. Verify real-time collaboration features

## User Preferences
- Production-ready CAD processing system
- Professional UI with glassmorphism design
- Real-time collaboration capabilities
- Mobile-responsive interface