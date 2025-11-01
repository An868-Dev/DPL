import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import './log.css';

export default function Log() {
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const [devConsoleEnabled, setDevConsoleEnabled] = useState(false);
  const [uiEventsEnabled, setUiEventsEnabled] = useState(true);

    return (
    <div className="log-tab">
      <div className="log-header">
        <div className="log-title">
          <h2>Console</h2>
          <span className="log-count">{logs.length} entries</span>
        </div>
        <button className="clear-button" onClick={clearLogs}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Clear
        </button>
      </div>

      <div className={`log-console ${!devConsoleEnabled ? 'blurred' : ''}`}>
        {!devConsoleEnabled ? (
          <div className="blur-overlay">
            <p>Developer console is disabled.</p>
            <p>Enable it in Settings &gt; Advanced.</p>
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`log-entry log-${log.level}`}>
              <span className="log-icon">{getLogIcon(log.level)}</span>
              <span className="log-time">{log.timestamp}</span>
              <span className="log-source">[{log.source}]</span>
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}