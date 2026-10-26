// Push Notification Service for Papo Hapo & PapoPay
// Implements all 9 Native Notification Types:
// 1. 🔔 Lock Screen (Inaonekana simu ikiwa imefungwa)
// 2. 📱 Notification Banner (Ujumbe unajitokeza juu ya skrini)
// 3. 📥 Notification Panel (Inaonekana ukishusha sehemu ya juu ya simu)
// 4. 🔴 App Badge (Alama ya idadi kwenye icon ya app)
// 5. 🖼️ Rich Notification (Huonyesha picha, thumbnail ya risiti/video/mtumaji)
// 6. ⚡ Action Notification (Vitufe kama Jibu, Angalia, Kubali au Kataa)
// 7. 📚 Grouped Notification (Hukusanya taarifa nyingi ili panel isijazwe)
// 8. 🤫 Silent Notification (Haina sauti wala banner, inajaza panel kimyakimya)
// 9. ⏳ Progress Notification (Maendeleo ya kazi kama kutuma pesa au kupakua faili)

export type NotificationTypeKey = 
  | 'lock_screen'
  | 'banner'
  | 'panel'
  | 'badge'
  | 'rich'
  | 'action'
  | 'grouped'
  | 'silent'
  | 'progress';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
  vibrate?: number[];
  silent?: boolean;
  requireInteraction?: boolean;
  renotify?: boolean;
  badgeCount?: number;
}

export interface ActionClickEvent {
  action: string;
  tag?: string;
  title?: string;
  data?: Record<string, any>;
}

class PushNotificationService {
  private listeners: Set<(event: ActionClickEvent) => void> = new Set();
  private defaultIcon = 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png';
  private defaultBadge = 'https://cdn-icons-png.flaticon.com/512/3063/3063822.png';

