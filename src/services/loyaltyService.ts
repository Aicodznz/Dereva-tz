import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { CustomerLoyaltyCard, VendorProfile } from '../types';

export const loyaltyService = {
  /**
   * Fetches or initializes a customer loyalty card for a given vendor and customer phone
   */
  async getLoyaltyCard(vendorId: string, customerPhone: string): Promise<CustomerLoyaltyCard | null> {
    if (!vendorId || !customerPhone) return null;
    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return null;

    try {
      const q = query(
        collection(db, 'vendors', vendorId, 'loyalty_cards'),
        where('customerPhone', '==', cleanPhone)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const d = snap.docs[0];
        return { id: d.id, ...d.data() } as CustomerLoyaltyCard;
      }
      return null;
    } catch (error) {
      console.warn('Error fetching loyalty card:', error);
      return null;
    }
  },

  /**
   * Awards stamps & points to the customer upon a completed/placed order
   */
  async processOrderLoyalty(
    vendorId: string,
    customerPhone: string,
    customerName: string,
    orderTotal: number,
    loyaltyConfig?: VendorProfile['loyaltyProgram']
  ): Promise<{ card: CustomerLoyaltyCard; earnedStamp: boolean; earnedReward: boolean; earnedPoints: number } | null> {
    if (!vendorId || !customerPhone || !loyaltyConfig || !loyaltyConfig.enabled) {
      return null;
    }

    const cleanPhone = customerPhone.replace(/[^0-9]/g, '');
    if (!cleanPhone) return null;

    try {
      const requiredStamps = loyaltyConfig.stampsRequired || 5;
      const pointsPer1000 = loyaltyConfig.pointsPer1000Tzs || 10;
      const earnedPoints = Math.floor((orderTotal / 1000) * pointsPer1000);

      // Check if existing card
      const existing = await this.getLoyaltyCard(vendorId, cleanPhone);

      let currentStamps = existing ? existing.currentStamps || 0 : 0;
      let totalStampsEarned = existing ? existing.totalStampsEarned || 0 : 0;
      let availableRewards = existing ? existing.availableRewards || 0 : 0;
      let currentPoints = existing ? existing.currentPoints || 0 : 0;
      let totalPointsEarned = existing ? existing.totalPointsEarned || 0 : 0;

      // Add 1 stamp for this order
      currentStamps += 1;
      totalStampsEarned += 1;
      currentPoints += earnedPoints;
      totalPointsEarned += earnedPoints;

      let earnedReward = false;
      if (currentStamps >= requiredStamps) {
        availableRewards += 1;
        currentStamps = 0; // Reset stamp counter for the next card cycle
        earnedReward = true;
      }

      const cardData: CustomerLoyaltyCard = {
        vendorId,
        customerPhone: cleanPhone,
        customerName: customerName || (existing ? existing.customerName : 'Mteja'),
        currentStamps,
        totalStampsEarned,
        availableRewards,
        currentPoints,
        totalPointsEarned,
        redeemedRewardsCount: existing ? existing.redeemedRewardsCount || 0 : 0,
        lastOrderDate: serverTimestamp(),
        createdAt: existing?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (existing?.id) {
        await updateDoc(doc(db, 'vendors', vendorId, 'loyalty_cards', existing.id), {
          ...cardData,
          id: existing.id
        });
        return {
          card: { ...cardData, id: existing.id },
          earnedStamp: true,
          earnedReward,
          earnedPoints
        };
      } else {
        const newDoc = await addDoc(collection(db, 'vendors', vendorId, 'loyalty_cards'), cardData);
        return {
          card: { ...cardData, id: newDoc.id },
          earnedStamp: true,
          earnedReward,
          earnedPoints
        };
      }
    } catch (error) {
      console.error('Error processing order loyalty:', error);
      return null;
    }
  },

  /**
   * Redeems 1 stamp reward for the customer
   */
  async redeemReward(vendorId: string, cardId: string): Promise<boolean> {
    try {
      const cardRef = doc(db, 'vendors', vendorId, 'loyalty_cards', cardId);
      const snap = await getDoc(cardRef);
      if (!snap.exists()) return false;

      const data = snap.data() as CustomerLoyaltyCard;
      if ((data.availableRewards || 0) <= 0) return false;

      await updateDoc(cardRef, {
        availableRewards: data.availableRewards - 1,
        redeemedRewardsCount: (data.redeemedRewardsCount || 0) + 1,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error redeeming loyalty reward:', error);
      return false;
    }
  },

  /**
   * Redeems points for a discount
   */
  async redeemPoints(vendorId: string, cardId: string, pointsToDeduct: number): Promise<boolean> {
    try {
      const cardRef = doc(db, 'vendors', vendorId, 'loyalty_cards', cardId);
      const snap = await getDoc(cardRef);
      if (!snap.exists()) return false;

      const data = snap.data() as CustomerLoyaltyCard;
      if ((data.currentPoints || 0) < pointsToDeduct) return false;

      await updateDoc(cardRef, {
        currentPoints: data.currentPoints - pointsToDeduct,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Error redeeming loyalty points:', error);
      return false;
    }
  }
};
