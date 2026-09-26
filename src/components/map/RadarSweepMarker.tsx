import React, { useEffect, useState, useMemo } from 'react';
import { Polygon, Polyline, Circle, Marker } from 'react-leaflet';
import L from 'leaflet';

interface RadarSweepMarkerProps {
  center: [number, number];
  radiusMeters?: number;
}

// Calculate precise spherical destination point given distance (meters) and bearing (degrees)
function getDestinationPoint(center: [number, number], distanceMeters: number, bearingDegrees: number): [number, number] {
  const rad = bearingDegrees * (Math.PI / 180);
  const latRad = center[0] * (Math.PI / 180);
  
  // 1 degree latitude ~ 111,320 meters
  const dLat = (distanceMeters * Math.cos(rad)) / 111320;
  // 1 degree longitude ~ 111,320 * cos(lat) meters
  const dLng = (distanceMeters * Math.sin(rad)) / (111320 * Math.cos(latRad));
  
  return [center[0] + dLat, center[1] + dLng];
}

export const RadarSweepMarker: React.FC<RadarSweepMarkerProps> = ({ 
  center, 
  radiusMeters = 850 
}) => {
  const [currentAngle, setCurrentAngle] = useState(0);

  // Smooth continuous 360-degree rotation loop
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const delta = now - lastTime;
      // Update at ~40fps for high smoothness and zero battery drain
      if (delta >= 24) {
        // Rotates ~90 degrees per second -> full 360 rotation in ~4 seconds
        setCurrentAngle((prev) => (prev + (delta * 0.085)) % 360);
        lastTime = now;
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Compute the full sweep geometry touching the exact outer perimeter
  const { sectorPositions, leadingLinePositions } = useMemo(() => {
    const sweepDegrees = 55; // 55-degree scanning cone
    const steps = 14;
    const arcPoints: [number, number][] = [];

    for (let i = 0; i <= steps; i++) {
      const angle = currentAngle - sweepDegrees + (i / steps) * sweepDegrees;
      arcPoints.push(getDestinationPoint(center, radiusMeters, angle));
    }

    const sector: [number, number][] = [center, ...arcPoints, center];
    const leadingLine: [number, number][] = [center, arcPoints[arcPoints.length - 1]];

    return {
      sectorPositions: sector,
      leadingLinePositions: leadingLine,
    };
  }, [center[0], center[1], radiusMeters, currentAngle]);

  return (
    <>
      {/* 1. Concentric Range Circles (Dashed Amber) */}
      <Circle
        center={center}
        radius={Math.round(radiusMeters * 0.35)}
        pathOptions={{
          color: '#f59e0b',
          weight: 1.2,
          fillColor: '#f59e0b',
          fillOpacity: 0.04,
          dashArray: '5, 8',
        }}
      />
      <Circle
        center={center}
        radius={Math.round(radiusMeters * 0.68)}
        pathOptions={{
          color: '#f59e0b',
          weight: 1.2,
          fillColor: '#f59e0b',
          fillOpacity: 0.03,
          dashArray: '6, 10',
        }}
      />
      <Circle
        center={center}
        radius={radiusMeters}
        pathOptions={{
          color: '#f59e0b',
          weight: 1.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.02,
          dashArray: '8, 12',
        }}
      />

      {/* 2. Trailing Amber Radar Sector Cone (Rotates full 360 degrees) */}
      <Polygon
        positions={sectorPositions}
        pathOptions={{
          color: '#f59e0b',
          weight: 0.5,
          fillColor: '#f59e0b',
          fillOpacity: 0.22,
          opacity: 0.4,
        }}
      />

      {/* 3. Leading Radar Sweep Line (Extends all the way from center to outer circle) */}
      <Polyline
        positions={leadingLinePositions}
        pathOptions={{
          color: '#fbbf24',
          weight: 2.8,
          opacity: 0.95,
        }}
      />

      {/* 4. Center Beacon (Red Node with crisp white ring) */}
      <Marker
        position={center}
        icon={L.divIcon({
          className: 'radar-center-beacon-marker',
          html: `
            <div class="relative flex items-center justify-center w-8 h-8 pointer-events-none select-none">
              <span class="absolute w-7 h-7 rounded-full bg-red-500/25 animate-ping"></span>
              <div class="relative w-5 h-5 rounded-full bg-red-600 border-2 border-white shadow-[0_0_12px_rgba(239,68,68,0.9)] flex items-center justify-center">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })}
      />
    </>
  );
};
