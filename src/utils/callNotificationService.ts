// Call Notification Service
// Handles native Browser System Notifications (Web Notification API & ServiceWorker)
// for incoming audio and video calls, with interactive actions (Answer & Decline),
// device vibration patterns, and window focus management.

export interface IncomingCallNotificationPayload {
  callId: string;
  callerName: string;
  callerPhoto?: string;
  callerRole: 'driver' | 'passenger';
  callType: 'audio' | 'video';
  rideId?: string;
  onAnswer?: () => void;
  onDecline?: () => void;
  onOpen?: () => void;
}

class CallNotificationService {
  private activeNotification: Notification | null = null;
  private vibrationInterval: any = null;
  private activeCallPayload: IncomingCallNotificationPayload | null = null;
  private actionListeners: Set<(action: 'answer' | 'decline' | 'open', callId?: string) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      // Listen for messages from Service Worker (when user clicks 'Pokea' or 'Kata' in system notification)
      navigator.serviceWorker?.addEventListener('message', (event) => {
        if (event.data?.type === 'NOTIFICATION_CALL_ACTION') {
          const action = event.data.action as 'answer' | 'decline' | 'open';
          const callId = event.data.callId;
          this.handleNotificationAction(action, callId);
        }
      });
    }
  }

  // Check if browser supports notifications
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  // Get current permission status
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // Request user permission for incoming call notifications
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[CallNotification] Permission request failed:', e);
      return 'denied';
    }
  }

  // Subscribe to action events triggered from native notifications
  public onAction(callback: (action: 'answer' | 'decline' | 'open', callId?: string) => void): () => void {
    this.actionListeners.add(callback);
    return () => {
      this.actionListeners.delete(callback);
    };
  }

  private handleNotificationAction(action: 'answer' | 'decline' | 'open', callId?: string) {
    this.stopVibration();
    this.closeNotification();

    if (action === 'answer') {
      this.activeCallPayload?.onAnswer?.();
    } else if (action === 'decline') {
      this.activeCallPayload?.onDecline?.();
    } else {
      this.activeCallPayload?.onOpen?.();
    }

    this.actionListeners.forEach((listener) => {
      try {
        listener(action, callId);
      } catch (err) {
        console.error('[CallNotification] Listener error:', err);
      }
    });
  }

  // Start repeated physical vibration on mobile devices
  private startVibration() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([500, 250, 500, 250, 500]);
        if (this.vibrationInterval) clearInterval(this.vibrationInterval);
        this.vibrationInterval = setInterval(() => {
          try {
            navigator.vibrate([500, 250, 500, 250, 500]);
          } catch {}
        }, 2500);
      } catch {}
    }
  }

  // Stop device vibration
  private stopVibration() {
    if (this.vibrationInterval) {
      clearInterval(this.vibrationInterval);
      this.vibrationInterval = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  // Show incoming call notification via Service Worker or Window Notification
  public async showIncomingCallNotification(payload: IncomingCallNotificationPayload) {
    this.activeCallPayload = payload;
    this.startVibration();

    const title = payload.callType === 'video'
      ? `🎥 Simu ya Video: ${payload.callerName}`
      : `📞 Simu Inayoingia: ${payload.callerName}`;

    const roleText = payload.callerRole === 'driver' ? 'Dereva wako' : 'Mteja / Abiria';
    const body = `${roleText} anakupigia simu ndani ya app. Gusa hapa kupokea mara moja.`;
    const icon = payload.callerPhoto || '/icon-192.png';
    const tag = `call-${payload.callId}`;

    // 1. Try Service Worker showNotification if active (supports interactive action buttons!)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && 'showNotification' in registration) {
          const options: any = {
            body,
            icon,
            badge: '/icon-192.png',
            tag,
            renotify: true,
            requireInteraction: true,
            vibrate: [500, 250, 500, 250, 500],
            data: {
              callId: payload.callId,
              rideId: payload.rideId,
              callType: payload.callType,
              callerName: payload.callerName,
            },
            actions: [
              {
                action: 'answer',
                title: '📞 Pokea Simu',
              },
              {
                action: 'decline',
                title: '❌ Kata',
              },
            ],
          };
          await registration.showNotification(title, options);
          return;
        }
      } catch (err) {
        console.warn('[CallNotification] ServiceWorker notification fallback to window:', err);
      }
    }

    // 2. Standard Window Notification fallback
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        this.closeNotification();
        const notification = new Notification(title, {
          body,
          icon,
          tag,
          requireInteraction: true,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
          this.handleNotificationAction('answer', payload.callId);
        };

        notification.onclose = () => {
          this.stopVibration();
        };

        this.activeNotification = notification;
      } catch (err) {
        console.warn('[CallNotification] Window Notification failed:', err);
      }
    }
  }

  // Close active notification and silence vibration
  public closeNotification() {
    this.stopVibration();
    if (this.activeNotification) {
      try {
        this.activeNotification.close();
      } catch {}
      this.activeNotification = null;
    }
    this.activeCallPayload = null;
  }
}

export const callNotificationService = new CallNotificationService();
