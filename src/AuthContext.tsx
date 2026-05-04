import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously, GoogleAuthProvider, signInWithPopup, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserProfile, UserRole } from './types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, role: UserRole, extraData?: any) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  signInGuest: () => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.uid);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchProfile = async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        // Profile doesn't exist, check if we should create it
        const currentUser = auth.currentUser;
        if (currentUser) {
          const isAdminEmail = currentUser.email === 'aicodtznation@gmail.com';
          const newProfile: any = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || (isAdminEmail ? 'Super Admin' : ''),
            fullName: currentUser.displayName || (isAdminEmail ? 'Super Admin' : ''),
            photoURL: currentUser.photoURL || '',
            role: isAdminEmail ? 'admin' : 'customer',
            walletBalance: 0,
            points: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          await setDoc(doc(db, 'users', currentUser.uid), newProfile);
          setProfile(newProfile);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
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
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, { role });
      setProfile(prev => prev ? { ...prev, role } : null);
    } catch (error) {
      console.error('Update role error:', error);
    }
  };

  const updateProfileData = async (data: Partial<UserProfile>) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid);
      await updateDoc(docRef, data as any);
      setProfile(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error('Update profile error:', error);
    }
  };

  const signUp = async (email: string, pass: string, role: UserRole, extraData?: any) => {
    const cleanEmail = email.trim().toLowerCase();
    
    if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
      throw new Error("Tafadhali weka barua pepe sahihi (mfano: jina@gmail.com)");
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
      const newUser = userCredential.user;

      const newProfile: any = {
        uid: newUser.uid,
        email: newUser.email || cleanEmail,
        displayName: extraData?.fullName || '',
        fullName: extraData?.fullName || '',
        photoURL: '',
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      const dbFields = ['phoneNumber', 'address', 'approvalStatus', 'status', 'driverType', 'vehicleType', 'vehicleBrand', 'vehicleModel', 'vehicleColor', 'licensePlate', 'vehicleYear', 'carryingCapacity'];
      if (extraData) {
        Object.keys(extraData).forEach(key => {
          if (dbFields.includes(key)) {
            newProfile[key] = extraData[key];
          }
        });
      }
      
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      setProfile(newProfile);
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.code === 'auth/configuration-not-found') {
        toast.error("Firebase Authentication haijawezeshwa kule Console.", {
          description: "Tafadhali washa 'Email/Password' kwenye mradi wako mpya wa Firebase.",
          duration: 10000
        });
      }
      throw error;
    }
  };

  const login = async (email: string, pass: string) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/configuration-not-found') {
        toast.error("Firebase Auth haijaanzishwa.", {
          description: "Washa 'Email/Password' auth kwenye Firebase Console.",
          duration: 10000
        });
      } else if (error.code === 'auth/invalid-credential') {
        // This is handled in the UI component as well, but we log more context here if needed
        console.warn('Invalid credentials provided');
      }
      throw error;
    }
  };

  const signInGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error) {
      console.error('Guest sign in error:', error);
      throw error;
    }
  };

  const changePasswordMethod = async (newPass: string) => {
    if (!auth.currentUser) throw new Error("No user logged in");
    try {
      await updatePassword(auth.currentUser, newPass);
    } catch (error: any) {
      console.error('Change password error:', error);
      throw error;
    }
  };

  const value = React.useMemo(() => ({
    user,
    profile,
    loading,
    signIn,
    login,
    signUp,
    logout,
    updateRole,
    updateProfileData,
    signInGuest,
    changePassword: changePasswordMethod
  }), [user, profile, loading]);

  return (
    <AuthContext.Provider value={value}>
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
