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

    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Unexpected response from server: ${text.substring(0, 50)}...`);
    }

    if (!response.ok) {
      throw new Error(data?.message || 'Payment initiation failed');
    }

    return data as MongikePaymentResponse;
  } catch (error) {
    console.error('Payment Error:', error);
    throw error;
  }
};
