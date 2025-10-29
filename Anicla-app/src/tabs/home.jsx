import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { convertFileSrc } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import './home.css';

export default function Home() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [result, setResult] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    loadAutoSaveSetting();
    
    // Listen for auto-save setting changes
    let unlistenSettings;
    let unlistenDragDrop;
    
    const setupListeners = async () => {
      // Settings listener
      unlistenSettings = await listen('setting-changed', (event) => {
        if (event.payload.key === 'autoSave') {
          setAutoSave(event.payload.value);
        }
      });
      
      // Tauri drag & drop listener
      const webview = getCurrentWebviewWindow();
      unlistenDragDrop = await webview.onDragDropEvent((event) => {
        if (event.payload.type === 'drop' && event.payload.paths && event.payload.paths.length > 0) {
          const filePath = event.payload.paths[0];
          handleFileDropped(filePath);
          
          if (window.logUIEvent) {
            window.logUIEvent('File uploaded via drag & drop');
          }
        } else if (event.payload.type === 'over') {
          setIsDragging(true);
        } else if (event.payload.type === 'leave' || event.payload.type === 'cancel') {
          setIsDragging(false);
        }
      });
    };
    
    setupListeners();
    
    // Log component mount
    if (window.logUIEvent) {
      window.logUIEvent('Home tab rendered');
    }
    
    return () => {
      if (unlistenSettings) {
        unlistenSettings();
      }
      if (unlistenDragDrop) {
        unlistenDragDrop();
      }
    };
  }, []);

  const loadAutoSaveSetting = async () => {
    try {
      const configJson = await invoke('load_config');
      const config = JSON.parse(configJson);
      if (config.autoSave !== undefined) {
        setAutoSave(config.autoSave);
      }
    } catch (error) {
      console.error('Failed to load auto-save setting:', error);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set dragging to false if we're leaving the upload zone itself
    // Check if the related target is outside the upload zone
    const uploadZone = e.currentTarget;
    const relatedTarget = e.relatedTarget;
    
    if (!relatedTarget || !uploadZone.contains(relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
      
      // Log the drop event
      if (window.logUIEvent) {
        window.logUIEvent('File uploaded via drag & drop');
      }
    }
  };

  const handleFileSelect = (selectedFile) => {
    const fileType = selectedFile.type;
    const isVideoFile = fileType.startsWith('video/');
    
    setFile(selectedFile);
    setIsVideo(isVideoFile);
    setResult('');
    
    // Log UI event
    if (window.logUIEvent) {
      window.logUIEvent(`File selected: ${selectedFile.name} (${isVideoFile ? 'video' : 'image'})`);
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleFileDropped = async (filePath) => {
    try {
      // Determine file type from extension
      const extension = filePath.split('.').pop().toLowerCase();
      const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'];
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
      
      let mimeType = '';
      let isVideoFile = false;
      
      if (videoExtensions.includes(extension)) {
        isVideoFile = true;
        mimeType = `video/${extension === 'mov' ? 'quicktime' : extension}`;
      } else if (imageExtensions.includes(extension)) {
        isVideoFile = false;
        mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
      } else {
        console.error('Unsupported file type');
        return;
      }
      
      // Get file size from the file system
      const fileSize = await invoke('get_file_size', { path: filePath });
      
      // Convert the file path to an asset URL that can be used by the browser
      const assetUrl = convertFileSrc(filePath);
      const fileName = filePath.split('/').pop().split('\\').pop();
      
      // Set the file info and preview directly
      setFile({ name: fileName, type: mimeType, path: filePath, size: fileSize });
      setIsVideo(isVideoFile);
      setPreview(assetUrl);
      setResult('');
      
      // Log UI event
      if (window.logUIEvent) {
        window.logUIEvent(`File selected: ${fileName} (${isVideoFile ? 'video' : 'image'})`);
      }
    } catch (error) {
      console.error('Error processing dropped file:', error);
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleClassify = async () => {
    if (!file) return;
    
    setIsClassifying(true);
    
    // Log UI event
    if (window.logUIEvent) {
      window.logUIEvent('Started classification process');
    }
    
    try {
      let fileData;
      
      // Check if file has a path (Tauri drag & drop) or is a File object (browser file input)
      if (file.path) {
        // File uploaded via Tauri - read from path
        const fileBytes = await invoke('read_file_bytes', { path: file.path });
        fileData = fileBytes;
      } else {
        // File from browser file input
        const arrayBuffer = await file.arrayBuffer();
        fileData = Array.from(new Uint8Array(arrayBuffer));
      }
      
      // Save file to backend
      const hash = await invoke('save_media_file', {
        fileData,
        originalName: file.name,
      });
      
      // Generate thumbnail
      await invoke('generate_thumbnail', {
        hash,
        isVideo,
      });
      
      // Get actual media info (resolution and duration)
      const mediaInfo = await invoke('get_media_info', {
        hash,
        isVideo,
      });
      
      // TODO: Actual classification logic
      // For now, mock result
      const mockResult = isVideo ? "Animation Video" : "Anime Character";
      setResult(mockResult);
      
      // Log UI event
      if (window.logUIEvent) {
        window.logUIEvent(`Classification complete: ${mockResult}`);
      }
      
      // Save to database only if auto-save is enabled
      if (autoSave) {
        const mediaEntry = {
          name: file.name,
          hashed_name: hash,
          stime: new Date().toISOString(),
          result: mockResult,
          media_type: isVideo ? "Video" : "Image",
          res: mediaInfo.resolution,
          duration: mediaInfo.duration,
          size: file.size,
          original_path: null,
          hash_path: `library/${hash}/`,
          thumb_source: "generated",
        };
        
        await invoke('add_media_entry', { entry: mediaEntry });
      }
      
    } catch (error) {
      console.error('Classification error:', error);
      setResult('Error: ' + error.toString());
    } finally {
      setIsClassifying(false);
    }
  };

  const handleNewUpload = () => {
    setFile(null);
    setPreview(null);
    setResult('');
    setIsVideo(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="home-tab">
      <div className="home-header">
        <h2>Home</h2>
      </div>
      
      <div className="home-content">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="upload"
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`upload-zone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="1">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <h3>Upload Image or Video</h3>
              <p>Drag & drop or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={false}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="preview-zone"
            >
              {isVideo ? (
                <video
                  ref={videoRef}
                  src={preview}
                  controls
                  loop
                  className="preview-media"
                />
              ) : (
                <img src={preview} alt="Preview" className="preview-media" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {file && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="result-section"
          >
            {result && (
              <div className="result-box">
                <h4>Classification Result:</h4>
                <p>{result}</p>
              </div>
            )}

            <div className="action-buttons">
              <button
                className={`btn-primary ${isClassifying ? 'loading' : ''}`}
                onClick={result ? handleClassify : handleClassify}
                disabled={isClassifying}
              >
                {isClassifying ? (
                  <>
                    <span className="spinner"></span>
                    <span>Classifying...</span>
                  </>
                ) : result ? (
                  <span>Retry</span>
                ) : (
                  <span>Start Classification</span>
                )}
              </button>
              <button className="btn-secondary" onClick={handleNewUpload}>
                New Upload
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}