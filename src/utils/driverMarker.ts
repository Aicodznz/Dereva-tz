import L from 'leaflet';

export function getDriverSvg(type: string, isDark: boolean = true): string {
  const t = (type || '').toLowerCase();
  const isBike = t.includes('bike') || t.includes('pikipiki') || t.includes('delivery') || t.includes('motorcycle');
  const isBajaj = t.includes('bajaj') || t.includes('bajaji') || t.includes('tuktuk');

  if (isBike) {
    return `
      <svg viewBox="0 0 100 120" class="w-9 h-11 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="headlightGlowBike" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#FFE259" stop-opacity="${isDark ? '0.35' : '0.15'}"/>
            <stop offset="100%" stop-color="#FFE259" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bikeBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FF6B35"/>
            <stop offset="100%" stop-color="#FF3F00"/>
          </linearGradient>
        </defs>
        
        <path d="M50,30 L20,-30 L80,-30 Z" fill="url(#headlightGlowBike)" pointer-events="none" />
        <ellipse cx="50" cy="70" rx="14" ry="32" fill="rgba(0,0,0,0.35)" />
        <rect x="46" y="75" width="8" height="22" rx="4" fill="#111827" />
        <rect x="46" y="15" width="8" height="18" rx="3" fill="#374151" />
        <rect x="43" y="25" width="14" height="55" rx="6" fill="#1e1b4b" />
        <rect x="39" y="42" width="22" height="14" rx="3" fill="#4B5563" />
        <rect x="25" y="32" width="50" height="5" rx="2.5" fill="#1F2937" />
        <rect x="23" y="30" width="5" height="9" rx="1" fill="#111827" />
        <rect x="72" y="30" width="5" height="9" rx="1" fill="#111827" />
        <path d="M38,38 C38,34 62,34 62,38 L57,68 C57,72 43,72 43,68 Z" fill="url(#bikeBody)" />
        <rect x="42" y="46" width="16" height="24" rx="8" fill="#111827" />
        <rect x="44" y="50" width="12" height="16" rx="4" fill="#1F2937" />
        <circle cx="50" cy="48" r="10" fill="#3B82F6" />
        <path d="M43,46 C45,41 55,41 57,46" fill="#111827" />
        <rect x="47" y="93" width="6" height="4" rx="1" fill="#EF4444" />
      </svg>
    `;
  } else if (isBajaj) {
    return `
      <svg viewBox="0 0 100 120" class="w-9 h-11 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="headlightGlowBajaj" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#FFE259" stop-opacity="${isDark ? '0.35' : '0.15'}"/>
            <stop offset="100%" stop-color="#FFE259" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bajajBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FBBF24"/>
            <stop offset="100%" stop-color="#D97706"/>
          </linearGradient>
        </defs>

        <path d="M35,32 L5,-35 L50,-35 Z" fill="url(#headlightGlowBajaj)" pointer-events="none" />
        <path d="M65,32 L50,-35 L95,-35 Z" fill="url(#headlightGlowBajaj)" pointer-events="none" />
        <ellipse cx="50" cy="70" rx="26" ry="34" fill="rgba(0,0,0,0.35)" />
        <rect x="12" y="66" width="10" height="22" rx="4" fill="#111827" />
        <rect x="78" y="66" width="10" height="22" rx="4" fill="#111827" />
        <rect x="45" y="20" width="10" height="18" rx="3" fill="#111827" />
        <path d="M22,30 C22,18 78,18 78,30 L74,86 C74,92 26,92 26,86 Z" fill="url(#bajajBody)" />
        <rect x="27" y="32" width="46" height="48" rx="6" fill="#1F2937" />
        <rect x="36" y="32" width="28" height="6" rx="2" fill="#111827" />
        <circle cx="50" cy="35" r="3" fill="#374151" />
        <path d="M25,34 C25,24 75,24 75,34 L71,44 C71,44 29,44 29,44 Z" fill="rgba(147,197,253,0.4)" stroke="#60A5FA" stroke-width="1.5" />
        <rect x="12" y="38" width="6" height="4" rx="1.5" fill="#374151" />
        <rect x="82" y="38" width="6" height="4" rx="1.5" fill="#374151" />
        <path d="M24,42 C24,36 76,36 76,42 L72,82 C72,86 28,86 28,82 Z" fill="#111827" />
        <rect x="34" y="86" width="32" height="4" rx="1" fill="#374151" />
        <rect x="29" y="93" width="8" height="4" rx="1" fill="#EF4444" />
        <rect x="63" y="93" width="8" height="4" rx="1" fill="#EF4444" />
      </svg>
    `;
  } else {
    return `
      <svg viewBox="0 0 100 120" class="w-9 h-11 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="headlightGlowCar" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#E0F2FE" stop-opacity="${isDark ? '0.4' : '0.18'}"/>
            <stop offset="100%" stop-color="#E0F2FE" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="carBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E3A8A"/>
            <stop offset="50%" stop-color="#3B82F6"/>
            <stop offset="100%" stop-color="#1D4ED8"/>
          </linearGradient>
        </defs>

        <path d="M26,20 L-5,-45 L40,-45 Z" fill="url(#headlightGlowCar)" pointer-events="none" />
        <path d="M74,20 L60,-45 L105,-45 Z" fill="url(#headlightGlowCar)" pointer-events="none" />
        <ellipse cx="50" cy="65" rx="30" ry="46" fill="rgba(0,0,0,0.38)" />
        <rect x="15" y="24" width="8" height="18" rx="4" fill="#111827" />
        <rect x="77" y="24" width="8" height="18" rx="4" fill="#111827" />
        <rect x="15" y="76" width="8" height="18" rx="4" fill="#111827" />
        <rect x="77" y="76" width="8" height="18" rx="4" fill="#111827" />
        <rect x="22" y="14" width="56" height="92" rx="28" fill="url(#carBody)" stroke="#60A5FA" stroke-width="1.2" />
        <path d="M28,34 C28,26 72,26 72,34 L68,44 L32,44 Z" fill="#1F2937" stroke="#4B5563" stroke-width="1" />
        <path d="M32,32 L68,32" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.15" />
        <path d="M30,82 C30,85 70,85 70,82 L67,90 L33,90 Z" fill="#1F2937" stroke="#4B5563" stroke-width="1" />
        <rect x="31" y="48" width="38" height="30" rx="4" fill="#111827" />
        <rect x="34" y="52" width="32" height="11" rx="2" fill="#1F2937" />
        <rect x="14" y="38" width="8" height="12" rx="3.5" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1" />
        <rect x="78" y="38" width="8" height="12" rx="3.5" fill="#3B82F6" stroke="#1D4ED8" stroke-width="1" />
        <rect x="27" y="11" width="8" height="4" rx="1.5" fill="#FDE047" />
        <rect x="65" y="11" width="8" height="4" rx="1.5" fill="#FDE047" />
        <rect x="26" y="102" width="12" height="4" rx="1" fill="#EF4444" />
        <rect x="62" y="102" width="12" height="4" rx="1" fill="#EF4444" />
      </svg>
    `;
  }
}

