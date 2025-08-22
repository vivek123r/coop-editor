# CoopEditor - Collaborative Document Editor

A modern web application for real-time collaborative editing of PDF, PowerPoint, and Word documents with your friends online.

## ✨ Features

- **Real-time Collaboration**: Edit documents simultaneously with multiple users
- **Multi-format Support**: Works with PDF, PowerPoint (.pptx), and Word (.docx) files
- **Live User Presence**: See who's online and track user cursors
- **Room-based Sharing**: Create and join collaboration rooms with unique IDs
- **Document Viewers**: Specialized viewers for each document type
- **File Upload**: Drag & drop or click to upload documents
- **Export Functionality**: Download edited documents

## 🚀 Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd coop-editor
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd server
npm install
cd ..
```

4. Start the backend server:
```bash
cd server
node server.js
```

5. Start the frontend development server:
```bash
npm run dev
```

6. Open your browser and navigate to `http://localhost:5174`

**Note**: The backend server runs on port 3002 and the frontend on port 5174.

## 🛠️ Technology Stack

- **Frontend**: React with JavaScript
- **Build Tool**: Vite for fast development and building
- **Styling**: CSS modules with modern design patterns
- **Icons**: Lucide React for beautiful icons
- **Document Processing**:
  - PDF: react-pdf library
  - PowerPoint: pptxgenjs library
  - Word: mammoth library
- **Real-time Communication**: Socket.io (ready for integration)

## 📖 How to Use

1. **Join a Room**: Enter your name and a room ID to start collaborating
2. **Upload Documents**: Drag and drop or click to upload PDF, PowerPoint, or Word files
3. **Start Editing**: Use the built-in viewers and editors for each document type
4. **Collaborate**: See other users online and their real-time changes
5. **Export**: Download your edited documents when finished

## 🎯 Supported File Formats

| Format | Extension | Viewing | Editing | Status |
|--------|-----------|---------|---------|--------|
| PDF | `.pdf` | ✅ | 🔄 | Placeholder view implemented |
| PowerPoint | `.pptx` | ✅ | 🔄 | Presentation mode available |
| Word | `.docx` | ✅ | ✅ | Basic editing implemented |

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Project Structure

```
src/
├── components/           # React components
│   ├── viewers/         # Document viewers (PDF, PPT, Word)
│   ├── DocumentEditor.jsx
│   ├── FileUpload.jsx
│   └── UserList.jsx
├── App.jsx              # Main application component
├── App.css              # Main application styles
├── index.css            # Global styles
└── main.jsx             # Application entry point
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📋 Future Enhancements

- [ ] Full Socket.io real-time collaboration implementation
- [ ] Advanced text editing with rich text editor
- [ ] Comments and suggestions system
- [ ] Version history and document tracking
- [ ] User authentication and permissions
- [ ] Advanced PDF annotation tools
- [ ] PowerPoint slide editing capabilities
- [ ] Cloud storage integration

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋‍♂️ Support

If you have any questions or need help, please open an issue in the repository.

---

**Note**: This is a demonstration project showing the foundation for a collaborative document editor. Some features like real-time editing use placeholder implementations and would require additional backend infrastructure for full functionality.
