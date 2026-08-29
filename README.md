# CHAGEE QR Code Mapper

A crowdsourced platform to decode and map CHAGEE's internal QR code payloads for their Singapore menu.

By gathering payload data from various drinks, we can understand the underlying logic used by the CHAGEE automated bar machines. This helps us extract macronutrient profiles (calories, milk type, sweetness, etc.) simply by scanning a cup's QR code—without having to individually purchase and consume every item on the menu.

## Features

- **In-Browser QR Scanning:** Instantly read CHAGEE cup QR codes using device cameras.
- **Payload Decoding & Anomaly Detection:** Real-time client-side parsing of the transaction ID, SKU code, cup size (A-value), milk type (C-value), ice level (m-value), and sweetness preset (mm-value).
- **Smart Contribution Flow:**
  - Auto-fills data for known SKUs.
  - Dynamically requires a cup sticker photo as proof if contributing an unmapped SKU or if modifying autofilled data.
  - Skips rigid milk/size requirements for bakery, cakes, and special items (e.g., Free Milk).
- **Bot Protection:** Secured with Cloudflare Turnstile.
- **Admin Review Pipeline:** Supabase-powered backend to manage and verify crowdsourced payloads and sticker images before officially mapping them.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Server Actions)
- **UI/Styling:** React, Tailwind CSS, Lucide React
- **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL, Storage)
- **Security:** Cloudflare Turnstile
- **QR Scanner:** [`qr-scanner`](https://github.com/nimiq/qr-scanner) (Web Worker based)
- **Tooling:** ESLint, Prettier, TypeScript

## Environment Setup

To run this project locally, create a `.env.local` file with the following keys:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_PRIVILEGED_KEY=...
NEXT_PUBLIC_BUCKET_NAME=chagee-study

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

## Getting Started

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Run the development server:**

   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Contributing

The goal is to map the entire catalog starting from **April 1, 2026** (when CHAGEE revamped their QR code system to include different milk types).

If you grab a CHAGEE drink, head over to the `/contribute` page, scan your QR code, snap a photo of the sticker, and submit!

---

Disclaimer: This project is an independent community effort and is not affiliated with, maintained, or endorsed by CHAGEE.