export function createDriverMarkerIcon(
  initials: string,
  isOnline: boolean,
  rotation: number = 0,
  vehicleType: string = 'mini',
  theme: string = 'dark'
) {
  const isDark = theme === 'dark';
  const vehicleSvg = getDriverSvg(vehicleType, isDark);
  const pulseClass = isOnline ? 'animate-pulse' : '';

  // Use a beautifully crafted wrapper representing a professional radar tracking compass dial
  const ringColor = isDark 
    ? 'border-[#00E5A0]/50 shadow-[0_0_12px_rgba(0,229,160,0.3)] bg-slate-950/90' 
    : 'border-[#1E724C]/50 shadow-[0_0_12px_rgba(30,114,76,0.2)] bg-[#FDFBF7]/95';

  const centerAccent = isDark ? 'bg-emerald-500/10' : 'bg-emerald-600/10';

  return L.divIcon({
    className: 'custom-driver-marker-wrapper',
    html: `
      <div class="relative flex items-center justify-center w-[54px] h-[54px]">
        <!-- Rotating GPS Dotted Halo Ring -->
        <div class="absolute inset-0 rounded-full border border-dashed ${isDark ? 'border-[#00E5A0]/20' : 'border-[#1E724C]/25'} animate-spin [animation-duration:12s] pointer-events-none"></div>
        
        <!-- Energetic Pulse Ring -->
        <div class="absolute w-[38px] h-[38px] rounded-full ${isDark ? 'bg-[#00E5A0]/10' : 'bg-[#1E724C]/8'} ${pulseClass} pointer-events-none"></div>
        
        <!-- Compass Outer Body -->
        <div class="absolute w-[44px] h-[44px] rounded-full border ${ringColor} flex items-center justify-end select-none pointer-events-none">
          <!-- Directional indicator pointing north relative to rotation -->
          <div class="absolute inset-0 flex items-center justify-center transition-transform duration-500 ease-out" style="transform: rotate(${rotation}deg);">
            <!-- The pointing arrow accent at the very front -->
            <div class="absolute top-[1.5px] w-1.5 h-1.5 rotate-45 ${isDark ? 'bg-[#00E5A0]' : 'bg-[#1E724C]'} rounded-[1px]"></div>
            
            <!-- Beautiful vehicle render -->
            <div class="w-8 h-8 flex items-center justify-center">
              ${vehicleSvg}
            </div>
          </div>
        </div>
        
        <!-- Small badge for online status -->
        <span class="absolute bottom-1 right-1 w-3 h-3 rounded-full border-2 border-black ${isOnline ? 'bg-emerald-400' : 'bg-zinc-400'} shadow-[0_1px_4px_rgba(0,0,0,0.4)]"></span>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
}
