import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { User as FirebaseUser, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously, GoogleAuthProvider, signInWithPopup, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';
import { UserProfile, UserRole } from './types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  staffProfile: any | null;
  loading: boolean;
  signIn: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  signUp: (email: string, pass: string, role: UserRole, extraData?: any) => Promise<any>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateProfileData: (data: Partial<UserProfile>) => Promise<void>;
  signInGuest: () => Promise<void>;
  staffLogin: (phone: string, pass: string) => Promise<void>;
  changePassword: (newPass: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [staffProfile, setStaffProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setStaffProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    const path = `users/${user.uid}`;
    
    // Subscribe to driver/passenger profile with live updates
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      try {
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          setStaffProfile(null);
          setLoading(false);
        } else {
          // Check staff collection
          const staffQ = query(collection(db, 'staff'), where('uid', '==', user.uid), limit(1));
          const staffSnap = await getDocs(staffQ);

          if (!staffSnap.empty) {
            const staffData = staffSnap.docs[0].data();
            setStaffProfile({ id: staffSnap.docs[0].id, ...staffData });
            setProfile({
              uid: user.uid,
              role: 'vendor',
              email: '',
            } as any);
          } else {
            // Profile does not exist, check if we should create it
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
              setStaffProfile(null);
            }
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      console.error("Live profile sync error:", error);
      setLoading(false);
    });

    return () => unsubProfile();
  }, [user]);

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
      
      const dbFields = ['phoneNumber', 'address', 'approvalStatus', 'status', 'driverType', 'vehicleType', 'vehicleBrand', 'vehicleModel', 'vehicleColor', 'licensePlate', 'vehicleYear', 'carryingCapacity', 'category', 'businessName', 'tinNumber', 'hotelDescription', 'location'];
      if (extraData) {
        Object.keys(extraData).forEach(key => {
          if (dbFields.includes(key)) {
            newProfile[key] = extraData[key];
          }
        });
      }
      
      await setDoc(doc(db, 'users', newUser.uid), newProfile);
      
      // If vendor, also create a vendor profile
      if (role === 'vendor' && extraData) {
        await setDoc(doc(db, 'vendors', newUser.uid), {
          ...extraData,
          ownerUid: newUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          rating: 0,
          ratingCount: 0,
          status: 'pending'
        });
      }

      setProfile(newProfile);
      return userCredential;
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
      const errorCode = error.code || '';
      if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found') {
        console.warn('Login Auth Warning:', error.message || error);
      } else {
        console.error('Login error:', error);
      }
      if (error.code === 'auth/configuration-not-found') {
        toast.error("Firebase Auth haijaanzishwa.", {
          description: "Washa 'Email/Password' auth kwenye Firebase Console.",
          duration: 10000
        });
      }
      throw error;
    }
  };

  const staffLogin = async (phone: string, pass: string) => {
    try {
      // 1. Ensure the user is signed in (anonymously) first to satisfy raw Firestore read security rules for staff
      let currentUser = auth.currentUser;
      if (!currentUser) {
        const userCredential = await signInAnonymously(auth);
        currentUser = userCredential.user;
      }

      // 2. Search for staff member in Firestore
      const staffQ = query(
        collection(db, 'staff'), 
        where('phone', '==', phone), 
        where('password', '==', pass),
        limit(1)
      );
      const staffSnap = await getDocs(staffQ);

      if (staffSnap.empty) {
        // If query failed and this anonymous user was newly created in this run, sign out to be safe and clean
        if (currentUser.isAnonymous) {
          await auth.signOut();
        }
        throw new Error("Samahani, Namba ya simu au Password si sahihi.");
      }

      const staffDoc = staffSnap.docs[0];
      const staffData = staffDoc.data();

      // 3. Link this UID to the staff record so VendorDashboard can find it
      await updateDoc(doc(db, 'staff', staffDoc.id), {
        uid: currentUser.uid
      });

      toast.success(`Karibu ${staffData.name}!`);
    } catch (error: any) {
      console.error('Staff login error:', error);
      throw error;
    }
  };

  const signInGuest = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error('Guest sign in error:', error);
      if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
        toast.error("Anonymous Authentication haijawezeshwa.", {
          description: "Washa 'Anonymous' auth kwenye mradi wako wa Firebase kule Console.",
          duration: 10000
        });
      }
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
    staffProfile,
    loading,
    signIn,
    login,
    signUp,
    logout,
    updateRole,
    updateProfileData,
    signInGuest,
    staffLogin,
    changePassword: changePasswordMethod
  }), [user, profile, staffProfile, loading]);

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
