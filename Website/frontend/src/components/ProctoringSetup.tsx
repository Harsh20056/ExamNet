import { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2, UserCheck, X } from 'lucide-react';
import { reportIdentityFailure } from '../services/apiService';

export interface IdentityCheckProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onComplete?: (stream: MediaStream | null) => void;
  onClose?: () => void;
  examinerEmail?: string;
  examinerName?: string;
}

export default function IdentityCheck({
  onSuccess,
  onCancel,
  onComplete,
  onClose,
  examinerEmail = 'examiner@demo.com',
  examinerName = 'Examiner',
}: IdentityCheckProps) {
  const handleSuccessCallback = () => {
    if (onSuccess) onSuccess();
    if (onComplete) onComplete(null);
  };

  const handleCancelCallback = () => {
    if (onCancel) onCancel();
    if (onClose) onClose();
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [modelsLoaded, setModelsLoaded] = useState<boolean>(false);
  const [modelsLoading, setModelsLoading] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing facial verification engine...');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<'idle' | 'success' | 'failed'>('idle');
  const [distanceScore, setDistanceScore] = useState<number | null>(null);

  // Stop camera tracks helper
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraActive(false);
    }
  };

  // 1. Load face-api.js neural net weights
  useEffect(() => {
    let isMounted = true;
    const loadFaceModels = async () => {
      try {
        setModelsLoading(true);
        setStatusMessage('Loading biometric neural models...');
        const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        if (isMounted) {
          setModelsLoaded(true);
          setModelsLoading(false);
          setStatusMessage('Neural models ready. Please grant camera permission.');
        }
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        if (isMounted) {
          setModelsLoading(false);
          setStatusMessage('Failed to download biometric models from CDN. Please check network.');
          setCameraError('AI Models could not be loaded from CDN.');
        }
      }
    };

    loadFaceModels();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, []);

  // 2. Request Camera Permission
  const startCamera = async () => {
    setCameraError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      setStream(mediaStream);
      setCameraActive(true);
      setStatusMessage('Camera stream active. Align your face and click "Verify Identity".');

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('Camera access was denied or device is not available. Please allow camera permissions.');
      setStatusMessage('Camera permission required to authenticate session.');
    }
  };

  // Re-attach video stream whenever videoRef mounts or stream updates
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // 3. Single-step Face Verification
  const handleVerify = async () => {
    if (!videoRef.current || !modelsLoaded) return;

    setIsVerifying(true);
    setStatusMessage('Scanning facial landmarks and calculating biometric descriptor...');

    try {
      // Detect single face with relaxed threshold for varied indoor lighting
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.15 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setIsVerifying(false);
        setVerificationResult('failed');
        setStatusMessage('No face detected in camera viewport. Ensure face is clearly visible and well-lit.');
        await reportIdentityFailure({
          examinerEmail,
          reason: 'No face detected in camera viewport',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Retrieve registered reference descriptor from localStorage or generate a mock baseline
      let referenceDescriptor: Float32Array;
      const storedRef = localStorage.getItem(`examiner_reference_face_${examinerEmail}`);

      if (storedRef) {
        try {
          const parsed = JSON.parse(storedRef);
          referenceDescriptor = new Float32Array(parsed);
        } catch {
          // If corrupted, initialize with current live descriptor as enrollment baseline
          referenceDescriptor = detection.descriptor;
          localStorage.setItem(`examiner_reference_face_${examinerEmail}`, JSON.stringify(Array.from(detection.descriptor)));
        }
      } else {
        // Enrol current descriptor as the examiner's reference photo descriptor on first login
        referenceDescriptor = detection.descriptor;
        localStorage.setItem(`examiner_reference_face_${examinerEmail}`, JSON.stringify(Array.from(detection.descriptor)));
      }

      // Calculate Euclidean distance between live face and enrolled reference
      const distance = faceapi.euclideanDistance(detection.descriptor, referenceDescriptor);
      setDistanceScore(distance);

      // Threshold standard: <= 0.65 is authentic match
      if (distance <= 0.65) {
        setVerificationResult('success');
        setStatusMessage(`Identity Confirmed! Euclidean Distance: ${distance.toFixed(3)} (Match threshold: 0.65).`);
        
        // Brief delay for visual confirmation before firing success
        setTimeout(() => {
          stopCamera();
          handleSuccessCallback();
        }, 1200);
      } else {
        setVerificationResult('failed');
        setStatusMessage(`Identity Verification Failed: Live face does not match registered examiner credentials (Distance: ${distance.toFixed(3)} > 0.65).`);
        await reportIdentityFailure({
          examinerEmail,
          reason: `Biometric distance mismatch (${distance.toFixed(3)})`,
          distance,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error('Face verification error:', err);
      setVerificationResult('failed');
      setStatusMessage('An error occurred during facial descriptor analysis.');
      await reportIdentityFailure({
        examinerEmail,
        reason: err?.message || 'Biometric analysis exception',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Fallback demo bypass for testing / offline environments
  const handleSimulatePass = () => {
    stopCamera();
    handleSuccessCallback();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden max-w-xl w-full mx-auto">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 flex items-center justify-center">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Examiner Identity Check
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Biometric single-step verification for <span className="font-semibold text-slate-700 dark:text-slate-300">{examinerName}</span> ({examinerEmail})
            </p>
          </div>
        </div>

        {(onCancel || onClose) && (
          <button
            onClick={() => {
              stopCamera();
              handleCancelCallback();
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Main Body */}
      <div className="p-6 space-y-6">
        {/* Camera Viewport / Frame */}
        <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800 shadow-inner">
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover transform -scale-x-100"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800 text-slate-500">
                <Camera size={26} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-300">Camera Inactive</p>
                <p className="text-xs text-slate-500 mt-0.5">Click below to allow camera access for verification</p>
              </div>
            </div>
          )}

          {/* Loading or Verifying Overlay */}
          {isVerifying && (
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-3">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold tracking-wider uppercase text-primary-300">
                Verifying facial descriptor...
              </p>
            </div>
          )}

          {/* Result Badge Overlay */}
          {verificationResult === 'success' && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white space-y-2 animate-fade-in">
              <CheckCircle2 size={42} className="text-emerald-400" />
              <p className="text-sm font-bold text-emerald-200">Identity Verified Successfully</p>
              <p className="text-xs text-emerald-300 font-mono">Redirecting to workspace...</p>
            </div>
          )}
        </div>

        {/* Feedback / Status Alert */}
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2.5 ${
            verificationResult === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-200'
              : verificationResult === 'failed'
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-200'
              : cameraError
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-800 dark:text-amber-200'
              : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
          }`}
        >
          {verificationResult === 'success' ? (
            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          ) : verificationResult === 'failed' || cameraError ? (
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          ) : (
            <UserCheck size={16} className="text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">
              {verificationResult === 'success'
                ? 'Authentication Passed: '
                : verificationResult === 'failed'
                ? 'Verification Warning: '
                : cameraError
                ? 'Camera Alert: '
                : 'Session Check: '}
            </span>
            <span>{statusMessage}</span>
            {distanceScore !== null && (
              <span className="block font-mono text-[11px] opacity-80 mt-1">
                Cosine/Euclidean Delta: {distanceScore.toFixed(4)} (Threshold: 0.6500)
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          {!cameraActive ? (
            <button
              onClick={startCamera}
              disabled={modelsLoading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-primary-500/20"
            >
              <Camera size={18} />
              <span>{modelsLoading ? 'Loading AI Engine...' : 'Enable Camera'}</span>
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handleVerify}
                disabled={isVerifying || !modelsLoaded}
                className="flex-1 py-3 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-primary-500/20"
              >
                <UserCheck size={18} />
                <span>{isVerifying ? 'Matching Face...' : 'Verify Face Match'}</span>
              </button>

              <button
                onClick={startCamera}
                disabled={isVerifying}
                title="Restart Camera"
                className="px-4 py-3 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl transition-colors flex items-center justify-center"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          )}

          {/* Quick pass for developer simulation / environments without webcams */}
          <div className="pt-2 flex justify-between items-center text-xs text-slate-400">
            <span>Hardware issue or offline?</span>
            <button
              type="button"
              onClick={handleSimulatePass}
              className="text-primary-600 dark:text-primary-400 hover:underline font-semibold"
            >
              Simulate Verified Match (Bypass)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
