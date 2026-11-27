import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { cleanUndefined } from './getFirestoreDb.js';
import {
  computeTransferFee,
  computeWithdrawalFee,
  getMobileMoneyNetworkLabel,
  getPapoPayTreasurySettings,
  normalizeMobileMoneyNetwork,
} from './payoutProviders.js';
import { deriveCanonicalWalletId, lookupP2PRecipientVerified } from './walletEngine.js';

export interface WhatsAppFlowsConfig {
  enableNativeFlows: boolean;
  hubFlowId: string;
  papopayFlowId: string;
  checkoutFlowId: string;
  registerFlowId: string;
  rideFlowId: string;
  bookingFlowId: string;
  paymentConfigurationName: string;
  checkoutTemplateName: string;
  checkoutTemplateLanguage: string;
  dataEndpointUri: string;
  updatedAt?: string;
}

export interface EnhancedPaymentLinkRecord {
  refCode: string;
  title: string;
  description?: string;
  amount: number;
  currency: 'TZS';
  merchantName: string;
  merchantPhone: string;
  merchantUid?: string | null;
  merchantWalletId?: string | null;
  purpose: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  checkoutUrl: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  paymentType: 'payment_link' | 'payment_gateway' | 'upi' | 'boleto';
  paymentConfiguration?: string;
  paidAt?: string;
  paidMethod?: string;
  transactionRef?: string;
  orderId?: string | null;
  createdAt: string;
  createdAtMs: number;
  expiresAtMs: number;
}

const META_CONFIG_FILE = path.join(process.cwd(), 'meta_config.json');

export function getPublicAppBaseUrl(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.VITE_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
    'https://dereva-tz.onrender.com',
  ];
  for (const cand of candidates) {
    const clean = String(cand || '').trim().replace(/\/+$/, '');
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
  }
  return 'https://dereva-tz.onrender.com';
}

function readLocalMetaConfig(): Record<string, any> {
  try {
    if (fs.existsSync(META_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(META_CONFIG_FILE, 'utf8')) || {};
    }
  } catch {}
  return {};
}

