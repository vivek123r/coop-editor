# Copilot Instructions for Collaborative Document Editor

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Overview
This is a collaborative online document editor built with React and JavaScript that supports:
- Real-time collaborative editing of PDF, PowerPoint, and Word documents
- Multi-user sessions with live cursors and changes
- Document viewing and basic editing capabilities
- Modern React components with responsive design

## Technology Stack
- **Frontend**: React with JavaScript (no TypeScript)
- **Build Tool**: Vite for fast development
- **Real-time Communication**: Socket.io for collaboration features
- **Document Processing**:
  - PDF: react-pdf for viewing
  - PowerPoint: pptxgenjs for handling presentations
  - Word: mammoth for document processing
- **UI**: Lucide React for icons, custom CSS for styling

## Coding Guidelines
- Use functional components with React hooks
- Implement proper error handling for document uploads and processing
- Create reusable components for different document types
- Use modern JavaScript features (ES6+, async/await, destructuring)
- Focus on user experience with loading states and feedback
- Implement proper file handling and validation
- Create responsive layouts that work on different screen sizes

## Key Features to Implement
- Document upload and file type detection
- Real-time collaborative editing interface
- User presence indicators (who's online, cursors)
- Document sharing and room management
- Basic editing tools for each document type
- Export functionality for modified documents
