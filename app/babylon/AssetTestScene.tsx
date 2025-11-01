'use client';

import { useEffect, useRef, useState } from 'react';
import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, SceneLoader, Color4, Mesh } from '@babylonjs/core';

// Import GLTF loader - this registers the loader automatically
import '@babylonjs/loaders';

export default function AssetTestScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAssets, setLoadedAssets] = useState<string[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create engine
    const engine = new Engine(canvasRef.current, true);

    // Create scene
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

    // Create camera
    const camera = new ArcRotateCamera(
      'camera',
      -Math.PI / 2, // Alpha
      Math.PI / 2.5, // Beta
      18, // Radius - increased to see all models better
      new Vector3(0, 2, 0), // Target
      scene
    );

    // Attach camera controls
    camera.attachControl(canvasRef.current, true);

    // Create light
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    // Add a second light from the front
    const light2 = new HemisphericLight('light2', new Vector3(0, 0, -1), scene);
    light2.intensity = 0.3;

    // Helper function to calculate bounding box of all meshes
    const getBoundingBox = (meshes: Mesh[]) => {
      if (meshes.length === 0) return null;
      
      let min = meshes[0].getBoundingInfo().boundingBox.minimumWorld.clone();
      let max = meshes[0].getBoundingInfo().boundingBox.maximumWorld.clone();
      
      meshes.forEach(mesh => {
        if (mesh instanceof Mesh) {
          const boundingInfo = mesh.getBoundingInfo();
          const meshMin = boundingInfo.boundingBox.minimumWorld;
          const meshMax = boundingInfo.boundingBox.maximumWorld;
          
          min = Vector3.Minimize(min, meshMin);
          max = Vector3.Maximize(max, meshMax);
        }
      });
      
      const size = max.subtract(min);
      return { min, max, size };
    };

    // Load assets with scaling
    const loadAsset = async (
      folderPath: string, 
      fileName: string, 
      position: Vector3, 
      name: string,
      targetSize: number = 2 // Target size in Babylon units (default 2 units)
    ) => {
      try {
        // Base URL should be the folder containing the GLTF file
        // This ensures textures are loaded relative to the GLTF file location
        const baseUrl = `/assets/${folderPath}/`;
        const result = await SceneLoader.ImportMeshAsync(
          '', // Load all meshes
          baseUrl, // Base URL - points to the folder containing the GLTF
          fileName, // File name (e.g., "scene.gltf")
          scene
        );

        if (result.meshes.length > 0) {
          // Get all meshes (filter out any non-mesh objects)
          const meshes = result.meshes.filter(m => m instanceof Mesh) as Mesh[];
          
          if (meshes.length === 0) {
            console.warn(`⚠️ ${name} loaded but has no valid meshes`);
            return;
          }

          // Find the root mesh (usually the first one or one without parent)
          const rootMesh = result.meshes.find(mesh => !mesh.parent) || result.meshes[0];
          
          // Calculate bounding box to determine current size
          const boundingBox = getBoundingBox(meshes);
          
          if (boundingBox) {
            // Calculate the largest dimension (width, height, or depth)
            const currentSize = Math.max(
              Math.abs(boundingBox.size.x),
              Math.abs(boundingBox.size.y),
              Math.abs(boundingBox.size.z)
            );
            
            // Calculate scale factor to normalize to target size
            const scaleFactor = targetSize / currentSize;
            
            // Apply scaling to root mesh or parent if it exists
            if (rootMesh.parent && 'scaling' in rootMesh.parent) {
              rootMesh.parent.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
            } else {
              rootMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
            }
            
            console.log(`✅ ${name}: scaled from ${currentSize.toFixed(2)} to ${targetSize} (factor: ${scaleFactor.toFixed(2)})`);
          }
          
          // Position the root mesh
          rootMesh.position = position;
          
          // If the root has a parent transform node, position that instead
          if (rootMesh.parent && 'position' in rootMesh.parent) {
            rootMesh.parent.position = position;
            rootMesh.position = Vector3.Zero();
          }
          
          setLoadedAssets(prev => [...prev, name]);
          console.log(`✅ Loaded ${name}: ${result.meshes.length} mesh(es) at ${position.toString()}`);
        } else {
          console.warn(`⚠️ ${name} loaded but has no meshes`);
        }
      } catch (error) {
        console.error(`❌ Error loading ${name}:`, error);
        if (error instanceof Error) {
          console.error(`Error details: ${error.message}`);
        }
      }
    };

    // Load all assets from their respective folders
    // Pass folder path and filename separately so textures load correctly
    // Target sizes: adjust these to make models appear similar in scale
    Promise.all([
      loadAsset('recurve_bow', 'scene.gltf', new Vector3(-4, 1, 0), 'Recurve Bow', 2.5), // Bow - slightly larger
      loadAsset('arrow', 'scene.gltf', new Vector3(0, 1, 0), 'Arrow', 5), // Arrow - smaller (it's a small object)
      loadAsset('target', 'scene.gltf', new Vector3(4, 1, 0), 'Target', 3), // Target - largest
    ]).then(() => {
      setLoading(false);
      console.log('All assets loaded!');
    });

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      engine.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-screen">
      <canvas
        ref={canvasRef}
        className="w-full h-screen"
        style={{ width: '100%', height: '100vh', display: 'block' }}
      />
      {loading && (
        <div className="absolute top-4 left-4 bg-black/70 text-white p-4 rounded-lg">
          <p>Loading assets...</p>
        </div>
      )}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg max-w-xs">
        <h3 className="font-bold mb-2">Loaded Assets:</h3>
        <ul className="list-disc list-inside space-y-1">
          {loadedAssets.length === 0 && <li>None yet...</li>}
          {loadedAssets.map((asset) => (
            <li key={asset} className="text-green-400">✓ {asset}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-300">
          Use mouse to rotate camera<br />
          Scroll to zoom
        </p>
      </div>
    </div>
  );
}
