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
        positions={positions}
        pathOptions={{
          color: color,
          weight: 4,
          opacity: 0.95,
          dashArray: '12, 8',
          lineCap: 'round',
          lineJoin: 'round',
          className: 'animated-route-glow',
        }}
      />
    </>
  );
};
