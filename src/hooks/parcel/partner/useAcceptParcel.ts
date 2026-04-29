import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../AuthContext';
import { UserProfile } from '../../../types';

export function useAcceptParcel() {
  const { user, profile } = useAuth();

  const acceptParcel = async (parcelId: string) => {
    if (!user || !profile) throw new Error('Unatakiwa kuingia kwenye akaunti');

    const parcelRef = doc(db, 'parcels', parcelId);
    
    try {
      await runTransaction(db, async (transaction) => {
        const parcelDoc = await transaction.get(parcelRef);
        if (!parcelDoc.exists()) throw new Error('Parcel haipo');
        
        const data = parcelDoc.data();
        if (data.status !== 'pending') {
          throw new Error('Imechukuliwa na mwenzako tayari');
        }

        transaction.update(parcelRef, {
          status: 'accepted',
          partnerId: user.uid,
          partnerInfo: {
            name: profile.displayName || profile.fullName || 'Partner',
            initials: (profile.displayName || profile.fullName || 'P').split(' ').map(n => n[0]).join('').toUpperCase(),
            plate: (profile as any).licensePlate || 'T 000 ABC',
            vehicleType: (profile as any).vehicleType || 'pikipiki',
            phone: (profile as any).phoneNumber || '',
            rating: (profile as any).rating || 5.0
          },
          'timestamps.acceptedAt': serverTimestamp()
        });
      });
      return true;
    } catch (error) {
      console.error('Hitilafu ya kukubali parcel:', error);
      throw error;
    }
  };

  return { acceptParcel };
}
