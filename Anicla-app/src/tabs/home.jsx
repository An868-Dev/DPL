import { motion, AnimatePresence } from 'framer-motion';
import './home.css';

export default function Home() {
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
                    Classifying...
                  </>
                ) : result ? (
                  'Retry'
                ) : (
                  'Start Classification'
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