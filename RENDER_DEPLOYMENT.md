# Mwongozo wa Kuweka Programu Render.com (Render.com Deployment Guide)

Kama ukipata jibu la **404 Not Found** unapoingia kwenye:
`https://papohapo.onrender.com/api/meta/webhook`

Inamaanisha kuwa ume-deploy programu yako Render kama **Static Site** badala ya **Web Service**.
* **Static Site** inafungua tu faili za Frontend (HTML/CSS/JS) na **haisomi kabisa** server ya Node.js/Express (`server.ts` au `server.cjs`). Ndio maana ukijaribu kupiga `/api/...` inapata 404 Not Found.
* **Web Service** ndiyo inayoweza kuendesha server ya Node.js/Express na kuruhusu Webhook yako ya Meta ifanye kazi kikamilifu.

---

## Jinsi ya Kusuluhisha (Hatua kwa Hatua)

### Hatua ya 1: Unda Web Service Mpya kwenye Render
1. Ingia kwenye akaunti yako ya [Render.com](https://render.com).
2. Bonyeza kitufe cha **New +** kisha chagua **Web Service** (Usichague *Static Site*).
3. Unganisha na GitHub Repository ya mradi wako wa Papo Hapo.

### Hatua ya 2: Kusanidi Mipangilio ya Web Service (Configure Web Service Settings)
Weka vipengele vifuatavyo kwenye ukurasa wa kusanidi:

* **Name**: `papohapo` (au jina lolote ulipendalo)
* **Region**: Chagua iliyo karibu nawe (mfano: `Frankfurt (EU)`)
* **Branch**: `main` (au branch uliyoweka code yako)
* **Runtime**: `Node`
* **Build Command**: 
  ```bash
  npm install && npm run build
  ```
* **Start Command**: 
  ```bash
  npm start
  ```

### Hatua ya 3: Weka Mazingira / Environment Variables
Chini kabisa bonyeza **Advanced** au **Environment Variables** na uongeze hizi:

| Key | Value | Maelezo |
| --- | --- | --- |
| `NODE_ENV` | `production` | Inaweka mfumo kwenye hali ya Production |
| `META_VERIFY_TOKEN` | `papo_hapo_meta_secure_token_2026` | Token ya siri ya uhakiki wa Meta (Lazima ifanane na ile ya Meta Dashboard) |
| `GEMINI_API_KEY` | `WEKA_API_KEY_YAKO_HAPA` | API Key ya Gemini kwa ajili ya AI Chatbot |
| `PORT` | `3000` | Port ambayo server yetu inasikiliza |

Bonyeza **Create Web Service**.

---

## Uhakiki wa Webhook Baada ya Ku-deploy (Verification)

Baada ya Render kukamilisha ujenzi (Build Successful), unaweza kuhakiki kwa njia mbili:

### 1. Kupitia Browser:
Nenda kwenye:
`https://papohapo.onrender.com/api/meta/webhook`
Inapaswa kurudisha ujumbe kama huu:
```json
{
  "status": "active",
  "service": "Papo Hapo Meta Webhook",
  "verify_token": "papo_hapo_meta_secure_token_2026",
  "endpoint_url": "https://dereva-tz.vercel.app/api/meta/webhook"
}
```

### 2. Kupitia App Interface ya AI Studio:
1. Chagua **RENDER SERVER** kwenye sehemu ya **Sanidi Meta Developer Webhooks**.
2. Bonyeza kitufe cha **Pima Webhook Live**.
3. Sasa itarudisha **HTTP 200 OK — Response: "papohapo_test_challenge_123" 🟢** na itafanya kazi 100%!

---

# Render.com Deployment Guide (English Version)

If you are receiving a **404 Not Found** error when accessing:
`https://papohapo.onrender.com/api/meta/webhook`

It means you deployed your application on Render as a **Static Site** instead of a **Web Service**.
* A **Static Site** only serves static frontend files (HTML/CSS/JS) and does not spin up or run the Node.js/Express backend server (`server.ts` or `server.cjs`). That is why your `/api/...` endpoints result in 404 Not Found.
* A **Web Service** is required to run the Node.js/Express server and handle the Meta Webhook endpoints correctly.

---

## How to Fix It (Step-by-Step)

### Step 1: Create a New Web Service on Render
1. Log in to your [Render.com](https://render.com) dashboard.
2. Click the **New +** button and choose **Web Service** (Do NOT choose *Static Site*).
3. Connect your GitHub Repository of the Papo Hapo project.

### Step 2: Configure Web Service Settings
Provide the following configuration values on the creation screen:

* **Name**: `papohapo` (or your preferred name)
* **Region**: Choose the closest region (e.g., `Frankfurt (EU)`)
* **Branch**: `main`
* **Runtime**: `Node`
* **Build Command**: 
  ```bash
  npm install && npm run build
  ```
* **Start Command**: 
  ```bash
  npm start
  ```

### Step 3: Add Environment Variables
Under the **Advanced** section, add the following environment variables:

| Key | Value | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Puts the system into Production mode |
| `META_VERIFY_TOKEN` | `papo_hapo_meta_secure_token_2026` | Secret verify token used by Meta to validate your webhook |
| `GEMINI_API_KEY` | `YOUR_GEMINI_API_KEY_HERE` | Gemini API Key for AI smart parsing |
| `PORT` | `3000` | The port our Express server binds to |

Click **Create Web Service** to trigger the deployment.
