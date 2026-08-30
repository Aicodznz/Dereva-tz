export interface AppSectionSlot {
  id: string;
  name: string;
  swahiliName: string;
  description: string;
  category: string;
  icon: string;
  defaultAnimationId: string;
  sampleText: string;
}

export const APP_SECTION_SLOTS: AppSectionSlot[] = [
  {
    id: 'promo_hero_banner',
    name: 'Home Promo Hero Banner',
    swahiliName: 'Bango Kuu la Matangazo ya Mwanzo',
    description: 'Bango kubwa linaloonekana mwanzo wa ukurasa wa abiria kutangaza ofa za siku na punguzo.',
    category: 'Mabango & Ofa',
    icon: '🏷️',
    defaultAnimationId: 'shimmer-gold',
    sampleText: 'OFFA KABAMBE: PUNGUZO LA 50% LEO!'
  },
  {
    id: 'order_now_cta',
    name: 'Order & Booking CTA Buttons',
    swahiliName: 'Vitufe vya Kuagiza & Kuitisha Safari',
    description: 'Vitufe vikubwa vya kuitisha gari, bajaji, bodaboda au chakula (Order Now / Book Ride).',
    category: 'Vitufe & Vitendo',
    icon: '🛒',
    defaultAnimationId: 'bounce-elastic-drop',
    sampleText: 'AGIZA SASA UOKOE TZS 3,000'
  },
  {
    id: 'coupon_reward_badge',
    name: 'Coupons & Rewards Share Card',
    swahiliName: 'Kadi ya Vocha & Zawadi (Papo Share)',
    description: 'Kadi ya mwaliko "Share Papo Hapo / Pata Vocha ya TZS 1,000" kwenye ramani.',
    category: 'Zawadi & Kuponi',
    icon: '🎁',
    defaultAnimationId: 'flame-fire-flare',
    sampleText: 'ZAWADI YA TZS 1,000 VOCHA PAPO HAPO!'
  },
  {
    id: 'driver_vip_badge',
    name: 'VIP Driver & Top-Rated Badge',
    swahiliName: 'Beji ya Dereva VIP & Hadhi ya Juu',
    category: 'Madereva & Hadhi',
    icon: '⭐',
    description: 'Kutambulisha madereva wenye nyota 5 na safari za heshima (Executive Rides).',
    defaultAnimationId: 'metallic-chrome-reflex',
    sampleText: 'DEREVA VIP MTENDAJI • 5.0 NYOTA'
  },
  {
    id: 'gps_live_hud',
    name: 'Live Satellite GPS & Radar HUD',
    swahiliName: 'Mita ya GPS & Rada ya Satelaiti',
    category: 'Ramani & Ufuatiliaji',
    icon: '🛰️',
    description: 'Kwenye ramani kuonyesha mawimbi ya satelaiti, muda wa kuwasili (ETA) na mwelekeo wa gari.',
    defaultAnimationId: 'hologram-flicker',
    sampleText: 'GPS SATELLITE RADAR: 100% ACCURACY'
  },
  {
    id: 'trip_complete_screen',
    name: 'Trip Completed Celebration',
    swahiliName: 'Ujumbe wa Mwisho wa Safari Salama',
    category: 'Uzoefu wa Mteja',
    icon: '🏁',
    description: 'Ukurasa wa kupongeza safari imekamilika salama na risiti ya malipo.',
    defaultAnimationId: 'rainbow-aurora',
    sampleText: 'SAFARI IMEKAMILIKA KWA USALAMA!'
  },
  {
    id: 'night_flash_deals',
    name: 'Night Mode & Late Night Deals',
    swahiliName: 'Ofa za Usiku & Safari za Baadaye',
    category: 'Usiku & Mandhari',
    icon: '🌙',
    description: 'Kwenye mandhari ya usiku (Night Mode) na ofa za migahawa inayofunguliwa 24/7.',
    defaultAnimationId: 'neon-glow-pulse',
    sampleText: '24/7 NIGHT DELIVERY: DAR ES SALAAM'
  },
  {
    id: 'wallet_security_header',
    name: 'Wallet & Top-up Security Banner',
    swahiliName: 'Ulinzi wa Wallet & Uthibitisho wa Malipo',
    category: 'Fedha & Malipo',
    icon: '🔒',
    description: 'Kwenye ukurasa wa kuweka pesa kwa M-Pesa/TigoPesa na usalama wa miamala.',
    defaultAnimationId: 'matrix-digital-rain',
    sampleText: 'MIAMALA SALAMA YA KIELEKTRONIKI'
  },
  {
    id: 'papo_stay_luxury',
    name: 'Papo Stay & Hotel Rooms Header',
    swahiliName: 'Vyumba vya Kifahari & Hoteli (Papo Stay)',
    category: 'Hoteli & Malazi',
    icon: '🏨',
    description: 'Vichwa vya kumbi za mikutano, hoteli na nyumba za wageni za daraja la juu.',
    defaultAnimationId: 'letter-spacing-expand',
    sampleText: 'EXECUTIVE LUXURY SUITES & APARTMENTS'
  },
  {
    id: 'grand_opening_alert',
    name: 'New Store & Restaurant Launch',
    swahiliName: 'Uzinduzi wa Maduka Mapya & Migahawa',
    category: 'Wauzaji & Biashara',
    icon: '🎉',
    description: 'Kutangaza migahawa mipya, maduka ya dawa na masoko yaliyojiunga leo.',
    defaultAnimationId: 'curtain-reveal-sweep',
    sampleText: 'MGAHAWA MPYA UMEJIUNGA: PAPO FOODS'
  }
];

const STORAGE_KEY = 'papo_text_animation_slot_assignments';

export interface SlotAssignmentMap {
  [slotId: string]: {
    enabled: boolean;
    animationId: string;
    customText?: string;
  };
}

export function getDefaultSlotAssignments(): SlotAssignmentMap {
  const map: SlotAssignmentMap = {};
  APP_SECTION_SLOTS.forEach(slot => {
    map[slot.id] = {
      enabled: true,
      animationId: slot.defaultAnimationId,
      customText: slot.sampleText
    };
  });
  return map;
}

export function loadSlotAssignments(): SlotAssignmentMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSlotAssignments();
    const parsed = JSON.parse(raw);
    return { ...getDefaultSlotAssignments(), ...parsed };
  } catch {
    return getDefaultSlotAssignments();
  }
}

export function saveSlotAssignments(assignments: SlotAssignmentMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments));
  } catch (e) {
    console.error('Failed to save slot assignments', e);
  }
}
