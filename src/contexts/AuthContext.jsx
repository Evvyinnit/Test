import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { getAuthServices, getFirestoreServices } from '../utils/firebaseClient';
import { syncSettings } from '../utils/settings';
import { getBadgeForLevel, normalizeBadge, clampLevel, MAX_LEVEL, getAvatarBorderForLevel, getUnlockedAvatarBorders } from '../utils/levelSystem';

const AuthContext = createContext(null);

const OWNER_ID = 'liHiw2xfxscykaCOAO1ufA3bViz2';
const SPECIAL_EMAIL = 'evvyxan@gmail.com';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Use a ref to store the initialization promise so we can await it if needed
  // and ensure we only initialize once.
  const initPromise = useRef(null);

  const initializeAuth = () => {
    if (initPromise.current) return initPromise.current;

    initPromise.current = (async () => {
      try {
        const [{ auth, authModule }, { db, firestoreModule }] = await Promise.all([
          getAuthServices(),
          getFirestoreServices()
        ]);

        const { onAuthStateChanged } = authModule;
        const { doc, getDoc, setDoc, updateDoc, serverTimestamp } = firestoreModule;

        // Return the unsubscribe function if needed, though we don't use it here explicitly
        return onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            localStorage.setItem('gemini_auth_active', 'true');
            // Sync settings in background
            syncSettings(firebaseUser.uid).catch(e => console.error("Settings sync failed", e));

            try {
              const userRef = doc(db, 'users', firebaseUser.uid);
              const userSnap = await getDoc(userRef);

              if (userSnap.exists()) {
                const data = userSnap.data();
                const normalizedLevel = clampLevel(data.level || 1);
                const effectiveData =
                  normalizedLevel !== (data.level || 1)
                    ? { ...data, level: normalizedLevel, xp: 0 }
                    : data;

                // Enforce MAX_LEVEL cap server-side (Firestore) if needed.
                if (normalizedLevel !== (data.level || 1)) {
                  await updateDoc(userRef, { level: normalizedLevel, xp: 0 });
                }
                
                // Auto-grant roles to special email
                if (firebaseUser.email === SPECIAL_EMAIL) {
                  const roles = data.roles || [];
                  const hasOwner = roles.includes('owner');
                  const hasAdmin = roles.includes('admin');
                  const hasHeadAdmin = roles.includes('head_admin');
                  
                  if (!hasOwner || !hasAdmin || !hasHeadAdmin) {
                    const newRoles = [...new Set([...roles, 'owner', 'admin', 'head_admin'])];
                    await updateDoc(userRef, { roles: newRoles });
                    setUserData({ ...effectiveData, roles: newRoles });
                  } else {
                    const expectedBadge = getBadgeForLevel(effectiveData.level || 1);
                  const expectedMaxBorder = getAvatarBorderForLevel(effectiveData.level || 1);
                  const unlockedBorderIds = getUnlockedAvatarBorders(effectiveData.level || 1).map(b => b.id);

                  const currentBadge = normalizeBadge(effectiveData.badge);
                  const prevMaxBorderId = effectiveData.avatarBorderMaxId || null;

                  let selectedBorderId = effectiveData.avatarBorderId || null;
                  if (!selectedBorderId || selectedBorderId === prevMaxBorderId || !unlockedBorderIds.includes(selectedBorderId)) {
                    selectedBorderId = expectedMaxBorder.id;
                  }

                  const updates = {};
                  if (!currentBadge || currentBadge.id !== expectedBadge.id) updates.badge = expectedBadge;
                  if (effectiveData.avatarBorderMaxId !== expectedMaxBorder.id) updates.avatarBorderMaxId = expectedMaxBorder.id;
                  if (effectiveData.avatarBorderId !== selectedBorderId) updates.avatarBorderId = selectedBorderId;

                  if (Object.keys(updates).length) {
                    await updateDoc(userRef, updates);
                    setUserData({ ...effectiveData, ...updates });
                  } else {
                    setUserData(effectiveData);
                  }
                  }
                } else {
                  const expectedBadge = getBadgeForLevel(effectiveData.level || 1);
                  const expectedMaxBorder = getAvatarBorderForLevel(effectiveData.level || 1);
                  const unlockedBorderIds = getUnlockedAvatarBorders(effectiveData.level || 1).map(b => b.id);

                  const currentBadge = normalizeBadge(effectiveData.badge);
                  const prevMaxBorderId = effectiveData.avatarBorderMaxId || null;

                  let selectedBorderId = effectiveData.avatarBorderId || null;
                  if (!selectedBorderId || selectedBorderId === prevMaxBorderId || !unlockedBorderIds.includes(selectedBorderId)) {
                    selectedBorderId = expectedMaxBorder.id;
                  }

                  const updates = {};
                  if (!currentBadge || currentBadge.id !== expectedBadge.id) updates.badge = expectedBadge;
                  if (effectiveData.avatarBorderMaxId !== expectedMaxBorder.id) updates.avatarBorderMaxId = expectedMaxBorder.id;
                  if (effectiveData.avatarBorderId !== selectedBorderId) updates.avatarBorderId = selectedBorderId;

                  if (Object.keys(updates).length) {
                    await updateDoc(userRef, updates);
                    setUserData({ ...effectiveData, ...updates });
                  } else {
                    setUserData(effectiveData);
                  }
                }
              } else {
                // New user creation
                const isOwner = firebaseUser.uid === OWNER_ID || firebaseUser.email === SPECIAL_EMAIL;
                const defaultRoles = ['user'];
                if (isOwner) {
                  defaultRoles.push('owner', 'admin');
                  if (firebaseUser.email === SPECIAL_EMAIL) {
                    defaultRoles.push('head_admin');
                  }
                }

                const newUserData = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  displayName: firebaseUser.displayName,
                  photoURL: firebaseUser.photoURL,
                  roles: defaultRoles,
                  nsfwEnabled: false,
                  xp: 0,
                  level: 1,
                  badge: getBadgeForLevel(1),
                  isVerifiedDev: false,
                  verifiedDevRequestStatus: null,
                  persona_list: [],
                  stats: {
                    bots_created: 0,
                    messages_sent: 0,
                    likes_received: 0
                  },
                  createdAt: serverTimestamp(),
                  lastLogin: serverTimestamp()
                };

                await setDoc(userRef, newUserData);
                setUserData(newUserData);
              }
            } catch (error) {
              console.error("Error fetching/creating user data:", error);
            }
          } else {
            setUser(null);
            setUserData(null);
            localStorage.removeItem('gemini_auth_active');
          }
          setLoading(false);
        });
      } catch (error) {
        console.error("Failed to initialize auth services:", error);
        setLoading(false);
      }
    })();

    return initPromise.current;
  };

  useEffect(() => {
    const hasSession = localStorage.getItem('gemini_auth_active') === 'true';
    if (hasSession) {
      // Defer initialization to allow initial paint
      setTimeout(() => {
        initializeAuth();
      }, 100);
    } else {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = async () => {
    try {
      // Ensure auth is initialized before trying to sign in
      await initializeAuth();
      
      const { auth, googleProvider, authModule } = await getAuthServices();
      await authModule.signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    // Ensure auth services are loaded to sign out
    const { auth, authModule } = await getAuthServices();
    await authModule.signOut(auth);
    localStorage.removeItem('gemini_auth_active');
    setUser(null);
    setUserData(null);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
      const { db, firestoreModule } = await getFirestoreServices();
      const { doc, getDoc } = firestoreModule;
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        setUserData(userSnap.data());
      }
    } catch (error) {
      console.error("Error refreshing user:", error);
    }
  };

  const isAdmin = () => {
    return userData?.roles?.includes('admin') || user?.uid === OWNER_ID || user?.email === SPECIAL_EMAIL;
  };

  const isOwner = () => {
    return userData?.roles?.includes('owner') || user?.uid === OWNER_ID || user?.email === SPECIAL_EMAIL;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userData, 
      loading, 
      loginWithGoogle, 
      logout,
      refreshUser,
      isAdmin,
      isOwner
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}