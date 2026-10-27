import L from 'leaflet';

export function getDriverSvg(type: string, isDark: boolean = true): string {
  const t = (type || 'car').toLowerCase();
  const isBike = t.includes('bike') || t.includes('pikipiki') || t.includes('delivery') || t.includes('motorcycle') || t.includes('boda') || t.includes('bodaboda');
  const isBajaj = t.includes('bajaj') || t.includes('bajaji') || t.includes('tuktuk');

  if (isBike) {
    return `
      <svg viewBox="0 0 100 120" class="w-10 h-12 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="bikeGlow_${isDark ? 'dark' : 'light'}" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#F97316" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bodyOrange_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FB923C"/>
            <stop offset="50%" stop-color="#F97316"/>
            <stop offset="100%" stop-color="#C2410C"/>
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
        <path d="M50,40 L15,-10 L85,-10 Z" fill="url(#bikeGlow_${isDark ? 'dark' : 'light'})" pointer-events="none" />

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

        <!-- Fuel Tank / Front Body Cover (glossy Papo Orange) -->
        <path d="M38,38 C38,32 62,32 62,38 L58,62 C58,66 42,66 42,62 Z" fill="url(#bodyOrange_${isDark ? 'dark' : 'light'})" />
        <path d="M42,38 Q50,42 58,38" fill="none" stroke="#FFEDD5" stroke-width="1.5" stroke-opacity="0.7" />

        <!-- Textured Seat (Black Leather) -->
        <path d="M42,60 C42,58 58,58 58,60 L56,86 C56,89 44,89 44,86 Z" fill="#111827" />
        <path d="M45,64 C45,63 55,63 55,64 L53,82 C53,84 47,84 47,82 Z" fill="#1F2937" />

        <!-- Tail Unit & License Plate (Orange) -->
        <rect x="46" y="86" width="8" height="6" rx="1" fill="#C2410C" />
        <!-- Rear Turning signals -->
        <circle cx="42" cy="89" r="2" fill="#F59E0B" />
        <circle cx="58" cy="89" r="2" fill="#F59E0B" />
        <!-- Brake Light -->
        <rect x="46" y="91" width="8" height="3" rx="1" fill="#EF4444" />

        <!-- RIDER (Helmet & Shoulders) -->
        <!-- Shoulders / Jacket -->
        <path d="M32,54 C32,48 68,48 68,54 L64,72 C64,74 36,74 36,72 Z" fill="#111827" />
        <!-- Helmet Outer (Papo Orange) -->
        <circle cx="50" cy="56" r="11" fill="#FB923C" stroke="#9A3412" stroke-width="1.5" />
        <!-- Visor -->
        <path d="M42,50 C44,46 56,46 58,50 L56,53 C54,55 46,55 44,53 Z" fill="url(#helmetVisor)" />
        <path d="M44,49 C46,47 54,47 56,49" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-opacity="0.6" />
      </svg>
    `;
  } else if (isBajaj) {
    return `
      <svg viewBox="0 0 100 120" class="w-10 h-12 overflow-visible" style="display: block; margin: auto;">
        <defs>
          <linearGradient id="bajajGlow_${isDark ? 'dark' : 'light'}" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#F97316" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="bajajChassis_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FB923C"/>
            <stop offset="45%" stop-color="#F97316"/>
            <stop offset="100%" stop-color="#C2410C"/>
          </linearGradient>
          <linearGradient id="roofGrad_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E293B"/>
            <stop offset="50%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
          <linearGradient id="glassGrad_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#93C5FD" stop-opacity="0.8"/>
            <stop offset="100%" stop-color="#1E3A8A" stop-opacity="0.8"/>
          </linearGradient>
        </defs>

        <!-- Dual Front Headlights Beam -->
        <path d="M35,32 L5,-15 L50,-15 Z" fill="url(#bajajGlow_${isDark ? 'dark' : 'light'})" pointer-events="none" />
        <path d="M65,32 L50,-15 L95,-15 Z" fill="url(#bajajGlow_${isDark ? 'dark' : 'light'})" pointer-events="none" />

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

        <!-- Main Body Chassis (Papo Orange base) -->
        <path d="M24,28 C24,18 76,18 76,28 L82,88 C82,94 18,94 18,88 Z" fill="url(#bajajChassis_${isDark ? 'dark' : 'light'})" stroke="#9A3412" stroke-width="1.2" />

        <!-- Front Mudguard / Nose -->
        <path d="M38,20 C38,15 62,15 62,20 L58,32 C58,32 42,32 42,32 Z" fill="url(#bajajChassis_${isDark ? 'dark' : 'light'})" />

        <!-- Dashboard / Controls Area -->
        <rect x="28" y="30" width="44" height="10" rx="2" fill="#1E293B" />
        <!-- Driver Seat -->
        <rect x="36" y="42" width="28" height="12" rx="4" fill="#111827" />

        <!-- Panoramic Roof & Cabin Structure -->
        <!-- Outer roof outline -->
        <path d="M22,34 Q50,30 78,34 L74,86 Q50,90 26,86 Z" fill="url(#roofGrad_${isDark ? 'dark' : 'light'})" />

        <!-- Roof longitudinal styling ribs / curves -->
        <path d="M30,36 Q50,32 70,36" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M28,48 Q50,45 72,48" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M27,60 Q50,57 73,60" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M26,72 Q50,69 74,72" fill="none" stroke="#475569" stroke-width="2.5" />
        <path d="M26,84 Q50,82 74,84" fill="none" stroke="#475569" stroke-width="2" />

        <!-- Orange Roof Trim accents -->
        <path d="M22,34 Q50,30 78,34" fill="none" stroke="#FB923C" stroke-width="2" />
        <path d="M22,34 L26,86" fill="none" stroke="#FB923C" stroke-width="1.5" />
        <path d="M78,34 L74,86" fill="none" stroke="#FB923C" stroke-width="1.5" />

        <!-- Front windshield glass (glassmorphic gradient) -->
        <path d="M24,34 C24,26 76,26 76,34 L72,42 C72,42 28,42 28,42 Z" fill="url(#glassGrad_${isDark ? 'dark' : 'light'})" stroke="#60A5FA" stroke-width="1.2" opacity="0.9" />
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
      <svg viewBox="0 0 50 96" class="w-[26px] h-[50px] overflow-visible" style="display: block; margin: auto;">
        <defs>
          <!-- Forward Headlight Illuminating Beam with soft gradient -->
          <linearGradient id="carHeadlightBeam_${isDark ? 'dark' : 'light'}" x1="50%" y1="100%" x2="50%" y2="0%">
            <stop offset="0%" stop-color="#FFEDD5" stop-opacity="${isDark ? '0.45' : '0.35'}"/>
            <stop offset="40%" stop-color="#F97316" stop-opacity="${isDark ? '0.2' : '0.12'}"/>
            <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
          </linearGradient>

          <!-- Ultra-Sleek Metallic Papo Orange Body -->
          <linearGradient id="carBodyGrad_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#C2410C"/>
            <stop offset="18%" stop-color="#EA580C"/>
            <stop offset="50%" stop-color="#FB923C"/>
            <stop offset="82%" stop-color="#EA580C"/>
            <stop offset="100%" stop-color="#C2410C"/>
          </linearGradient>

          <!-- Tinted Glass Canopy (Windshields & Sunroof) -->
          <linearGradient id="carGlassGrad_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#0F172A"/>
            <stop offset="40%" stop-color="#1E293B"/>
            <stop offset="70%" stop-color="#1E293B"/>
            <stop offset="100%" stop-color="#0B132B"/>
          </linearGradient>

          <!-- Glass Specular Reflection Streak -->
          <linearGradient id="glassStreak_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#FED7AA" stop-opacity="0.75"/>
            <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0.6"/>
            <stop offset="60%" stop-color="#FB923C" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#F97316" stop-opacity="0"/>
          </linearGradient>

          <!-- Tire Gradient -->
          <linearGradient id="tireGrad_${isDark ? 'dark' : 'light'}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#0F172A"/>
            <stop offset="50%" stop-color="#334155"/>
            <stop offset="100%" stop-color="#0F172A"/>
          </linearGradient>
        </defs>

        <!-- Forward Road Illumination Beams (Crisp directional light cone) -->
        <path d="M14,16 L-10,-32 L22,-32 Z" fill="url(#carHeadlightBeam_${isDark ? 'dark' : 'light'})" pointer-events="none" />
        <path d="M36,16 L28,-32 L60,-32 Z" fill="url(#carHeadlightBeam_${isDark ? 'dark' : 'light'})" pointer-events="none" />

        <!-- Clean Ground Shadow (Ambient contact shadow underneath chassis) -->
        <ellipse cx="25" cy="50" rx="19" ry="38" fill="rgba(0,0,0,0.32)" />

        <!-- 4 Realistic Tires with Subtle Inset -->
        <rect x="3.5" y="19" width="6" height="15" rx="3" fill="url(#tireGrad_${isDark ? 'dark' : 'light'})" />
        <rect x="40.5" y="19" width="6" height="15" rx="3" fill="url(#tireGrad_${isDark ? 'dark' : 'light'})" />
        <rect x="3.5" y="62" width="6" height="15" rx="3" fill="url(#tireGrad_${isDark ? 'dark' : 'light'})" />
        <rect x="40.5" y="62" width="6" height="15" rx="3" fill="url(#tireGrad_${isDark ? 'dark' : 'light'})" />

        <!-- Main Aerodynamic Chassis Body in Papo Orange -->
        <path d="M12,18 C12,10 38,10 38,18 L41,48 C42,66 39,84 37,86 C35,88 15,88 13,86 C11,84 8,66 9,48 Z" 
              fill="url(#carBodyGrad_${isDark ? 'dark' : 'light'})" 
              stroke="#9A3412" 
              stroke-width="1.1" 
              stroke-linejoin="round" />

        <!-- Hood Crease Lines -->
        <path d="M16,14 L18,29 C18,31 32,31 32,29 L34,14" fill="none" stroke="#EA580C" stroke-width="0.9" />
        <path d="M21,11 L21,26 M29,11 L29,26" fill="none" stroke="#FDBA74" stroke-width="0.6" />

        <!-- Front Xenon / LED Headlights -->
        <path d="M11,15 Q15,13 18,17 L17,20 Q13,18 10,18 Z" fill="#FEF08A" stroke="#EAB308" stroke-width="0.6" />
        <path d="M39,15 Q35,13 32,17 L33,20 Q37,18 40,18 Z" fill="#FEF08A" stroke="#EAB308" stroke-width="0.6" />
        <!-- Inner projector bulb dots -->
        <circle cx="14" cy="16.5" r="1.3" fill="#FFFFFF" />
        <circle cx="36" cy="16.5" r="1.3" fill="#FFFFFF" />

        <!-- Aerodynamic Side Mirrors (Papo Orange) -->
        <path d="M8,30 C5,30 4,34 7,36 L10,34 Z" fill="#F97316" stroke="#9A3412" stroke-width="0.8" />
        <path d="M42,30 C45,30 46,34 43,36 L40,34 Z" fill="#F97316" stroke="#9A3412" stroke-width="0.8" />
        <circle cx="7" cy="33" r="1" fill="#FFEDD5" opacity="0.8" />
        <circle cx="43" cy="33" r="1" fill="#FFEDD5" opacity="0.8" />

        <!-- Front Windshield Glass -->
        <path d="M13.5,31 C15,26 35,26 36.5,31 L35,42 C35,43 15,43 15,42 Z" fill="url(#carGlassGrad_${isDark ? 'dark' : 'light'})" stroke="#0F172A" stroke-width="0.9" />
        <path d="M15,31 Q25,28 35,31" fill="none" stroke="#FFFFFF" stroke-width="0.8" stroke-opacity="0.7" />

        <!-- Panoramic Sunroof Glass -->
        <rect x="15" y="44" width="20" height="18" rx="2" fill="url(#carGlassGrad_${isDark ? 'dark' : 'light'})" stroke="#0F172A" stroke-width="0.9" />
        <line x1="15" y1="52" x2="35" y2="52" stroke="#0F172A" stroke-width="1.2" />

        <!-- Rear Windshield Glass -->
        <path d="M15,64 L35,64 L36.5,74 C35,76 15,76 13.5,74 Z" fill="url(#carGlassGrad_${isDark ? 'dark' : 'light'})" stroke="#0F172A" stroke-width="0.9" />
        <path d="M15.5,73 Q25,75 34.5,73" fill="none" stroke="#FFFFFF" stroke-width="0.7" stroke-opacity="0.4" />

        <!-- Continuous Specular Sky Reflection Streak across glass -->
        <path d="M16,30 L22,30 L32,73 L28,73 Z" fill="url(#glassStreak_${isDark ? 'dark' : 'light'})" pointer-events="none" />

        <!-- Trunk Lines -->
        <path d="M15,77 C15,83 35,83 35,77" fill="none" stroke="#C2410C" stroke-width="0.9" />

        <!-- Rear Red LED Taillights -->
        <path d="M11,83 Q14,84 16,84 L16,86 Q12,86 10.5,84 Z" fill="#EF4444" stroke="#B91C1C" stroke-width="0.6" />
        <path d="M39,83 Q36,84 34,84 L34,86 Q38,86 39.5,84 Z" fill="#EF4444" stroke="#B91C1C" stroke-width="0.6" />
        <!-- Center brake light strip -->
        <rect x="22" y="86.5" width="6" height="1.2" rx="0.5" fill="#EF4444" />

        <!-- Clean License Plate -->
        <rect x="20" y="86" width="10" height="2" rx="0.5" fill="#FFFFFF" stroke="#64748B" stroke-width="0.4" />
      </svg>
    `;
  }
}

