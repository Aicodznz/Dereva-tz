import { LatLng, TripLocation } from '../types/trip.types';

export interface PapoSharePreferences {
  enabled: boolean;
  allowSharingConsent: boolean;
  womenOnly?: boolean;
  verifiedOnly?: boolean;
}

export interface Waypoint {
  id: string;
  type: 'pickup' | 'dropoff';
  riderId: string;
  riderName: string;
  location: TripLocation;
  status: 'pending' | 'arrived' | 'completed';
  sequence: number;
  estimatedTimeMin?: number;
  note?: string;
}

export interface SharedSegmentFareBreakdown {
  soloFare: number;
  finalFare: number;
  savings: number;
  savingsPercentage: number;
  soloDistanceKm: number;
  sharedDistanceKm: number;
  totalDistanceKm: number;
  driverTotalPayout: number;
}

export interface AlongTheWayParcel {
  id: string;
  trackingNumber: string;
  senderName: string;
  recipientName: string;
  packageType: 'envelope' | 'small_box' | 'document' | 'keys';
  pickup: TripLocation;
  delivery: TripLocation;
  payoutBonus: number;
  detourMinutes: number;
}

/**
 * 1. Adaptive Detour Budget Formula:
 * max_detour = min(5 min, max(2 min, trip_duration * 15%))
 */
export function calculateDetourBudget(tripDurationMinutes: number): number {
  if (!tripDurationMinutes || tripDurationMinutes <= 0) return 2;
  const fifteenPercent = Math.round(tripDurationMinutes * 0.15);
  return Math.min(5, Math.max(2, fifteenPercent));
}

/**
 * Haversine distance in kilometers
 */
