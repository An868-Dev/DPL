import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import * as THREE from 'three';
import './Loader.css';

const Loader = ({ onLoadComplete }) => {
  const containerRef = useRef(null);
  const [componentsLoaded, setComponentsLoaded] = useState(false);
  const [initResult, setInitResult] = useState(null);
  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isInitialized = useRef(false);
  const hasCalledComplete = useRef(false);
  const geometryRef = useRef(null);
  const materialRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || isInitialized.current) return;
    
    console.log('Initializing loader...');
    isInitialized.current = true;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 3;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0); // Transparent background
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Create icosahedron wireframe
    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      wireframeLinewidth: 2
    });
    geometryRef.current = geometry;
    materialRef.current = material;
    
    const icosahedron = new THREE.Mesh(geometry, material);
    
    // Rotate to face-forward view
    icosahedron.rotation.x = 0;
    icosahedron.rotation.y = 0;
    icosahedron.rotation.z = Math.PI / 2;
    
    scene.add(icosahedron);

    // Animation loop with auto-rotation
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      icosahedron.rotation.y += 0.01; // Rotate left to right
      renderer.render(scene, camera);
    };
    animate();
    
    console.log('Animation started');

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Initialize backend
    const initializeBackend = async () => {
      try {
        console.log('Calling initialize_app...');
        const result = await invoke('initialize_app');
        console.log('Backend initialized:', result);
        setInitResult(result);
        setComponentsLoaded(true);
      } catch (error) {
        console.error('Failed to initialize app:', error);
        setInitResult({ success: false, message: error.toString() });
        setComponentsLoaded(true);
      }
    };

    initializeBackend();

    // Cleanup
    return () => {
      console.log('Cleaning up loader...');
      window.removeEventListener('resize', handleResize);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (containerRef.current && rendererRef.current && rendererRef.current.domElement) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) {
          // Element might already be removed
        }
      }
      
      if (geometryRef.current) geometryRef.current.dispose();
      if (materialRef.current) materialRef.current.dispose();
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      sceneRef.current = null;
      rendererRef.current = null;
      isInitialized.current = false;
    };
  }, []);

  // After components are loaded, wait 5 seconds then trigger completion
  useEffect(() => {
    console.log('Timer effect - componentsLoaded:', componentsLoaded, 'hasCalledComplete:', hasCalledComplete.current);
    if (componentsLoaded && !hasCalledComplete.current) {
      console.log('Starting 5-second timer...');
      const timer = setTimeout(() => {
        console.log('Timer complete, calling onLoadComplete');
        hasCalledComplete.current = true;
        onLoadComplete(initResult);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [componentsLoaded, onLoadComplete, initResult]);

  return (
    <div className="loader-container">
      <div ref={containerRef} className="loader-canvas" />
      <div className="loader-text">✦ Getting things ready ✦</div>
    </div>
  );
};

export default Loader;
