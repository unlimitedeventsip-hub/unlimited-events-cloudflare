# Unlimited Events — Cloudflare Workers + Supabase + Resend

Site premium și responsive pentru Unlimited Events, cu formular de ofertă în 3 pași. Proiectul se publică pe **Cloudflare Workers Static Assets**, iar endpoint-urile API rulează în Worker-ul din `src/worker.js`.

## Arhitectură

- `public/` — HTML, CSS, JavaScript, fotografii și identitate vizuală.
- `src/worker.js` — intrarea Cloudflare Workers, cu rutele `/api/config` și `/api/lead` și suport pentru `env.ASSETS`.
- `functions/api/lead.js`, `functions/api/config.js` — logica server-side de validare, Supabase și Resend, reutilizată de Worker.
- `wrangler.jsonc` — configurație Workers: `main`, assets și `run_worker_first` pentru `/api/*`.
- `supabase/001_event_leads.sql` — schema tabelului `public.event_leads`, protejată cu RLS.
- `tests/*.test.mjs` — teste pentru validare, persistență, notificări și routing Workers.

## Deploy GitHub → Cloudflare Workers

Repository: `unlimitedeventsip-hub/unlimited-events-cloudflare`, branch `main`.

În Cloudflare Dashboard → **Workers & Pages → unlimited-events-cloudflare → Settings → Builds** verifică:

- **Git repository:** `unlimitedeventsip-hub/unlimited-events-cloudflare`
- **Branch:** `main`
- **Root directory:** rădăcina repository-ului
- **Build command:** gol (site static, fără compilare)
- **Deploy command:** `npx wrangler deploy`

Cloudflare folosește `wrangler.jsonc` pentru a publica simultan Worker-ul și fișierele statice din `public/`. **Nu** folosi `wrangler pages deploy` în proiectul Workers existent.

## Runtime secrets, NU build variables

În Cloudflare Worker → **Settings → Variables and Secrets** (legături disponibile **în timpul execuției Worker-ului**), adaugă:

| Variabilă | Tip | Valoare |
|---|---|---|
| `SUPABASE_URL` | Variable | Project URL din Supabase, de forma `https://xxxxx.supabase.co` |
| `SUPABASE_SECRET_KEY` | **Secret** | Secret API key `sb_secret_...` a proiectului Supabase corect |
| `EMAIL_TO` | Variable | `unlimited.events.ip@gmail.com` |
| `RESEND_API_KEY` | **Secret** | API key nouă Resend `re_...` |
| `EMAIL_FROM` | Variable | Expeditor verificat în Resend, ex. `Unlimited Events <contact@domeniu.ro>` |
| `TURNSTILE_SITE_KEY` | Variable | Cheie publică Turnstile (opțional, recomandat) |
| `TURNSTILE_SECRET_KEY` | **Secret** | Cheie secretă Turnstile (opțional, trebuie asociată cu cea publică) |

**Atenție:** variabilele introduse în **Settings → Builds → Variables and secrets** sunt doar pentru build și nu sunt disponibile în runtime. Pune-le în **Settings → Variables and Secrets** pentru Worker-ul efectiv.

Nu publica, nu copia în GitHub și nu trimite prin chat chei secrete. Rotește orice cheie expusă anterior. Nu stoca în `wrangler.jsonc` cheia Supabase sau Resend.

## Supabase

Tabelul `public.event_leads` trebuie creat în proiectul Supabase folosit de site prin schema `supabase/001_event_leads.sql`. La verificare:

- RLS trebuie să fie activat.
- `anon` și `authenticated` trebuie să nu aibă acces la tabel.
- Cheia `SUPABASE_SECRET_KEY` este folosită numai de Worker, pentru a insera cereri.
- Cererile sunt salvate înainte de încercarea notificării email; starea emailului este reținută în `email_status`.

## Resend

Destinatarul este `EMAIL_TO`. Pentru expeditor, după testele inițiale, verifică un domeniu propriu în Resend și setează `EMAIL_FROM` pe acea adresă. `onboarding@resend.dev` este destinat **doar testelor**, cu restricțiile furnizorului; nu este o soluție generală pentru clienți.

## Testare

```bash
npm test
```

După deploy, verifică întâi `GET /api/config`: trebuie să returneze JSON cu câmpul `turnstileSiteKey`, nu HTML. Completează apoi o cerere de test reală. Confirmă apariția în **Supabase → Table Editor → event_leads** și starea `email_status`. Dacă emailul nu ajunge, verifică **Resend Logs** și **Cloudflare Observability Logs**.

Nu există administrare publică a cererilor: ele se consultă momentan în Supabase Dashboard. Nu folosi datele reale ale clienților pentru teste.

## Lansare publică

Înlocuiește fotografiile ilustrative cu materiale aprobate ale evenimentelor reale, completează informațiile legale și de confidențialitate și stabilește perioada de retenție a datelor. Activează Turnstile pentru protecție antispam.