export function createGoogleMapsDestinationIcon(label?: string) {
  return L.divIcon({
    className: 'custom-google-dest-pin',
    html: `
      <div class="relative flex flex-col items-center select-none cursor-pointer" style="transform: translate(-50%, -100%);">
        <!-- Google Maps Red Teardrop Pin -->
        <svg width="34" height="44" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="filter drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26s16-15.5 16-26c0-8.837-7.163-16-16-16z" fill="#EA4335"/>
          <circle cx="16" cy="15" r="6" fill="#B31412"/>
          <circle cx="16" cy="15" r="4.5" fill="#FFFFFF"/>
        </svg>
        <!-- Ground Shadow Ellipse -->
        <div class="w-5 h-2 bg-black/30 rounded-full filter blur-[1px] -mt-1"></div>
        ${label ? `
          <div class="mt-1 bg-white/95 text-slate-800 font-bold text-[10px] px-2 py-0.5 rounded-md shadow-md border border-slate-200 whitespace-nowrap">
            ${label}
          </div>
        ` : ''}
      </div>
    `,
    iconSize: [34, 44],
    iconAnchor: [17, 44]
  });
}

export function createDriverMarkerIcon(
  initials: string,
  isOnline: boolean,
  vehicleHeading: number = 0,
  vehicleType: string = 'mini',
  theme: string = 'dark',
  compassHeading?: number,
  roadGuideLabel?: string
) {
  const isDark = theme === 'dark';
  const vehicleSvg = getDriverSvg(vehicleType, isDark);
  const pulseClass = isOnline ? 'animate-pulse' : '';
  
  // If compassHeading is not provided, fallback to vehicleHeading
  const finalCompassHeading = typeof compassHeading === 'number' ? compassHeading : vehicleHeading;

  // Use a beautifully crafted wrapper representing a professional radar tracking compass dial
  const ringColor = isDark 
    ? 'border-[#EA580C]/60 shadow-[0_0_12px_rgba(234,88,12,0.35)] bg-transparent' 
    : 'border-[#EA580C]/60 shadow-[0_0_12px_rgba(234,88,12,0.25)] bg-transparent';

  return L.divIcon({
    className: 'custom-driver-marker-wrapper driver-marker-smooth',
    html: `
      <div class="relative flex items-center justify-center w-[54px] h-[54px]">
        
        <!-- Attached Navigation Road Label Badge (Exact match to "toward Nelson Mandela Rd" in user screenshot) -->
        ${roadGuideLabel ? `
          <div class="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#EA580C] text-white font-bold text-[11px] px-3 py-1 rounded-full shadow-[0_4px_12px_rgba(234,88,12,0.5)] border border-white/20 whitespace-nowrap z-50 pointer-events-none">
            ${roadGuideLabel}
          </div>
        ` : ''}

        <!-- Rotating GPS Dotted Halo Ring -->
        <div class="absolute inset-0 rounded-full border border-dashed ${isDark ? 'border-[#EA580C]/30' : 'border-[#EA580C]/35'} animate-spin [animation-duration:12s] pointer-events-none"></div>
        
        <!-- Energetic Pulse Ring -->
        <div class="absolute w-[38px] h-[38px] rounded-full ${isDark ? 'bg-[#EA580C]/15' : 'bg-[#EA580C]/10'} ${pulseClass} pointer-events-none"></div>
        
        <!-- Compass Outer Body -->
        <div class="absolute w-[44px] h-[44px] rounded-full border ${ringColor} flex items-center justify-center select-none pointer-events-none">
          
          <!-- COMPASS BEAM / FLASHLIGHT: Rotates with phone compass orientation -->
          <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style="transform: rotate(${finalCompassHeading}deg);">
            <!-- Compass Heading Flashlight Light Beam / Field-of-View Cone -->
            <div class="absolute bottom-1/2 left-1/2 -translate-x-1/2 origin-bottom pointer-events-none" style="width: 100px; height: 90px; margin-bottom: 2px;">
              <svg viewBox="0 0 100 90" class="w-full h-full overflow-visible">
                <defs>
                  <radialGradient id="driverCompassBeamGrad_${isDark ? 'dark' : 'light'}" cx="50%" cy="100%" r="100%">
                    <stop offset="0%" stop-color="${isDark ? '#F97316' : '#EA580C'}" stop-opacity="0.6"/>
                    <stop offset="45%" stop-color="${isDark ? '#F97316' : '#EA580C'}" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="${isDark ? '#F97316' : '#EA580C'}" stop-opacity="0"/>
                  </radialGradient>
                </defs>
                <path d="M 50 90 L 12 0 A 85 85 0 0 1 88 0 Z" fill="url(#driverCompassBeamGrad_${isDark ? 'dark' : 'light'})" />
              </svg>
            </div>

            <!-- Pointing arrow accent at front -->
            <div class="absolute top-[1px] w-2 h-2 rotate-45 ${isDark ? 'bg-[#F97316]' : 'bg-[#EA580C]'} rounded-[1px] shadow-[0_0_8px_rgba(249,115,22,0.9)] z-10"></div>
          </div>

          <!-- VEHICLE ICON: Rotates with compass heading -->
          <div class="absolute inset-0 flex items-center justify-center transition-transform duration-300 ease-out" style="transform: rotate(${finalCompassHeading}deg);">
            <div class="w-8 h-8 flex items-center justify-center relative z-10">
              ${vehicleSvg}
            </div>
          </div>

        </div>
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
}
