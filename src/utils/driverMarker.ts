import L from 'leaflet';

export function getDriverSvg(type: string, isDark: boolean = true): string {
  const t = (type || '').toLowerCase();
  const isBike = t.includes('bike') || t.includes('pikipiki') || t.includes('delivery') || t.includes('motorcycle');
  const isBajaj = t.includes('bajaj') || t.includes('bajaji') || t.includes('tuktuk');

  if (isBike) {
    return `
      <svg viewBox="0 0 100 120" class="w-10 h-12 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="bikeGlow" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#10B981" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#10B981" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bodyGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34D399"/>
            <stop offset="50%" stop-color="#10B981"/>
            <stop offset="100%" stop-color="#047857"/>
          </linearGradient>
          <linearGradient id="helmetVisor" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#60A5FA"/>
            <stop offset="100%" stop-color="#1D4ED8"/>
          </linearGradient>
          <linearGradient id="tireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1F2937"/>
            <stop offset="50%" stop-color="#374151"/>
            <stop offset="100%" stop-color="#111827"/>
          </linearGradient>
        </defs>

        <!-- Headlight beam -->
        <path d="M50,40 L15,-10 L85,-10 Z" fill="url(#bikeGlow)" pointer-events="none" />

        <!-- Shadow under the entire bike -->
        <ellipse cx="50" cy="65" rx="16" ry="42" fill="rgba(0,0,0,0.35)" filter="blur(2px)" />

        <!-- Rear Wheel & Sprocket -->
        <rect x="46" y="85" width="8" height="24" rx="4" fill="url(#tireGrad)" />
        <rect x="48" y="88" width="4" height="18" fill="#9CA3AF" />

        <!-- Front Wheel -->
        <rect x="46" y="16" width="8" height="20" rx="4" fill="url(#tireGrad)" />
        <rect x="48" y="18" width="4" height="14" fill="#9CA3AF" />

        <!-- Exhaust Pipe (Chrome) -->
        <rect x="57" y="70" width="5" height="24" rx="2.5" fill="none" stroke="#D1D5DB" stroke-width="1.5" />
        <path d="M57,75 L61,75" stroke="#4B5563" stroke-width="2" />
        <rect x="58" y="72" width="3" height="20" rx="1" fill="#9CA3AF" />

        <!-- Main Chassis / Frame -->
        <rect x="42" y="32" width="16" height="58" rx="8" fill="#1E293B" />
        <!-- Engine Details -->
        <rect x="40" y="52" width="20" height="14" rx="3" fill="#4B5563" />
        <rect x="38" y="55" width="24" height="6" rx="1" fill="#374151" />

        <!-- Front Fork Suspension -->
        <line x1="43" y1="20" x2="43" y2="40" stroke="#9CA3AF" stroke-width="2.5" />
        <line x1="57" y1="20" x2="57" y2="40" stroke="#9CA3AF" stroke-width="2.5" />

        <!-- Handlebars -->
        <path d="M22,34 L43,36 M57,36 L78,34" stroke="#111827" stroke-width="4.5" stroke-linecap="round" />
        <!-- Handle Grips -->
        <rect x="18" y="31" width="8" height="6" rx="2" fill="#1F2937" />
        <rect x="74" y="31" width="8" height="6" rx="2" fill="#1F2937" />
        
        <!-- Sleek mirrors -->
        <path d="M25,34 L16,24 M75,34 L84,24" stroke="#4B5563" stroke-width="2" stroke-linecap="round" />
        <circle cx="14" cy="22" r="4" fill="#E5E7EB" stroke="#374151" stroke-width="1.5" />
        <circle cx="86" cy="22" r="4" fill="#E5E7EB" stroke="#374151" stroke-width="1.5" />

        <!-- Fuel Tank / Front Body Cover (glossy green) -->
        <path d="M38,38 C38,32 62,32 62,38 L58,62 C58,66 42,66 42,62 Z" fill="url(#bodyGreen)" />
        <path d="M42,38 Q50,42 58,38" fill="none" stroke="#D1FAE5" stroke-width="1.5" stroke-opacity="0.6" />

        <!-- Textured Seat (Black Leather) -->
        <path d="M42,60 C42,58 58,58 58,60 L56,86 C56,89 44,89 44,86 Z" fill="#111827" />
        <path d="M45,64 C45,63 55,63 55,64 L53,82 C53,84 47,84 47,82 Z" fill="#1F2937" />

        <!-- Tail Unit & License Plate -->
        <rect x="46" y="86" width="8" height="6" rx="1" fill="#047857" />
        <!-- Rear Turning signals -->
        <circle cx="42" cy="89" r="2" fill="#F59E0B" />
        <circle cx="58" cy="89" r="2" fill="#F59E0B" />
        <!-- Brake Light -->
        <rect x="46" y="91" width="8" height="3" rx="1" fill="#EF4444" />

        <!-- RIDER (Helmet & Shoulders) -->
        <!-- Shoulders / Jacket -->
        <path d="M32,54 C32,48 68,48 68,54 L64,72 C64,74 36,74 36,72 Z" fill="#111827" />
        <!-- Helmet Outer -->
        <circle cx="50" cy="56" r="11" fill="#34D399" stroke="#065F46" stroke-width="1.5" />
        <!-- Visor -->
        <path d="M42,50 C44,46 56,46 58,50 L56,53 C54,55 46,55 44,53 Z" fill="url(#helmetVisor)" />
        <path d="M44,49 C46,47 54,47 56,49" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-opacity="0.6" />
      </svg>
    `;
  } else if (isBajaj) {
    return `
      <svg viewBox="0 0 100 120" class="w-10 h-12 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="bajajGlow" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#FBBF24" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="#FBBF24" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bajajChassis" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#34D399"/>
            <stop offset="50%" stop-color="#10B981"/>
            <stop offset="100%" stop-color="#065F46"/>
          </linearGradient>
          <linearGradient id="roofGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="50%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
          <linearGradient id="glassGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#93C5FD" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#1E3A8A" stop-opacity="0.8"/>
          </linearGradient>
        </defs>

        <!-- Dual Front Headlights Beam -->
        <path d="M35,32 L5,-15 L50,-15 Z" fill="url(#bajajGlow)" pointer-events="none" />
        <path d="M65,32 L50,-15 L95,-15 Z" fill="url(#bajajGlow)" pointer-events="none" />

        <!-- Shadow under the entire bajaj -->
        <ellipse cx="50" cy="65" rx="28" ry="42" fill="rgba(0,0,0,0.38)" filter="blur(2px)" />

        <!-- Left & Right Rear Wheels inside arches -->
        <rect x="14" y="65" width="8" height="24" rx="4" fill="#111827" />
        <rect x="78" y="65" width="8" height="24" rx="4" fill="#111827" />

        <!-- Front Wheel Assembly -->
        <rect x="46" y="15" width="8" height="18" rx="3" fill="#111827" />
        <line x1="42" y1="20" x2="58" y2="20" stroke="#9CA3AF" stroke-width="3.5" />

        <!-- Side Mirrors -->
        <path d="M22,32 L10,22 M78,32 L90,22" stroke="#4B5563" stroke-width="2.5" stroke-linecap="round" />
        <rect x="6" y="18" width="6" height="4" rx="1.5" fill="#1F2937" stroke="#4B5563" stroke-width="1" />
        <rect x="88" y="18" width="6" height="4" rx="1.5" fill="#1F2937" stroke="#4B5563" stroke-width="1" />

        <!-- Main Body Chassis (Green base) -->
        <path d="M24,28 C24,18 76,18 76,28 L82,88 C82,94 18,94 18,88 Z" fill="url(#bajajChassis)" stroke="#047857" stroke-width="1" />

        <!-- Front Mudguard / Nose -->
        <path d="M38,20 C38,15 62,15 62,20 L58,32 C58,32 42,32 42,32 Z" fill="url(#bajajChassis)" />

        <!-- Dashboard / Controls Area -->
        <rect x="28" y="30" width="44" height="10" rx="2" fill="#1E293B" />
        <!-- Driver Seat -->
        <rect x="36" y="42" width="28" height="12" rx="4" fill="#111827" />

        <!-- Panoramic Roof & Cabin Structure -->
        <!-- Outer roof outline -->
        <path d="M22,34 Q50,30 78,34 L74,86 Q50,90 26,86 Z" fill="url(#roofGrad)" />

        <!-- Roof longitudinal styling ribs / curves -->
        <path d="M30,36 Q50,32 70,36" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M28,48 Q50,45 72,48" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M27,60 Q50,57 73,60" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M26,72 Q50,69 74,72" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M26,84 Q50,82 74,84" fill="none" stroke="#475569" stroke-width="2" />

        <!-- Green Roof Trim accents -->
        <path d="M22,34 Q50,30 78,34" fill="none" stroke="#34D399" stroke-width="2" />
        <path d="M22,34 L26,86" fill="none" stroke="#34D399" stroke-width="1.5" />
        <path d="M78,34 L74,86" fill="none" stroke="#34D399" stroke-width="1.5" />

        <!-- Front windshield glass (glassmorphic gradient) -->
        <path d="M24,34 C24,26 76,26 76,34 L72,42 C72,42 28,42 28,42 Z" fill="url(#glassGrad)" stroke="#60A5FA" stroke-width="1.2" opacity="0.9" />
        <path d="M30,30 Q50,34 70,30" fill="none" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="0.6" />

        <!-- Left/Right indicator light spots -->
        <circle cx="21" cy="28" r="3" fill="#FFE259" />
        <circle cx="79" cy="28" r="3" fill="#FFE259" />

        <!-- Rear Taillights -->
        <rect x="20" y="88" width="8" height="4" rx="1" fill="#EF4444" />
        <rect x="72" y="88" width="8" height="4" rx="1" fill="#EF4444" />
        <!-- License plate spot -->
        <rect x="42" y="90" width="16" height="3" rx="0.5" fill="#F3F4F6" />
      </svg>
    `;
  } else {
    return `
      <svg viewBox="0 0 100 120" class="w-10 h-12 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="carGlow" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#FFE259" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="#FFE259" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="carBody" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FFFFFF"/>
            <stop offset="50%" stop-color="#F1F5F9"/>
            <stop offset="100%" stop-color="#CBD5E1"/>
          </linearGradient>
          <linearGradient id="windshieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
          <linearGradient id="glassReflection" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.7"/>
            <stop offset="30%" stop-color="#38BDF8" stop-opacity="0.2"/>
            <stop offset="70%" stop-color="#FFFFFF" stop-opacity="0.6"/>
            <stop offset="100%" stop-color="#0284C7" stop-opacity="0.8"/>
          </linearGradient>
        </defs>

        <!-- Dual Headlights Beam -->
        <path d="M26,16 L-10,-40 L35,-40 Z" fill="url(#carGlow)" pointer-events="none" />
        <path d="M74,16 L65,-40 L110,-40 Z" fill="url(#carGlow)" pointer-events="none" />

        <!-- Smooth 3D Drop Shadow -->
        <ellipse cx="50" cy="65" rx="32" ry="48" fill="rgba(0,0,0,0.35)" filter="blur(2.5px)" />

        <!-- Four Wheels (Tires) extending slightly -->
        <rect x="15" y="24" width="8" height="18" rx="4" fill="#111827" />
        <rect x="77" y="24" width="8" height="18" rx="4" fill="#111827" />
        <rect x="15" y="78" width="8" height="18" rx="4" fill="#111827" />
        <rect x="77" y="78" width="8" height="18" rx="4" fill="#111827" />

        <!-- Main Car Shell (Glossy white body with panel curves) -->
        <rect x="22" y="14" width="56" height="92" rx="28" fill="url(#carBody)" stroke="#E2E8F0" stroke-width="1.5" />

        <!-- Panel outline lines (Hood & Trunk) -->
        <!-- Hood Panel lines -->
        <path d="M30,32 C30,22 70,22 70,32" fill="none" stroke="#CBD5E1" stroke-width="1.2" />
        <path d="M36,14 L38,30 M64,14 L62,30" fill="none" stroke="#CBD5E1" stroke-width="1" />
        
        <!-- Trunk Panel lines -->
        <path d="M28,84 C28,94 72,94 72,84" fill="none" stroke="#CBD5E1" stroke-width="1.2" />
        <path d="M34,92 L36,104 M66,92 L64,104" fill="none" stroke="#CBD5E1" stroke-width="1" />

        <!-- Side Mirrors -->
        <path d="M14,38 C14,35 22,36 22,38 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
        <rect x="14" y="38" width="8" height="10" rx="2" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />
        <path d="M86,38 C86,35 78,36 78,38 Z" fill="#FFFFFF" stroke="#CBD5E1" stroke-width="1" />
        <rect x="78" y="38" width="8" height="10" rx="2" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1" />

        <!-- Headlights at Front Bumper -->
        <rect x="26" y="13" width="8" height="4" rx="2" fill="#FFFBEB" stroke="#FBBF24" stroke-width="1" />
        <rect x="66" y="13" width="8" height="4" rx="2" fill="#FFFBEB" stroke="#FBBF24" stroke-width="1" />

        <!-- Panoramic Roof & Windscreens (Full Glass Capsule) -->
        <path d="M28,34 Q50,30 72,34 L68,82 Q50,85 32,82 Z" fill="url(#windshieldGrad)" stroke="#1E293B" stroke-width="2" />
        
        <!-- Sleek light blue reflection on glass -->
        <path d="M28,34 Q50,30 72,34 L68,82 Q50,85 32,82 Z" fill="url(#glassReflection)" opacity="0.45" />

        <!-- Cross beams / roof structure separators -->
        <!-- Front Windshield arc -->
        <path d="M29,42 Q50,39 71,42" fill="none" stroke="#0F172A" stroke-width="1.5" />
        <!-- Rear Window arc -->
        <path d="M31,74 Q50,71 69,74" fill="none" stroke="#0F172A" stroke-width="1.5" />

        <!-- Bumper details (Rear red reflectors and license plate) -->
        <rect x="28" y="102" width="10" height="3" rx="1" fill="#EF4444" />
        <rect x="62" y="102" width="10" height="3" rx="1" fill="#EF4444" />
        <rect x="42" y="103" width="16" height="2" rx="0.5" fill="#F8FAFC" />
      </svg>
    `;
  }
}

