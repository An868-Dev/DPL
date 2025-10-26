import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import "./titlebar.css";

export default function Titlebar() {
  const winRef = useRef(null);

  useEffect(() => {
    // Initialize window reference after component mounts
    winRef.current = getCurrentWindow();
  }, []);

  const handleClose = async () => {
    if (winRef.current) await winRef.current.close();
  };

  const handleMinimize = async () => {
    if (winRef.current) await winRef.current.minimize();
  };

  const handleZoom = async () => {
    if (winRef.current) {
      const isMax = await winRef.current.isMaximized();
      isMax ? await winRef.current.unmaximize() : await winRef.current.maximize();
    }
  };

  return (
    <>
      <div className="titlebar">
        <div data-tauri-drag-region />
        <div className="app-title">A N I C L A</div>
        <div className="controls">
          <button 
            id="titlebar-minimize" 
            title="minimize"
            onClick={handleMinimize}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path fill="white" d="M19 13H5v-2h14z" />
            </svg>
          </button>
          <button 
            id="titlebar-maximize" 
            title="maximize"
            onClick={handleZoom}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path fill="white" d="M4 4h16v16H4zm2 4v10h12V8z" />
            </svg>
          </button>
          <button 
            id="titlebar-close" 
            title="close"
            onClick={handleClose}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
            >
              <path
                fill="white"
                d="M13.46 12L19 17.54V19h-1.46L12 13.46L6.46 19H5v-1.46L10.54 12L5 6.46V5h1.46L12 10.54L17.54 5H19v1.46z"
              />
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
