# Mwongozo wa Kutumia Spaceship (Spaceship.com) kwa Dereva-TZ / Papo Hapo Super App

Mwongozo huu unakuelekeza jinsi ya kutumia **Spaceship.com** kusanidi **Domain (Jina la Tovuti)** au **Hosting/VPS** kwa ajili ya mfumo wako.

---

## 1. Kutumia Domain ya Spaceship na Vercel (Recommended)

Kama programu yako imewekwa kwenye Vercel (au Cloud Run), unaweza kununua Domain kutoka **Spaceship.com** na kuielekeza moja kwa moja:

### Hatua za Kuelekeza DNS kwenye Spaceship:
1. Ingia kwenye akaunti yako ya **Spaceship.com**.
2. Nenda kwenye **Domain Manager** -> Chagua Domain yako (mfano: `derevatz.com`).
3. Chagua **Advanced DNS** au **DNS Records**.
4. Ongeza Record zifuatazo kutoka Vercel:

| Type | Name | Value / Target | TTL |
| --- | --- | --- | --- |
| **A** | `@` | `76.76.21.21` | Automatic |
| **CNAME** | `www` | `cname.vercel-dns.com` | Automatic |

5. Nenda kwenye Vercel -> Project Settings -> **Domains**, kisha ongeza domain yako (`derevatz.com` na `www.derevatz.com`).
6. Baada ya dakika chache (propagation), tovuti yako itakuwa hewani kwa kutumia domain ya Spaceship yenye SSL (HTTPS) ya bure!

---

## 2. Kutumia Hosting au VPS ya Spaceship (Node.js App)

Kama unatumia **Spaceship Web Hosting** yenye Node.js Support au **Spaceship VPS**:

### A. Kuandaa Mfumo (Build locally au kwenye CI)
Kwenye kompyuta yako au server, fanya build ya mfumo:

```bash
npm run build
```

Hii itatengeneza:
- `dist/` (Faili za Frontend SPA)
- `dist/server.cjs` (Server ya Node.js/Express)

### B. Kutuma Faili kwenye Server / Hosting
Pakia faili zifuatazo kwenye server yako ya Spaceship:
- `dist/`
- `package.json`
- `.env` (zenye API keys kama `GEMINI_API_KEY`, `FIREBASE_*`, nk.)

### C. Kuendesha Server ya Node.js
Kwenye Terminal / SSH / cPanel Node.js Selector:
1. Weka Environment Variable: `NODE_ENV=production`
2. Run amri ya kusakinisha dependencies:
   ```bash
   npm install --omit=dev
   ```
3. Endesha server kwa kutumia **PM2** (ili isizime):
   ```bash
   npx pm2 start dist/server.cjs --name "dereva-tz"
   ```
4. Sanidi Reverse Proxy (Nginx) au Port 3000 kuelekeza kwenye domain yako.

---

## Environment Variables Zina zohitajika (.env)
Hakikisha umeweka variable zifuatazo kwenye mazingira yako ya Spaceship:
- `GEMINI_API_KEY`
- `PORT=3000`
- Variables nyingine zozote zilizopo kwenye `.env.example`
