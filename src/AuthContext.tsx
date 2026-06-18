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
    
    // 1. Subscribe to staff updates for this user UID
    const staffQ = query(collection(db, 'staff'), where('uid', '==', user.uid), limit(1));
    const unsubStaff = onSnapshot(staffQ, (staffSnap) => {
      if (!staffSnap.empty) {
        const staffDoc = staffSnap.docs[0];
        const staffData = staffDoc.data();
        setStaffProfile({ id: staffDoc.id, ...staffData });
        setProfile({
          uid: user.uid,
          role: 'vendor',
          email: '',
          fullName: staffData.name,
          displayName: staffData.name
        } as any);
        setLoading(false);
      }
    }, (error) => {
      console.warn("Live staff profile sync warning:", error);
    });

    // 2. Subscribe to driver/passenger profile with live updates
    const unsubProfile = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      try {
        const activeStaffQ = query(collection(db, 'staff'), where('uid', '==', user.uid), limit(1));
        const activeStaffSnap = await getDocs(activeStaffQ);

        if (!activeStaffSnap.empty) {
          // Keep staff profile active
          const staffDoc = activeStaffSnap.docs[0];
          const staffData = staffDoc.data();
          setStaffProfile({ id: staffDoc.id, ...staffData });
          setProfile({
            uid: user.uid,
            role: 'vendor',
            email: '',
            fullName: staffData.name,
            displayName: staffData.name
          } as any);
          setLoading(false);
          return;
        }

        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
          setStaffProfile(null);
          setLoading(false);
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
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    }, (error) => {
      const errMsg = error?.message || String(error);
      if (errMsg.includes('offline') || errMsg.includes('unavailable') || errMsg.includes('network')) {
        console.warn("Live profile sync warning (offline):", error);
      } else {
        console.error("Live profile sync error:", error);
      }
      setLoading(false);
    });

    return () => {
      unsubStaff();
      unsubProfile();
    };
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
      const digits = phone.replace(/\D/g, '');
      if (!digits || digits.length < 5) {
        throw new Error("Samahani, tafadhali weka namba sahihi ya simu.");
      }
      const staffEmail = `staff_${digits}@mabasi.com`;

      // Generate normalized phone variations to support both international and local inputs in East Africa
      const variations: string[] = [phone, phone.trim()];
      if (digits) {
        variations.push(digits);
        let base9 = digits;
        if (digits.startsWith('255') && digits.length === 12) {
          base9 = digits.slice(3);
        } else if (digits.startsWith('0') && digits.length === 10) {
          base9 = digits.slice(1);
        }
        if (base9.length === 9) {
          variations.push(base9);
          variations.push(`0${base9}`);
          variations.push(`255${base9}`);
          variations.push(`+255${base9}`);
        }
      }
      const uniqueVariations = Array.from(new Set(variations));

      let userCredential = null;
      let loginSuccess = false;

      // 1. Try signing in directly to check if they already have an email/password account
      try {
        userCredential = await signInWithEmailAndPassword(auth, staffEmail, pass);
        loginSuccess = true;
      } catch (loginError: any) {
        const errCode = loginError.code;
        // If wrong password, throw immediately so they can correct it
        if (errCode === 'auth/wrong-password') {
          throw new Error("Samahani, Namba ya simu au Password si sahihi.");
        }
        
        // If user not found (not registered yet in Auth, only in Firestore), we proceed with registration flow
        if (errCode === 'auth/user-not-found' || errCode === 'auth/invalid-credential') {
          // Continue to register on-demand
        } else {
          throw loginError;
        }
      }

      // 2. If login failed because Firebase Auth account doesn't exist, search Firestore and register them
      if (!loginSuccess) {
        // We need to query the database. Since Firestore rules require isSignedIn(), sign in with a safe shared guest account first
        const guestEmail = 'guest_staff@mabasi.com';
        const guestPass = 'GuestStaff123!';
        
        try {
          await signInWithEmailAndPassword(auth, guestEmail, guestPass);
        } catch (guestErr: any) {
          if (guestErr.code === 'auth/user-not-found' || guestErr.code === 'auth/invalid-credential') {
            try {
              await createUserWithEmailAndPassword(auth, guestEmail, guestPass);
            } catch (createGuestErr) {
              console.error("Failed to create guest reader:", createGuestErr);
            }
          }
        }

        // Search for staff member in Firestore
        let staffSnap = null;
        try {
          const staffQ = query(
            collection(db, 'staff'), 
            where('phone', 'in', uniqueVariations), 
            where('password', '==', pass),
            limit(1)
          );
          staffSnap = await getDocs(staffQ);
        } catch (err) {
          console.warn('IN query failed, trying exact match query:', err);
          const staffQ = query(
            collection(db, 'staff'),
            where('phone', '==', phone),
            where('password', '==', pass),
            limit(1)
          );
          staffSnap = await getDocs(staffQ);
        }

        if (!staffSnap || staffSnap.empty) {
          await auth.signOut();
          throw new Error("Samahani, Namba ya simu au Password si sahihi.");
        }

        const staffDoc = staffSnap.docs[0];
        const staffData = staffDoc.data();

        // Sign out guest before registering new user
        await auth.signOut();

        // Create the dedicated Auth user dynamically
        try {
          userCredential = await createUserWithEmailAndPassword(auth, staffEmail, pass);
          
          // Link this new UID to the staff record in Firestore
          await updateDoc(doc(db, 'staff', staffDoc.id), {
            uid: userCredential.user.uid
          });

          setStaffProfile({ id: staffDoc.id, ...staffData, uid: userCredential.user.uid });
          setProfile({
            uid: userCredential.user.uid,
            role: 'vendor',
            email: '',
            fullName: staffData.name,
            displayName: staffData.name
          } as any);

          toast.success(`Karibu ${staffData.name}!`);
          return;
        } catch (createErr: any) {
          if (createErr.code === 'auth/email-already-in-use') {
            // Means credentials mismatch against existing user in Auth
            throw new Error("Samahani, Namba ya simu au Password si sahihi.");
          } else {
            throw createErr;
          }
        }
      }

      // 3. Direct Sign-in Succeeded, now recover and load their profile
      if (userCredential && userCredential.user) {
        let staffSnap = null;
        try {
          const staffQ = query(
            collection(db, 'staff'),
            where('uid', '==', userCredential.user.uid),
            limit(1)
          );
          staffSnap = await getDocs(staffQ);
        } catch (e) {
          console.error("Failed fetching staff by UID:", e);
        }

        if (staffSnap && !staffSnap.empty) {
          const staffDoc = staffSnap.docs[0];
          const staffData = staffDoc.data();
          setStaffProfile({ id: staffDoc.id, ...staffData });
          setProfile({
            uid: userCredential.user.uid,
            role: 'vendor',
            email: '',
            fullName: staffData.name,
            displayName: staffData.name
          } as any);
          toast.success(`Karibu ${staffData.name}!`);
        } else {
          // Sync recovery: Search by phone to re-link UID
          const staffQ = query(
            collection(db, 'staff'),
            where('phone', 'in', uniqueVariations),
            limit(1)
          );
          const fallbackSnap = await getDocs(staffQ);
          if (!fallbackSnap.empty) {
            const staffDoc = fallbackSnap.docs[0];
            const staffData = staffDoc.data();
            await updateDoc(doc(db, 'staff', staffDoc.id), {
              uid: userCredential.user.uid
            });
            setStaffProfile({ id: staffDoc.id, ...staffData, uid: userCredential.user.uid });
            setProfile({
              uid: userCredential.user.uid,
              role: 'vendor',
              email: '',
              fullName: staffData.name,
              displayName: staffData.name
            } as any);
            toast.success(`Karibu ${staffData.name}!`);
          } else {
            throw new Error("Hujasajiliwa kama staff wa restaurant hii.");
          }
        }
      }
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
