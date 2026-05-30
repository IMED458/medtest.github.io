import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface FirebaseContextType {
  user: UserProfile | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  signOutUser: () => Promise<void>;
  loginAnonymously: () => Promise<void>;
  authReady: boolean;
  isAdmin: boolean;
  isLocalUser: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  loginWithGoogle: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
  signOutUser: async () => {},
  loginAnonymously: async () => {},
  authReady: false,
  isAdmin: false,
  isLocalUser: false,
});

export const useFirebase = () => useContext(FirebaseContext);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isLocalUser, setIsLocalUser] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const userDocRef = doc(db, 'users', fbUser.uid);
          let userDocSnap;
          try {
            userDocSnap = await getDoc(userDocRef);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
          }

          const ADMIN_EMAILS = ['imedashviligio27@gmail.com'];
          const isAdminEmail = ADMIN_EMAILS.includes(fbUser.email || '');

          if (userDocSnap && userDocSnap.exists()) {
            const data = userDocSnap.data() as UserProfile;
            // Upgrade to admin if email matches, even if stored role is 'user'
            if (isAdminEmail && data.role !== 'admin') {
              const updated = { ...data, role: 'admin' as const };
              try { await setDoc(userDocRef, updated); } catch {}
              setUser(updated);
            } else {
              setUser(data);
            }
          } else {
            // Bootstrap new user
            const profile: UserProfile = {
              uid: fbUser.uid,
              email: fbUser.email || 'guest@portal.ge',
              displayName: fbUser.displayName || (fbUser.isAnonymous ? 'სტუმარი' : fbUser.email?.split('@')[0] || 'სტუდენტი'),
              photoURL: fbUser.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + fbUser.uid,
              createdAt: new Date().toISOString(),
              role: isAdminEmail ? 'admin' : 'user'
            };
            try {
              await setDoc(userDocRef, profile);
            } catch (err) {
              handleFirestoreError(err, OperationType.CREATE, `users/${fbUser.uid}`);
            }
            setUser(profile);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error in onAuthStateChanged synchronization:', err);
      } finally {
        setLoading(false);
        setAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Google Sign-In failed:', err);
      setLoading(false);
      throw err;
    }
  };

  const loginAnonymously = async () => {
    setLoading(true);
    // Persist a stable guest ID in localStorage so progress survives page reloads
    const existingId = localStorage.getItem('medtest_guest_uid');
    const guestId = existingId || ('guest_local_' + Math.random().toString(36).substring(2, 9));
    if (!existingId) localStorage.setItem('medtest_guest_uid', guestId);

    const localGuestProfile: UserProfile = {
      uid: guestId,
      email: 'guest@medtest.local',
      displayName: 'სტუმარი სტუდენტი',
      photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=' + guestId,
      createdAt: new Date().toISOString(),
      role: 'user'
    };
    setIsLocalUser(true);
    setUser(localGuestProfile);
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (!isLocalUser) await signOut(auth);
      setIsLocalUser(false);
      setUser(null);
    } catch (err) {
      console.error('Sign-Out failed:', err);
      setIsLocalUser(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <FirebaseContext.Provider value={{
      user,
      loading,
      loginWithGoogle,
      signInWithGoogle: loginWithGoogle,
      logout,
      signOutUser: logout,
      loginAnonymously,
      authReady,
      isAdmin,
      isLocalUser,
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};
