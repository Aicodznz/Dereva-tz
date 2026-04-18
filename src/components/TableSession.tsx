import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { VendorProfile } from '../types';
import { toast } from 'sonner';

export default function TableSession() {
  const { vendorId, tableId } = useParams<{ vendorId: string; tableId: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    async function checkIn() {
      if (!vendorId || !tableId) {
        navigate('/');
        return;
      }

      try {
        const vendorSnap = await getDoc(doc(db, 'vendors', vendorId));
        if (vendorSnap.exists()) {
          const vendor = vendorSnap.data() as VendorProfile;
          
          // Save session to localStorage
          const session = {
            vendorId,
            tableId,
            businessName: vendor.businessName,
            timestamp: Date.now()
          };
          
          localStorage.setItem('papo_hapo_table_session', JSON.stringify(session));
          
          toast.success(`Umeingia Mezani: ${tableId} hapa ${vendor.businessName}`);
          
          // Redirect to vendor store
          navigate(`/vendor/${vendorId}`);
        } else {
          toast.error('Muuzaji hakuweza kupatikana');
          navigate('/');
        }
      } catch (error) {
        console.error('Table check-in error:', error);
        toast.error('Hitilafu imetokea wakati wa kusekeni QR');
        navigate('/');
      }
    }

    checkIn();
  }, [vendorId, tableId, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 p-8 text-center space-y-6">
      <div className="w-16 h-16 border-4 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
      <div>
        <h2 className="text-xl font-bold text-neutral-900 uppercase italic tracking-tighter">Inasekeni QR Code...</h2>
        <p className="text-sm text-neutral-500 mt-2 italic">Tafadhali subiri wakati tunakuunganisha na meza yako...</p>
      </div>
    </div>
  );
}
