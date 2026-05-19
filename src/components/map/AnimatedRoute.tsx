import { Polyline } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface AnimatedRouteProps {
  positions: [number, number][];
  color?: string;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ 
  positions, 
  color = '#00FF88' 
}) => {
  const routeRef = useRef<L.Polyline>(null);

  useEffect(() => {
    if (routeRef.current) {
      const el = routeRef.current.getElement() as SVGPathElement | undefined;
      if (el) {
        el.classList.add('animated-route-glow');
        // Force repaint on mobile
        el.style.display = 'none';
        requestAnimationFrame(() => {
          if (el) el.style.display = '';
        });
      }
    }
  }, [positions]);

  return (
    <>
      {/* Glow layer */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 12,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Animated main route */}
      <Polyline
        ref={routeRef}
        positions={positions}
        pathOptions={{
          color: color,
          weight: 4,
          opacity: 0.95,
          dashArray: '12, 8',
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  );
};
