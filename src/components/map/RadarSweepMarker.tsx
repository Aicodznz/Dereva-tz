import React, { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

interface RadarSweepMarkerProps {
  center: [number, number];
}

export const RadarSweepMarker: React.FC<RadarSweepMarkerProps> = ({ center }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const angleRef = useRef<number>(0);

  useEffect(() => {
    if (!map || !center || isNaN(center[0]) || isNaN(center[1])) return;

    const size = 360; // 360px x 360px high-res canvas
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.style.pointerEvents = 'none';

    const ctx = canvas.getContext('2d');

    const customIcon = L.divIcon({
      className: 'radar-sweep-canvas-wrapper',
      html: canvas,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    const marker = L.marker(center, {
      icon: customIcon,
      interactive: false,
      zIndexOffset: 350,
    }).addTo(map);

    markerRef.current = marker;

    const render = () => {
      if (!ctx) return;

      // Increment rotation angle smoothly (approx. 2 degrees per frame = full 360 rotation in ~3 seconds)
      angleRef.current = (angleRef.current + 2.2) % 360;
      const rad = (angleRef.current * Math.PI) / 180;
      const c = size / 2;
      const radius = c - 15;

      ctx.clearRect(0, 0, size, size);

      // 1. Concentric Range Rings (Dashed Amber)
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 8]);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';

      [radius * 0.35, radius * 0.65, radius].forEach((r) => {
        ctx.beginPath();
        ctx.arc(c, c, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // 2. Continuous 360 Radar Sweep Sector (Trailing 55-degree Amber Glow)
      const sweepAngle = (55 * Math.PI) / 180;
      const startAngle = rad - sweepAngle;

      const radialGrad = ctx.createRadialGradient(c, c, 5, c, c, radius);
      radialGrad.addColorStop(0, 'rgba(245, 158, 11, 0.42)');
      radialGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.18)');
      radialGrad.addColorStop(1, 'rgba(245, 158, 11, 0.01)');

      ctx.save();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, radius, startAngle, rad, false);
      ctx.closePath();
      ctx.fillStyle = radialGrad;
      ctx.fill();
      ctx.restore();

      // 3. Leading Radar Sweep Line (Sweeps full 360 degrees endlessly from center to edge)
      const lineEndX = c + Math.cos(rad) * radius;
      const lineEndY = c + Math.sin(rad) * radius;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(lineEndX, lineEndY);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.restore();

      // 4. Center Radar Beacon Node (Matching Red Beacon with White Ring)
      ctx.save();
      // Outer subtle red pulse halo
      ctx.beginPath();
      ctx.arc(c, c, 13, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fill();

      // Main Red Node with thick crisp white border
      ctx.beginPath();
      ctx.arc(c, c, 7.5, 0, Math.PI * 2);
      ctx.fillStyle = '#dc2626';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Bright white inner core
      ctx.beginPath();
      ctx.arc(c, c, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    animFrameIdRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (marker && map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
      markerRef.current = null;
    };
  }, [map, center?.[0], center?.[1]]);

  return null;
};
