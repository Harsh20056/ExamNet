import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, RefreshCw, X, AlertCircle } from 'lucide-react';

interface Props {
  onClose: () => void;
  onCapture: (faceDescriptor: number[]) => void;
  studentName: string;
}

export default function CameraCaptureModal({ onClose, onCapture, studentName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [loading, setLoading] = useState('Loading AI Models...');
  const [error, setError] = useState('');
  const [modelsLoaded, setModelsLoaded] = useState(false);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setModelsLoaded(true);
        setLoading('Starting Camera...');
      } catch (err) {
        console.error(err);
        setError('Failed to load AI models. Check connection.');
        setLoading('');
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    if (!modelsLoaded) return;
    
    const startCamera = async () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setLoading('');
      } catch (err) {
        console.error(err);
        setError('Failed to access camera.');
        setLoading('');
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode, modelsLoaded]);

  const captureFace = async () => {
    if (!videoRef.current) return;
    setLoading('Detecting Face...');
    try {
      // Use SsdMobilenetv1 with low confidence threshold (0.15) to detect faces in low light
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (detection) {
        setLoading('Face captured successfully!');
        // Array.from is needed because faceDescriptor is Float32Array
        setTimeout(() => {
          onCapture(Array.from(detection.descriptor));
        }, 1000);
      } else {
        setError('No face detected. Please ensure good lighting and look straight.');
        setLoading('');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setError('Error processing face.');
      setLoading('');
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-lg text-slate-900 dark:text-white">Verify: {studentName}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        
        <div className="relative bg-slate-950 flex-grow flex items-center justify-center min-h-[300px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm text-white">
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="font-medium">{loading}</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-900/90 text-red-400 p-6 text-center">
              <AlertCircle size={32} className="mb-2 text-red-500" />
              <p className="font-medium">{error}</p>
            </div>
          )}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover ${facingMode === 'user' ? 'transform -scale-x-100' : ''}`}
          />
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-between gap-3">
          <button
            onClick={toggleCamera}
            className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg font-medium flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw size={18} className="mr-2" />
            Switch
          </button>
          <button
            onClick={captureFace}
            disabled={!!loading || !!error}
            className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center transition-colors"
          >
            <Camera size={18} className="mr-2" />
            Capture
          </button>
        </div>
      </div>
    </div>
  );
}
