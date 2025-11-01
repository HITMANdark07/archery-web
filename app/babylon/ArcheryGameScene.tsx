'use client';

import { useEffect, useRef, useState } from 'react';
import { Engine, Scene, FreeCamera, HemisphericLight, Vector3, SceneLoader, Color4, Mesh, MeshBuilder, StandardMaterial, Color3 } from '@babylonjs/core';

// Import GLTF loader - this registers the loader automatically
import '@babylonjs/loaders';

export default function ArcheryGameScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAssets, setLoadedAssets] = useState<string[]>([]);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Create engine
    const engine = new Engine(canvasRef.current, true);

    // Create scene
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.53, 0.81, 0.92, 1); // Sky blue background

    // Create first-person camera (archer's perspective)
    // Position at eye level (1.6m high) looking forward
    const camera = new FreeCamera('camera', new Vector3(0, 1.6, 0), scene);
    camera.setTarget(new Vector3(0, 1.6, 1)); // Look forward
    camera.attachControl(canvasRef.current, true);
    
    // Disable keyboard movement (we don't want player walking)
    camera.keysUp = [];
    camera.keysDown = [];
    camera.keysLeft = [];
    camera.keysRight = [];
    camera.speed = 0; // Disable WASD movement
    
    // Allow mouse look (rotation)
    // This is enabled by default with attachControl

    // Create lighting
    const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.8;

    // Add directional light (sun)
    const dirLight = new HemisphericLight('dirLight', new Vector3(0.5, -1, 0.5), scene);
    dirLight.intensity = 0.5;

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

    // Load and position asset
    const loadAsset = async (
      folderPath: string, 
      fileName: string, 
      position: Vector3, 
      rotation: Vector3,
      name: string,
      targetSize: number = 2
    ) => {
      try {
        const baseUrl = `/assets/${folderPath}/`;
        const result = await SceneLoader.ImportMeshAsync(
          '',
          baseUrl,
          fileName,
          scene
        );

        if (result.meshes.length > 0) {
          const meshes = result.meshes.filter(m => m instanceof Mesh) as Mesh[];
          
          if (meshes.length === 0) {
            console.warn(`⚠️ ${name} loaded but has no valid meshes`);
            return null;
          }

          const rootMesh = result.meshes.find(mesh => !mesh.parent) || result.meshes[0];
          
          // Calculate bounding box and scale
          const boundingBox = getBoundingBox(meshes);
          
          if (boundingBox) {
            const currentSize = Math.max(
              Math.abs(boundingBox.size.x),
              Math.abs(boundingBox.size.y),
              Math.abs(boundingBox.size.z)
            );
            
            const scaleFactor = targetSize / currentSize;
            
            if (rootMesh.parent && 'scaling' in rootMesh.parent) {
              rootMesh.parent.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
            } else {
              rootMesh.scaling = new Vector3(scaleFactor, scaleFactor, scaleFactor);
            }
          }
          
          // Position and rotate
          if (rootMesh.parent && 'position' in rootMesh.parent) {
            rootMesh.parent.position = position;
            if ('rotation' in rootMesh.parent) {
              rootMesh.parent.rotation = rotation;
            }
            rootMesh.position = Vector3.Zero();
          } else {
            rootMesh.position = position;
            rootMesh.rotation = rotation;
          }
          
          setLoadedAssets(prev => [...prev, name]);
          console.log(`✅ Loaded ${name} at ${position.toString()}`);
          return rootMesh;
        }
      } catch (error) {
        console.error(`❌ Error loading ${name}:`, error);
      }
      return null;
    };

    // Create ground plane
    const ground = MeshBuilder.CreateGround('ground', { width: 50, height: 50 }, scene);
    const groundMat = new StandardMaterial('groundMat', scene);
    groundMat.diffuseColor = new Color3(0.3, 0.5, 0.3); // Green grass color
    ground.material = groundMat;
    ground.position.y = 0;

    // Load assets
    Promise.all([
      loadAsset(
        'recurve_bow', 
        'scene.gltf', 
        new Vector3(0, 1.4, 0.5), // Bow in front of camera, slightly lower
        new Vector3(0, 0, 0), 
        'Recurve Bow', 
        0.8
      ),
      loadAsset(
        'target', 
        'scene.gltf', 
        new Vector3(0, 1.5, 20), // Target far away, at eye level
        new Vector3(0, 0, 0), 
        'Target', 
        3
      ),
    ]).then((results) => {
      setLoading(false);
      console.log('Game scene loaded!');
      
      // Store references for later use
      const bow = results[0];
      const target = results[1];
      
      if (bow) {
        // Make bow parented to camera (so it moves with camera)
        // For now, just position it. We'll add parent-child relationship later if needed
        console.log('Bow ready for shooting mechanics');
      }
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
          <p>Loading game scene...</p>
        </div>
      )}
      <div className="absolute top-4 right-4 bg-black/70 text-white p-4 rounded-lg max-w-xs">
        <h3 className="font-bold mb-2">Archery Game</h3>
        <ul className="list-disc list-inside space-y-1">
          {loadedAssets.length === 0 && <li>Loading assets...</li>}
          {loadedAssets.map((asset) => (
            <li key={asset} className="text-green-400">✓ {asset}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-300">
          Use mouse to look around<br />
          Ready for shooting mechanics
        </p>
      </div>
    </div>
  );
}
