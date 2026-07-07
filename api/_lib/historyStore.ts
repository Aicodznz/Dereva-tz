import fs from 'fs';
import path from 'path';

const historyPath = path.join(process.cwd(), 'meta_chat_history.json');
const clearedPath = path.join(process.cwd(), 'logs_cleared.txt');

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
    if (fs.existsSync(historyPath)) {
      fs.writeFileSync(historyPath, '[]', 'utf8');
    }
    fs.writeFileSync(clearedPath, 'cleared', 'utf8');
  } catch (err) {
    console.warn("[historyStore] Error clearing history:", err);
  }
}
