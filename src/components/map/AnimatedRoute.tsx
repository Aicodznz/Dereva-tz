import { Polyline } from 'react-leaflet';

interface AnimatedRouteProps {
  positions: [number, number][];
  color?: string;
}

export const AnimatedRoute: React.FC<AnimatedRouteProps> = ({ 
  positions, 
  color = '#00E5A0' 
}) => {
  return (
    <>
      {/* 1. Low-opacity outer glow layer */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 12,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* 2. SOLID robust main path */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: color,
          weight: 5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* 3. Overlaying animated movement layer (marching ants) */}
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#ffffff', // Cool glowing flowing dashes over the colored line
          weight: 5,
          opacity: 0.7,
          dashArray: '12, 10',
          lineCap: 'round',
          lineJoin: 'round',
          className: 'animated-route-glow',
        }}
      />
    </>
  );
};
