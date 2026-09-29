import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface SeatMap3DProps {
  onClose: () => void;
  targetRow: number;
  targetCol: number;
}

export default function SeatMap3D({ onClose, targetRow, targetCol }: SeatMap3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [loadingMsg, setLoadingMsg] = useState('Initializing Environment...');

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    // Use much lower density fog so it doesn't black out the scene at a distance
    scene.fog = new THREE.FogExp2(0x0a0f18, 0.002);
    
    // Add fallback lighting in case HDRI fails or loads slowly
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 50, 20);
    scene.add(dirLight);

    const camera = new THREE.PerspectiveCamera(50, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 2000);
    // Initial camera position very high up to see the floor
    camera.position.set(0, 150, 200);
    
    // Target position for camera zoom animation
    const targetCameraPos = new THREE.Vector3(0, 150, 200);
    const targetLookAt = new THREE.Vector3(0, 0, 0);
    let isAnimating = false;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Enable physical lighting
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);

    // 2. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; 
    controls.minDistance = 2;
    controls.maxDistance = 500;
    // Map LEFT click drag to DOLLY (Zoom) as requested "mouse drag hote he wo zoom ho"
    // Map RIGHT click drag to ROTATE
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.DOLLY,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.ROTATE 
    };
    controls.enableZoom = true;
    controls.zoomSpeed = 1.5;

    // Stop programmatic animation when user interacts
    controls.addEventListener('start', () => {
      isAnimating = false;
    });

    // 3. Environment & Lighting (Instant Load without external files)
    scene.background = new THREE.Color(0x0a0f18);
    // Remove loading overlay immediately since there are no external models
    setLoadingMsg('');

    // 4. Materials using Physical Properties for Glassmorphism & HDRI Reflections
    const regularSeatMat = new THREE.MeshPhysicalMaterial({
      color: 0x0ea5e9,
      metalness: 0.1,
      roughness: 0.2,
      transmission: 0.9, // glass-like transparency
      ior: 1.5,
      thickness: 0.5,
      transparent: true,
      opacity: 1.0,
      envMapIntensity: 1.0,
    });

    const highlightSeatMat = new THREE.MeshPhysicalMaterial({
      color: 0xffaa00,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.2,
      ior: 1.5,
      thickness: 0.5,
      emissive: 0xffaa00,
      emissiveIntensity: 2.0,
      transparent: true,
      opacity: 1.0,
      envMapIntensity: 2.0,
    });

    // Desks/Tables material
    const deskMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.5,
      roughness: 0.4,
      envMapIntensity: 0.8,
      clearcoat: 0.5,
    });

    const seatGeo = new THREE.BoxGeometry(0.8, 0.4, 0.8);
    const deskGeo = new THREE.BoxGeometry(1.2, 0.8, 0.6);

    const seatsGroup = new THREE.Group();
    const rows = 10;
    const cols = 15;
    const spacingX = 2.5;
    const spacingZ = 3.0;
    
    // Store meshes for raycasting interactions
    const interactableObjects: THREE.Mesh[] = [];
    
    const targetSeatPosition = new THREE.Vector3();

    for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
        const isTarget = (r === targetRow - 1 && c === targetCol - 1); // Dynamic target
        const x = (c - cols/2) * spacingX + spacingX/2;
        const z = (r - rows/2) * spacingZ + spacingZ/2;

        // Seat
        const seat = new THREE.Mesh(seatGeo, isTarget ? highlightSeatMat : regularSeatMat);
        seat.position.set(x, 0.2, z + 0.5); // slightly behind desk
        seat.userData = { isTarget, row: r+1, seatNum: c+1 };
        seatsGroup.add(seat);
        interactableObjects.push(seat);

        // Desk
        const desk = new THREE.Mesh(deskGeo, deskMat);
        desk.position.set(x, 0.4, z);
        seatsGroup.add(desk);

        if(isTarget) {
          targetSeatPosition.copy(seat.position);
          
          // Add a massive glowing beacon above target seat
          const beaconGeo = new THREE.CylinderGeometry(0.2, 2.0, 50, 32, 1, true);
          const beaconMat = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.4,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
          });
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(x, 25, z + 0.5);
          seatsGroup.add(beacon);

          // Add a very bright point light pointing down at the seat
          const pointLight1 = new THREE.PointLight(0xffaa00, 200, 50);
          pointLight1.position.set(x, 10, z + 0.5);
          scene.add(pointLight1);
          
          // Add a closer light for immediate bright glow
          const pointLight2 = new THREE.PointLight(0xffaa00, 50, 10);
          pointLight2.position.set(x, 1, z + 0.5);
          scene.add(pointLight2);
        }
      }
    }
    scene.add(seatsGroup);

    // Outer Campus Floor
    const outerFloorGeo = new THREE.PlaneGeometry(1000, 1000);
    const outerFloorMat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      roughness: 0.8,
      metalness: 0.2,
    });
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.1;
    scene.add(outerFloor);

    // Classroom Floor (Slightly reflective)
    const floorGeo = new THREE.PlaneGeometry(80, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.1,
      metalness: 0.5,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);
    
    // Classroom Walls (transparent from top)
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide
    });
    const wallGeoX = new THREE.PlaneGeometry(80, 10);
    const wallGeoZ = new THREE.PlaneGeometry(60, 10);
    
    const wall1 = new THREE.Mesh(wallGeoX, wallMat);
    wall1.position.set(0, 5, -30);
    scene.add(wall1);
    
    const wall2 = new THREE.Mesh(wallGeoX, wallMat);
    wall2.position.set(0, 5, 30);
    scene.add(wall2);
    
    const wall3 = new THREE.Mesh(wallGeoZ, wallMat);
    wall3.rotation.y = Math.PI / 2;
    wall3.position.set(-40, 5, 0);
    scene.add(wall3);
    
    const wall4 = new THREE.Mesh(wallGeoZ, wallMat);
    wall4.rotation.y = Math.PI / 2;
    wall4.position.set(40, 5, 0);
    scene.add(wall4);

    // 5. Interaction (Click to zoom to any seat)
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: MouseEvent) => {
      // Only handle left clicks for selecting
      if (event.button !== 0) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(interactableObjects);

      if (intersects.length > 0) {
        const object = intersects[0].object;
        // Set new camera target
        targetLookAt.copy(object.position);
        
        // Calculate new camera position (zoomed in, slightly above and behind)
        const offset = new THREE.Vector3(0, 3, 5);
        targetCameraPos.copy(object.position).add(offset);
        isAnimating = true;
        
        // Update beacon or highlight could be added here
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Just initialize empty timer to avoid undefined
    const initialTimer = setTimeout(() => {}, 0);

    // 6. Animation
    const clock = new THREE.Clock();
    let reqId: number;

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Pulsate highlight seat
      highlightSeatMat.emissiveIntensity = 0.5 + Math.sin(elapsedTime * 4) * 0.3;

      // Smoothly animate camera position and lookat for zooming effect only if animating
      if (isAnimating) {
        camera.position.lerp(targetCameraPos, 0.05);
        controls.target.lerp(targetLookAt, 0.05);
        if (camera.position.distanceTo(targetCameraPos) < 0.1) {
          isAnimating = false;
        }
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 7. Resize
    const handleResize = () => {
      if(!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      controls.dispose();
      clearTimeout(initialTimer);
      cancelAnimationFrame(reqId);
      if(mountRef.current) mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
      floorGeo.dispose();
      floorMat.dispose();
      seatGeo.dispose();
      deskGeo.dispose();
      regularSeatMat.dispose();
      highlightSeatMat.dispose();
      deskMat.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl w-full max-w-6xl h-[85vh] overflow-hidden relative shadow-xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/80 dark:bg-slate-900/80 z-10 backdrop-blur-md">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center tracking-tight">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mr-2.5 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              HDRI Campus & Classroom View
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">Block A - Hall 3 | Target: Row {targetRow}, Seat {targetCol}</p>
          </div>
          <button 
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md transition-colors border border-slate-200 dark:border-slate-700 font-medium text-sm"
          >
            Close Map
          </button>
        </div>
        
        {/* Loading Overlay */}
        {loadingMsg && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 z-20 backdrop-blur-sm">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-900 dark:text-white font-semibold">{loadingMsg}</p>
            </div>
          </div>
        )}

        {/* 3D Container */}
        <div ref={mountRef} className="flex-grow w-full relative cursor-crosshair bg-[#0f172a]">
           <div className="absolute bottom-6 left-6 text-sm pointer-events-none bg-slate-900/80 p-5 rounded-xl border border-slate-700/50 backdrop-blur-md shadow-lg">
              <p className="font-bold text-white mb-3 uppercase tracking-wider text-xs">Map Controls</p>
              <ul className="space-y-2 text-slate-300">
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-primary-500 mr-2"></span> <span className="text-primary-400 font-semibold mr-1">Left Drag:</span> Zoom In/Out</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-primary-500 mr-2"></span> <span className="text-primary-400 font-semibold mr-1">Right Drag:</span> Rotate View</li>
                <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-primary-500 mr-2"></span> <span className="text-primary-400 font-semibold mr-1">Scroll:</span> Zoom in/out of the Campus</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
}
