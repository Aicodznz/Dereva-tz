import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { db } from '../firebase';
import {
  describeAppPath,
  getClientDeviceSummary,
  logUserActivity,
  markUserOffline,
  upsertUserPresence,
} from '../utils/userActivityTracker';

const CITY_FALLBACK_COORDS: Record<string, { lat: number; lng: number }> = {
  'dar es salaam': { lat: -6.7924, lng: 39.2083 },
  arusha: { lat: -3.3731, lng: 36.6853 },
  dodoma: { lat: -6.1731, lng: 35.7419 },
  mwanza: { lat: -2.5164, lng: 32.9009 },
  mbeya: { lat: -8.9094, lng: 33.4608 },
  zanzibar: { lat: -6.1659, lng: 39.2026 },
  morogoro: { lat: -6.8278, lng: 37.6591 },
  tanga: { lat: -5.0689, lng: 39.0987 },
};

export const PresenceAndActivityMonitor: React.FC = () => {
  const { user, profile, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
    source: 'gps' | 'profile' | 'city';
  } | null>(null);

  const sessionStartRef = useRef<number>(Date.now());
  const trailRef = useRef<Array<{ lat: number; lng: number; atMs: number; path?: string }>>([]);
  const lastLoggedRouteRef = useRef<{ path: string; atMs: number }>({ path: '', atMs: 0 });
  const handledCommandIdRef = useRef<string>('');
  const coordsRef = useRef(coords);
  coordsRef.current = coords;

  const currentFullPath = `${location.pathname}${location.search || ''}`;

  // Reset session start timestamp whenever UID changes
  useEffect(() => {
    if (user?.uid) {
      sessionStartRef.current = Date.now();
      trailRef.current = [];
      handledCommandIdRef.current = '';
    }
  }, [user?.uid]);

  // Acquire browser GPS silently, fallback cleanly to profile.location or city coords
  useEffect(() => {
    if (!user?.uid) return;

    const applyFallbackLocation = () => {
      if (
        profile?.location &&
        typeof profile.location.lat === 'number' &&
        typeof profile.location.lng === 'number' &&
        !(profile.location.lat === 0 && profile.location.lng === 0)
      ) {
        setCoords((prev) =>
          prev?.source === 'gps'
            ? prev
            : {
                lat: profile.location!.lat,
                lng: profile.location!.lng,
                accuracy: null,
                source: 'profile',
              }
        );
        return;
      }

      const cityKey = String(profile?.city || 'dar es salaam').toLowerCase().trim();
      const matched =
        Object.entries(CITY_FALLBACK_COORDS).find(([k]) => cityKey.includes(k))?.[1] ||
        CITY_FALLBACK_COORDS['dar es salaam'];

      setCoords((prev) =>
        prev?.source === 'gps' || prev?.source === 'profile'
          ? prev
          : {
              lat: matched.lat,
              lng: matched.lng,
              accuracy: null,
              source: 'city',
            }
      );
    };

    applyFallbackLocation();

    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    const onGeoSuccess = (pos: GeolocationPosition) => {
      setCoords({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
        source: 'gps',
      });
    };

    navigator.geolocation.getCurrentPosition(onGeoSuccess, applyFallbackLocation, {
      enableHighAccuracy: true,
      maximumAge: 30000,
      timeout: 8000,
    });

    const watchId = navigator.geolocation.watchPosition(onGeoSuccess, () => {}, {
      enableHighAccuracy: false,
      maximumAge: 45000,
      timeout: 15000,
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.uid, profile?.location?.lat, profile?.location?.lng, profile?.city]);

  // Listen to user_presence/{uid} for trail sync & real-time admin remote commands
  useEffect(() => {
    if (!user?.uid) return;

    const unsub = onSnapshot(
      doc(db, 'user_presence', user.uid),
      async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as any;

        if (Array.isArray(data.locationTrail)) {
          trailRef.current = data.locationTrail;
        }

        const cmd = data.adminCommand;
        if (!cmd || !cmd.id) return;
        if (handledCommandIdRef.current === cmd.id) return;
        if (typeof cmd.issuedAtMs === 'number' && cmd.issuedAtMs < sessionStartRef.current - 5000) {
          handledCommandIdRef.current = cmd.id;
          return;
        }
        if (cmd.acknowledgedAtMs) {
          handledCommandIdRef.current = cmd.id;
          return;
        }

        handledCommandIdRef.current = cmd.id;

        // Acknowledge receipt immediately so it doesn't replay on reload
        setDoc(
          doc(db, 'user_presence', user.uid),
          {
            adminCommand: {
              ...cmd,
              acknowledgedAtMs: Date.now(),
            },
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        ).catch(() => {});

        if (cmd.type === 'alert') {
          toast.warning(cmd.title || 'Ujumbe kutoka kwa Admin', {
            description: cmd.message || '',
            duration: 12000,
          });
        } else if (cmd.type === 'navigate' && typeof cmd.targetPath === 'string' && cmd.targetPath.startsWith('/')) {
          toast.info('Admin amekuelekeza kwenye ukurasa mpya', {
            description: describeAppPath(cmd.targetPath),
            duration: 5000,
          });
          navigate(cmd.targetPath);
        } else if (cmd.type === 'force_logout') {
          toast.error('Kikao chako kimefungwa na Admin.', {
            description: cmd.message || 'Tafadhali wasiliana na msimamizi au ingia tena.',
            duration: 10000,
          });
          await logUserActivity({
            uid: user.uid,
            userName: profile?.displayName || profile?.fullName || user.displayName || '',
            userEmail: profile?.email || user.email || '',
            userPhone: profile?.phoneNumber || profile?.phone || '',
            role: profile?.role || 'customer',
            action: 'FORCE_LOGOUT_EXECUTED',
            title: 'Ametolewa kwenye mfumo na Admin',
            details: cmd.message || 'Admin amefunga kikao cha mtumiaji huyu',
            path: currentFullPath,
            category: 'admin',
            lat: coordsRef.current?.lat,
            lng: coordsRef.current?.lng,
          });
          await markUserOffline(user.uid, 'Ametolewa na Admin');
          await logout();
          navigate('/login', { replace: true });
        }
      },
      (err) => {
        console.warn('Presence command listener warning:', err);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // Log route navigation & sync presence whenever path/profile/coords change
  useEffect(() => {
    if (!user?.uid) return;

    const displayName =
      profile?.displayName ||
      profile?.fullName ||
      user.displayName ||
      (user.isAnonymous ? 'Mgeni' : user.email?.split('@')[0] || 'Mtumiaji');
    const phone = profile?.phoneNumber || profile?.phone || user.phoneNumber || '';
    const email = profile?.email || user.email || '';
    const role = profile?.role || 'customer';
    const pageLabel = describeAppPath(location.pathname);

    upsertUserPresence({
      uid: user.uid,
      displayName,
      email,
      phone,
      photoURL: profile?.photoURL || user.photoURL || '',
      role,
      status: profile?.status || 'active',
      isOnline: true,
      currentPath: currentFullPath,
      currentPageLabel: pageLabel,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      accuracy: coords?.accuracy ?? null,
      locationSource: coords?.source ?? 'none',
      device: getClientDeviceSummary(),
      sessionStartedAtMs: sessionStartRef.current,
      existingTrail: trailRef.current,
      isAnonymous: user.isAnonymous,
    });

    const now = Date.now();
    const sameRouteRecently =
      lastLoggedRouteRef.current.path === location.pathname &&
      now - lastLoggedRouteRef.current.atMs < 5000;

    if (!sameRouteRecently) {
      lastLoggedRouteRef.current = { path: location.pathname, atMs: now };
      logUserActivity({
        uid: user.uid,
        userName: displayName,
        userEmail: email,
        userPhone: phone,
        role,
        action: 'PAGE_VIEW',
        title: `Amefungua: ${pageLabel}`,
        details: `Njia: ${currentFullPath}`,
        path: currentFullPath,
        pageLabel,
        category: 'navigation',
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
    }
  }, [
    user?.uid,
    location.pathname,
    location.search,
    profile?.role,
    profile?.displayName,
    profile?.status,
    coords?.lat,
    coords?.lng,
  ]);

  // Periodic 25s heartbeat while app is open & visible, plus offline mark on tab close
  useEffect(() => {
    if (!user?.uid) return;

    const pushHeartbeat = (online: boolean) => {
      const displayName =
        profile?.displayName ||
        profile?.fullName ||
        user.displayName ||
        (user.isAnonymous ? 'Mgeni' : user.email?.split('@')[0] || 'Mtumiaji');
      upsertUserPresence({
        uid: user.uid,
        displayName,
        email: profile?.email || user.email || '',
        phone: profile?.phoneNumber || profile?.phone || user.phoneNumber || '',
        photoURL: profile?.photoURL || user.photoURL || '',
        role: profile?.role || 'customer',
        status: profile?.status || 'active',
        isOnline: online,
        currentPath: currentFullPath,
        currentPageLabel: describeAppPath(location.pathname),
        lat: coordsRef.current?.lat ?? null,
        lng: coordsRef.current?.lng ?? null,
        accuracy: coordsRef.current?.accuracy ?? null,
        locationSource: coordsRef.current?.source ?? 'none',
        device: getClientDeviceSummary(),
        sessionStartedAtMs: sessionStartRef.current,
        existingTrail: trailRef.current,
        isAnonymous: user.isAnonymous,
      });
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        pushHeartbeat(true);
      }
    }, 25000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        pushHeartbeat(true);
      }
    };

    const handleUnload = () => {
      markUserOffline(user.uid, 'Amefunga ukurasa wa app');
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleUnload);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleUnload);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [user?.uid, profile?.role, profile?.displayName, profile?.status, currentFullPath]);

  return null;
};
