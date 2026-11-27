import { cleanUndefined } from './getFirestoreDb.js';
import {
  detectTanzaniaMobileNetwork,
  getDaliPayConfig,
  initiateDaliPayDisbursement,
  normalizePhoneForDaliPay,
} from './dalipay.js';

export type MobileMoneyNetwork = 'MPESA' | 'TIGO' | 'AIRTEL' | 'HALOPESA';

export const SUPPORTED_MOBILE_MONEY_NETWORKS: Array<{
  id: MobileMoneyNetwork;
  name: string;
  shortName: string;
  prefixes: string[];
}> = [
  { id: 'MPESA', name: 'Vodacom M-Pesa', shortName: 'M-Pesa', prefixes: ['074', '075', '076'] },
  { id: 'TIGO', name: 'Tigo Pesa (Mixx by Yas)', shortName: 'Tigo Pesa', prefixes: ['071', '065', '067'] },
  { id: 'AIRTEL', name: 'Airtel Money', shortName: 'Airtel Money', prefixes: ['068', '069', '078', '079'] },
  { id: 'HALOPESA', name: 'HaloPesa', shortName: 'HaloPesa', prefixes: ['062'] },
];

export interface PapoPayTreasurySettings {
  transferFeePercent: number;
  transferFeeFlat: number;
  transferFeeMin: number;
  withdrawalFeePercent: number;
  withdrawalFeeMin: number;
  withdrawalMinAmount: number;
  withdrawalMaxAmount: number;
  enabledNetworks: Record<MobileMoneyNetwork, boolean>;
  b2cProvider: 'manual_settlement' | 'dalipay_api' | 'custom_b2c';
  daliPayDisbursementApiDisabled: boolean;
  daliPayDisabledMessage?: string;
  daliPayDisabledAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export function getDefaultPapoPayTreasurySettings(): PapoPayTreasurySettings {
  const envEnabled = String(process.env.DALIPAY_DISBURSEMENTS_API_ENABLED || '').toLowerCase() === 'true';
  return {
    transferFeePercent: 0,
    transferFeeFlat: 0,
    transferFeeMin: 0,
    withdrawalFeePercent: 0.2,
    withdrawalFeeMin: 100,
    withdrawalMinAmount: 1000,
    withdrawalMaxAmount: 5000000,
    enabledNetworks: {
      MPESA: true,
      TIGO: true,
      AIRTEL: true,
      HALOPESA: true,
    },
    b2cProvider: envEnabled ? 'dalipay_api' : 'manual_settlement',
    daliPayDisbursementApiDisabled: !envEnabled,
    daliPayDisabledMessage: envEnabled
      ? undefined
      : 'DaliPay API B2C disbursements require merchant dashboard permission. Using Admin Settlement Queue with atomic fund reservation.',
  };
}

export async function getPapoPayTreasurySettings(dbAdmin: any): Promise<PapoPayTreasurySettings> {
  const defaults = getDefaultPapoPayTreasurySettings();
  if (!dbAdmin) return defaults;
  try {
    const snap = await dbAdmin.collection('config').doc('papopay_settings').get();
    if (!snap?.exists) return defaults;
    const raw = snap.data() || {};
    const nets = raw.enabledNetworks || {};
    const daliDisabledFlag =
      typeof raw.daliPayDisbursementApiDisabled === 'boolean'
        ? raw.daliPayDisbursementApiDisabled
        : defaults.daliPayDisbursementApiDisabled;

    let provider: PapoPayTreasurySettings['b2cProvider'] =
      raw.b2cProvider === 'dalipay_api' || raw.b2cProvider === 'custom_b2c' || raw.b2cProvider === 'manual_settlement'
        ? raw.b2cProvider
        : defaults.b2cProvider;

    // Never auto-route to dalipay_api if it has been flagged disabled by DaliPay
    if (provider === 'dalipay_api' && daliDisabledFlag) {
      provider = 'manual_settlement';
    }

    return {
      transferFeePercent: Math.max(0, Number(raw.transferFeePercent ?? defaults.transferFeePercent)),
      transferFeeFlat: Math.max(0, Number(raw.transferFeeFlat ?? defaults.transferFeeFlat)),
      transferFeeMin: Math.max(0, Number(raw.transferFeeMin ?? defaults.transferFeeMin)),
      withdrawalFeePercent: Math.max(0, Number(raw.withdrawalFeePercent ?? defaults.withdrawalFeePercent)),
      withdrawalFeeMin: Math.max(0, Number(raw.withdrawalFeeMin ?? defaults.withdrawalFeeMin)),
      withdrawalMinAmount: Math.max(100, Number(raw.withdrawalMinAmount ?? defaults.withdrawalMinAmount)),
      withdrawalMaxAmount: Math.max(1000, Number(raw.withdrawalMaxAmount ?? defaults.withdrawalMaxAmount)),
      enabledNetworks: {
        MPESA: nets.MPESA !== false,
        TIGO: nets.TIGO !== false,
        AIRTEL: nets.AIRTEL !== false,
        HALOPESA: nets.HALOPESA !== false,
      },
      b2cProvider: provider,
      daliPayDisbursementApiDisabled: daliDisabledFlag,
      daliPayDisabledMessage: raw.daliPayDisabledMessage || defaults.daliPayDisabledMessage,
      daliPayDisabledAt: raw.daliPayDisabledAt || undefined,
      updatedAt: raw.updatedAt || undefined,
      updatedBy: raw.updatedBy || undefined,
    };
  } catch {
    return defaults;
  }
}

export function normalizeMobileMoneyNetwork(rawNetwork?: string, fallbackPhone?: string): MobileMoneyNetwork | null {
  const upper = String(rawNetwork || '').trim().toUpperCase();
  if (upper) {
    if (upper.includes('MPESA') || upper.includes('M-PESA') || upper.includes('VODACOM')) return 'MPESA';
    if (upper.includes('TIGO') || upper.includes('MIXX') || upper.includes('YAS')) return 'TIGO';
    if (upper.includes('AIRTEL')) return 'AIRTEL';
    if (upper.includes('HALO')) return 'HALOPESA';
  }
  if (fallbackPhone) {
    const detected = detectTanzaniaMobileNetwork(fallbackPhone);
    if (detected === 'MPESA' || detected === 'TIGO' || detected === 'AIRTEL' || detected === 'HALOPESA') {
      return detected;
    }
  }
  return null;
}

export function getMobileMoneyNetworkLabel(net: MobileMoneyNetwork): string {
  const found = SUPPORTED_MOBILE_MONEY_NETWORKS.find((n) => n.id === net);
  return found ? found.name : net;
}

export function computeTransferFee(amount: number, settings: PapoPayTreasurySettings): number {
  const cleanAmt = Math.max(0, Math.round(Number(amount || 0)));
  if (cleanAmt <= 0) return 0;
  const pct = Math.max(0, Number(settings.transferFeePercent || 0));
  const flat = Math.max(0, Number(settings.transferFeeFlat || 0));
  const min = Math.max(0, Number(settings.transferFeeMin || 0));
  if (pct === 0 && flat === 0 && min === 0) return 0;
  return Math.max(min, Math.round((cleanAmt * pct) / 100) + Math.round(flat));
}

export function computeWithdrawalFee(amount: number, settings: PapoPayTreasurySettings): number {
  const cleanAmt = Math.max(0, Math.round(Number(amount || 0)));
  if (cleanAmt <= 0) return 0;
  const pct = Math.max(0, Number(settings.withdrawalFeePercent ?? 0.2));
  const min = Math.max(0, Number(settings.withdrawalFeeMin ?? 100));
  if (pct === 0 && min === 0) return 0;
  return Math.max(min, Math.round((cleanAmt * pct) / 100));
}

export function isDaliPayDashboardOnlyError(errorMessage?: string): boolean {
  const lower = String(errorMessage || '').toLowerCase();
  return (
    lower.includes('disbursements can only be created from the dalipay merchant dashboard') ||
    lower.includes('endpoint is disabled for security reasons') ||
    lower.includes('log in to your dashboard to request a settlement')
  );
}

export interface PayoutDispatchRequest {
  reference: string;
  amount: number;
  fee: number;
  totalDebit: number;
  network: MobileMoneyNetwork;
  recipientPhone: string;
  recipientName: string;
  payerUid: string;
  reason?: string;
}

export interface PayoutDispatchOutcome {
  outcome: 'completed' | 'pending_provider_webhook' | 'pending_admin_settlement' | 'definitive_failure';
  provider: string;
  gatewayRef?: string;
  message: string;
  disableAutomatedB2CReason?: string;
  raw?: any;
}

export interface PayoutProviderAdapter {
  id: 'manual_settlement' | 'dalipay_api' | 'custom_b2c';
  name: string;
  supportsAutomatedApi: boolean;
  dispatchPayout: (req: PayoutDispatchRequest, dbAdmin: any) => Promise<PayoutDispatchOutcome>;
}

const manualSettlementAdapter: PayoutProviderAdapter = {
  id: 'manual_settlement',
  name: 'PapoPay Admin Settlement Queue',
  supportsAutomatedApi: false,
  async dispatchPayout(req) {
    return {
      outcome: 'pending_admin_settlement',
      provider: 'manual_settlement',
      message: `Ombi la kutoa TZS ${req.amount.toLocaleString()} kwenda ${getMobileMoneyNetworkLabel(
        req.network
      )} (+${normalizePhoneForDaliPay(req.recipientPhone)}) limehifadhiwa na fedha zimezuiliwa kwa usalama zikisubiri uthibitisho wa malipo.`,
    };
  },
};

const daliPayApiAdapter: PayoutProviderAdapter = {
  id: 'dalipay_api',
  name: 'DaliPay Automated B2C Disbursements',
  supportsAutomatedApi: true,
  async dispatchPayout(req, dbAdmin) {
    const cfg = getDaliPayConfig();
    if (!cfg.configured) {
      return {
        outcome: 'pending_admin_settlement',
        provider: 'manual_settlement',
        message:
          'DaliPay API credentials hazijawekwa. Ombi limewekwa kwenye foleni ya uthibitisho wa Admin na fedha zimehifadhiwa salama.',
      };
    }

    const res = await initiateDaliPayDisbursement(
      {
        reference: req.reference,
        amount: req.amount,
        fee: req.fee,
        totalDebit: req.totalDebit,
        recipientPhone: req.recipientPhone,
        recipientName: req.recipientName,
        reason: req.reason || `PapoPay Withdrawal #${req.reference}`,
        payerUid: req.payerUid,
      },
      dbAdmin
    );

    if (res.ok) {
      return {
        outcome: res.status === 'completed' ? 'completed' : 'pending_provider_webhook',
        provider: 'dalipay_api',
        gatewayRef: res.gatewayRef,
        message: res.message,
      };
    }

    if (isDaliPayDashboardOnlyError(res.message)) {
      return {
        outcome: 'pending_admin_settlement',
        provider: 'manual_settlement',
        disableAutomatedB2CReason: res.message,
        message:
          'Malipo ya moja kwa moja ya DaliPay yanahitaji idhini ya Merchant Dashboard. Ombi lako limehifadhiwa (PENDING) na fedha zimezuiliwa salama kwa ajili ya malipo ya Admin.',
      };
    }

    return {
      outcome: 'definitive_failure',
      provider: 'dalipay_api',
      message: res.message || 'Malipo ya moja kwa moja kwenda mtandao wa simu yameshindikana.',
    };
  },
};

const customWebhookB2CAdapter: PayoutProviderAdapter = {
  id: 'custom_b2c',
  name: 'External Tanzania Payment Provider Adapter (Selcom/AzamPay/ClickPesa)',
  supportsAutomatedApi: true,
  async dispatchPayout(req) {
    const webhookUrl = String(process.env.CUSTOM_B2C_PAYOUT_WEBHOOK_URL || '').trim();
    const apiKey = String(process.env.CUSTOM_B2C_PAYOUT_API_KEY || '').trim();
    if (!webhookUrl) {
      return {
        outcome: 'pending_admin_settlement',
        provider: 'manual_settlement',
        message:
          'External B2C provider URL haijawekwa. Ombi limehifadhiwa kwenye foleni ya uthibitisho wa Admin.',
      };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 14000);
      let resp: Response;
      try {
        resp = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            reference: req.reference,
            amount: req.amount,
            fee: req.fee,
            currency: 'TZS',
            network: req.network,
            recipientPhone: normalizePhoneForDaliPay(req.recipientPhone),
            recipientName: req.recipientName,
            reason: req.reason,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      const data = (await resp.json().catch(() => ({}))) as any;
      if (!resp.ok || data?.ok === false || String(data?.status || '').toLowerCase() === 'failed') {
        return {
          outcome: 'definitive_failure',
          provider: 'custom_b2c',
          message: String(data?.message || data?.error || `B2C gateway error (HTTP ${resp.status})`),
          raw: data,
        };
      }

      const st = String(data?.status || '').toUpperCase();
      return {
        outcome: ['COMPLETED', 'SUCCESS', 'PAID'].includes(st) ? 'completed' : 'pending_provider_webhook',
        provider: 'custom_b2c',
        gatewayRef: String(data?.gatewayRef || data?.reference || req.reference),
        message: String(data?.message || 'Ombi la kutuma pesa limetumwa kwa mtoa huduma.'),
        raw: data,
      };
    } catch (err: any) {
      return {
        outcome: 'pending_admin_settlement',
        provider: 'manual_settlement',
        message:
          'Imeshindwa kuwasiliana na mtoa huduma kwa sasa. Ombi limehifadhiwa (PENDING) na fedha zimezuiliwa salama.',
        raw: { error: err?.message },
      };
    }
  },
};

export function getPayoutProviderAdapter(providerId: PapoPayTreasurySettings['b2cProvider']): PayoutProviderAdapter {
  switch (providerId) {
    case 'dalipay_api':
      return daliPayApiAdapter;
    case 'custom_b2c':
      return customWebhookB2CAdapter;
    case 'manual_settlement':
    default:
      return manualSettlementAdapter;
  }
}

export async function dispatchModularMobileMoneyPayout(
  dbAdmin: any,
  settings: PapoPayTreasurySettings,
  req: PayoutDispatchRequest
): Promise<PayoutDispatchOutcome> {
  // Never call disabled DaliPay endpoint repeatedly
  if (settings.b2cProvider === 'dalipay_api' && settings.daliPayDisbursementApiDisabled) {
    return await manualSettlementAdapter.dispatchPayout(req, dbAdmin);
  }

  const adapter = getPayoutProviderAdapter(settings.b2cProvider);
  const outcome = await adapter.dispatchPayout(req, dbAdmin);

  // Persist disabled state once detected so future withdrawals route straight to safe Pending Admin queue
  if (outcome.disableAutomatedB2CReason && dbAdmin) {
    await dbAdmin
      .collection('config')
      .doc('papopay_settings')
      .set(
        cleanUndefined({
          b2cProvider: 'manual_settlement',
          daliPayDisbursementApiDisabled: true,
          daliPayDisabledMessage: outcome.disableAutomatedB2CReason,
          daliPayDisabledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      )
      .catch(() => {});
  }

  return outcome;
}
