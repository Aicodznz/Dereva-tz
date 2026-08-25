import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface AnimatedRouteProps {
  positions: [number, number][];
  color?: string;
  showTrafficSegments?: boolean;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ 
  positions, 
  color = '#2563EB',
  showTrafficSegments = true
}) => {
  const map = useMap();
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!map || !positions || positions.length < 2) return;

    // Clean up previous layers
    if (layersGroupRef.current) {
      map.removeLayer(layersGroupRef.current);
      layersGroupRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    layersGroupRef.current = group;

    // 1. Base Outer Dark Casing / Border (Google Maps style high contrast)
    L.polyline(positions, {
      color: '#0f172a',
      weight: 10,
      opacity: 0.7,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(group);

    // 2. Multi-color traffic rendering if positions has enough points
    if (showTrafficSegments && positions.length >= 6) {
      // Split coordinates into:
      // Section 1: Normal flow (Royal Blue)
      // Section 2: Moderate Traffic / Slowdown (Amber / Orange) - exactly like the user's screenshot
      // Section 3: Normal flow (Royal Blue)
      const len = positions.length;
      const idx1 = Math.floor(len * 0.35);
      const idx2 = Math.floor(len * 0.70);

      const segment1 = positions.slice(0, idx1 + 1);
      const segmentTraffic = positions.slice(idx1, idx2 + 1);
      const segment3 = positions.slice(idx2);

      // Section 1: Royal Blue
      if (segment1.length > 1) {
        L.polyline(segment1, {
          color: '#2563EB', // Royal Blue
          weight: 7,
          opacity: 0.95,
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      }

      // Section 2: Traffic Amber/Orange (Matches the user screenshot)
      if (segmentTraffic.length > 1) {
        L.polyline(segmentTraffic, {
          color: '#F97316', // Vibrant Orange / Amber traffic
          weight: 7,
          opacity: 0.98,
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      }

      // Section 3: Royal Blue
      if (segment3.length > 1) {
        L.polyline(segment3, {
          color: '#2563EB', // Royal Blue
          weight: 7,
          opacity: 0.95,
          smoothFactor: 1,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);
      }
    } else {
      // Fallback single route line
      L.polyline(positions, {
        color: color,
        weight: 7,
        opacity: 0.95,
        smoothFactor: 1,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);
    }

    // 3. Subtle animated flowing chevron/dash overlay
    const animatedLine = L.polyline(positions, {
      color: '#FFFFFF',
      weight: 3.5,
      opacity: 0.55,
      smoothFactor: 1,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '8, 16'
    }).addTo(group);

    let offset = 0;
    const animate = () => {
      const el = animatedLine.getElement();
      if (el) {
        offset -= 0.9;
        el.setAttribute('stroke-dashoffset', offset.toString());
      }
      animFrameIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (layersGroupRef.current) {
        map.removeLayer(layersGroupRef.current);
        layersGroupRef.current = null;
      }
    };
  }, [map, positions, color, showTrafficSegments]);

  return null;
};
