import { useState, useEffect, useRef } from "react";
import collaborationManager from "../../utils/collaborationManager";
import "./drawing.css";

// fabric.js is loaded from CDN in index.html and available as a global variable
const fabric = window.fabric;

export default function Drawing({ roomId, currentUser }) {
  // Reference to the HTML canvas element
  const canvasElRef = useRef(null);
  // Reference to store the fabric.js canvas instance
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

  // Initialize the canvas when component mounts
  useEffect(() => {
    // Wait for DOM to be ready
    if (!canvasElRef.current) {
      console.log("Canvas element not ready");
      return;
    }
    
    // Check if canvas is already initialized
    if (canvasRef.current) {
      console.log("Canvas already initialized, skipping initialization");
      return;
    }
    
    console.log("Initializing fabric canvas");
    
    // Make sure fabric is available in the global scope
    if (!window.fabric) {
      console.error("Fabric.js not loaded! Please check the script in index.html");
      return;
    }
    
    // Create canvas
    const canvas = new fabric.Canvas(canvasElRef.current, {
      isDrawingMode: true,
      width: 900,
      height: 600,
      backgroundColor: "white"
    });
    
    // Store canvas instance in our ref
    canvasRef.current = canvas;
    
    // Custom object ID generator to ensure unique IDs across users
    fabric.Object.prototype.toObject = (function(originalFn) {
      return function(propertiesToInclude) {
        const obj = originalFn.call(this, propertiesToInclude);
        if (!this.id) {
          this.id = `obj_${currentUser?.id || 'local'}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        obj.id = this.id;
        return obj;
      };
    })(fabric.Object.prototype.toObject);

    // Default brush - initialize with pencil brush
    canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
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
      console.log("Requesting drawing data from room:", roomId);
      
      // Send a message to request the current drawing state
      collaborationManager.sendMessage({
        type: 'drawing-data-request',
        roomId,
        userId: currentUser.id,
        userName: currentUser.name,
        timestamp: new Date().toISOString()
      });
    }

    // Store objects added to history for undo/redo
    canvas.on('object:added', (e) => {
      if (ignoreSyncRef.current) return;
      
      // Assign a unique ID to the object if it doesn't have one
      if (e.target && !e.target.id) {
        e.target.id = `obj_${currentUser.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      // Add a small delay to avoid too frequent updates
      clearTimeout(canvas.syncTimeout);
      canvas.syncTimeout = setTimeout(() => {
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
      }, 300); // 300ms delay
    });

    // Listen for object modifications
    canvas.on('object:modified', (e) => {
      if (ignoreSyncRef.current) return;
      
      console.log("Object modified on canvas");
      
      // Add a small delay to avoid too frequent updates
      clearTimeout(canvas.modifyTimeout);
      canvas.modifyTimeout = setTimeout(() => {
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
          console.log("Broadcasting drawing update after modification");
          broadcastDrawingData(json);
        }
      }, 300); // 300ms delay
    });
    
    // Listen for object removals
    canvas.on('object:removed', (e) => {
      if (ignoreSyncRef.current) return;
      
      console.log("Object removed from canvas");
      
      // Add a small delay to avoid too frequent updates
      clearTimeout(canvas.removeTimeout);
      canvas.removeTimeout = setTimeout(() => {
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
          console.log("Broadcasting drawing update after removal");
          broadcastDrawingData(json);
        }
      }, 300); // 300ms delay
    });
    
    // Add current state to history
    const initialJson = canvas.toJSON();
    historyRef.current = [initialJson];
    historyPositionRef.current = 0;
    
    return () => {
      console.log("Disposing canvas");
      // Clean up event listeners to prevent memory leaks
      if (canvas) {
        canvas.off('object:added');
        canvas.off('object:modified');
        canvas.off('object:removed');
        // Dispose of the canvas
        canvas.dispose();
      }
      // Remove the reference
      canvasRef.current = null;
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
    if (!roomId) {
      console.log("Cannot broadcast: missing roomId");
      return;
    }
    
    console.log("Broadcasting drawing update to room:", roomId);
    
    try {
      // Process JSON data to ensure all objects have IDs before sending
      const processedData = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      
      // Make sure all objects have IDs
      if (processedData.objects && Array.isArray(processedData.objects)) {
        processedData.objects.forEach((obj, index) => {
          if (!obj.id) {
            obj.id = `obj_${currentUser?.id || 'local'}_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
          }
        });
        
        console.log(`Broadcasting ${processedData.objects.length} objects to room`);
      }
      
      // Convert back to string
      const drawingDataStr = JSON.stringify(processedData);
      
      // Send to other clients in the room
      collaborationManager.sendMessage({
        type: 'drawing-data-update',
        roomId,
        userId: currentUser?.id || 'local-user',
        userName: currentUser?.name || 'Anonymous',
        drawingData: drawingDataStr,
        timestamp: new Date().toISOString()
      });
      
      console.log("Drawing update sent successfully");
    } catch (error) {
      console.error("Error broadcasting drawing data:", error);
    }
  };

  // Handle incoming messages for collaborative drawing
  useEffect(() => {
    if (!roomId || !currentUser || !canvasRef.current) {
      console.log("Not setting up drawing message handlers - missing dependencies");
      return;
    }
    
    console.log("Setting up drawing message handlers for room:", roomId);
    
    const handleMessage = (msg) => {
      if (!msg || !msg.roomId || msg.roomId !== roomId) return;
      
      console.log("Received message in drawing component:", msg.type);
      
      // Handle drawing data updates
      if (msg.type === 'drawing-data-update') {
        // Skip processing our own broadcasts
        if (msg.userId === currentUser?.id) {
          console.log("Skipping our own drawing broadcast");
          return;
        }
        
        console.log(`Received drawing update from ${msg.userName || 'Anonymous'}`);
        
        // Set flag to prevent triggering object:added event during loading
        ignoreSyncRef.current = true;
          
        try {
          const canvas = canvasRef.current;
          if (!canvas) {
            console.error("Canvas not initialized yet");
            return;
          }
          
          // Parse the drawing data if it's a string
          let drawingData;
          try {
            drawingData = typeof msg.drawingData === 'string' 
              ? JSON.parse(msg.drawingData) 
              : msg.drawingData;
            
            if (!drawingData || !drawingData.objects) {
              console.error("Invalid drawing data received:", drawingData);
              ignoreSyncRef.current = false;
              return;
            }
          } catch (parseErr) {
            console.error("Error parsing drawing data:", parseErr);
            ignoreSyncRef.current = false;
            return;
          }
          
          // Instead of replacing the entire canvas, merge the incoming objects
          const currentObjects = canvas.getObjects();
          const currentIds = new Set(currentObjects.map(obj => obj.id || ''));
          
          console.log(`Processing ${drawingData.objects.length} objects from incoming drawing data`);
          
          // Process the incoming objects
          if (drawingData.objects && Array.isArray(drawingData.objects)) {
            // For each incoming object
            drawingData.objects.forEach(incomingObj => {
              // Skip if no ID or object already exists
              const objId = incomingObj.id || `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              
              // If we don't have this object yet, add it
              if (!currentIds.has(objId)) {
                fabric.util.enlivenObjects([incomingObj], (objects) => {
                  if (objects[0] && canvas) {
                    objects[0].id = objId;
                    canvas.add(objects[0]);
                    console.log(`Added new object with ID: ${objId}`);
                  }
                });
              }
            });
            
            // Render the canvas after all objects are added
            canvas.renderAll();
            
            // Update history with the new state
            const json = canvas.toJSON();
            historyRef.current.push(json);
            historyPositionRef.current = historyRef.current.length - 1;
            
            // Update localStorage with timestamp
            saveToLocalStorage(json);
            
            console.log("Successfully processed drawing update");
          }
          
          // Clear flag after processing is complete
          setTimeout(() => {
            ignoreSyncRef.current = false;
          }, 100);
        } catch (err) {
          console.error("Error applying drawing update:", err);
          ignoreSyncRef.current = false;
        }
      }
      
      // Handle drawing data request
      else if (msg.type === 'drawing-data-request' && msg.userId !== currentUser?.id) {
        console.log("Received drawing data request from another user");
        
        if (!canvasRef.current) {
          console.warn("Canvas not ready, can't respond to drawing data request");
          return;
        }
        
        console.log("Sending drawing data in response to request");
        const json = canvasRef.current.toJSON();
        
        // Add a small delay to avoid network congestion
        setTimeout(() => {
          collaborationManager.sendMessage({
            type: 'drawing-data-update',
            roomId,
            userId: currentUser?.id || 'local-user',
            userName: currentUser?.name || 'Anonymous',
            drawingData: JSON.stringify(json),
            timestamp: new Date().toISOString(),
            requesterId: msg.userId
          });
        }, Math.random() * 300); // Random delay up to 300ms
      }
      
      // Handle new user joining the drawing area
      else if (msg.type === 'drawing-user-joined' && msg.userId !== currentUser?.id) {
        console.log(`User ${msg.userName || 'Anonymous'} joined the drawing area - sending current canvas state`);
        
        // Add a small random delay to avoid multiple users sending at the same time
        setTimeout(() => {
          if (!canvasRef.current) {
            console.warn("Canvas not ready, can't send drawing data to new user");
            return;
          }
          
          console.log("Sending current canvas state to new user");
          const json = canvasRef.current.toJSON();
          collaborationManager.sendMessage({
            type: 'drawing-data-update',
            roomId,
            userId: currentUser?.id || 'local-user',
            userName: currentUser?.name || 'Anonymous',
            drawingData: JSON.stringify(json),
            timestamp: new Date().toISOString(),
            targetUserId: msg.userId
          });
        }, Math.random() * 1000); // Random delay up to 1 second
      }
      
      // Handle clear canvas message
      else if (msg.type === 'drawing-clear-canvas' && msg.userId !== currentUser.id) {
        console.log("Received clear canvas message from another user");
        
        if (!canvasRef.current) return;
        
        // Set flag to prevent triggering object:added events
        ignoreSyncRef.current = true;
        
        // Clear the canvas and set white background
        canvasRef.current.clear().setBackgroundColor("white", () => {
          canvasRef.current.renderAll();
          
          // Load any objects from the message (likely none)
          if (msg.drawingData) {
            try {
              const data = typeof msg.drawingData === 'string' 
                ? JSON.parse(msg.drawingData) 
                : msg.drawingData;
              
              canvasRef.current.loadFromJSON(data, () => {
                canvasRef.current.renderAll();
              });
            } catch (err) {
              console.error("Error loading cleared canvas state:", err);
            }
          }
          
          // Update history
          const json = canvasRef.current.toJSON();
          historyRef.current = [json];
          historyPositionRef.current = 0;
          
          // Update localStorage
          saveToLocalStorage(json);
          
          // Reset the ignoreSyncRef flag after a delay
          setTimeout(() => {
            ignoreSyncRef.current = false;
          }, 100);
        });
      }
    };
    
    // Make sure collaborationManager is ready and connected
    if (!collaborationManager.connected) {
      console.log("CollaborationManager not connected, connecting now");
      collaborationManager.connect();
    }
    
    // Register for custom messages
    console.log("Registering for custom-message events");
    collaborationManager.on('custom-message', handleMessage);
    
    // Announce our presence to get the latest drawing
    collaborationManager.sendMessage({
      type: 'drawing-user-joined',
      roomId,
      userId: currentUser.id,
      userName: currentUser.name,
      timestamp: new Date().toISOString()
    });
    
    // Cleanup event handler when component unmounts
    return () => {
      console.log("Cleaning up drawing message handlers");
      collaborationManager.off('custom-message', handleMessage);
    };
  }, [roomId, currentUser, canvasRef.current]);

  const setBrush = (type) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set drawing mode to true for all brush types except select
    canvas.isDrawingMode = type !== 'select';
    setActiveMode(type);
    
    switch (type) {
      case "pencil":
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
        break;
      case "spray":
        canvas.freeDrawingBrush = new fabric.SprayBrush(canvas);
        break;
      case "circle":
        canvas.freeDrawingBrush = new fabric.CircleBrush(canvas);
        break;
      case "eraser":
        canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
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
    
    const text = new fabric.IText("Type here", {
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
    if (shape === "rect") obj = new fabric.Rect({ 
      left: 150, 
      top: 150, 
      width: 100, 
      height: 80, 
      fill: brushColor,
      stroke: '#000',
      strokeWidth: 1
    });
    if (shape === "circle") obj = new fabric.Circle({ 
      left: 200, 
      top: 200, 
      radius: 50, 
      fill: brushColor,
      stroke: '#000',
      strokeWidth: 1 
    });
    if (shape === "line") obj = new fabric.Line([50, 100, 200, 100], { 
      stroke: brushColor,
      strokeWidth: brushSize 
    });
    if (shape === "triangle") obj = new fabric.Triangle({
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
      // Set the ignoreSyncRef flag to true to prevent triggering object:added events
      ignoreSyncRef.current = true;
      
      canvasRef.current.clear().setBackgroundColor("white", () => {
        canvasRef.current.renderAll();
        
        // Reset history
        const json = canvasRef.current.toJSON();
        historyRef.current = [json];
        historyPositionRef.current = 0;
        
        // Save to localStorage with new timestamp
        saveToLocalStorage(json);
        
        // Set active mode back to pencil
        setBrush('pencil');
        
        // Send a special clear-canvas message to all users
        if (roomId && currentUser) {
          collaborationManager.sendMessage({
            type: 'drawing-clear-canvas',
            roomId,
            userId: currentUser.id,
            userName: currentUser.name,
            drawingData: JSON.stringify(json),
            timestamp: new Date().toISOString()
          });
        }
        
        // Reset the ignoreSyncRef flag after a small delay
        setTimeout(() => {
          ignoreSyncRef.current = false;
        }, 100);
      });
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
      
      // Set flag to prevent triggering object:added events
      ignoreSyncRef.current = true;
      
      canvasRef.current.loadFromJSON(previousState, () => {
        canvasRef.current.renderAll();
        
        // Save to localStorage with a new timestamp
        saveToLocalStorage(previousState);
        
        // Broadcast the change with current timestamp
        if (roomId && currentUser) {
          collaborationManager.sendMessage({
            type: 'drawing-data-update',
            roomId,
            userId: currentUser.id,
            userName: currentUser.name,
            drawingData: JSON.stringify(previousState),
            timestamp: new Date().toISOString(),
            action: 'undo'
          });
        }
        
        // Reset the ignoreSyncRef flag after a delay
        setTimeout(() => {
          ignoreSyncRef.current = false;
        }, 100);
      });
    }
  };
  
  const redo = () => {
    if (!canvasRef.current) return;
    
    const position = historyPositionRef.current;
    if (position < historyRef.current.length - 1) {
      historyPositionRef.current = position + 1;
      const nextState = historyRef.current[position + 1];
      
      // Set flag to prevent triggering object:added events
      ignoreSyncRef.current = true;
      
      canvasRef.current.loadFromJSON(nextState, () => {
        canvasRef.current.renderAll();
        
        // Save to localStorage with a new timestamp
        saveToLocalStorage(nextState);
        
        // Broadcast the change with current timestamp
        if (roomId && currentUser) {
          collaborationManager.sendMessage({
            type: 'drawing-data-update',
            roomId,
            userId: currentUser.id,
            userName: currentUser.name,
            drawingData: JSON.stringify(nextState),
            timestamp: new Date().toISOString(),
            action: 'redo'
          });
        }
        
        // Reset the ignoreSyncRef flag after a delay
        setTimeout(() => {
          ignoreSyncRef.current = false;
        }, 100);
      });
    }
  };
  
  const deleteSelected = () => {
    if (!canvasRef.current) return;
    
    const activeObjects = canvasRef.current.getActiveObjects();
    if (activeObjects.length > 0) {
      // Set flag to prevent triggering object:added events during deletion
      ignoreSyncRef.current = true;
      
      activeObjects.forEach(obj => {
        canvasRef.current.remove(obj);
      });
      
      canvasRef.current.discardActiveObject();
      canvasRef.current.renderAll();
      
      // Update history
      const json = canvasRef.current.toJSON();
      historyRef.current = historyRef.current.slice(0, historyPositionRef.current + 1);
      historyRef.current.push(json);
      historyPositionRef.current = historyRef.current.length - 1;
      
      // Save to localStorage with a new timestamp
      saveToLocalStorage(json);
      
      // Broadcast the change with current timestamp and specific action type
      if (roomId && currentUser) {
        collaborationManager.sendMessage({
          type: 'drawing-data-update',
          roomId,
          userId: currentUser.id,
          userName: currentUser.name,
          drawingData: JSON.stringify(json),
          timestamp: new Date().toISOString(),
          action: 'delete'
        });
      }
      
      // Reset the ignoreSyncRef flag after a delay
      setTimeout(() => {
        ignoreSyncRef.current = false;
      }, 100);
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
        <canvas ref={canvasElRef} width="900" height="600" className="drawing-canvas" />
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
