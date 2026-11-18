import fs from 'fs';
import path from 'path';

function getHistoryPath(): string | null {
  if (typeof window !== 'undefined') return null;
  try {
    return path.join(process.cwd(), 'meta_chat_history.json');
  } catch {
    return null;
  }
}

function getClearedPath(): string | null {
  if (typeof window !== 'undefined') return null;
  try {
    return path.join(process.cwd(), 'logs_cleared.txt');
  } catch {
    return null;
  }
}

export interface ChatMessage {
  id: string;
  channel: string;
  senderId: string;
  message: string;
  reply: string;
  timestamp: string;
}

export function getHistory(): ChatMessage[] {
  try {
    const clearedPath = getClearedPath();
    const historyPath = getHistoryPath();
    if (!clearedPath || !historyPath) return [];
    if (fs.existsSync(clearedPath)) {
      return [];
    }
    if (fs.existsSync(historyPath)) {
      const data = fs.readFileSync(historyPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.warn("[historyStore] Error reading history file:", err);
  }
  return [];
}

export function addMessageToHistory(channel: string, senderId: string, message: string, reply: string) {
  try {
    const clearedPath = getClearedPath();
    const historyPath = getHistoryPath();
    if (!clearedPath || !historyPath) return;

    // Delete logs_cleared flag if a new real chat comes in
    if (fs.existsSync(clearedPath)) {
      try {
        fs.unlinkSync(clearedPath);
      } catch (e) {}
    }

    let history: ChatMessage[] = [];
    if (fs.existsSync(historyPath)) {
      try {
        const data = fs.readFileSync(historyPath, 'utf8');
        history = JSON.parse(data);
      } catch (e) {
        history = [];
      }
    }

    history.unshift({
      id: `m-mem-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      channel,
      senderId,
      message,
      reply,
      timestamp: new Date().toISOString()
    });

    if (history.length > 50) {
      history.pop();
    }

    fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf8');
  } catch (err) {
    console.warn("[historyStore] Error writing message to history:", err);
  }
}

export function clearHistory() {
  try {
    const clearedPath = getClearedPath();
    const historyPath = getHistoryPath();
    if (!clearedPath || !historyPath) return;

    if (fs.existsSync(historyPath)) {
      fs.writeFileSync(historyPath, '[]', 'utf8');
    }
    fs.writeFileSync(clearedPath, 'cleared', 'utf8');
  } catch (err) {
    console.warn("[historyStore] Error clearing history:", err);
  }
}

export function removeSenderFromHistory(channel: string, senderId: string) {
  try {
    const historyPath = getHistoryPath();
    if (!historyPath || !fs.existsSync(historyPath)) return;
    const raw = fs.readFileSync(historyPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    const targetDigits = String(senderId || '').replace(/\D/g, '');
    const filtered = parsed.filter((item: any) => {
      if (channel && item?.channel && item.channel !== channel) return true;
      const itemSender = String(item?.senderId || '').trim();
      if (itemSender === senderId) return false;
      if (targetDigits.length >= 9 && itemSender.replace(/\D/g, '') === targetDigits) return false;
      return true;
    });
    if (filtered.length !== parsed.length) {
      fs.writeFileSync(historyPath, JSON.stringify(filtered, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn("[historyStore] Error removing sender history:", err);
  }
}