export function getHaversineDistanceKm(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number }
): number {
  if (!coord1 || !coord2) return 0;
  const R = 6371; // Earth radius in km
  const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const dLon = ((coord2.lng - coord1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.lat * Math.PI) / 180) *
      Math.cos((coord2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
 * Approximate travel time from distance (Dar es Salaam average: 22 km/h city traffic)
 */
export function estimateDurationMinutes(distanceKm: number): number {
  return Math.max(2, Math.ceil((distanceKm / 22) * 60));
}

/**
 * 4. Fair Distance-based Segment Fare Split:
 * - Solo Segment: 100% standard rate
 * - Shared Segment: 35% - 40% discount for each rider
 * - Driver receives combined payout (130% - 150% of solo trip)
 */
export function calculateDistanceBasedPapoShareFare({
  baseSoloFare,
  totalDistanceKm,
  sharedDistanceKm,
  vehicleType = 'bajaj',
}: {
  baseSoloFare: number;
  totalDistanceKm: number;
  sharedDistanceKm: number;
  vehicleType?: string;
}): SharedSegmentFareBreakdown {
  const dist = Math.max(1, totalDistanceKm);
  const sharedDist = Math.min(dist, Math.max(0, sharedDistanceKm));
  const soloDist = Math.max(0, dist - sharedDist);

  // Rate per km derived from solo base fare
  const ratePerKm = baseSoloFare / dist;

  // Solo segment charged at 100%, shared segment discounted by 35%
  const DISCOUNT_RATE = 0.35;
  const soloSegmentCost = soloDist * ratePerKm;
  const sharedSegmentCost = sharedDist * ratePerKm * (1 - DISCOUNT_RATE);

  // Ensure minimum realistic fare
  const minFloor = vehicleType === 'bajaj' ? 2500 : 4000;
  const rawFare = soloSegmentCost + sharedSegmentCost;
  const finalFare = Math.max(minFloor, Math.round(rawFare / 500) * 500);

  const savings = Math.max(0, baseSoloFare - finalFare);
  const savingsPercentage = Math.round((savings / Math.max(1, baseSoloFare)) * 100);

  // Driver gets full solo portion + shared portion + shared passenger addition
  const driverTotalPayout = Math.round(baseSoloFare * 1.35);

  return {
    soloFare: baseSoloFare,
    finalFare,
    savings,
    savingsPercentage: Math.max(10, Math.min(40, savingsPercentage || 30)),
    soloDistanceKm: Number(soloDist.toFixed(1)),
    sharedDistanceKm: Number(sharedDist.toFixed(1)),
    totalDistanceKm: Number(dist.toFixed(1)),
    driverTotalPayout,
  };
}

/**
 * 3. Smart Sequence Optimizer (FIFO vs Minimum Detour Sequence)
 * Determines optimal dropoff order between Rider A and Rider B
 */
export function optimizePapoShareSequence({
  pickupA,
  dropA,
  riderNameA,
  riderIdA,
  pickupB,
  dropB,
  riderNameB,
  riderIdB,
  durationA_Min = 15,
}: {
  pickupA: TripLocation;
  dropA: TripLocation;
  riderNameA: string;
  riderIdA: string;
  pickupB: TripLocation;
  dropB: TripLocation;
  riderNameB: string;
  riderIdB: string;
  durationA_Min?: number;
}): {
  optimalSequence: Waypoint[];
  chosenPattern: 'FIFO_DROP_A_FIRST' | 'OPTIMAL_DROP_B_FIRST';
  detourMinutesForA: number;
  maxDetourBudgetMinutes: number;
  isWithinBudget: boolean;
  sharedKm: number;
} {
  const maxDetourBudgetMinutes = calculateDetourBudget(durationA_Min);

  // Distances:
  // Sequence 1 (FIFO): PickA -> PickB -> DropA -> DropB
  const distDirectA = getHaversineDistanceKm(pickupA, dropA);
  const distToPickB = getHaversineDistanceKm(pickupA, pickupB);
  const distPickBToDropA = getHaversineDistanceKm(pickupB, dropA);
  const distDropAToDropB = getHaversineDistanceKm(dropA, dropB);
  const totalDistSeq1 = distToPickB + distPickBToDropA + distDropAToDropB;

  // Sequence 2 (Drop B first): PickA -> PickB -> DropB -> DropA
  const distPickBToDropB = getHaversineDistanceKm(pickupB, dropB);
  const distDropBToDropA = getHaversineDistanceKm(dropB, dropA);
  const totalDistSeq2 = distToPickB + distPickBToDropB + distDropBToDropA;

  // Check detour for Rider A
  const distSeq1ForA = distToPickB + distPickBToDropA;
  const distSeq2ForA = distToPickB + distPickBToDropB + distDropBToDropA;

  const detourKmSeq1 = Math.max(0, distSeq1ForA - distDirectA);
  const detourKmSeq2 = Math.max(0, distSeq2ForA - distDirectA);

  const detourMinSeq1 = estimateDurationMinutes(detourKmSeq1);
  const detourMinSeq2 = estimateDurationMinutes(detourKmSeq2);

  // Preference: Drop B first ONLY IF it is strictly faster overall and doesn't blow A's budget
  let chosenPattern: 'FIFO_DROP_A_FIRST' | 'OPTIMAL_DROP_B_FIRST' = 'FIFO_DROP_A_FIRST';
  let detourForA = detourMinSeq1;

  if (totalDistSeq2 < totalDistSeq1 && detourMinSeq2 <= maxDetourBudgetMinutes) {
    chosenPattern = 'OPTIMAL_DROP_B_FIRST';
    detourForA = detourMinSeq2;
  }

  const isWithinBudget = detourForA <= maxDetourBudgetMinutes;
  const sharedKm = Math.max(1, getHaversineDistanceKm(pickupB, chosenPattern === 'OPTIMAL_DROP_B_FIRST' ? dropB : dropA));

  const waypoints: Waypoint[] = [
    {
      id: `wp-pick-${riderIdA}`,
      type: 'pickup',
      riderId: riderIdA,
      riderName: riderNameA,
      location: pickupA,
      status: 'completed',
      sequence: 1,
      note: 'Abiria wa Kwanza (A)',
    },
    {
      id: `wp-pick-${riderIdB}`,
      type: 'pickup',
      riderId: riderIdB,
      riderName: riderNameB,
      location: pickupB,
      status: 'pending',
      sequence: 2,
      note: 'Abiria wa Pili (Njiani)',
    },
  ];

  if (chosenPattern === 'OPTIMAL_DROP_B_FIRST') {
    waypoints.push(
      {
        id: `wp-drop-${riderIdB}`,
        type: 'dropoff',
        riderId: riderIdB,
        riderName: riderNameB,
        location: dropB,
        status: 'pending',
        sequence: 3,
        note: 'Shusha B (Kituo cha Karibu)',
      },
      {
        id: `wp-drop-${riderIdA}`,
        type: 'dropoff',
        riderId: riderIdA,
        riderName: riderNameA,
        location: dropA,
        status: 'pending',
        sequence: 4,
        note: 'Shusha A (Mwisho)',
      }
    );
  } else {
    waypoints.push(
      {
        id: `wp-drop-${riderIdA}`,
        type: 'dropoff',
        riderId: riderIdA,
        riderName: riderNameA,
        location: dropA,
        status: 'pending',
        sequence: 3,
        note: 'Shusha A (Kwanza - FIFO)',
      },
      {
        id: `wp-drop-${riderIdB}`,
        type: 'dropoff',
        riderId: riderIdB,
        riderName: riderNameB,
        location: dropB,
        status: 'pending',
        sequence: 4,
        note: 'Shusha B (Mwisho)',
      }
    );
  }

  return {
    optimalSequence: waypoints,
    chosenPattern,
    detourMinutesForA: detourForA,
    maxDetourBudgetMinutes,
    isWithinBudget,
    sharedKm: Number(sharedKm.toFixed(1)),
  };
}

/**
 * 6. Boda Boda "PapoSend Njiani" (Parcel Add-on Along-the-Way)
 * Check if a small package pickup and delivery fits cleanly along a boda ride
 */
export function checkBodaParcelAddonMatch({
  bodaPickup,
  bodaDestination,
  parcelPickup,
  parcelDelivery,
}: {
  bodaPickup: TripLocation;
  bodaDestination: TripLocation;
  parcelPickup: TripLocation;
  parcelDelivery: TripLocation;
}): {
  isEligible: boolean;
  detourMinutes: number;
  extraDistanceKm: number;
  bonusEarningsTZS: number;
} {
  const directDist = getHaversineDistanceKm(bodaPickup, bodaDestination);
  const distToParcelPick = getHaversineDistanceKm(bodaPickup, parcelPickup);
  const distParcelPickToDrop = getHaversineDistanceKm(parcelPickup, parcelDelivery);
  const distParcelDropToDest = getHaversineDistanceKm(parcelDelivery, bodaDestination);

  const totalDistWithParcel = distToParcelPick + distParcelPickToDrop + distParcelDropToDest;
  const extraDist = Math.max(0, totalDistWithParcel - directDist);
  const detourMinutes = estimateDurationMinutes(extraDist);

  // Eligible if detour is under 3 minutes and within 1.2km off the main route
  const isEligible = detourMinutes <= 3 && extraDist <= 1.2;

  // Driver bonus for parcel along the way: TZS 2,000 - 3,500
  const bonusEarningsTZS = isEligible ? 2500 : 0;

  return {
    isEligible,
    detourMinutes,
    extraDistanceKm: Number(extraDist.toFixed(1)),
    bonusEarningsTZS,
  };
}
