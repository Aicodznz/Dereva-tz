import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getDriverSvg } from '../../utils/driverMarker';

interface SmoothDriverMarkerProps {
  position: [number, number];
  heading?: number;
  vehicleType?: string;
  driverId?: string;
  customVehicle?: any;
  theme?: 'dark' | 'light';
  isAssignedDriver?: boolean;
  onPositionInterpolated?: (pos: [number, number], heading: number) => void;
}

// Calculate shortest path rotation to avoid 360° spin artifacts when crossing 0°/360°
function getShortestAngleDelta(currentAngle: number, targetAngle: number): number {
  const currentNormalized = ((currentAngle % 360) + 360) % 360;
  const targetNormalized = ((targetAngle % 360) + 360) % 360;
  let diff = targetNormalized - currentNormalized;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

// Spherical forward azimuth calculation
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLng = (lng2 - lng1) * rad;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

export const SmoothDriverMarker: React.FC<SmoothDriverMarkerProps> = ({
  position,
  heading,
  vehicleType = 'mini',
  driverId = 'driver',
  customVehicle,
  theme = 'dark',
  isAssignedDriver = true,
  onPositionInterpolated
}) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Position and heading state tracked in refs for smooth 60fps interpolation
  const currentPosRef = useRef<[number, number]>(position);
  const targetPosRef = useRef<[number, number]>(position);
  const accumulatedRotationRef = useRef<number>(heading || 0);
  const targetHeadingRef = useRef<number>(heading || 0);

  const prevRawPosRef = useRef<[number, number] | null>(null);

  // Generate dynamic icon HTML with continuous rotation
  const createIcon = (currentRotation: number) => {
    const isDark = theme === 'dark';
    const mapMarkerLayout = customVehicle?.mapMarkerLayout || 'top_down';

    // Custom side image or top-down image
    if (customVehicle?.mapMarkerUrl && (mapMarkerLayout === 'custom' || mapMarkerLayout === 'custom_side' || mapMarkerLayout === 'custom_top_down')) {
      if (mapMarkerLayout === 'custom_top_down' || (mapMarkerLayout === 'custom' && vehicleType === 'bike')) {
        let finalRotation = currentRotation;
        const orientation = customVehicle.mapMarkerOrientation || 'left';
        if (orientation === 'left') finalRotation += 90;
        else if (orientation === 'right') finalRotation -= 90;
        else if (orientation === 'bottom') finalRotation += 180;

        return L.divIcon({
          className: "smooth-driver-marker-wrapper",
          html: `
            <div class="relative flex items-center justify-center pointer-events-none" style="width: 50px; height: 50px;">
              ${isAssignedDriver ? `
                <div class="absolute w-12 h-12 rounded-full ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-600/20'} animate-ping pointer-events-none"></div>
                <div class="absolute w-10 h-10 rounded-full bg-black/25 blur-[2px] pointer-events-none"></div>
              ` : ''}
              <div id="driver-rot-${driverId}" class="relative flex items-center justify-center pointer-events-none" style="transform: rotate(${finalRotation}deg); width: 44px; height: 44px; transition: transform 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);">
                <img 
                  src="${customVehicle.mapMarkerUrl}" 
                  class="w-11 h-11 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]" 
                  referrerPolicy="no-referrer" 
                />
              </div>
            </div>
          `,
          iconSize: [50, 50],
          iconAnchor: [25, 25]
        });
      } else {
        const normRot = ((currentRotation % 360) + 360) % 360;
        const isMovingEast = normRot > 0 && normRot < 180;
        const flipTransform = isMovingEast ? "scaleX(-1)" : "scaleX(1)";

        return L.divIcon({
          className: "smooth-driver-marker-wrapper",
          html: `
            <div class="relative flex items-center justify-center pointer-events-none" style="width: 44px; height: 44px;">
              ${isAssignedDriver ? `<div class="absolute -inset-2 rounded-full ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-600/20'} animate-ping pointer-events-none"></div>` : ''}
              <div class="absolute bottom-1 w-8 h-2 rounded-full bg-black/45 blur-[1.5px] pointer-events-none"></div>
              <img 
                id="driver-rot-${driverId}"
                src="${customVehicle.mapMarkerUrl}" 
                class="w-9 h-9 object-contain drop-shadow-[0_3px_6px_rgba(0,0,0,0.4)]" 
                style="transform: ${flipTransform}; transition: transform 0.3s ease-out;"
                referrerPolicy="no-referrer" 
              />
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22]
        });
      }
    }

    // Default ultra-smooth top-down vector vehicle with headlights
    return L.divIcon({
      className: "smooth-driver-marker-wrapper",
      html: `
        <div class="relative flex items-center justify-center w-[54px] h-[54px] pointer-events-none">
          <!-- Active Sonar Radar Wave -->
          ${isAssignedDriver ? `
            <div class="absolute w-[42px] h-[42px] rounded-full ${isDark ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-emerald-600/15 border border-emerald-600/30'} animate-ping pointer-events-none"></div>
          ` : ''}
          
          <!-- Outer Ring / Podium Glow -->
          <div class="absolute w-[44px] h-[44px] rounded-full bg-transparent ${isDark ? 'border-emerald-400/60 shadow-[0_0_15px_rgba(16,185,129,0.35)]' : 'border-emerald-600/50 shadow-[0_0_12px_rgba(5,150,105,0.25)]'} border flex items-center justify-center">
            <!-- Rotated Vehicle Chassis Container -->
            <div id="driver-rot-${driverId}" class="select-none pointer-events-none flex items-center justify-center w-8 h-8" style="transform: rotate(${currentRotation}deg); transition: transform 0.35s cubic-bezier(0.2, 0.9, 0.3, 1);">
              
              <!-- Forward Headlight / Navigation Directional Beam (Mwangaza wa Mwelekeo) -->
              <div class="absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none" style="width: 100px; height: 90px; margin-bottom: 2px;">
                <svg viewBox="0 0 100 80" class="w-full h-full overflow-visible">
                  <defs>
                    <radialGradient id="beamGrad_${driverId}" cx="50%" cy="100%" r="100%">
                      <stop offset="0%" stop-color="${isDark ? '#10B981' : '#059669'}" stop-opacity="0.8"/>
                      <stop offset="45%" stop-color="${isDark ? '#10B981' : '#059669'}" stop-opacity="0.35"/>
                      <stop offset="100%" stop-color="${isDark ? '#10B981' : '#059669'}" stop-opacity="0"/>
                    </radialGradient>
                  </defs>
                  <path d="M 50 80 L 10 0 A 90 90 0 0 1 90 0 Z" fill="url(#beamGrad_${driverId})" />
                </svg>
              </div>

              <!-- Directional Notch / Arrow Pointer -->
              <div class="absolute top-[-3px] w-2.5 h-2.5 rotate-45 ${isDark ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]' : 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.7)]'} rounded-[1px] z-10"></div>
              
              <!-- SVG Top-Down Vehicle Body -->
              <div class="w-8 h-8 flex items-center justify-center relative z-10">
                ${getDriverSvg(vehicleType, isDark)}
              </div>
            </div>
          </div>
        </div>
      `,
      iconSize: [54, 54],
      iconAnchor: [27, 27]
    });
  };

  // Mount Leaflet Marker once and keep it synced
  useEffect(() => {
    if (!map) return;

    const initialIcon = createIcon(accumulatedRotationRef.current);
    const marker = L.marker(position, {
      icon: initialIcon,
      zIndexOffset: isAssignedDriver ? 1000 : 500,
      interactive: false,
      keyboard: false
    }).addTo(map);

    markerRef.current = marker;

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
      markerRef.current = null;
    };
  }, [map, driverId, vehicleType, theme, isAssignedDriver]);

  // When new position or heading arrives, perform smooth animation and angle rotation
  useEffect(() => {
    if (!markerRef.current || !Array.isArray(position) || position.length < 2) return;
    const [newLat, newLng] = position;
    if (isNaN(newLat) || isNaN(newLng)) return;

    // Calculate heading dynamically if not supplied or calculate bearing from previous step
    let computedHeading = heading;
    if (typeof computedHeading !== 'number' || isNaN(computedHeading)) {
      if (prevRawPosRef.current) {
        const [prevLat, prevLng] = prevRawPosRef.current;
        const dLat = Math.abs(newLat - prevLat);
        const dLng = Math.abs(newLng - prevLng);
        if (dLat > 0.00001 || dLng > 0.00001) {
          computedHeading = calculateBearing(prevLat, prevLng, newLat, newLng);
        }
      }
    }

    prevRawPosRef.current = [newLat, newLng];

    // Calculate continuous rotation without 360° spin artifacts
    if (typeof computedHeading === 'number' && !isNaN(computedHeading)) {
      const delta = getShortestAngleDelta(accumulatedRotationRef.current, computedHeading);
      accumulatedRotationRef.current += delta;
      targetHeadingRef.current = accumulatedRotationRef.current;

      // Fast update rotation in DOM if element exists
      const rotEl = document.getElementById(`driver-rot-${driverId}`);
      if (rotEl) {
        rotEl.style.transform = `rotate(${accumulatedRotationRef.current}deg)`;
      }
    }

    // Set animation target
    const startLat = currentPosRef.current[0];
    const startLng = currentPosRef.current[1];
    const endLat = newLat;
    const endLng = newLng;
    targetPosRef.current = [endLat, endLng];

    // If jump is huge (> 5km), skip animation and jump directly
    const distMeters = L.latLng(startLat, startLng).distanceTo(L.latLng(endLat, endLng));
    if (distMeters > 5000) {
      currentPosRef.current = [endLat, endLng];
      markerRef.current.setLatLng([endLat, endLng]);
      if (onPositionInterpolated) {
        onPositionInterpolated([endLat, endLng], accumulatedRotationRef.current);
      }
      return;
    }

    // Cancel existing animation loop
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    const duration = 950; // ms (smooth interpolation between GPS updates)
    const startTime = performance.now();

    const animateStep = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out cubic easing for ultra-smooth vehicular braking & acceleration
      const ease = 1 - Math.pow(1 - progress, 3);

      const curLat = startLat + (endLat - startLat) * ease;
      const curLng = startLng + (endLng - startLng) * ease;
      currentPosRef.current = [curLat, curLng];

      if (markerRef.current) {
        markerRef.current.setLatLng([curLat, curLng]);
      }

      if (onPositionInterpolated) {
        onPositionInterpolated([curLat, curLng], accumulatedRotationRef.current);
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animateStep);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(animateStep);
  }, [position[0], position[1], heading, driverId, onPositionInterpolated]);

  return null;
};
