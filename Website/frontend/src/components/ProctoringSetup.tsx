import { useState, useEffect, useRef } from 'react';
import { Camera, Mic, MonitorPlay, AlertTriangle, CheckCircle, Smartphone, UserCheck, X } from 'lucide-react';
import * as faceapi from 'face-api.js';

export default function ProctoringSetup({ onComplete, onClose }: { onComplete: (stream: MediaStream | null) => void; onClose?: () => void }) {
  const [step, setStep] = useState(() => {
    const savedStep = sessionStorage.getItem('proctoring_step');
    return savedStep ? parseInt(savedStep, 10) : 1;
  });
  const [, setPermissions] = useState({
    camera: false,
    mic: false,
    screen: false, 
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceStatus, setFaceStatus] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('proctoring_step', step.toString());
  }, [step]);

  useEffect(() => {
    if (step > 1 && !stream) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(mediaStream => {
          setStream(mediaStream);
          setPermissions(prev => ({ ...prev, camera: true, mic: true }));
        })
        .catch(err => {
          console.error("Failed to auto-restore media stream:", err);
          setStep(1);
        });
    }
  }, [step, stream]);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://127.0.0.1:5000' : `https://zup-exam-backend-42.loca.lt`);

  // 1. Camera & Mic Access
  const requestMedia = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      setPermissions(prev => ({ ...prev, camera: true, mic: true }));
      setStep(2);
    } catch (err) {
      console.error(err);
      if (!navigator.mediaDevices) {
        alert("Camera access is blocked. This usually happens if you are not using a secure connection (HTTPS) or localhost.");
      } else {
        alert("Camera and Microphone permissions are strictly required for the exam. Please allow them in your browser settings.");
      }
    }
  };

  // Attach camera stream when stepping to 3 or 4
  useEffect(() => {
    if ((step === 3 || step === 4) && stream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = stream;
    }
  }, [step, stream]);

  // 2. Tab Change / Blur Detection Setup (will be active during exam)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn("WARNING: Tab changed! This violation is recorded.");
        alert("SECURITY WARNING: You changed the tab! Activity has been flagged to the invigilator.");
      }
    };
    
    const handleBlur = () => {
      console.warn("WARNING: Window lost focus!");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // 3. Screen & External Device Constraint
  const enforceEnvironment = async () => {
    try {
      // Enforce Fullscreen to prevent taskbar/casting access easily
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      
      // Chrome-specific: Check for multiple screens (Requires Window Placement permission)
      if ('getScreenDetails' in window) {
        // @ts-expect-error Screen Details API is not standard across all browsers
        const screenDetails = await window.getScreenDetails();
        if (screenDetails.screens.length > 1) {
          alert("SECURITY WARNING: Multiple displays detected. Please disconnect external monitors/HDMI to proceed.");
          return; // Block them
        }
      }
      
      setPermissions(prev => ({ ...prev, screen: true }));
      setStep(3);
    } catch (err) {
      console.log("Fullscreen or Screen Details API failed/denied.", err);
      // Fallback allowed for demo purposes
      setStep(3);
    }
  };

  const proceedToFaceVerification = () => {
    setStep(4);
    setFaceStatus('Loading AI Models...');
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setFaceStatus('Models Loaded. Please look straight at the camera.');
      } catch (err) {
        console.error(err);
        setFaceStatus('Failed to load AI models. Check connection.');
      }
    };
    loadModels();
  };

  const verifyIdentity = async () => {
    if (!videoRef.current) return;
    setIsVerifying(true);
    setFaceStatus('Analyzing face...');
    try {
      const email = localStorage.getItem('auth_email') || '';
      const name = email ? email.split('@')[0] : '';
      
      // Fetch student reference face
      const response = await fetch(`${BACKEND_URL}/api/students`);
      const students = await response.json();
      const student = students.find((s: any) => s.name.toLowerCase() === name.toLowerCase());

      if (!student || !student.referenceDescriptor) {
        setFaceStatus('No reference face found. Please contact Invigilator to capture your face first!');
        setIsVerifying(false);
        return;
      }

      const referenceDescriptor = new Float32Array(student.referenceDescriptor);

      // Use SsdMobilenetv1 with low confidence threshold (0.15) to detect faces in low light
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setFaceStatus('No face detected. Please ensure good lighting and look straight.');
        setIsVerifying(false);
        return;
      }

      // Calculate Euclidean distance
      const distance = faceapi.euclideanDistance(detection.descriptor, referenceDescriptor);
      
      // 0.65 is a relaxed threshold (industry standard is 0.60, 0.65 is more lenient for varying lighting/angles)
      if (distance < 0.65) {
        setFaceStatus('Identity Verified Successfully!');
        
        // Update student status to verified on backend
        try {
          await fetch(`${BACKEND_URL}/api/students/${student.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'verified' })
          });
        } catch (e) {
          console.error('Failed to update student verified status on backend:', e);
        }

        setTimeout(() => {
          onComplete(stream);
        }, 1500);
      } else {
        setFaceStatus(`Identity Verification Failed! Face does not match the registered student (Distance: ${distance.toFixed(2)}, match threshold: 0.65).`);
        setIsVerifying(false);
        
        // Report failure to backend
        fetch(`${BACKEND_URL}/api/cheat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name,
            message: `Identity Verification Failed (Distance: ${distance.toFixed(2)}). Unknown person attempting to start exam.`
          })
        }).catch(err => console.error(err));
      }
    } catch (err) {
      console.error(err);
      setFaceStatus('Error during verification.');
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl max-w-2xl w-full shadow-xl relative animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Strict Proctoring Setup</h2>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-650 dark:hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className="flex justify-between mb-8 relative">
          <div className="absolute top-5 left-10 right-10 h-[2px] bg-slate-100 dark:bg-slate-800 -z-10"></div>
          
          <div className={`flex flex-col items-center ${step >= 1 ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step >= 1 ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800/50 text-primary-600 dark:text-primary-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
              <Camera size={18} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">Media Access</span>
          </div>
          <div className={`flex flex-col items-center ${step >= 2 ? 'text-yellow-600 dark:text-yellow-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step >= 2 ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800/50 text-yellow-600 dark:text-yellow-500' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
              <MonitorPlay size={18} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">System Constraints</span>
          </div>
          <div className={`flex flex-col items-center ${step >= 3 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step >= 3 ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
              <Smartphone size={18} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">360° Scan</span>
          </div>
          <div className={`flex flex-col items-center ${step >= 4 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 border-2 ${step >= 4 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
              <UserCheck size={18} />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider">Face ID</span>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 mb-6">
          {step === 1 && (
            <div className="text-center animate-fade-in">
              <div className="bg-primary-100 dark:bg-primary-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-primary-600 dark:text-primary-400">
                <Mic size={28} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Camera & Microphone</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 max-w-md mx-auto">SAMADHAN X requires access to your camera and microphone to use AI Facial Tracking and Audio Anomaly Detection.</p>
              <button onClick={requestMedia} className="btn-primary w-full max-w-xs mx-auto py-2.5">Grant Permissions</button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center animate-fade-in">
              <div className="bg-yellow-100 dark:bg-yellow-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 dark:text-yellow-500">
                <AlertTriangle size={28} />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Strict Environment Policy</h3>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-4 mb-6 text-left max-w-md mx-auto border border-slate-200 dark:border-slate-800 shadow-sm">
                <ul className="text-slate-600 dark:text-slate-300 text-sm space-y-3 font-medium">
                  <li className="flex items-start"><span className="text-red-500 mr-2 mt-0.5 font-bold">•</span> Tab changing or minimizing the window is tracked and flagged.</li>
                  <li className="flex items-start"><span className="text-red-500 mr-2 mt-0.5 font-bold">•</span> Screen casting (HDMI/Miracast) will block the exam via Multi-Screen API.</li>
                  <li className="flex items-start"><span className="text-red-500 mr-2 mt-0.5 font-bold">•</span> Full-Screen mode will be enforced to lock you into the ecosystem.</li>
                </ul>
              </div>
              <div className="flex gap-4 justify-center max-w-md mx-auto">
                <button type="button" onClick={() => setStep(1)} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Back</button>
                <button type="button" onClick={enforceEnvironment} className="flex-2 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition-colors shadow-sm px-6">Acknowledge & Enforce</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center animate-fade-in">
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-56 bg-slate-950 rounded-lg mb-4 object-cover border border-emerald-200 dark:border-emerald-800 shadow-sm transform scale-x-[-1]"></video>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">360° Environment Scan</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">Please pick up your laptop or webcam and slowly rotate 360 degrees to verify your room environment is clear.</p>
              <div className="flex gap-4 justify-center max-w-md mx-auto">
                <button type="button" onClick={() => setStep(2)} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Back</button>
                <button type="button" onClick={proceedToFaceVerification} className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors shadow-sm flex justify-center items-center px-6">
                  <CheckCircle size={18} className="mr-2" />
                  Scan Complete - Next
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="text-center animate-fade-in">
              <div className="relative w-full h-56 mb-4">
                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full bg-slate-950 rounded-lg object-cover border border-blue-200 dark:border-blue-800 shadow-sm transform scale-x-[-1]"></video>
                {isVerifying && (
                  <div className="absolute inset-0 bg-slate-900/60 flex flex-col items-center justify-center rounded-lg backdrop-blur-sm text-white">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  </div>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Identity Verification</h3>
              <p className={`text-sm mb-6 font-medium ${faceStatus.includes('Failed') || faceStatus.includes('No reference') ? 'text-red-600 dark:text-red-400' : faceStatus.includes('Successfully') ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {faceStatus}
              </p>
              <div className="flex gap-4 justify-center max-w-md mx-auto">
                <button type="button" onClick={() => setStep(3)} disabled={isVerifying} className="flex-1 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Back</button>
                <button type="button" onClick={verifyIdentity} disabled={isVerifying || faceStatus.includes('Loading')} className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg font-semibold transition-colors shadow-sm flex justify-center items-center px-6">
                  <UserCheck size={18} className="mr-2" />
                  Verify Face & Start Exam
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
