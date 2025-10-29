import { useState, useEffect } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { motion, AnimatePresence } from "framer-motion";
import Titlebar from "./components/Titlebar";
import "./App.css";
import "./components/titlebar.css"
import Sidebar from "./components/Sidebar";
// import Loader from "./loader/Loader";
import Home from "./tabs/home";
// import History from "./tabs/history";
// import Log from "./tabs/log";
// import Settings from "./tabs/settings";

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [showMainApp, setShowMainApp] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [initResult, setInitResult] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    
    // Log tab switch
    if (window.logUIEvent) {
      window.logUIEvent(`Switched to ${tab.charAt(0).toUpperCase() + tab.slice(1)} tab`);
    }
  };

  const handleLoadComplete = async (result) => {
    setInitResult(result);
    
    const appWindow = getCurrentWindow();
    
    // Start window expansion animation using LogicalSize
    await appWindow.setSize(new LogicalSize(1100, 600));
    
    // Small delay to let window resize complete
    setTimeout(() => {
      setIsLoading(false);
      setTimeout(() => {
        setShowMainApp(true);
        
        // Show warning if model or database is missing
        if (result && (!result.has_model || !result.has_database)) {
          setShowWarning(true);
        }
      }, 100);
    }, 300);
  };

  const renderTab = () => {
    // Render all tabs but only show the active one to preserve state
    return (
      <>
        <div style={{ display: activeTab === 'home' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <Home />
        </div>
        <div style={{ display: activeTab === 'gallery' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <History isActive={activeTab === 'gallery'} />
        </div>
        <div style={{ display: activeTab === 'log' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <Log />
        </div>
        <div style={{ display: activeTab === 'settings' ? 'block' : 'none', width: '100%', height: '100%' }}>
          <Settings initResult={initResult} />
        </div>
      </>
    );
  };

  if (isLoading) {
    return <Loader onLoadComplete={handleLoadComplete} />;
  }

  return (
    <AnimatePresence>
      {showMainApp && (
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Titlebar />
          <Sidebar activeTab={activeTab} setActiveTab={handleTabChange} />
          <div className="main-content">
            {showWarning && (
              <motion.div
                className="warning-banner"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="warning-content">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span>
                    {!initResult?.has_model && "Model not found. "}
                    {!initResult?.has_database && "Database initialized. "}
                    Please check Settings.
                  </span>
                  <button onClick={() => setShowWarning(false)}>✕</button>
                </div>
              </motion.div>
            )}
            <div style={{ width: '100%', height: showWarning ? 'calc(100% - 45px)' : '100%' }}>
              {renderTab()}
            </div>
          </div>
        </motion.main>
      )}
    </AnimatePresence>
  );
}

export default App;
