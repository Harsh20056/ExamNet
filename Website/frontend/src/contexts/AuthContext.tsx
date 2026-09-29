import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase'

export type Role = 'student' | 'admin' | 'invigilator' | null;

interface AuthContextType {
  role: Role;
  user: FirebaseUser | null;
  loading: boolean;
  setRoleOverride: (r: Role) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

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
            setRole('student');
          }
        } catch(e) {
          console.error("Firebase config is likely missing or Firestore read failed.", e);
          // Fallback to local storage or default to student
          const localRole = localStorage.getItem('auth_role') as Role;
          setRole(localRole || 'student');
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    setRole(null);
    localStorage.removeItem('auth_role');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_name');
    try {
      await firebaseSignOut(auth);
    } catch(e) {
      console.log("Firebase signout error (or using mock):", e);
    }
  };

  const setRoleOverride = (newRole: Role) => {
    setRole(newRole);
    if(newRole) localStorage.setItem('auth_role', newRole);
  };

  return (
    <AuthContext.Provider value={{ role, user, loading, logout, setRoleOverride }}>
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
