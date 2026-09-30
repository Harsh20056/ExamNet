import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged,
  onIdTokenChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { initializeSocket, disconnectSocket, updateSocketToken } from '../services/socket';

export type Role = 'examiner' | 'moderator' | 'controller' | null;

interface AuthContextType {
  role: Role;
  user: FirebaseUser | null;
  loading: boolean;
  identityVerified: boolean;
  setIdentityVerified: (verified: boolean) => void;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  setRoleOverride: (r: Role) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [identityVerified, setIdentityVerifiedState] = useState<boolean>(() => {
    return sessionStorage.getItem('identity_verified') === 'true';
  });

  const setIdentityVerified = (verified: boolean) => {
    setIdentityVerifiedState(verified);
    if (verified) {
      sessionStorage.setItem('identity_verified', 'true');
    } else {
      sessionStorage.removeItem('identity_verified');
    }
  };

  const getToken = async (forceRefresh: boolean = false): Promise<string | null> => {
    if (user) {
      try {
        return await user.getIdToken(forceRefresh);
      } catch (err) {
        console.error('Failed to get Firebase ID token:', err);
      }
    }
    // Fallback if stored in localStorage for development/offline
    return localStorage.getItem('auth_token') || null;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const localRole = localStorage.getItem('auth_role') as Role;
        
        // If we already have the role cached locally, use it immediately to prevent blocking the UI
        if (localRole) {
          setRole(localRole);
          setLoading(false);
          
          // Fetch from Firestore in the background to sync / update if changed
          try {
            const docRef = doc(db, 'users', currentUser.uid);
            getDoc(docRef)
              .then((docSnap) => {
                if (docSnap.exists()) {
                  const fetchedRole = docSnap.data().role as Role;
                  if (fetchedRole && fetchedRole !== localRole) {
                    setRole(fetchedRole);
                    localStorage.setItem('auth_role', fetchedRole);
                  }
                }
              })
              .catch((err) => {
                console.warn("Background Firestore read failed:", err);
              });
          } catch (e) {
            console.warn("Background Firestore read setup failed:", e);
          }
          return;
        }

        // If no cached role, fetch it with a timeout to prevent long blank screen if client is offline / misconfigured
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          
          // Timeout promise that rejects after 2 seconds
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error("Firestore fetch timeout")), 2000)
          );
          
          // Race between the real fetch and the timeout
          const docSnap = await Promise.race([
            getDoc(docRef),
            timeoutPromise
          ]);

          if (docSnap.exists()) {
            const fetchedRole = docSnap.data().role as Role;
            setRole(fetchedRole);
            if (fetchedRole) {
              localStorage.setItem('auth_role', fetchedRole);
            }
          } else {
            setRole('examiner');
          }
        } catch(e) {
          console.error("Firebase config is likely missing or Firestore read failed.", e);
          // Fallback to local storage or default to examiner
          const localRole = localStorage.getItem('auth_role') as Role;
          setRole(localRole || 'examiner');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    // Reconnect socket with fresh token whenever Firebase refreshes it
    const unsubscribeToken = onIdTokenChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const freshToken = await currentUser.getIdToken();
          if (freshToken) {
            localStorage.setItem('auth_token', freshToken);
            await updateSocketToken(freshToken);
          }
        } catch (err) {
          console.warn('Failed to refresh socket token:', err);
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeToken();
    };
  }, []);

  // Initialize socket singleton and join role room whenever role changes
  useEffect(() => {
    if (role) {
      initializeSocket(role).catch((err) => {
        console.warn('Socket auto-initialization deferred:', err);
      });
    } else {
      disconnectSocket();
    }
  }, [role]);

  const logout = async () => {
    disconnectSocket();
    setRole(null);
    setIdentityVerified(false);
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_name');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('identity_verified');
    try {
      await firebaseSignOut(auth);
    } catch {
      // Signout error or mock session cleanup
    }
  };

  const setRoleOverride = (newRole: Role) => {
    setRole(newRole);
    if(newRole) localStorage.setItem('auth_role', newRole);
  };

  return (
    <AuthContext.Provider value={{ 
      role, 
      user, 
      loading, 
      identityVerified, 
      setIdentityVerified, 
      getToken, 
      logout, 
      setRoleOverride 
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
