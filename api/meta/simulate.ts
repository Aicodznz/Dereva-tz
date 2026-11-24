import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestoreDb } from '../_lib/getFirestoreDb';
import { handleMetaInputWithMedia } from '../_lib/metaBot';
import { addMessageToHistory } from '../_lib/historyStore';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { senderId, message, channel, audioBase64, imageBase64, mimeType, caption, catalogOrder } = req.body || {};
    const effectiveMessage =
      message ||
      (audioBase64 ? '__WA_VOICE_NOTE__' : '') ||
      (imageBase64 ? (caption ? `__WA_IMAGE__:${caption}` : '__WA_IMAGE__') : '') ||
      (catalogOrder ? `__WA_CATALOG_ORDER__:${JSON.stringify(catalogOrder)}` : '');

    if (!senderId || !effectiveMessage || !channel) {
      return res.status(400).json({ error: 'senderId, message, and channel are required' });
    }

    const dbAdmin = getFirestoreDb();
    const { text: reply, media, interactive } = await handleMetaInputWithMedia(
      senderId,
      effectiveMessage,
      channel,
      dbAdmin,
      { audioBase64, imageBase64, mimeType, caption, catalogOrder }
    );

    addMessageToHistory(channel, senderId, effectiveMessage, reply);

    if (dbAdmin) {
      try {
        await dbAdmin.collection('meta_chats').add({
          channel,
          senderId,
          message: effectiveMessage,
          reply,
          mediaCount: media.length,
          timestamp: new Date(),
        });
      } catch (err) {
        console.warn('[Meta Simulator Vercel] Could not write chat to Firestore:', err);
      }
    }

    return res.status(200).json({ reply, media, interactive, status: 'success' });
  } catch (error: any) {
    console.error('[Meta Simulator Vercel] Processing error:', error);
    return res.status(500).json({ error: 'Failed to simulate Meta response', details: error?.message || String(error) });
  }
}
