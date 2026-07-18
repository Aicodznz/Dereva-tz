import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { order_id, amount, buyer_phone, fee_payer } = req.body;
  const apiKey = process.env.MONGIKE_API_KEY;

  // Normalize and clean the phone number
  let rawPhone = (buyer_phone || "").trim();
  let formattedPhone = rawPhone;
  if (rawPhone.startsWith("0")) {
    formattedPhone = "255" + rawPhone.substring(1);
  } else if (rawPhone.startsWith("+")) {
    formattedPhone = rawPhone.substring(1);
  } else if (!rawPhone.startsWith("255") && rawPhone.replace(/[^0-9]/g, "").length === 9) {
    formattedPhone = "255" + rawPhone;
  }
  const cleanPhone = formattedPhone.replace(/[^0-9]/g, "");

  if (!apiKey) {
    console.warn("MONGIKE_API_KEY is missing in environment variables. Running in sandbox mode!");

    const simulatedResponse = {
      status: "success",
      message: "Ombi la malipo limetumwa (Sandbox Mode)",
      data: {
        id: `sim_pay_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        order_id: order_id,
        gateway_ref: `sim_ref_${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
        amount: Number(amount) || 0,
        status: "PENDING",
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    };

    try {
      const db = getFirestoreDb();
      if (db && order_id) {
        setTimeout(async () => {
          try {
            console.log(`[Sandbox Vercel Payment Webhook] Simulating successful payment completion for order: ${order_id}`);
            
            await db.collection("orders").doc(String(order_id)).update({
              paymentStatus: "paid",
              updatedAt: new Date().toISOString(),
              gatewayRef: simulatedResponse.data.gateway_ref
            });

            await db.collection("payment_callbacks").doc(String(order_id)).set({
              order_id: order_id,
              status: "COMPLETED",
              reference_id: simulatedResponse.data.gateway_ref,
              amount: Number(amount) || 0,
              raw_payload: {
                order_id: order_id,
                status: "COMPLETED",
                gateway_ref: simulatedResponse.data.gateway_ref,
                reference_id: simulatedResponse.data.gateway_ref,
                amount: Number(amount) || 0,
                is_simulated: true
              },
              updated_at: new Date().toISOString()
            }, { merge: true });

            console.log(`[Sandbox Vercel Payment Webhook] Order ${order_id} marked as PAID.`);
          } catch (err) {
            console.error("[Sandbox Vercel Payment Webhook] Error simulating payment success:", err);
          }
        }, 2500);
      }
    } catch (dbErr) {
      console.error("[Sandbox Vercel Payment Webhook] Firestore error during initialization:", dbErr);
    }

    return res.status(201).json(simulatedResponse);
  }

  try {
    const response = await fetch("https://mongike.com/api/v1/payments/mobile-money/tanzania", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order_id,
        amount,
        buyer_phone: cleanPhone,
        fee_payer: fee_payer || "MERCHANT"
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(201).json(data);
  } catch (error) {
    console.error("Payment initiation failed:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Failed to initiate payment. Please try again later." 
    });
  }
}
