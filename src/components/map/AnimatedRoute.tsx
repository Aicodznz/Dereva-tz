import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedRouteProps {
  positions: [number, number][];
  color?: string;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ 
  positions, 
  color = '#00E5A0' 
}) => {
  const map = useMap();
  const layersRef = useRef<{
    glowLine?: L.Polyline;
    baseLine?: L.Polyline;
    animatedLine?: L.Polyline;
    animFrameId?: number;
  }>({});

  useEffect(() => {
    if (!map || !positions || positions.length < 2) return;

    const refs = layersRef.current;

    // If layers already exist on the map, update coordinates directly without re-creating SVG elements!
    if (refs.glowLine && refs.baseLine && refs.animatedLine) {
      try {
        refs.glowLine.setLatLngs(positions);
        refs.baseLine.setLatLngs(positions);
        refs.animatedLine.setLatLngs(positions);
        return;
      } catch (e) {
        console.warn("[AnimatedRoute] Update latLngs failed, recreating layers:", e);
      }
    }

    // 1. Cleanup function to wipe previous layers and halt animation
    const cleanup = () => {
      if (refs.animFrameId) {
        cancelAnimationFrame(refs.animFrameId);
        refs.animFrameId = undefined;
      }
      try {
        if (refs.glowLine && map.hasLayer(refs.glowLine)) {
          map.removeLayer(refs.glowLine);
          refs.glowLine = undefined;
        }
        if (refs.baseLine && map.hasLayer(refs.baseLine)) {
          map.removeLayer(refs.baseLine);
          refs.baseLine = undefined;
        }
        if (refs.animatedLine && map.hasLayer(refs.animatedLine)) {
          map.removeLayer(refs.animatedLine);
          refs.animatedLine = undefined;
        }
      } catch (err) {
        console.warn("[AnimatedRoute] Cleanup failed or map already unmounted:", err);
      }
    };

    cleanup();

    // 2. Base semi-transparent thick glow path
    const glowLine = L.polyline(positions, {
      color: color,
      weight: 12,
      opacity: 0.15,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 3. Medium solid path for high-contrast backing
    const baseLine = L.polyline(positions, {
      color: color,
      weight: 5,
      opacity: 0.85,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // 4. White overlapping flowing dash overlay path for the "marching ants" effect
    const animatedLine = L.polyline(positions, {
      color: '#ffffff',
      weight: 4,
      opacity: 0.85,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '15, 12'
    }).addTo(map);

    layersRef.current = {
      glowLine,
      baseLine,
      animatedLine,
      animFrameId: refs.animFrameId
    };

    // 5. Native performance animation loop on SVG stroke-dashoffset
    let offset = 0;
    const animate = () => {
      const el = animatedLine.getElement();
      if (el) {
        offset -= 1.25; // Speed of route movement
        el.setAttribute('stroke-dashoffset', offset.toString());
      }
      layersRef.current.animFrameId = requestAnimationFrame(animate);
    };

    // Begin looping
    animate();

    return () => {
      cleanup();
    };
  }, [map, positions, color]);

  return null;
};