  constructor() {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_ACTION') {
          const actionEvent: ActionClickEvent = {
            action: event.data.action || 'click',
            tag: event.data.tag,
            title: event.data.title,
            data: event.data.data,
          };
          this.notifyActionListeners(actionEvent);
        }
      });
    }
  }

  // 1. Browser Support Checks
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  public isServiceWorkerSupported(): boolean {
    return typeof window !== 'undefined' && 'serviceWorker' in navigator;
  }

  public isBadgingSupported(): boolean {
    return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
  }

  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  }

  // 2. Request System Permission
  public async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.warn('[PushNotificationService] Failed to request permission:', e);
      return 'denied';
    }
  }

  // 3. Get or Ensure Service Worker Registration
  public async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.isServiceWorkerSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return reg;
    } catch {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        return regs[0] || null;
      } catch {
        return null;
      }
    }
  }

  // 4. Subscribe to Action Click Events (from Action Notification buttons)
  public onAction(callback: (event: ActionClickEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyActionListeners(event: ActionClickEvent) {
    this.listeners.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error('[PushNotificationService] Action listener error:', err);
      }
    });
  }

  // ==========================================
  // Core Dispatcher
  // ==========================================
  public async sendNotification(payload: PushNotificationPayload): Promise<boolean> {
    if (!this.isSupported()) {
      console.warn('[PushNotificationService] Notifications are not supported in this environment');
      return false;
    }

    if (Notification.permission !== 'granted') {
      const perm = await this.requestPermission();
      if (perm !== 'granted') return false;
    }

    const title = payload.title;
    const options: NotificationOptions & { 
      image?: string; 
      actions?: any[]; 
      vibrate?: number[]; 
      renotify?: boolean; 
    } = {
      body: payload.body,
      icon: payload.icon || this.defaultIcon,
      badge: payload.badge || this.defaultBadge,
      image: payload.image || undefined,
      tag: payload.tag || undefined,
      data: payload.data || { url: window.location.pathname },
      vibrate: payload.vibrate !== undefined ? payload.vibrate : [200, 100, 200],
      silent: Boolean(payload.silent),
      requireInteraction: Boolean(payload.requireInteraction),
      renotify: Boolean(payload.renotify),
    };

    // Actions require serviceWorker showNotification
    if (payload.actions && payload.actions.length > 0) {
      (options as any).actions = payload.actions;
    }

    // Try Service Worker registration first (supports full Actions, Rich Media & Badging)
    const swReg = await this.getRegistration();
    if (swReg && 'showNotification' in swReg) {
      try {
        await swReg.showNotification(title, options);
        if (typeof payload.badgeCount === 'number') {
          await this.setAppBadge(payload.badgeCount);
        }
        return true;
      } catch (err) {
        console.warn('[PushNotificationService] SW showNotification failed, trying fallback:', err);
      }
    }

    // Fallback: Standard window Notification constructor
    try {
      const notif = new Notification(title, {
        body: options.body,
        icon: options.icon,
        badge: options.badge,
        tag: options.tag,
        data: options.data,
        silent: options.silent,
      });

      notif.onclick = () => {
        window.focus();
        notif.close();
        this.notifyActionListeners({
          action: 'click',
          tag: payload.tag,
          title: payload.title,
          data: payload.data,
        });
      };

      if (typeof payload.badgeCount === 'number') {
        this.setAppBadge(payload.badgeCount);
      }
      return true;
    } catch (fallbackErr) {
      console.error('[PushNotificationService] Window Notification failed:', fallbackErr);
      return false;
    }
  }

  // ==========================================
  // 1. 🔔 LOCK SCREEN NOTIFICATION
  // Inaonekana simu ikiwa imefungwa (Lock Screen)
  // ==========================================
  public async showLockScreenNotification(params?: {
    title?: string;
    body?: string;
    amount?: number;
    customerName?: string;
  }): Promise<boolean> {
    const title = params?.title || '🔔 PapoPay: Muamala Umeidhinishwa';
    const body = params?.body || (params?.amount 
      ? `TZS ${params.amount.toLocaleString()} zimethibitishwa na sura ya ${params.customerName || 'Mteja'}. Bofya kufungua risiti.`
      : 'Uthibitisho wa uso na PIN umefaulu. Salio lako limelindwa kikamilifu.');

    return this.sendNotification({
      title,
      body,
      tag: 'papopay_lockscreen',
      requireInteraction: true,
      vibrate: [300, 150, 300],
      data: { url: '/wakala', type: 'lock_screen' },
      badgeCount: 1,
    });
  }

  // ==========================================
  // 2. 📱 NOTIFICATION BANNER
  // Ujumbe unajitokeza juu ya skrini (Heads-Up Banner)
  // ==========================================
  public async showBannerNotification(params?: {
    title?: string;
    body?: string;
  }): Promise<boolean> {
    const title = params?.title || '📱 Papo Hapo: Arifa ya Moja kwa Moja';
    const body = params?.body || 'Dereva wako amewasili kituoni. Tafadhali jitokeze barabarani.';

    return this.sendNotification({
      title,
      body,
      tag: 'papopay_banner',
      renotify: true,
      vibrate: [400, 100, 400],
      requireInteraction: false,
      data: { url: '/taxi', type: 'banner' },
      badgeCount: 2,
    });
  }

  // ==========================================
  // 3. 📥 NOTIFICATION PANEL (TRAY)
  // Inaonekana ukishusha sehemu ya juu ya simu
  // ==========================================
  public async showPanelNotification(params?: {
    title?: string;
    body?: string;
  }): Promise<boolean> {
    const title = params?.title || '📥 PapoPay: Taarifa Imehifadhiwa Kwenye Panel';
    const body = params?.body || 'Risiti yako ya EFD Namba #TZ-8921 imehifadhiwa. Bofya hapa kupakua PDF.';

    return this.sendNotification({
      title,
      body,
      tag: 'papopay_panel_tray',
      vibrate: [200, 100, 200],
      data: { url: '/notifications', type: 'panel' },
    });
  }

  // ==========================================
  // 4. 🔴 APP BADGE
  // Alama ya idadi kwenye icon ya app (Badge API)
  // ==========================================
  public async setAppBadge(count: number): Promise<boolean> {
    try {
      localStorage.setItem('papopay_app_badge_count', count.toString());
      if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
        await (navigator as any).setAppBadge(count);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[PushNotificationService] Failed to set badge:', err);
      return false;
    }
  }

  public async clearAppBadge(): Promise<boolean> {
    try {
      localStorage.setItem('papopay_app_badge_count', '0');
      if (typeof navigator !== 'undefined' && 'clearAppBadge' in navigator) {
        await (navigator as any).clearAppBadge();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public getAppBadgeCount(): number {
    if (typeof localStorage === 'undefined') return 0;
    return Number(localStorage.getItem('papopay_app_badge_count')) || 0;
  }

  // ==========================================
  // 5. 🖼️ RICH NOTIFICATION
  // Huonyesha picha kubwa, thumbnail ya risiti/video/mtumaji
  // ==========================================
  public async showRichNotification(params?: {
    title?: string;
    body?: string;
    image?: string;
  }): Promise<boolean> {
    const title = params?.title || '🖼️ PapoPay Risiti: Malipo Yamekamilika';
    const body = params?.body || 'Umepokea TZS 250,000 kutoka kwa Baraka Mrema kupitia AI Face Scan.';
    // High-res visual receipt image
    const image = params?.image || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop&q=80';

    return this.sendNotification({
      title,
      body,
      image,
      tag: 'papopay_rich_receipt',
      vibrate: [300, 100, 300],
      data: { url: '/wakala', type: 'rich' },
      badgeCount: 3,
    });
  }

  // ==========================================
  // 6. ⚡ ACTION NOTIFICATION
  // Ina vitufe vya haraka: Kubali, Kataa, Jibu, Angalia
  // ==========================================
  public async showActionNotification(params?: {
    title?: string;
    body?: string;
    actions?: Array<{ action: string; title: string }>;
  }): Promise<boolean> {
    const title = params?.title || '⚡ PapoPay Ombi la Malipo: TZS 45,000';
    const body = params?.body || 'Kituo cha Kaunta ya Kariakoo kinaomba uidhinishe malipo ya chakula.';

    const actions = params?.actions || [
      { action: 'accept', title: '✅ Kubali' },
      { action: 'decline', title: '❌ Kataa' },
      { action: 'view', title: '👁️ Angalia' },
    ];

    return this.sendNotification({
      title,
      body,
      tag: 'papopay_actionable_request',
      requireInteraction: true,
      actions,
      vibrate: [500, 200, 500],
      data: { url: '/notifications', requestId: 'REQ-TZ-' + Date.now(), type: 'action' },
      badgeCount: 4,
    });
  }

  // ==========================================
  // 7. 📚 GROUPED NOTIFICATION
  // Hukusanya taarifa nyingi kutoka app moja (Stack/Summary)
  // ==========================================
  public async showGroupedNotification(itemIndex: number = 1): Promise<boolean> {
    const titles = [
      '📚 Miamala ya PapoPay (Ujumbe 1 wa 3): Kuweka TZS 50,000',
      '📚 Miamala ya PapoPay (Ujumbe 2 wa 3): Kutoa TZS 20,000',
      '📚 Miamala ya PapoPay (Ujumbe 3 wa 3): Kamisheni +TZS 1,200',
    ];

    const bodies = [
      'Wakala Kaunta: TZS 50,000 zimewekwa kikamilifu kwenye pochi.',
      'ATM Cardless: TZS 20,000 zimetolewa kwa uthibitisho wa uso.',
      'Faida ya Leo: Kamisheni yako imeongezeka kufikia TZS 38,400.',
    ];

    const idx = (itemIndex - 1) % 3;

    return this.sendNotification({
      title: titles[idx],
      body: bodies[idx],
      tag: 'papopay_transactions_group', // Shared tag keeps panel clean!
      renotify: true,
      data: { url: '/wakala', groupTag: 'transactions', type: 'grouped' },
    });
  }

  // ==========================================
  // 8. 🤫 SILENT NOTIFICATION
  // Inawasilisha taarifa bila sauti wala mtikisiko wala banner
  // ==========================================
  public async showSilentNotification(params?: {
    title?: string;
    body?: string;
  }): Promise<boolean> {
    const title = params?.title || '🤫 PapoPay: Sasisho Kimyakimya';
    const body = params?.body || 'Viweka vya kiusalama vya AI Face Biometrics vimesasishwa kwa mafanikio.';

    return this.sendNotification({
      title,
      body,
      silent: true,
      vibrate: [], // Zero vibration
      tag: 'papopay_silent_sync',
      requireInteraction: false,
      data: { url: '/notifications', type: 'silent' },
    });
  }

  // ==========================================
  // 9. ⏳ PROGRESS NOTIFICATION
  // Huonyesha maendeleo ya kazi (Inatuma pesa: 25% -> 60% -> 100%)
  // ==========================================
  public async startProgressNotificationDemo(onUpdate?: (percent: number) => void): Promise<void> {
    const steps = [
      { percent: 15, bar: '▓░░░░░░░░░', label: 'Inathibitisha alama za uso na NIDA...' },
      { percent: 45, bar: '▓▓▓▓░░░░░░', label: 'Inawasiliana na seva ya Benki Kuu (BOT)...' },
      { percent: 80, bar: '▓▓▓▓▓▓▓▓░░', label: 'Inatoa fedha na kuandaa risiti ya EFD...' },
      { percent: 100, bar: '▓▓▓▓▓▓▓▓▓▓', label: 'Muamala Umekamilika 100%! Pesa zimetumwa.' },
    ];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      onUpdate?.(step.percent);

      await this.sendNotification({
        title: `⏳ PapoPay [${step.percent}%] ${step.bar}`,
        body: step.label,
        tag: 'papopay_task_progress', // Same tag dynamically updates the existing notification!
        renotify: false,
        silent: i < steps.length - 1, // Only chime on 100% completion
        vibrate: i === steps.length - 1 ? [200, 100, 200] : [],
        data: { url: '/wakala', progress: step.percent, type: 'progress' },
      });

      if (i < steps.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
}

export const pushNotificationService = new PushNotificationService();
