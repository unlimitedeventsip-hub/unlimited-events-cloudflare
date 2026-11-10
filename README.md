# Unlimited Events — Cloudflare Pages + Supabase + Resend

Noua versiune a site-ului Unlimited Events, independentă de Netlify. Site responsive în română, portofoliu, 11 servicii/experiențe, formular în 3 pași, bază de date și email administrativ.

## Arhitectură

```
GitHub repository
  ├── public/                  site HTML/CSS/JS + imagini
  │     └── _routes.json       numai /api/* activează Pages Functions
  ├── functions/api/config.js  returnează doar cheia PUBLICĂ Turnstile
  ├── functions/api/lead.js    validează → Supabase → Resend → marchează status
  └── supabase/001_event_leads.sql
                       ↓
Cloudflare Pages (Git integration)
                       ↓
Supabase private table (RLS + no anon policies)
                       ↓
Resend → unlimited.events.ip@gmail.com
```

## 1. GitHub

Creează un repository NOU (recomandat `unlimited-events-cloudflare`) sub `unlimitedeventsip-hub`. Încarcă **conținutul acestui folder direct în rădăcină**, nu ZIP-ul și nu un folder suplimentar. Poți folosi GitHub Desktop (File > Add local repository > Publish) sau linia de comandă:

```bash
git init
git add .
git commit -m "Initial Unlimited Events Cloudflare launch"
git branch -M main
git remote add origin https://github.com/unlimitedeventsip-hub/unlimited-events-cloudflare.git
git push -u origin main
```

Nu încărca `.dev.vars` / `.env` / chei API în GitHub.

## 2. Supabase — baza de date

1. Creează proiect din https://supabase.com/dashboard (alege regiunea potrivită, de exemplu Europa).
2. Intră în **SQL Editor** și rulează **o singură dată** fișierul `supabase/001_event_leads.sql`.
3. În **Project Settings → API Keys** copiază **Project URL** și o **Secret key** nouă `sb_secret_...` (NU `sb_publishable_...`).
4. Păstrează cheia secretă în Cloudflare, **niciodată** în `public/`, `app.js` sau în GitHub. Schema activează RLS și interzice accesul anonim.
5. Solicitările vor fi disponibile în **Table Editor → event_leads** (câmpuri `status`, `email_status`).

## 3. Resend — email

1. Creează cont la https://resend.com/ .
2. Verifică **un domeniu propriu** în Resend (de exemplu `unlimitedevents.ro`, doar dacă îl deții) prin DNS.
3. Generează `RESEND_API_KEY`.
4. Folosește o adresă expeditor verificată în `EMAIL_FROM`, de exemplu `Unlimited Events <contact@domeniul-tau.ro>`.
5. `EMAIL_TO=unlimited.events.ip@gmail.com`. Gmail este destinatarul, nu expeditorul SMTP.

*Fără Resend: cererea este în continuare salvată în Supabase, dar `email_status=not_configured`, iar site-ul nu pretinde că a trimis email.*

## 4. Cloudflare Pages — publicare din GitHub

1. Intră în https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Alege noul repository `unlimited-events-cloudflare`.
3. **Production branch:** `main`; **Framework preset:** `None`; **Build command:** lasă gol sau `exit 0`; **Build output directory:** `public`; **Root directory:** gol (rădăcina repository-ului).
4. În **Settings → Variables and Secrets** configurează:

| Nume | Tip | Ce pui |
|---|---|---|
| `SUPABASE_URL` | Variable | `https://xxxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | **Secret / encrypted** | `sb_secret_...` |
| `RESEND_API_KEY` | **Secret / encrypted** | `re_...` |
| `EMAIL_FROM` | Variable | `Unlimited Events <contact@domeniul-tau.ro>` |
| `EMAIL_TO` | Variable | `unlimited.events.ip@gmail.com` |
| `TURNSTILE_SITE_KEY` | Variable | Turnstile public key (recomandat) |
| `TURNSTILE_SECRET_KEY` | **Secret / encrypted** | Turnstile secret key (recomandat) |

5. **Redeploy** după ce salvezi variabilele. Nu pune cheile în cod.
6. Testează site-ul pe subdomeniul oferit `*.pages.dev`. După verificare, poți conecta un domeniu propriu.

**Important:** pentru Turnstile, configurează AMBELE chei. Site-ul încarcă automat widgetul dacă există `TURNSTILE_SITE_KEY`; backend-ul respinge cereri neverificate dacă ai adăugat `TURNSTILE_SECRET_KEY`.

## 5. Verificare end-to-end (obligatoriu înainte de lansare)

1. Deschide pagina de la Cloudflare pe telefon.
2. Completează o cerere de TEST cu nume, telefon, email real și acord GDPR.
3. Confirmă mesajul verde de pe site. Dacă backend-ul nu e configurat, apare explicit eroare 503.
4. Verifică în **Supabase → Table Editor → event_leads** că a fost creat rândul și `email_status` este `sent`.
5. Verifică emailul în **unlimited.events.ip@gmail.com**, inclusiv Spam.
6. Verifică Resend → Logs pentru mesaje eșuate. Dacă emailul eșuează, cererea **rămâne salvată** în Supabase, cu `email_status=failed`.
7. Testează pe telefon la lățimi 320, 375, 390, 768 și pe desktop.

## Dezvoltare locală și teste

```bash
npm install
npm test
cp .dev.vars.example .dev.vars
# Completează .dev.vars local, fără să îl publici.
npm run dev
```

`wrangler pages dev public` lansează frontend-ul și Functions. Dacă deschizi `public/index.html` direct de pe disc ori cu un server static obișnuit, endpoint-ul `/api/lead` nu funcționează — aceasta este normal.

## Despre imaginile portofoliului

Imaginile incluse provin din materialele furnizate anterior în conversație și sunt folosite **ilustrativ**, nu ca dovezi fotografice pentru proiecte individuale. Înainte de promovare, înlocuiește imaginile din fiecare card cu fotografii proprii și confirmă toate drepturile de utilizare / permisiunile necesare.

## GDPR / confidențialitate

`public/confidentialitate.html` este un șablon care trebuie completat cu **numele legal al operatorului, adresă, contact, baza legală corectă și termenele de păstrare**. Datele sunt păstrate în Supabase până la ștergere manuală sau implementarea unui flux de retenție. Configurează acordurile cu procesatorii, și nu colecta date inutile.

## Limite

- Publicarea în Cloudflare și crearea bazei în Supabase cer acces autentificat la conturile tale; proiectul nu este live doar pentru că fișierele există în ZIP.
- Trimiterea de email reală necesită un domeniu expeditor verificat și o cheie Resend validă.
- Nu există încă un panou de administrare custom, dar solicitările pot fi urmărite în Supabase Table Editor.
- Pentru un volum mare de spam, activează Turnstile și protecții suplimentare Cloudflare WAF/Rate Limiting.