export function createDriverMarkerIcon(
  initials: string,
  isOnline: boolean,
  vehicleHeading: number = 0,
  vehicleType: string = 'mini',
  theme: string = 'dark',
  compassHeading?: number
) {
  const isDark = theme === 'dark';
  const vehicleSvg = getDriverSvg(vehicleType, isDark);
  const pulseClass = isOnline ? 'animate-pulse' : '';
  
  // If compassHeading is not provided, fallback to vehicleHeading
  const finalCompassHeading = typeof compassHeading === 'number' ? compassHeading : vehicleHeading;

  // Use a beautifully crafted wrapper representing a professional radar tracking compass dial (bg-transparent so it never obscures the map with a solid black or white disk)
  const ringColor = isDark 
    ? 'border-[#00E5A0]/60 shadow-[0_0_12px_rgba(0,229,160,0.35)] bg-transparent' 
    : 'border-[#1E724C]/60 shadow-[0_0_12px_rgba(30,114,76,0.25)] bg-transparent';

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
        <div class="absolute w-[44px] h-[44px] rounded-full border ${ringColor} flex items-center justify-center select-none pointer-events-none">
          
          <!-- COMPASS BEAM / FLASHLIGHT: Rotates with phone compass orientation -->
          <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style="transform: rotate(${finalCompassHeading}deg);">
            <!-- Compass Heading Flashlight Light Beam / Field-of-View Cone (Mwangaza wa Dira ya Simu) -->
            <div class="absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none" style="width: 100px; height: 90px; margin-bottom: 2px;">
              <svg viewBox="0 0 100 90" class="w-full h-full overflow-visible">
                <defs>
                  <radialGradient id="driverCompassBeamGrad_${isDark ? 'dark' : 'light'}" cx="50%" cy="100%" r="100%">
                    <stop offset="0%" stop-color="${isDark ? '#00FF88' : '#3B82F6'}" stop-opacity="0.75"/>
                    <stop offset="45%" stop-color="${isDark ? '#00FF88' : '#3B82F6'}" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="${isDark ? '#00FF88' : '#3B82F6'}" stop-opacity="0"/>
                  </radialGradient>
                </defs>
                <!-- Directional Light Cone Sector spanning ~55 degrees pointing forward -->
                <path d="M 50 90 L 12 0 A 85 85 0 0 1 88 0 Z" fill="url(#driverCompassBeamGrad_${isDark ? 'dark' : 'light'})" />
              </svg>
            </div>

            <!-- The pointing arrow accent at the very front -->
            <div class="absolute top-[1px] w-2 h-2 rotate-45 ${isDark ? 'bg-[#00FF88]' : 'bg-[#3B82F6]'} rounded-[1px] shadow-[0_0_8px_rgba(0,255,136,0.9)] z-10"></div>
          </div>

          <!-- VEHICLE ICON: Rotates with travel heading (vehicleHeading) -->
          <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style="transform: rotate(${vehicleHeading}deg);">
            <!-- Beautiful vehicle render -->
            <div class="w-8 h-8 flex items-center justify-center relative z-10">
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
