import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { order_id, amount, buyer_phone, fee_payer } = req.body;
  const apiKey = process.env.MONGIKE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ 
      status: "error", 
      message: "Server configuration error: Missing API Key" 
    });
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
        buyer_phone,
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
