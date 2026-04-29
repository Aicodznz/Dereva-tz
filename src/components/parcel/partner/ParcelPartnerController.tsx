import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../AuthContext';
import { Parcel, ParcelStatus } from '../../../types/parcel';
import PartnerDashboard from './PartnerDashboard';
import IncomingParcelCard from './IncomingParcelCard';
import GoToSenderScreen from './GoToSenderScreen';
import AtSenderScreen from './AtSenderScreen';
import InTransitScreen from './InTransitScreen';
import DeliverScreen from './DeliverScreen';
import PaymentScreen from './PaymentScreen';
import RateRecipientScreen from './RateRecipientScreen';
import { AnimatePresence, motion } from 'framer-motion';
import { useIncomingParcels } from '../../../hooks/parcel/partner/useIncomingParcels';

type PartnerScreen = 
  | 'dashboard' 
  | 'incoming' 
  | 'going_to_sender' 
  | 'at_sender' 
  | 'in_transit' 
  | 'arrived_recipient' 
  | 'payment' 
  | 'rating';

const statusToScreen: Record<string, PartnerScreen> = {
  accepted: 'going_to_sender',
  at_sender: 'at_sender',
  picked_up: 'in_transit',
  in_transit: 'in_transit',
  arrived_recipient: 'arrived_recipient',
  delivered: 'payment',
  rated: 'dashboard'
};

const ParcelPartnerController: React.FC = () => {
  const { user } = useAuth();
  const [activeParcel, setActiveParcel] = useState<Parcel | null>(null);
  const [screen, setScreen] = useState<PartnerScreen>('dashboard');
  const incomingParcels = useIncomingParcels();

  useEffect(() => {
    if (!user) return;

    // Listen for active parcels assigned to this partner
    const q = query(
      collection(db, 'parcels'), 
      where('partnerId', '==', user.uid),
      where('status', 'in', ['accepted', 'at_sender', 'picked_up', 'in_transit', 'arrived_recipient', 'delivered'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const parcelDoc = snapshot.docs[0];
        const data = parcelDoc.data() as Parcel;
        setActiveParcel({ ...data, id: parcelDoc.id });
        setScreen(statusToScreen[data.status] || 'dashboard');
      } else {
        setActiveParcel(null);
        setScreen('dashboard');
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Handle incoming request overlay
  const showIncoming = incomingParcels.length > 0 && !activeParcel;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans overflow-hidden">
      <AnimatePresence mode="wait">
        {screen === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PartnerDashboard />
          </motion.div>
        )}

        {screen === 'going_to_sender' && activeParcel && (
          <motion.div
            key="going_to_sender"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -100 }}
          >
            <GoToSenderScreen parcel={activeParcel} />
          </motion.div>
        )}

        {screen === 'at_sender' && activeParcel && (
          <motion.div
            key="at_sender"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            <AtSenderScreen parcel={activeParcel} />
          </motion.div>
        )}

        {screen === 'in_transit' && activeParcel && (
          <motion.div
            key="in_transit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <InTransitScreen parcel={activeParcel} />
          </motion.div>
        )}

        {screen === 'arrived_recipient' && activeParcel && (
          <motion.div
            key="arrived_recipient"
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -100 }}
          >
            <DeliverScreen parcel={activeParcel} />
          </motion.div>
        )}

        {screen === 'payment' && activeParcel && (
          <motion.div
            key="payment"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <PaymentScreen parcel={activeParcel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays */}
      <AnimatePresence>
        {showIncoming && (
          <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center p-4">
            <div className="pointer-events-auto w-full max-w-sm">
                <IncomingParcelCard parcel={incomingParcels[0]} />
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ParcelPartnerController;
