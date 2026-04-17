export interface MongikePaymentResponse {
  status: string;
  message: string;
  data: {
    id: string;
    order_id: string;
    gateway_ref: string;
    amount: number;
    status: string;
    expires_at: string;
  };
}

export interface PaymentRequest {
  order_id: string;
  amount: number;
  buyer_phone: string;
  fee_payer?: 'MERCHANT' | 'CUSTOMER';
}

export const initiatePayment = async (request: PaymentRequest): Promise<MongikePaymentResponse> => {
  try {
    const response = await fetch('/api/payments/initiate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Payment initiation failed');
    }

    return data as MongikePaymentResponse;
  } catch (error) {
    console.error('Payment Error:', error);
    throw error;
  }
};