function writeLocalMetaConfigPatch(patch: Record<string, any>): void {
  try {
    const cur = readLocalMetaConfig();
    const merged = {
      ...cur,
      ...patch,
      flowIds: {
        ...(cur.flowIds || {}),
        ...(patch.flowIds || {}),
      },
      flowsConfig: {
        ...(cur.flowsConfig || {}),
        ...(patch.flowsConfig || {}),
      },
    };
    fs.writeFileSync(META_CONFIG_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[WhatsApp Flows] Failed writing local meta_config.json:', err?.message || err);
  }
}

export async function getWhatsAppFlowsConfig(dbAdmin?: any): Promise<WhatsAppFlowsConfig> {
  const local = readLocalMetaConfig();
  const localFlows = local.flowsConfig || {};
  const localFlowIds = local.flowIds || {};
  let remote: Record<string, any> = {};

  if (dbAdmin) {
    try {
      const snap = await dbAdmin.collection('config').doc('whatsapp_flows').get();
      if (snap?.exists) remote = snap.data() || {};
    } catch {}
  }

  const pick = (envKey: string, remoteVal: any, localVal: any, fallback = ''): string => {
    const e = String(process.env[envKey] || '').trim();
    if (e) return e;
    const r = String(remoteVal || '').trim();
    if (r) return r;
    const l = String(localVal || '').trim();
    if (l) return l;
    return fallback;
  };

  const baseUrl = getPublicAppBaseUrl();
  return {
    enableNativeFlows:
      typeof remote.enableNativeFlows === 'boolean'
        ? remote.enableNativeFlows
        : typeof localFlows.enableNativeFlows === 'boolean'
        ? localFlows.enableNativeFlows
        : true,
    hubFlowId: pick('META_WHATSAPP_FLOW_ID_HUB', remote.hubFlowId, localFlows.hubFlowId || localFlowIds.hub || localFlowIds.default),
    papopayFlowId: pick('META_WHATSAPP_FLOW_ID_PAPOPAY', remote.papopayFlowId, localFlows.papopayFlowId || localFlowIds.papopay),
    checkoutFlowId: pick('META_WHATSAPP_FLOW_ID_CHECKOUT', remote.checkoutFlowId, localFlows.checkoutFlowId || localFlowIds.checkout),
    registerFlowId: pick('META_WHATSAPP_FLOW_ID_REGISTER', remote.registerFlowId, localFlows.registerFlowId || localFlowIds.register),
    rideFlowId: pick('META_WHATSAPP_FLOW_ID_RIDE', remote.rideFlowId, localFlows.rideFlowId || localFlowIds.ride),
    bookingFlowId: pick('META_WHATSAPP_FLOW_ID_BOOKING', remote.bookingFlowId, localFlows.bookingFlowId || localFlowIds.booking),
    paymentConfigurationName: pick('META_WHATSAPP_PAYMENT_CONFIGURATION', remote.paymentConfigurationName, localFlows.paymentConfigurationName),
    checkoutTemplateName: pick('META_WHATSAPP_CHECKOUT_TEMPLATE', remote.checkoutTemplateName, localFlows.checkoutTemplateName, 'papopay_order_checkout'),
    checkoutTemplateLanguage: pick('META_WHATSAPP_CHECKOUT_TEMPLATE_LANG', remote.checkoutTemplateLanguage, localFlows.checkoutTemplateLanguage, 'sw'),
    dataEndpointUri: pick('META_WHATSAPP_FLOW_ENDPOINT_URI', remote.dataEndpointUri, localFlows.dataEndpointUri, `${baseUrl}/api/meta/flows/data`),
    updatedAt: remote.updatedAt || localFlows.updatedAt,
  };
}

export async function saveWhatsAppFlowsConfig(
  patch: Partial<WhatsAppFlowsConfig>,
  dbAdmin?: any
): Promise<WhatsAppFlowsConfig> {
  const current = await getWhatsAppFlowsConfig(dbAdmin);
  const next: WhatsAppFlowsConfig = {
    enableNativeFlows:
      typeof patch.enableNativeFlows === 'boolean'
        ? patch.enableNativeFlows
        : current.enableNativeFlows,
    hubFlowId: patch.hubFlowId !== undefined ? String(patch.hubFlowId).trim() : current.hubFlowId,
    papopayFlowId: patch.papopayFlowId !== undefined ? String(patch.papopayFlowId).trim() : current.papopayFlowId,
    checkoutFlowId: patch.checkoutFlowId !== undefined ? String(patch.checkoutFlowId).trim() : current.checkoutFlowId,
    registerFlowId: patch.registerFlowId !== undefined ? String(patch.registerFlowId).trim() : current.registerFlowId,
    rideFlowId: patch.rideFlowId !== undefined ? String(patch.rideFlowId).trim() : current.rideFlowId,
    bookingFlowId: patch.bookingFlowId !== undefined ? String(patch.bookingFlowId).trim() : current.bookingFlowId,
    paymentConfigurationName:
      patch.paymentConfigurationName !== undefined
        ? String(patch.paymentConfigurationName).trim()
        : current.paymentConfigurationName,
    checkoutTemplateName:
      patch.checkoutTemplateName !== undefined
        ? String(patch.checkoutTemplateName).trim() || 'papopay_order_checkout'
        : current.checkoutTemplateName,
    checkoutTemplateLanguage:
      patch.checkoutTemplateLanguage !== undefined
        ? String(patch.checkoutTemplateLanguage).trim() || 'sw'
        : current.checkoutTemplateLanguage,
    dataEndpointUri:
      patch.dataEndpointUri !== undefined && String(patch.dataEndpointUri).trim()
        ? String(patch.dataEndpointUri).trim()
        : current.dataEndpointUri,
    updatedAt: new Date().toISOString(),
  };

  writeLocalMetaConfigPatch({
    flowsConfig: next,
    flowIds: {
      hub: next.hubFlowId || undefined,
      papopay: next.papopayFlowId || undefined,
      checkout: next.checkoutFlowId || undefined,
      register: next.registerFlowId || undefined,
      ride: next.rideFlowId || undefined,
      booking: next.bookingFlowId || undefined,
      default: next.hubFlowId || undefined,
    },
  });

  if (dbAdmin) {
    await dbAdmin
      .collection('config')
      .doc('whatsapp_flows')
      .set(cleanUndefined(next), { merge: true })
      .catch((err: any) => console.warn('[WhatsApp Flows] Firestore save warning:', err?.message || err));
  }

  return next;
}

// ============================================================================
// 1. OFFICIAL META WHATSAPP FLOWS JSON V6.0 SCHEMAS
// ============================================================================

export function buildPapoHapoSuperHubFlowJson(dataEndpointUri?: string): Record<string, any> {
  return {
    version: '6.0',
    ...(dataEndpointUri ? { data_api_version: '3.0', data_channel_uri: dataEndpointUri } : {}),
    routing_model: {
      HUB_HOME: [],
    },
    screens: [
      {
        id: 'HUB_HOME',
        title: 'Papo Hapo',
        terminal: true,
        success: true,
        data: {
          headline: { type: 'string', __example__: 'Huduma zote, papo hapo!' },
          subheadline: { type: 'string', __example__: 'Chagua huduma unayotaka.' },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
                description: { type: 'string' },
              },
            },
            __example__: [
              { id: 'papopay', title: 'PapoPay (24/7)', description: 'Wazi • Pochi, Tuma Pesa, Bili & Link' },
              { id: 'taxi', title: 'PapoRide', description: 'Wazi • Teksi, Boda & Bajaji' },
              { id: 'food', title: 'PapoFood', description: 'Wazi • Chakula na Meza' },
              { id: 'grocery', title: 'PapoMart', description: 'Wazi • Vyakula na Bidhaa' },
              { id: 'parcel', title: 'PapoSend', description: 'Wazi • Vifurushi na Usafirishaji' },
              { id: 'pharmacy', title: 'PapoMed', description: 'Wazi • Famasi na Afya' },
              { id: 'salon', title: 'PapoStyle', description: 'Wazi • Saluni na Spa' },
              { id: 'handyman', title: 'PapoFix', description: 'Wazi • Matengenezo na Fundi' },
              { id: 'hotel', title: 'PapoStay', description: 'Wazi • Hoteli na Malazi' },
              { id: 'bus_ticket', title: 'PapoBus', description: 'Wazi • Tiketi za Mabasi Mikoani' },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextHeading', text: '${data.headline}' },
            { type: 'TextCaption', text: '${data.subheadline}' },
            {
              type: 'Form',
              name: 'hub_form',
              children: [
                {
                  type: 'RadioButtonsGroup',
                  name: 'selected_service',
                  label: 'Chagua Huduma ya Papo Hapo',
                  required: true,
                  'data-source': '${data.services}',
                },
                {
                  type: 'Footer',
                  label: 'Fungua Huduma',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      flow_type: 'papo_hub',
                      selected_service: '${form.selected_service}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export function buildPapoPayWalletFlowJson(dataEndpointUri?: string): Record<string, any> {
  return {
    version: '6.0',
    ...(dataEndpointUri ? { data_api_version: '3.0', data_channel_uri: dataEndpointUri } : {}),
    routing_model: {
      PAPOPAY_HOME: ['PAPOPAY_INPUTS', 'PAPOPAY_SUMMARY'],
      PAPOPAY_INPUTS: ['PAPOPAY_SUMMARY'],
      PAPOPAY_SUMMARY: [],
    },
    screens: [
      {
        id: 'PAPOPAY_HOME',
        title: 'PapoPay',
        data: {
          wallet_banner: {
            type: 'string',
            __example__: 'Salio: TZS 0 • Weka pesa, tuma, na lipa bili kupitia WhatsApp.',
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextHeading', text: 'Lipa popote kwa PapoPay' },
            { type: 'TextBody', text: '${data.wallet_banner}' },
            {
              type: 'Form',
              name: 'papopay_home_form',
              children: [
                {
                  type: 'RadioButtonsGroup',
                  name: 'papopay_action',
                  label: 'Chagua Huduma ya PapoPay',
                  required: true,
                  'data-source': [
                    { id: 'topup', title: 'Weka Pesa (Top Up)', description: 'Lipa Namba 5656565 au Simu Push' },
                    { id: 'send_p2p', title: 'Tuma MoMo / Benki / PapoPay', description: '@username, Wallet ID, Simu au Benki' },
                    { id: 'send_bulk', title: 'Tuma kwa Wengi', description: 'Lipa namba nyingi kwa mkupuo mmoja' },
                    { id: 'withdraw', title: 'Toa Pesa (Withdraw)', description: 'M-Pesa, Mixx, Airtel, HaloPesa & Wakala' },
                    { id: 'balance_history', title: 'Salio na Historia', description: 'Salio, PapoPoints na miamala 8 ya mwisho' },
                    { id: 'bill_luku', title: 'Lipa Bili (LUKU, Maji, Airtime)', description: 'Umeme, DAWASA, Vocha (+5% PapoPoints)' },
                    { id: 'pay_target', title: 'Lipa Dereva / Duka', description: 'Review & Pay in-chat au namba ya duka' },
                    { id: 'split_bill', title: 'Gawana Bili (Split Bill)', description: 'Gawana bili na marafiki WhatsApp' },
                    { id: 'create_link', title: 'Link ya Malipo', description: 'Unda Enhanced Payment Link & Checkout Card' },
                    { id: 'student_card', title: 'Kadi ya Mwanafunzi & Card', description: 'Kadi ya NFC & Virtual Mastercard' },
                  ],
                },
                {
                  type: 'Footer',
                  label: 'Endelea',
                  'on-click-action': {
                    name: 'data_exchange',
                    payload: {
                      papopay_action: '${form.papopay_action}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'PAPOPAY_INPUTS',
        title: 'Taarifa za Muamala',
        data: {
          action_id: { type: 'string', __example__: 'send_p2p' },
          heading: { type: 'string', __example__: 'Tuma MoMo / Benki' },
          helper_text: { type: 'string', __example__: 'Weka @username, Wallet ID, namba ya simu au benki.' },
          show_channel: { type: 'boolean', __example__: true },
          show_recipient: { type: 'boolean', __example__: true },
          show_amount: { type: 'boolean', __example__: true },
          recipient_label: { type: 'string', __example__: 'Mpokeaji (@username / Wallet ID / Simu)' },
          channel_options: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                title: { type: 'string' },
              },
            },
            __example__: [
              { id: 'PAPOWALLET', title: 'PapoWallet (0% Ada)' },
              { id: 'MPESA', title: 'Vodacom M-Pesa' },
              { id: 'TIGO', title: 'Tigo Pesa (Mixx)' },
              { id: 'AIRTEL', title: 'Airtel Money' },
              { id: 'HALOPESA', title: 'HaloPesa' },
              { id: 'BANK', title: 'Benki (CRDB / NMB / NBC)' },
            ],
          },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextHeading', text: '${data.heading}' },
            { type: 'TextCaption', text: '${data.helper_text}' },
            {
              type: 'Form',
              name: 'papopay_inputs_form',
              children: [
                {
                  type: 'Dropdown',
                  name: 'channel',
                  label: 'Mtandao / Njia',
                  visible: '${data.show_channel}',
                  'data-source': '${data.channel_options}',
                },
                {
                  type: 'TextInput',
                  name: 'recipient_or_account',
                  label: '${data.recipient_label}',
                  'input-type': 'text',
                  visible: '${data.show_recipient}',
                },
                {
                  type: 'TextInput',
                  name: 'amount',
                  label: 'Kiasi (TZS)',
                  'input-type': 'number',
                  visible: '${data.show_amount}',
                },
                {
                  type: 'TextInput',
                  name: 'note',
                  label: 'Maelezo (Hiari)',
                  'input-type': 'text',
                  required: false,
                },
                {
                  type: 'Footer',
                  label: 'Kagua Muamala',
                  'on-click-action': {
                    name: 'data_exchange',
                    payload: {
                      action_id: '${data.action_id}',
                      channel: '${form.channel}',
                      recipient_or_account: '${form.recipient_or_account}',
                      amount: '${form.amount}',
                      note: '${form.note}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        id: 'PAPOPAY_SUMMARY',
        title: 'Thibitisha Malipo',
        terminal: true,
        success: true,
        data: {
          action_id: { type: 'string', __example__: 'send_p2p' },
          channel: { type: 'string', __example__: 'PAPOWALLET' },
          recipient_or_account: { type: 'string', __example__: '@amourrashid' },
          recipient_display: { type: 'string', __example__: 'AMOUR RASHID (@amourrashid)' },
          amount: { type: 'string', __example__: '10000' },
          fee_tzs: { type: 'string', __example__: '0' },
          total_tzs: { type: 'string', __example__: '10000' },
          summary_text: { type: 'string', __example__: 'Tuma TZS 10,000 kwenda @amourrashid (Ada: TZS 0)' },
          requires_pin: { type: 'boolean', __example__: true },
          note: { type: 'string', __example__: '' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextHeading', text: 'Muhtasari wa PapoPay' },
            { type: 'TextBody', text: '${data.summary_text}' },
            {
              type: 'Form',
              name: 'papopay_confirm_form',
              children: [
                {
                  type: 'TextInput',
                  name: 'pin',
                  label: 'PapoPay Transaction PIN (Tarakimu 4–6)',
                  'input-type': 'passcode',
                  visible: '${data.requires_pin}',
                },
                {
                  type: 'Footer',
                  label: 'Kamilisha Sasa',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      flow_type: 'papopay_action',
                      action_id: '${data.action_id}',
                      channel: '${data.channel}',
                      recipient_or_account: '${data.recipient_or_account}',
                      amount: '${data.amount}',
                      fee_tzs: '${data.fee_tzs}',
                      total_tzs: '${data.total_tzs}',
                      note: '${data.note}',
                      pin: '${form.pin}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

export function buildPaymentLinkCheckoutFlowJson(dataEndpointUri?: string): Record<string, any> {
  return {
    version: '6.0',
    ...(dataEndpointUri ? { data_api_version: '3.0', data_channel_uri: dataEndpointUri } : {}),
    routing_model: {
      CHECKOUT_REVIEW: [],
    },
    screens: [
      {
        id: 'CHECKOUT_REVIEW',
        title: 'Lipa na PapoPay',
        terminal: true,
        success: true,
        data: {
          reference_id: { type: 'string', __example__: 'REQ-100231' },
          merchant_name: { type: 'string', __example__: 'Papo Hapo Store' },
          item_title: { type: 'string', __example__: 'Agizo la Chakula' },
          amount_tzs: { type: 'string', __example__: '15000' },
        },
        layout: {
          type: 'SingleColumnLayout',
          children: [
            { type: 'TextHeading', text: 'Review & Pay • ${data.merchant_name}' },
            { type: 'TextBody', text: '${data.item_title} — Jumla: TZS ${data.amount_tzs}' },
            {
              type: 'Form',
              name: 'checkout_form',
              children: [
                {
                  type: 'RadioButtonsGroup',
                  name: 'payment_method',
                  label: 'Chagua Njia ya Malipo',
                  required: true,
                  'data-source': [
                    { id: 'papowallet', title: 'PapoPay Wallet (0% Ada)' },
                    { id: 'mpesa', title: 'M-Pesa (Vodacom)' },
                    { id: 'tigopesa', title: 'Mixx by Yas (Tigo Pesa)' },
                    { id: 'airtel', title: 'Airtel Money' },
                    { id: 'halopesa', title: 'HaloPesa' },
                    { id: 'lipanamba', title: 'Lipa Namba 5656565' },
                  ],
                },
                {
                  type: 'TextInput',
                  name: 'buyer_phone',
                  label: 'Namba ya Simu ya Mlipaji',
                  'input-type': 'phone',
                  required: true,
                },
                {
                  type: 'TextInput',
                  name: 'pin',
                  label: 'PapoPay PIN (Kama unatumia Wallet)',
                  'input-type': 'passcode',
                  required: false,
                },
                {
                  type: 'Footer',
                  label: 'Lipa Sasa',
                  'on-click-action': {
                    name: 'complete',
                    payload: {
                      flow_type: 'checkout_link',
                      reference_id: '${data.reference_id}',
                      payment_method: '${form.payment_method}',
                      buyer_phone: '${form.buyer_phone}',
                      pin: '${form.pin}',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

// ============================================================================
// 2. META FLOWS CRYPTOGRAPHY & DATA EXCHANGE ENDPOINT HANDLER
// ============================================================================

export function verifyMetaXHubSignature(
  rawBody: Buffer | string | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined
): boolean {
  const secret = String(appSecret || '').trim();
  const header = String(signatureHeader || '').trim();
  if (!secret || !header || !rawBody) return false;
  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', secret)
      .update(typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody)
      .digest('hex');
  try {
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(header, 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function decryptMetaFlowRequest(
  body: {
    encrypted_flow_data: string;
    encrypted_aes_key: string;
    initial_vector: string;
  },
  privateKeyPem: string,
  passphrase?: string
): {
  decryptedBody: Record<string, any>;
  aesKeyBuffer: Buffer;
  initialVectorBuffer: Buffer;
} {
  const encryptedAesKey = Buffer.from(body.encrypted_aes_key, 'base64');
  const keyObj = crypto.createPrivateKey({
    key: privateKeyPem,
    ...(passphrase ? { passphrase } : {}),
  });

  const aesKeyBuffer = crypto.privateDecrypt(
    {
      key: keyObj,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    encryptedAesKey
  );

  const initialVectorBuffer = Buffer.from(body.initial_vector, 'base64');
  const flowDataBuffer = Buffer.from(body.encrypted_flow_data, 'base64');
  const TAG_LENGTH = 16;
  const encryptedBody = flowDataBuffer.subarray(0, -TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-128-gcm', aesKeyBuffer, initialVectorBuffer);
  decipher.setAuthTag(authTag);

  const decryptedStr = Buffer.concat([decipher.update(encryptedBody), decipher.final()]).toString('utf8');
  return {
    decryptedBody: JSON.parse(decryptedStr),
    aesKeyBuffer,
    initialVectorBuffer,
  };
}

export function encryptMetaFlowResponse(
  responsePayload: Record<string, any>,
  aesKeyBuffer: Buffer,
  initialVectorBuffer: Buffer
): string {
  const flippedIv = Buffer.from(initialVectorBuffer.map((byte) => byte ^ 0xff));
  const cipher = crypto.createCipheriv('aes-128-gcm', aesKeyBuffer, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(responsePayload), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString('base64');
}

async function resolveUserWalletSummaryForFlow(dbAdmin: any, phoneOrToken?: string) {
  if (!dbAdmin || !phoneOrToken) {
    return { found: false, balance: 0, points: 0, walletId: '', displayName: 'Mteja wa PapoPay', username: '' };
  }
  const digits = String(phoneOrToken).replace(/\D/g, '');
  if (digits.length < 9) {
    return { found: false, balance: 0, points: 0, walletId: '', displayName: 'Mteja wa PapoPay', username: '' };
  }
  const tail9 = digits.slice(-9);
  const candidates = Array.from(new Set([digits, `+${digits}`, `0${tail9}`, `255${tail9}`, `+255${tail9}`]));
  for (const field of ['phoneNumber', 'phone']) {
    try {
      const snap = await dbAdmin.collection('users').where(field, 'in', candidates).limit(1).get();
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const d = docSnap.data() || {};
        return {
          found: true,
          balance: Number(d.walletBalance || 0),
          points: Number(d.points || 0),
          walletId: deriveCanonicalWalletId(d, docSnap.id),
          displayName: String(d.displayName || d.fullName || 'Mteja wa PapoPay'),
          username: d.username ? `@${String(d.username).replace(/^@+/, '')}` : '',
        };
      }
    } catch {}
  }
  return { found: false, balance: 0, points: 0, walletId: '', displayName: 'Mteja wa PapoPay', username: '' };
}

export async function handleWhatsAppFlowDataExchange(
  dbAdmin: any,
  rawPayload: Record<string, any>
): Promise<{ statusCode: number; encryptedText?: string; json?: Record<string, any> }> {
  const privateKeyPem = String(process.env.META_FLOW_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();
  const isEncrypted = Boolean(
    rawPayload?.encrypted_flow_data && rawPayload?.encrypted_aes_key && rawPayload?.initial_vector
  );

  let reqData: Record<string, any> = rawPayload || {};
  let aesKeyBuffer: Buffer | null = null;
  let initialVectorBuffer: Buffer | null = null;

  if (isEncrypted) {
    if (!privateKeyPem) {
      return {
        statusCode: 421,
        json: { error: 'META_FLOW_PRIVATE_KEY is not configured for encrypted Flow Data Exchange.' },
      };
    }
    try {
      const decrypted = decryptMetaFlowRequest(
        {
          encrypted_flow_data: String(rawPayload.encrypted_flow_data),
          encrypted_aes_key: String(rawPayload.encrypted_aes_key),
          initial_vector: String(rawPayload.initial_vector),
        },
        privateKeyPem,
        process.env.META_FLOW_PRIVATE_KEY_PASSPHRASE
      );
      reqData = decrypted.decryptedBody;
      aesKeyBuffer = decrypted.aesKeyBuffer;
      initialVectorBuffer = decrypted.initialVectorBuffer;
    } catch (err: any) {
      console.error('[WhatsApp Flows] Decryption failed:', err?.message || err);
      return { statusCode: 421, json: { error: 'Failed to decrypt WhatsApp Flow payload.' } };
    }
  }

  const sendResponse = (responseObj: Record<string, any>) => {
    if (isEncrypted && aesKeyBuffer && initialVectorBuffer) {
      return {
        statusCode: 200,
        encryptedText: encryptMetaFlowResponse(responseObj, aesKeyBuffer, initialVectorBuffer),
      };
    }
    return { statusCode: 200, json: responseObj };
  };

  const action = String(reqData.action || '').toLowerCase();
  if (action === 'ping') {
    return sendResponse({ data: { status: 'active' } });
  }

  const flowToken = String(reqData.flow_token || '');
  const screen = String(reqData.screen || '');
  const data = reqData.data || {};
  const phoneHint = flowToken.replace(/^papo_[^_]+_/, '').split('_')[0];
  const treasury = await getPapoPayTreasurySettings(dbAdmin);
  const walletSummary = await resolveUserWalletSummaryForFlow(dbAdmin, phoneHint);

  if (action === 'init' || screen === 'HUB_HOME' || (!screen && data.hub_init)) {
    const servicesList = [
      { id: 'papopay', title: 'PapoPay (24/7)', description: 'Wazi • Pochi, Tuma Pesa, Bili & Link' },
      { id: 'taxi', title: 'PapoRide', description: 'Wazi • Teksi, Boda & Bajaji' },
      { id: 'food', title: 'PapoFood', description: 'Wazi • Chakula na Meza' },
      { id: 'grocery', title: 'PapoMart', description: 'Wazi • Vyakula na Bidhaa' },
      { id: 'parcel', title: 'PapoSend', description: 'Wazi • Vifurushi na Usafirishaji' },
      { id: 'pharmacy', title: 'PapoMed', description: 'Wazi • Famasi na Afya' },
      { id: 'salon', title: 'PapoStyle', description: 'Wazi • Saluni na Spa' },
      { id: 'handyman', title: 'PapoFix', description: 'Wazi • Matengenezo na Fundi' },
      { id: 'hotel', title: 'PapoStay', description: 'Wazi • Hoteli na Malazi' },
      { id: 'bus_ticket', title: 'PapoBus', description: 'Wazi • Tiketi za Mabasi Mikoani' },
    ];
    if (flowToken.includes('papopay')) {
      return sendResponse({
        screen: 'PAPOPAY_HOME',
        data: {
          wallet_banner: `Salio: TZS ${walletSummary.balance.toLocaleString()} • ${walletSummary.points} PapoPoints${
            walletSummary.walletId ? ` • ID: ${walletSummary.walletId}` : ''
          }`,
        },
      });
    }
    return sendResponse({
      screen: 'HUB_HOME',
      data: {
        headline: 'Huduma zote, papo hapo!',
        subheadline: 'Chagua huduma unayotaka.',
        services: servicesList,
      },
    });
  }

  if (screen === 'PAPOPAY_HOME') {
    const pickedAction = String(data.papopay_action || 'send_p2p');
    if (pickedAction === 'balance_history' || pickedAction === 'student_card') {
      return sendResponse({
        screen: 'PAPOPAY_SUMMARY',
        data: {
          action_id: pickedAction,
          channel: 'PAPOWALLET',
          recipient_or_account: walletSummary.walletId || 'WALLET',
          recipient_display: walletSummary.displayName,
          amount: '0',
          fee_tzs: '0',
          total_tzs: '0',
          summary_text:
            pickedAction === 'balance_history'
              ? `Salio la PapoWallet: TZS ${walletSummary.balance.toLocaleString()} • PapoPoints: ${walletSummary.points} pts • ID: ${walletSummary.walletId || 'Papohapo'}`
              : `Fungua usimamizi wa Kadi ya Mwanafunzi & Virtual Mastercard kwa salio la TZS ${walletSummary.balance.toLocaleString()}.`,
          requires_pin: false,
          note: '',
        },
      });
    }

    const inputConfigs: Record<
      string,
      {
        heading: string;
        helper: string;
        showChannel: boolean;
        showRecipient: boolean;
        showAmount: boolean;
        recipientLabel: string;
        channels: Array<{ id: string; title: string }>;
      }
    > = {
      topup: {
        heading: 'Weka Pesa (Top Up)',
        helper: 'Chagua Lipa Namba 5656565 au Simu (Mongike USSD Push).',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Namba yako ya Simu (mf. 0712345678)',
        channels: [
          { id: 'LIPANAMBA', title: 'Lipa Namba 5656565' },
          { id: 'MONGIKE', title: 'Simu Push (M-Pesa / Mixx / Airtel)' },
        ],
      },
      send_p2p: {
        heading: 'Tuma MoMo / Benki / PapoPay',
        helper: 'Weka @username, Wallet ID, namba ya simu au akaunti ya benki.',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: '@username, Wallet ID, Simu au Akaunti Benki',
        channels: [
          { id: 'PAPOWALLET', title: 'PapoWallet (0% Ada)' },
          { id: 'MPESA', title: 'Vodacom M-Pesa' },
          { id: 'TIGO', title: 'Tigo Pesa (Mixx by Yas)' },
          { id: 'AIRTEL', title: 'Airtel Money' },
          { id: 'HALOPESA', title: 'HaloPesa' },
          { id: 'BANK', title: 'Benki (CRDB/NMB/NBC)' },
        ],
      },
      send_bulk: {
        heading: 'Tuma kwa Wengi (Bulk Pay)',
        helper: 'Weka namba zilizotenganishwa kwa koma (mf. 0712345678, 0755111222).',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Namba za Wapokeaji (koma)',
        channels: [
          { id: 'PAPOWALLET', title: 'PapoWallet (0% Ada)' },
          { id: 'MOMO', title: 'Mitandao ya Simu' },
        ],
      },
      withdraw: {
        heading: 'Toa Pesa (Withdraw)',
        helper: 'Toa kwenda M-Pesa, Tigo Pesa, Airtel Money, HaloPesa au Wakala.',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Namba ya Simu ya Kupokea Pesa',
        channels: [
          { id: 'MPESA', title: 'Vodacom M-Pesa' },
          { id: 'TIGO', title: 'Tigo Pesa (Mixx by Yas)' },
          { id: 'AIRTEL', title: 'Airtel Money' },
          { id: 'HALOPESA', title: 'HaloPesa' },
          { id: 'WAKALA', title: 'Msimbo wa Wakala' },
        ],
      },
      bill_luku: {
        heading: 'Lipa Bili (LUKU, Maji, Airtime)',
        helper: 'Pata +5% PapoPoints Cashback papo hapo.',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Namba ya Mita / Akaunti / Simu',
        channels: [
          { id: 'LUKU', title: 'LUKU (TANESCO)' },
          { id: 'DAWASA', title: 'DAWASA Maji' },
          { id: 'VOCHA', title: 'Airtime / Vocha' },
          { id: 'TV', title: 'AzamTV / DStv / StarTimes' },
        ],
      },
      pay_target: {
        heading: 'Lipa Dereva / Duka',
        helper: 'Weka namba au jina la dereva/duka na kiasi.',
        showChannel: true,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Jina / Namba ya Dereva au Duka',
        channels: [
          { id: 'PAPOWALLET', title: 'PapoWallet Salio' },
          { id: 'MONGIKE', title: 'Simu Push' },
          { id: 'LIPANAMBA', title: 'Lipa Namba 5656565' },
        ],
      },
      split_bill: {
        heading: 'Gawana Bili (Split Bill)',
        helper: 'Weka idadi ya watu na jumla ya bili.',
        showChannel: false,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Idadi ya Watu (mf. 3)',
        channels: [{ id: 'SPLIT', title: 'Gawa Bili' }],
      },
      create_link: {
        heading: 'Tengeneza Link ya Malipo',
        helper: 'Unda Enhanced Payment Link & Review & Pay Card ya kutuma kwa mteja.',
        showChannel: false,
        showRecipient: true,
        showAmount: true,
        recipientLabel: 'Maelezo ya Malipo (mf. Bili ya Chakula)',
        channels: [{ id: 'LINK', title: 'Enhanced Payment Link' }],
      },
    };

    const cfg = inputConfigs[pickedAction] || inputConfigs.send_p2p;
    return sendResponse({
      screen: 'PAPOPAY_INPUTS',
      data: {
        action_id: pickedAction,
        heading: cfg.heading,
        helper_text: cfg.helper,
        show_channel: cfg.showChannel,
        show_recipient: cfg.showRecipient,
        show_amount: cfg.showAmount,
        recipient_label: cfg.recipientLabel,
        channel_options: cfg.channels,
      },
    });
  }

  if (screen === 'PAPOPAY_INPUTS') {
    const actionId = String(data.action_id || 'send_p2p');
    const channel = String(data.channel || 'PAPOWALLET').toUpperCase();
    const recRaw = String(data.recipient_or_account || '').trim();
    const amountNum = Math.max(0, Math.round(Number(String(data.amount || '0').replace(/\D/g, '')) || 0));
    const note = String(data.note || '').trim();

    let recipientDisplay = recRaw || 'Mpokeaji';
    let feeTzs = 0;

    if (actionId === 'send_p2p' && channel === 'PAPOWALLET') {
      const verified = recRaw ? await lookupP2PRecipientVerified(dbAdmin, recRaw).catch(() => null) : null;
      if (verified?.found) {
        recipientDisplay = `${verified.displayName}${verified.username ? ` (${verified.username})` : ''} • ${verified.maskedWalletId}`;
      }
      feeTzs = computeTransferFee(amountNum, treasury);
    } else if (actionId === 'withdraw' || (actionId === 'send_p2p' && ['MPESA', 'TIGO', 'AIRTEL', 'HALOPESA'].includes(channel))) {
      feeTzs = computeWithdrawalFee(amountNum, treasury);
      const normNet = normalizeMobileMoneyNetwork(channel, recRaw);
      recipientDisplay = `${recRaw} (${normNet ? getMobileMoneyNetworkLabel(normNet) : channel})`;
    } else if (actionId === 'send_p2p' && channel === 'BANK') {
      feeTzs = Math.max(500, Math.round(amountNum * 0.005));
    }

    const totalTzs = amountNum + feeTzs;
    const requiresPin =
      ['send_p2p', 'send_bulk', 'withdraw'].includes(actionId) ||
      ((actionId === 'bill_luku' || actionId === 'pay_target') && channel === 'PAPOWALLET');

    return sendResponse({
      screen: 'PAPOPAY_SUMMARY',
      data: {
        action_id: actionId,
        channel,
        recipient_or_account: recRaw,
        recipient_display: recipientDisplay,
        amount: String(amountNum),
        fee_tzs: String(feeTzs),
        total_tzs: String(totalTzs),
        summary_text:
          `Huduma: ${actionId.toUpperCase()} (${channel})\n` +
          `Mpokeaji / Akaunti: ${recipientDisplay}\n` +
          `Kiasi: TZS ${amountNum.toLocaleString()}\n` +
          `Ada: TZS ${feeTzs.toLocaleString()}\n` +
          `Jumla: TZS ${totalTzs.toLocaleString()}`,
        requires_pin: requiresPin,
        note,
      },
    });
  }

  return sendResponse({ data: { status: 'ok', received: reqData } });
}

// ============================================================================
// 3. META GRAPH API FLOW PUBLISHING HELPER
// ============================================================================

export async function publishWhatsAppFlowToMeta(params: {
  flowKey: 'hub' | 'papopay' | 'checkout';
  wabaId?: string;
  accessToken?: string;
  dataEndpointUri?: string;
  publish?: boolean;
  dbAdmin?: any;
}): Promise<{
  ok: boolean;
  flowId?: string;
  published?: boolean;
  validationErrors?: any[];
  error?: string;
}> {
  const localCfg = readLocalMetaConfig();
  const wabaId = String(params.wabaId || process.env.META_WABA_ID || localCfg.wabaId || '').trim();
  const token = String(
    params.accessToken || process.env.META_WHATSAPP_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN || localCfg.accessToken || ''
  ).trim();

  if (!wabaId || !token) {
    return {
      ok: false,
      error: 'Weka WABA ID na Meta Access Token kwenye Meta Integration Settings kwanza.',
    };
  }

  const endpointUri = String(
    params.dataEndpointUri || `${getPublicAppBaseUrl()}/api/meta/flows/data`
  ).trim();

  const flowJson =
    params.flowKey === 'papopay'
      ? buildPapoPayWalletFlowJson(endpointUri)
      : params.flowKey === 'checkout'
      ? buildPaymentLinkCheckoutFlowJson(endpointUri)
      : buildPapoHapoSuperHubFlowJson(endpointUri);

  const flowName =
    params.flowKey === 'papopay'
      ? `papopay_wallet_${Date.now()}`
      : params.flowKey === 'checkout'
      ? `papopay_checkout_${Date.now()}`
      : `papohapo_hub_${Date.now()}`;

  const createRes = await fetch(`https://graph.facebook.com/v21.0/${wabaId}/flows`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: flowName,
      categories: ['OTHER'],
      endpoint_uri: endpointUri,
    }),
  });
  const createJson: any = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !createJson?.id) {
    return {
      ok: false,
      error: createJson?.error?.message || `Meta Flow create failed (HTTP ${createRes.status})`,
    };
  }

  const flowId = String(createJson.id);
  const formData = new FormData();
  formData.append('name', 'flow.json');
  formData.append('asset_type', 'FLOW_JSON');
  formData.append('file', new Blob([JSON.stringify(flowJson, null, 2)], { type: 'application/json' }), 'flow.json');

  const assetRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/assets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const assetJson: any = await assetRes.json().catch(() => ({}));
  const validationErrors = Array.isArray(assetJson?.validation_errors) ? assetJson.validation_errors : [];
  if (!assetRes.ok) {
    return {
      ok: false,
      flowId,
      validationErrors,
      error: assetJson?.error?.message || `Meta Flow JSON upload failed (HTTP ${assetRes.status})`,
    };
  }

  let published = false;
  if (params.publish !== false && validationErrors.length === 0) {
    const pubRes = await fetch(`https://graph.facebook.com/v21.0/${flowId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const pubJson: any = await pubRes.json().catch(() => ({}));
    published = Boolean(pubRes.ok && pubJson?.success);
  }

  const patch: Partial<WhatsAppFlowsConfig> =
    params.flowKey === 'papopay'
      ? { papopayFlowId: flowId }
      : params.flowKey === 'checkout'
      ? { checkoutFlowId: flowId }
      : { hubFlowId: flowId };
  await saveWhatsAppFlowsConfig(patch, params.dbAdmin);

  return {
    ok: true,
    flowId,
    published,
    validationErrors,
  };
}

// ============================================================================
// 4. ENHANCED PAYMENT LINKS, PG & CHECKOUT BUTTON TEMPLATES
// ============================================================================

export function buildEnhancedPayUrl(params: {
  refCode: string;
  amount: number;
  merchantName: string;
  merchantPhone?: string;
  title?: string;
  purpose?: string;
  orderId?: string;
}): string {
  const qs = new URLSearchParams({
    mode: 'whatsapp',
    ref: params.refCode,
    amount: String(Math.max(100, Math.round(params.amount))),
    name: params.merchantName,
    ...(params.merchantPhone ? { to: params.merchantPhone } : {}),
    ...(params.title ? { title: params.title } : {}),
    ...(params.purpose ? { purpose: params.purpose } : {}),
    ...(params.orderId ? { orderId: params.orderId } : {}),
  });
  return `${getPublicAppBaseUrl()}/pay?${qs.toString()}`;
}

export async function createEnhancedPaymentLink(
  dbAdmin: any,
  input: {
    refCode?: string;
    title: string;
    description?: string;
    amount: number;
    merchantName: string;
    merchantPhone?: string;
    merchantUid?: string | null;
    merchantWalletId?: string | null;
    purpose?: string;
    items?: Array<{ name: string; quantity: number; price: number }>;
    paymentType?: 'payment_link' | 'payment_gateway' | 'upi' | 'boleto';
    paymentConfiguration?: string;
    expiresInHours?: number;
    orderId?: string | null;
  }
): Promise<EnhancedPaymentLinkRecord> {
  const amt = Math.max(100, Math.round(Number(input.amount || 0)));
  const refCode =
    String(input.refCode || '').trim() || `REQ-${Math.floor(100000 + Math.random() * 899999)}`;
  const checkoutUrl = buildEnhancedPayUrl({
    refCode,
    amount: amt,
    merchantName: input.merchantName || 'PapoPay Merchant',
    merchantPhone: input.merchantPhone,
    title: input.title,
    purpose: input.purpose || 'payment_request',
    orderId: input.orderId || undefined,
  });

  const nowMs = Date.now();
  const expiresHours = Math.max(1, Math.min(720, Number(input.expiresInHours || 72)));
  const record: EnhancedPaymentLinkRecord = {
    refCode,
    title: String(input.title || 'Malipo ya PapoPay').trim().slice(0, 120),
    description: input.description ? String(input.description).trim().slice(0, 250) : undefined,
    amount: amt,
    currency: 'TZS',
    merchantName: String(input.merchantName || 'PapoPay Merchant').trim().slice(0, 80),
    merchantPhone: String(input.merchantPhone || '').trim(),
    merchantUid: input.merchantUid || null,
    merchantWalletId: input.merchantWalletId || null,
    purpose: String(input.purpose || 'payment_request').trim(),
    status: 'pending',
    checkoutUrl,
    items:
      Array.isArray(input.items) && input.items.length > 0
        ? input.items.slice(0, 10).map((it) => ({
            name: String(it.name || 'Bidhaa').slice(0, 60),
            quantity: Math.max(1, Math.round(Number(it.quantity || 1))),
            price: Math.max(1, Math.round(Number(it.price || amt))),
          }))
        : [{ name: String(input.title || 'Malipo ya PapoPay').slice(0, 60), quantity: 1, price: amt }],
    paymentType: input.paymentType || 'payment_link',
    paymentConfiguration: input.paymentConfiguration || undefined,
    createdAt: new Date(nowMs).toISOString(),
    createdAtMs: nowMs,
    expiresAtMs: nowMs + expiresHours * 3600 * 1000,
    orderId: input.orderId || null,
  };

  if (dbAdmin) {
    await dbAdmin
      .collection('payment_links')
      .doc(refCode)
      .set(cleanUndefined(record), { merge: true })
      .catch((err: any) => console.warn('[Enhanced Payment Link] Save failed:', err?.message || err));
  }

  return record;
}

export async function getEnhancedPaymentLink(
  dbAdmin: any,
  refCode: string
): Promise<EnhancedPaymentLinkRecord | null> {
  const cleanRef = String(refCode || '').trim();
  if (!cleanRef || !dbAdmin) return null;
  try {
    const snap = await dbAdmin.collection('payment_links').doc(cleanRef).get();
    if (!snap.exists) return null;
    const data = snap.data() as EnhancedPaymentLinkRecord;
    if (data.status === 'pending' && data.expiresAtMs && Date.now() > data.expiresAtMs) {
      return { ...data, status: 'expired' };
    }
    return data;
  } catch {
    return null;
  }
}

export async function markEnhancedPaymentLinkPaid(
  dbAdmin: any,
  refCode: string,
  meta: { methodLabel?: string; transactionRef?: string; orderId?: string; status?: 'paid' | 'pending' }
): Promise<void> {
  const cleanRef = String(refCode || '').trim();
  if (!cleanRef || !dbAdmin) return;
  try {
    const snap = await dbAdmin.collection('payment_links').doc(cleanRef).get();
    if (!snap.exists) return;
    await dbAdmin
      .collection('payment_links')
      .doc(cleanRef)
      .set(
        cleanUndefined({
          status: meta.status === 'paid' ? 'paid' : 'pending',
          paidAt: meta.status === 'paid' ? new Date().toISOString() : undefined,
          paidMethod: meta.methodLabel,
          transactionRef: meta.transactionRef,
          orderId: meta.orderId,
        }),
        { merge: true }
      );
  } catch {}
}

export function buildCheckoutButtonTemplateWirePayload(params: {
  recipientId: string;
  templateName: string;
  languageCode?: string;
  customerName?: string;
  itemTitle: string;
  amountTZS: number;
  refCode: string;
  checkoutUrl: string;
  mode?: 'order_details' | 'url_button';
  paymentConfiguration?: string;
}): Record<string, any> {
  const amt = Math.max(100, Math.round(Number(params.amountTZS || 0)));
  const langCode = String(params.languageCode || 'sw').trim() || 'sw';

  if (params.mode === 'order_details') {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: params.recipientId,
      type: 'template',
      template: {
        name: params.templateName,
        language: { code: langCode },
        components: [
          {
            type: 'header',
            parameters: [
              {
                type: 'order_details',
                order_details: {
                  reference_id: params.refCode,
                  type: 'digital-goods',
                  ...(params.paymentConfiguration
                    ? { payment_configuration: params.paymentConfiguration }
                    : {
                        payment_settings: [
                          {
                            type: 'payment_link',
                            payment_link: { uri: params.checkoutUrl },
                          },
                        ],
                      }),
                  currency: 'TZS',
                  total_amount: { value: amt, offset: 1 },
                  order: {
                    status: 'pending',
                    items: [
                      {
                        retailer_id: params.refCode,
                        name: params.itemTitle.slice(0, 60),
                        amount: { value: amt, offset: 1 },
                        quantity: 1,
                      },
                    ],
                    subtotal: { value: amt, offset: 1 },
                  },
                },
              },
            ],
          },
          {
            type: 'body',
            parameters: [
              { type: 'text', text: params.customerName || 'Mteja' },
              { type: 'text', text: params.itemTitle.slice(0, 60) },
              { type: 'text', text: `TZS ${amt.toLocaleString()}` },
            ],
          },
        ],
      },
    };
  }

  const pathSuffix = params.checkoutUrl.replace(/^https?:\/\/[^/]+\/?/i, '');
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: params.recipientId,
    type: 'template',
    template: {
      name: params.templateName,
      language: { code: langCode },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: params.customerName || 'Mteja' },
            { type: 'text', text: params.itemTitle.slice(0, 60) },
            { type: 'text', text: `TZS ${amt.toLocaleString()}` },
          ],
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [{ type: 'text', text: pathSuffix || `pay?ref=${params.refCode}` }],
        },
      ],
    },
  };
}
