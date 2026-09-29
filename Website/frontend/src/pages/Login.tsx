import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Users, ShieldAlert, KeyRound, ArrowRight, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [loginType, setLoginType] = useState<'student' | 'invigilator' | 'admin'>('student');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setRoleOverride, role } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (role === 'student') {
      navigate('/student', { replace: true });
    } else if (role === 'admin') {
      navigate('/admin', { replace: true });
    } else if (role === 'invigilator') {
      navigate('/invigilator', { replace: true });
    }
  }, [role, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      localStorage.setItem('auth_email', email);
      
      if (!isLogin && password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      
      if (!isLogin) {
        const specialCharCount = (password.match(/[^A-Za-z0-9]/g) || []).length;
        if (specialCharCount < 1) {
          setError("Password must contain at least 1 special character.");
          setLoading(false);
          return;
        }
      }
      
      const finalRole = loginType;

      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then((userDocSnap) => {
          if (!userDocSnap.exists()) {
             const inferredName = email.split('@')[0];
             setDoc(userDocRef, {
               name: inferredName,
               email: user.email,
               role: finalRole,
               createdAt: new Date().toISOString()
             });
             localStorage.setItem('auth_name', inferredName);
          } else {
             const data = userDocSnap.data();
             if (data && data.name) {
               localStorage.setItem('auth_name', data.name);
             }
             setDoc(userDocRef, { role: finalRole }, { merge: true }).catch(console.error);
          }
        }).catch(console.error);
        toast.success("Login successful!", { duration: 2000 });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        setDoc(doc(db, 'users', user.uid), {
          name: name,
          email: user.email,
          role: finalRole,
          createdAt: new Date().toISOString()
        }).catch(console.error);
        localStorage.setItem('auth_name', name);
        toast.success("Signup successful!", { duration: 2000 });
      }
      
      setRoleOverride(finalRole);
      if (finalRole === 'student') {
        navigate('/student');
      } else if (finalRole === 'admin') {
        navigate('/admin');
      } else if (finalRole === 'invigilator') {
        navigate('/invigilator');
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error(err);
      if (err.code === 'auth/invalid-api-key') {
        setError('Firebase Error: Please add your actual Firebase Config in src/config/firebase.ts!');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        toast.error('You have not signed up yet. Please sign up first!', { duration: 4000 });
        setIsLogin(false); // Switch to signup
      } else if (err.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please login.', { duration: 4000 });
        setIsLogin(true); // Switch to login
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.');
      } else {
        setError(err.message || 'Failed to authenticate.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      const finalRole = loginType;
      
      // Set localStorage states instantly to prevent redirection delay
      const inferredName = user.displayName || user.email?.split('@')[0] || 'Google User';
      localStorage.setItem('auth_email', user.email || '');
      localStorage.setItem('auth_name', inferredName);
      
      // Perform Firestore sync in the background
      const userDocRef = doc(db, 'users', user.uid);
      getDoc(userDocRef).then((userDocSnap) => {
        if (!userDocSnap.exists()) {
           setDoc(userDocRef, {
             name: inferredName,
             email: user.email,
             role: finalRole,
             createdAt: new Date().toISOString()
           });
        } else {
           const data = userDocSnap.data();
           if (data && data.name) {
             localStorage.setItem('auth_name', data.name);
           }
           setDoc(userDocRef, { role: finalRole }, { merge: true }).catch(console.error);
        }
      }).catch(console.error);

      toast.success("Google Login successful!", { duration: 2000 });
      setRoleOverride(finalRole);
      
      if (finalRole === 'student') {
        navigate('/student');
      } else if (finalRole === 'admin') {
        navigate('/admin');
      } else if (finalRole === 'invigilator') {
        navigate('/invigilator');
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      console.error(err);
      if (err.code === 'auth/popup-closed-by-user') {
        // User closed the popup, do nothing
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is disabled in Firebase. Please enable it in Firebase Console > Authentication > Sign-in method > Google.');
        toast.error('Google Sign-In needs to be enabled in your Firebase Console!', { duration: 6000 });
      } else {
        setError(err.message || 'Failed to sign in with Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 shadow-soft-lg rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-fade-in">
        
        {/* Graphic Side */}
        <div className="hidden md:flex flex-col justify-between p-12 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 relative">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-md mb-8 text-xs font-semibold uppercase tracking-wider border border-slate-200 dark:border-slate-800 shadow-sm">
              <KeyRound size={14} className="text-primary-600 dark:text-primary-400" />
              <span>Firebase Secured</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-4">SAMADHAN X Portal</h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">
              Access your examination environment. Our role-based infrastructure ensures strict data separation and maximum security.
            </p>
            
            <div className="space-y-4">
              {/* Student Card */}
              <div 
                onClick={() => setLoginType('student')}
                className={`p-4 rounded-xl transition-all cursor-pointer select-none border ${
                  loginType === 'student' 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 shadow-sm' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <h3 className="font-semibold flex items-center text-sm text-slate-900 dark:text-white">
                  <User className="mr-2 text-primary-600 dark:text-primary-400" size={16} /> 
                  Student Access
                </h3>
                <p className="text-xs text-slate-500 mt-1">Access upcoming exams and admit cards.</p>
              </div>

              {/* Invigilator Card */}
              <div 
                onClick={() => setLoginType('invigilator')}
                className={`p-4 rounded-xl transition-all cursor-pointer select-none border ${
                  loginType === 'invigilator' 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 shadow-sm' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <h3 className="font-semibold flex items-center text-sm text-slate-900 dark:text-white">
                  <Users className="mr-2 text-primary-600 dark:text-primary-400" size={16} /> 
                  Invigilator Panel
                </h3>
                <p className="text-xs text-slate-500 mt-1">Manage student sessions and identity verification.</p>
              </div>

              {/* Admin Card */}
              <div 
                onClick={() => setLoginType('admin')}
                className={`p-4 rounded-xl transition-all cursor-pointer select-none border ${
                  loginType === 'admin' 
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/10 shadow-sm' 
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <h3 className="font-semibold flex items-center text-sm text-slate-900 dark:text-white">
                  <ShieldAlert className="mr-2 text-primary-600 dark:text-primary-400" size={16} /> 
                  Admin Command
                </h3>
                <p className="text-xs text-slate-500 mt-1">Global command center and live telemetry tracking.</p>
              </div>
            </div>
          </div>
          <div className="mt-12 flex items-center text-xs text-slate-500 font-medium">
            <ShieldCheck size={16} className="mr-2 text-emerald-500" />
            End-to-End Encrypted Connection
          </div>
        </div>

        {/* Form Side */}
        <div className="p-8 md:p-12 flex flex-col justify-center">
          
          {/* Form Tabs */}
          <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-lg mb-10 w-full max-w-md mx-auto">
            <button
              onClick={() => setLoginType('student')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                loginType === 'student' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Student
            </button>
            <button
              onClick={() => setLoginType('invigilator')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                loginType === 'invigilator' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Invigilator
            </button>
            <button
              onClick={() => setLoginType('admin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
                loginType === 'admin' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5 w-full max-w-md mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                {isLogin ? 'Sign in to account' : 'Create new account'}
              </h2>
              <p className="text-sm text-slate-500 mt-2 font-medium">
                {loginType === 'student' 
                  ? 'Student Portal Access' 
                  : loginType === 'admin' 
                  ? 'Global Admin Command Center' 
                  : 'Exam Session Invigilation'
                }
              </p>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="p-3 bg-red-50 border border-red-200 text-red-600 dark:bg-red-900/10 dark:border-red-900/50 dark:text-red-400 rounded-lg text-sm font-medium">
                {error}
              </motion.div>
            )}

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  required={!isLogin}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="input-field"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  loginType === 'student' 
                    ? 'student@example.com' 
                    : loginType === 'admin' 
                    ? 'admin@example.com' 
                    : 'invigilator@example.com'
                }
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="input-field pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {!isLogin && (
                <div className="flex items-center space-x-2 mt-2 text-xs">
                  <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    /[^A-Za-z0-9]/.test(password) ? 'bg-emerald-500 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-650'
                  }`}>
                    {/[^A-Za-z0-9]/.test(password) ? '✓' : '•'}
                  </span>
                  <span className={`${/[^A-Za-z0-9]/.test(password) ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-550 dark:text-slate-400'}`}>
                    Must contain at least 1 special character (e.g. @, #, $, %)
                  </span>
                </div>
              )}
            </div>

            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required={!isLogin}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="input-field pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            <button disabled={loading} type="submit" className={`w-full btn-primary py-3 mt-4 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}>
              {loading ? 'Authenticating...' : <span className="flex items-center justify-center">{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} className="ml-2" /></span>}
            </button>

            {/* Google Authentication Section */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-250 dark:border-slate-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white dark:bg-slate-900 px-2 text-slate-500 font-medium">Or continue with</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5 mr-1" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Sign in with Google
            </button>
          </form>

          {/* Demo Credentials Section */}
          <div className="mt-8 flex flex-col gap-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 w-full max-w-md mx-auto">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-1">Demo Credentials</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('student@demo.com');
                  setPassword('Password@123');
                  setLoginType('student');
                }}
                className="flex-1 py-1.5 px-2 text-xs font-medium bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                Student
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('invigilator@demo.com');
                  setPassword('Password@123');
                  setLoginType('invigilator');
                }}
                className="flex-1 py-1.5 px-2 text-xs font-medium bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                Invigilator
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail('admin@demo.com');
                  setPassword('Password@123');
                  setLoginType('admin');
                }}
                className="flex-1 py-1.5 px-2 text-xs font-medium bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors shadow-sm"
              >
                Admin
              </button>
            </div>
          </div>

          <div className="mt-6 text-center text-sm">
            <span className="text-slate-500">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              onClick={() => { setIsLogin(!isLogin); setError(''); setShowPassword(false); setShowConfirmPassword(false); }}
              className="font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
