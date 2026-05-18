import L from 'leaflet';

export function createDriverMarkerIcon(initials: string, isOnline: boolean, rotation: number = 0) {
  const color = isOnline ? '#7F77DD' : '#6b6b8a';
  
  return L.divIcon({
    className: 'custom-driver-marker driver-marker-smooth',
    html: `
      <div class="relative flex items-center justify-center transition-transform duration-500 ease-out" style="transform: rotate(${rotation}deg);">
        ${isOnline ? `<div class="absolute w-12 h-12 bg-[#7F77DD]/20 rounded-full animate-ping"></div>` : ''}
        <div class="w-10 h-10 bg-[#0a0a0f] border-2 border-[#1e1e2e] rounded-2xl flex items-center justify-center shadow-2xl ring-2 ring-[#7F77DD]/30">
          <span class="text-[10px] font-black italic text-[#7F77DD] uppercase">${initials}</span>
        </div>
        <div class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#0a0a0f] rounded-full"></div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
}
