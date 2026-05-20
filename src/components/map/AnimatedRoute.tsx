import { Polyline } from 'react-leaflet';

interface AnimatedRouteProps {
  positions: [number, number][];
  color?: string;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ 
  positions, 
  color = '#00FF88' 
}) => {
  return (
    <>
      {/* 1. Low-opacity outer glow layer */}
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
      {/* 2. SOLID robust main path. This is GUARANTEED to display on all mobile and tablet devices even if SVGs with dash animations fail on webkit/blink */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* 3. Overlaying animated movement layer */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#ffffff', // Cool glowing flowing dashes over the colored line
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 15',
          lineCap: 'round',
          lineJoin: 'round',
          className: 'animated-route-glow',
        }}
      />
    </>
  );
};
