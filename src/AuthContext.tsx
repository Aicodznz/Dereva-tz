import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, UserRole } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, role: UserRole, extraData?: any) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      setUser(firebaseUser);
      
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        const initProfile = async () => {
          try {
            const profileSnap = await getDoc(profileRef);

            if (!profileSnap.exists()) {
              setProfile(prev => {
                if (prev) return prev;
                
                const isAdminEmail = firebaseUser.email === 'aicodtznation@gmail.com';
                const newProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  displayName: firebaseUser.displayName || (isAdminEmail ? 'Super Admin' : ''),
                  photoURL: firebaseUser.photoURL || '',
                  role: isAdminEmail ? 'admin' : 'customer',
                  createdAt: new Date(),
                };
                setDoc(profileRef, newProfile).catch(err => {
                  console.error('Error creating default profile:', err);
                });
                return newProfile;
              });
            }
          } catch (error) {
            console.error('Error in initProfile:', error);
            // Only handle error if user is still logged in
            if (auth.currentUser) {
              handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            }
          }
        };

        initProfile();

        unsubProfile = onSnapshot(profileRef, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
          setLoading(false);
        }, (error) => {
          // Only log error if user is still logged in to avoid noise on logout
          if (auth.currentUser) {
            console.error('Profile snapshot error:', error);
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        // Silently handle expected user cancellation
        console.log('User cancelled the sign-in popup.');
        return;
      }
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const updateRole = async (role: UserRole) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    try {
      await setDoc(profileRef, { role }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user) return;
    const profileRef = doc(db, 'users', user.uid);
    try {
      await setDoc(profileRef, data, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const signUp = async (email: string, pass: string, role: UserRole, extraData?: any) => {
    try {
      console.log('Attempting signup for:', email);
      const { user: firebaseUser } = await createUserWithEmailAndPassword(auth, email, pass);
      const profileRef = doc(db, 'users', firebaseUser.uid);
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: extraData?.fullName || '',
        photoURL: '',
        role: role,
        createdAt: new Date(),
        ...extraData
      };
      await setDoc(profileRef, newProfile);
      setProfile(newProfile);
      console.log('Signup successful for:', email);
    } catch (error: any) {
      console.error('Signup error code:', error.code);
      console.error('Signup error message:', error.message);
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error("Email registration is currently disabled. Please enable 'Email/Password' in your Firebase Console Authentication settings.");
      }
      throw error;
    }
  };

  const login = async (email: string, pass: string) => {
    try {
      console.log('Attempting login for:', email);
      await signInWithEmailAndPassword(auth, email, pass);
      console.log('Login successful for:', email);
    } catch (error: any) {
      console.error('Login error code:', error.code);
      console.error('Login error message:', error.message);
      if (error.code === 'auth/operation-not-allowed') {
        throw new Error("Email login is currently disabled. Please enable 'Email/Password' in your Firebase Console Authentication settings.");
      }
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, login, signUp, logout, updateRole, updateProfileData }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
