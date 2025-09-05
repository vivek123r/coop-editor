import { useState, useEffect, useRef } from "react";
import { Canvas, PencilBrush, SprayBrush, CircleBrush, IText, Rect, Circle, Line, Triangle } from 'fabric';
import collaborationManager from "../../utils/collaborationManager";
import "./drawing.css";

export default function Drawing({ roomId, currentUser }) {
  const canvasRef = useRef(null);
  const historyRef = useRef([]);
  const historyPositionRef = useRef(-1);
  const [brushColor, setBrushColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [activeMode, setActiveMode] = useState("pencil");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const ignoreSyncRef = useRef(false);
  
  // Local storage keys
  const getLocalStorageKey = (type) => `coopchat_drawing_${roomId || 'default'}_${type}`;
  
  // Clear local storage for this room's drawing
  const clearLocalStorage = () => {
    localStorage.removeItem(getLocalStorageKey('drawingData'));
    localStorage.removeItem(getLocalStorageKey('timestamp'));
    console.log("Cleared local storage for room drawing:", roomId);
  };

  useEffect(() => {
    // Wait for DOM to be ready
    if (!canvasRef.current) return;
    
    // Create canvas
    const canvas = new Canvas(canvasRef.current, {
      isDrawingMode: true,
      width: 900,
      height: 600,
      backgroundColor: "white"
    });

    // Default brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.width = brushSize;
    canvas.freeDrawingBrush.color = brushColor;

    // Load from localStorage if available
    const savedDrawing = localStorage.getItem(getLocalStorageKey('drawingData'));
    if (savedDrawing) {
      try {
        canvas.loadFromJSON(savedDrawing, () => {
          canvas.renderAll();
          console.log("Drawing loaded from local storage");
          const savedTime = localStorage.getItem(getLocalStorageKey('timestamp'));
          if (savedTime) {
            setLastSaved(new Date(savedTime));
          }
        });
      } catch (err) {
        console.error("Error loading drawing from localStorage:", err);
      }
    }

    // Request drawing data from other users when joining
    if (roomId && currentUser) {
      collaborationManager.sendMessage({
        type: 'drawing-data-request',
        roomId,
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: new Date().toISOString()
      });
    }

    // Store objects added to history for undo/redo
    canvas.on('object:added', () => {
      if (ignoreSyncRef.current) return;
      
      const json = canvas.toJSON();
      const position = historyPositionRef.current;
      
      // Remove any forward history
      historyRef.current = historyRef.current.slice(0, position + 1);
      historyRef.current.push(json);
      historyPositionRef.current++;
      
      // Save to localStorage
      saveToLocalStorage(json);
      
      // Broadcast changes
      if (roomId && currentUser) {
        broadcastDrawingData(json);
      }
    });

    // Store ref
    canvasRef.current = canvas;
    
    return () => {
      canvas.dispose();
    }
  }, [roomId, currentUser]);

  // Save drawing to local storage
  const saveToLocalStorage = (jsonData) => {
    try {
      const dataStr = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData);
      localStorage.setItem(getLocalStorageKey('drawingData'), dataStr);
      localStorage.setItem(getLocalStorageKey('timestamp'), new Date().toISOString());
      setLastSaved(new Date());
    } catch (err) {
      console.error("Error saving to localStorage:", err);
    }
  };
  
  // Broadcast drawing data to other users
  const broadcastDrawingData = (jsonData) => {
    if (!roomId || !currentUser) return;
    
    collaborationManager.sendMessage({
      type: 'drawing-data-update',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      drawingData: typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData),
      timestamp: new Date().toISOString()
    });
  };

  // Handle incoming messages for collaborative drawing
  useEffect(() => {
    if (!roomId || !currentUser || !canvasRef.current) return;
    
    const handleMessage = (msg) => {
      if (msg.roomId !== roomId) return;
      
      // Handle drawing data updates
      if (msg.type === 'drawing-data-update' && msg.userId !== currentUser.id) {
        try {
          ignoreSyncRef.current = true;
          canvasRef.current.loadFromJSON(msg.drawingData, () => {
            canvasRef.current.renderAll();
            ignoreSyncRef.current = false;
            
            // Update history
            const json = canvasRef.current.toJSON();
            historyRef.current.push(json);
            historyPositionRef.current = historyRef.current.length - 1;
            
            // Update localStorage
            saveToLocalStorage(json);
          });
        } catch (err) {
          console.error("Error applying drawing update:", err);
          ignoreSyncRef.current = false;
        }
      }
      
      // Handle drawing data request
      else if (msg.type === 'drawing-data-request' && msg.userId !== currentUser.id) {
        const json = canvasRef.current.toJSON();
        collaborationManager.sendMessage({
          type: 'drawing-data-update',
          roomId,
          userId: currentUser.id,
          userName: currentUser.name,
          drawingData: JSON.stringify(json),
          timestamp: new Date().toISOString()
        });
      }
    };
    
    collaborationManager.on('custom-message', handleMessage);
    return () => collaborationManager.off('custom-message', handleMessage);
  }, [roomId, currentUser]);

  const setBrush = (type) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set drawing mode to true for all brush types except select
    canvas.isDrawingMode = type !== 'select';
    setActiveMode(type);
    
    switch (type) {
      case "pencil":
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        break;
      case "spray":
        canvas.freeDrawingBrush = new SprayBrush(canvas);
        break;
      case "circle":
        canvas.freeDrawingBrush = new CircleBrush(canvas);
        break;
      case "eraser":
        canvas.freeDrawingBrush = new PencilBrush(canvas);
        canvas.freeDrawingBrush.color = "#FFFFFF"; // White for eraser
        setBrushColor("#FFFFFF");
        break;
      case "select":
        // Selection mode - disable drawing
        canvas.selection = true;
        break;
      default:
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
    }
    
    // Apply current brush settings
    if (canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.width = brushSize;
      if (type !== 'eraser') {
        canvas.freeDrawingBrush.color = brushColor;
      }
    }
  };
  
  const handleColorChange = (color) => {
    if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
      canvasRef.current.freeDrawingBrush.color = color;
      setBrushColor(color);
      
      // If we were in eraser mode, switch back to pencil
      if (activeMode === 'eraser') {
        setActiveMode('pencil');
      }
    }
  };
  
  const handleBrushSizeChange = (size) => {
    if (canvasRef.current && canvasRef.current.freeDrawingBrush) {
      canvasRef.current.freeDrawingBrush.width = size;
      setBrushSize(size);
    }
  };

  const addText = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Disable drawing mode
    canvas.isDrawingMode = false;
    setActiveMode('select');
    
    const text = new IText("Type here", {
      left: 100,
      top: 100,
      fontFamily: "Arial",
      fill: brushColor,
      fontSize: 24,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    
    // Update history
    const json = canvas.toJSON();
    historyRef.current.push(json);
    historyPositionRef.current = historyRef.current.length - 1;
    
    // Save and broadcast
    saveToLocalStorage(json);
    broadcastDrawingData(json);
  };

  const addShape = (shape) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Disable drawing mode
    canvas.isDrawingMode = false;
    setActiveMode('select');
    
    let obj;
    if (shape === "rect") obj = new Rect({ 
      left: 150, 
      top: 150, 
      width: 100, 
      height: 80, 
      fill: brushColor,
      stroke: '#000',
      strokeWidth: 1
    });
    if (shape === "circle") obj = new Circle({ 
      left: 200, 
      top: 200, 
      radius: 50, 
      fill: brushColor,
      stroke: '#000',
      strokeWidth: 1 
    });
    if (shape === "line") obj = new Line([50, 100, 200, 100], { 
      stroke: brushColor,
      strokeWidth: brushSize 
    });
    if (shape === "triangle") obj = new Triangle({
      left: 150,
      top: 150,
      width: 100,
      height: 100,
      fill: brushColor,
      stroke: '#000',
      strokeWidth: 1
    });
    
    if (obj) {
      canvas.add(obj);
      canvas.setActiveObject(obj);
      
      // Update history
      const json = canvas.toJSON();
      historyRef.current.push(json);
      historyPositionRef.current = historyRef.current.length - 1;
      
      // Save and broadcast
      saveToLocalStorage(json);
      broadcastDrawingData(json);
    }
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    
    if (confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
      canvasRef.current.clear().setBackgroundColor("white", () => {
        canvasRef.current.renderAll();
      });
      
      // Reset history
      const json = canvasRef.current.toJSON();
      historyRef.current = [json];
      historyPositionRef.current = 0;
      
      // Save and broadcast
      saveToLocalStorage(json);
      broadcastDrawingData(json);
      
      // Set active mode back to pencil
      setBrush('pencil');
    }
  };

  const saveImage = () => {
    if (!canvasRef.current) return;
    
    setIsSaving(true);
    
    setTimeout(() => {
      try {
        const data = canvasRef.current.toDataURL({ 
          format: "png",
          quality: 1
        });
        
        const link = document.createElement("a");
        link.href = data;
        link.download = `drawing-${new Date().toISOString().slice(0,10)}.png`;
        link.click();
      } catch (err) {
        console.error("Error saving image:", err);
        alert("Failed to save image. Please try again.");
      }
      
      setIsSaving(false);
    }, 100);
  };
  
  const undo = () => {
    if (!canvasRef.current) return;
    
    const position = historyPositionRef.current;
    if (position > 0) {
      historyPositionRef.current = position - 1;
      const previousState = historyRef.current[position - 1];
      
      ignoreSyncRef.current = true;
      canvasRef.current.loadFromJSON(previousState, () => {
        canvasRef.current.renderAll();
        ignoreSyncRef.current = false;
        
        // Broadcast the change
        broadcastDrawingData(previousState);
      });
    }
  };
  
  const redo = () => {
    if (!canvasRef.current) return;
    
    const position = historyPositionRef.current;
    if (position < historyRef.current.length - 1) {
      historyPositionRef.current = position + 1;
      const nextState = historyRef.current[position + 1];
      
      ignoreSyncRef.current = true;
      canvasRef.current.loadFromJSON(nextState, () => {
        canvasRef.current.renderAll();
        ignoreSyncRef.current = false;
        
        // Broadcast the change
        broadcastDrawingData(nextState);
      });
    }
  };
  
  const deleteSelected = () => {
    if (!canvasRef.current) return;
    
    const activeObjects = canvasRef.current.getActiveObjects();
    if (activeObjects.length > 0) {
      activeObjects.forEach(obj => {
        canvasRef.current.remove(obj);
      });
      
      canvasRef.current.discardActiveObject();
      canvasRef.current.renderAll();
      
      // Update history
      const json = canvasRef.current.toJSON();
      historyRef.current.push(json);
      historyPositionRef.current = historyRef.current.length - 1;
      
      // Save and broadcast
      saveToLocalStorage(json);
      broadcastDrawingData(json);
    }
  };

  return (
    <div className="drawing-container">
      <div className="drawing-header">
        <h2>Collaborative Drawing Board</h2>
        {lastSaved && (
          <div className="last-saved">
            Last saved: {lastSaved.toLocaleTimeString()}
          </div>
        )}
      </div>
      
      {/* Toolbar */}
      <div className="drawing-toolbar">
        <div className="toolbar-section">
          <h3>Tools</h3>
          <div className="button-group">
            <button 
              className={`tool-btn ${activeMode === 'pencil' ? 'active' : ''}`} 
              onClick={() => setBrush("pencil")} 
              title="Pencil"
            >
              ✏️ Pencil
            </button>
            <button 
              className={`tool-btn ${activeMode === 'spray' ? 'active' : ''}`} 
              onClick={() => setBrush("spray")} 
              title="Spray Brush"
            >
              💨 Spray
            </button>
            <button 
              className={`tool-btn ${activeMode === 'circle' ? 'active' : ''}`} 
              onClick={() => setBrush("circle")} 
              title="Circle Brush"
            >
              ⭕ Circle Brush
            </button>
            <button 
              className={`tool-btn ${activeMode === 'eraser' ? 'active' : ''}`} 
              onClick={() => setBrush("eraser")} 
              title="Eraser"
            >
              🧽 Eraser
            </button>
            <button 
              className={`tool-btn ${activeMode === 'select' ? 'active' : ''}`} 
              onClick={() => setBrush("select")} 
              title="Select"
            >
              � Select
            </button>
          </div>
        </div>
        
        <div className="toolbar-section">
          <h3>Shapes</h3>
          <div className="button-group">
            <button className="tool-btn" onClick={() => addShape("rect")} title="Rectangle">▭ Rectangle</button>
            <button className="tool-btn" onClick={() => addShape("circle")} title="Circle">⬤ Circle</button>
            <button className="tool-btn" onClick={() => addShape("triangle")} title="Triangle">△ Triangle</button>
            <button className="tool-btn" onClick={() => addShape("line")} title="Line">— Line</button>
            <button className="tool-btn" onClick={addText} title="Add Text">🔤 Text</button>
          </div>
        </div>
        
        <div className="toolbar-section">
          <h3>Color</h3>
          <div className="color-picker">
            <input 
              type="color" 
              value={brushColor} 
              onChange={(e) => handleColorChange(e.target.value)}
              className="color-input"
            />
            <div className="color-presets">
              <div className="color-preset black" onClick={() => handleColorChange("#000000")} />
              <div className="color-preset red" onClick={() => handleColorChange("#FF0000")} />
              <div className="color-preset green" onClick={() => handleColorChange("#00FF00")} />
              <div className="color-preset blue" onClick={() => handleColorChange("#0000FF")} />
              <div className="color-preset yellow" onClick={() => handleColorChange("#FFFF00")} />
            </div>
          </div>
        </div>
        
        <div className="toolbar-section">
          <h3>Brush Size</h3>
          <div className="brush-size-control">
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => handleBrushSizeChange(parseInt(e.target.value))}
              className="brush-slider"
            />
            <span className="brush-size-value">{brushSize}px</span>
          </div>
        </div>
        
        <div className="toolbar-section">
          <h3>Actions</h3>
          <div className="button-group">
            <button className="tool-btn" onClick={undo} title="Undo">↩️ Undo</button>
            <button className="tool-btn" onClick={redo} title="Redo">↪️ Redo</button>
            <button className="tool-btn" onClick={deleteSelected} title="Delete Selected">🗑️ Delete</button>
            <button className="tool-btn warning" onClick={clearCanvas} title="Clear Canvas">🧹 Clear All</button>
            <button className="tool-btn primary" onClick={saveImage} disabled={isSaving}>
              {isSaving ? 'Saving...' : '💾 Save Image'}
            </button>
          </div>
        </div>
      </div>

      {/* Canvas container */}
      <div className="canvas-container">
        <canvas ref={canvasRef} className="drawing-canvas" />
      </div>
      
      {/* Collaborative info */}
      {roomId && currentUser && (
        <div className="collaboration-info">
          <p>Your changes are automatically saved and shared with others in the room.</p>
        </div>
      )}
    </div>
  );
}
