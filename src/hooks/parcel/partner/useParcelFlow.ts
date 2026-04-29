import { doc, updateDoc, serverTimestamp, increment, arrayRemove } from 'firebase/firestore';
import { db } from '../../../firebase';
import { ParcelStatus } from '../../../types/parcel';

export function useParcelFlow() {
  const updateParcelStatus = async (parcelId: string, status: ParcelStatus, extraData: any = {}) => {
    const parcelRef = doc(db, 'parcels', parcelId);
    
    const updates: any = { status };
    
    // Add specific timestamps based on status
    if (status === 'at_sender') updates['timestamps.arrivedSenderAt'] = serverTimestamp();
    if (status === 'picked_up') updates['timestamps.pickedUpAt'] = serverTimestamp();
    if (status === 'arrived_recipient') updates['timestamps.arrivedRecipientAt'] = serverTimestamp();
    if (status === 'delivered') updates['timestamps.deliveredAt'] = serverTimestamp();

    await updateDoc(parcelRef, { ...updates, ...extraData });
  };

  const completeDelivery = async (parcelId: string, partnerId: string, earnings: number, extraData: any = {}) => {
    const parcelRef = doc(db, 'parcels', parcelId);
    const partnerRef = doc(db, 'partners', partnerId);

    // Update parcel
    await updateDoc(parcelRef, {
      status: 'delivered',
      'timestamps.deliveredAt': serverTimestamp(),
      ...extraData
    });

    // Update partner stats
    await updateDoc(partnerRef, {
      'earnings.today': increment(earnings),
      'earnings.total': increment(earnings),
      totalDeliveries: increment(1),
      activeParcelIds: arrayRemove(parcelId)
    });
  };

  return { updateParcelStatus, completeDelivery };
}
