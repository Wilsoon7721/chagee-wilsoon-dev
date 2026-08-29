# CHAGEE QR Payload Database Schema

## Overview

This database schema is designed to crowdsource and decode CHAGEE tea bar machine QR codes, with a focus on Singapore locations. The ultimate goal is to map SKU codes to drinks and understand the sweetness preset system.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PUBLIC SITE                                  │
│  chagee.wilsoon.dev                                                 │
│  - View verified drink mappings                                      │
│  - Submit new QR code contributions                                  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONTRIBUTION FLOW                               │
│  1. User scans QR code                                              │
│  2. Parser extracts: T-value | SKU | A,C,m,mm codes                 │
│  3. User fills in: drink name, size, sweetness, ice, milk          │
│  4. User uploads sticker photo                                       │
│  5. Submission stored as "pending"                                   │
│  6. Anomaly detection runs automatically                            │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ADMIN REVIEW                                    │
│  - Review pending contributions                                      │
│  - View anomaly alerts (critical/warning/info)                      │
│  - Approve → publishes data + updates SKU verification              │
│  - Reject → removes from queue                                       │
│  - Flag → marks for investigation                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## QR Payload Format

```
T0241|SG0422|A002,C003,m003,mm002|
  │     │          │
  │     │          └─ Segment 3: Machine instructions
  │     └─ SKU: Region (SG) + Drink ID (0422)
  └─ Transaction number
```

### Segment 3 Components

| Code | Name | Purpose | Values |
|------|------|---------|--------|
| `A___` | Cup Size | Large/Regular | `A001`=Large, `A002`=Regular |
| `C___` | Milk Type | Pump selection | `C001`=Fresh, `C002`=Oat, `C003`=Non-Fat |
| `m___` | Ice Level | Water offset | `m001`=Normal, `m002`=Less, `m003`=None |
| `mm___` | Sweetness | Sugar preset | Varies by drink (see below) |

### The Sweetness Mystery 🔍

The `mm` value **does NOT** directly map to user-selected sweetness. Instead:
- Each drink has its own sweetness calibration based on astringency
- A highly astringent tea (Da Hong Pao) with "Less Sweet" → `mm001`
- A mild tea (BO.YA Jasmine) with "Normal Sweet" → `mm001`

The `sweetness_observations` table and `sweetness_analysis` view help crack this by collecting:
- Which drinks produce which `mm` codes
- What sweetness level the user selected
- Whether `mm` is omitted (potentially = "No Additional Sugar")

## Database Tables

### Reference Tables (Pre-populated)

| Table | Purpose |
|-------|---------|
| `regions` | Country codes (SG, PHL, etc.) |
| `drink_skus` | Mapped SKU → drink name |
| `cup_size_codes` | A-value mappings |
| `milk_codes` | C-value mappings |
| `ice_codes` | m-value mappings |
| `sweetness_codes` | Known mm-values (auto-discovered) |

### Data Collection Tables

| Table | Purpose |
|-------|---------|
| `contributions` | User submissions with parsed data |
| `contribution_anomalies` | Detected issues per contribution |
| `sweetness_observations` | Extracted for analysis |

### Views

| View | Purpose |
|------|---------|
| `public_sg_drinks` | Verified Singapore drinks for public display |
| `admin_pending_contributions` | Pending items with anomaly summary |
| `sweetness_analysis` | Aggregated data for cracking the formula |

## Anomaly Detection

The system automatically flags contributions that:

| Anomaly | Severity | Meaning |
|---------|----------|---------|
| `non_singapore_region` | Warning | Not SG - won't be displayed |
| `unknown_sku` | Info | New drink discovery! |
| `unexpected_milk_code` | Critical | Pure tea has milk code |
| `missing_milk_code` | Critical | Milk tea missing milk code |
| `unknown_cup_size_code` | Warning | New A-value |
| `unknown_milk_code` | Warning | New C-value |
| `unknown_ice_code` | Warning | New m-value |
| `new_sweetness_preset` | Info | New mm-value (auto-added) |
| `size_mismatch` | Critical | User report vs QR mismatch |

## Row Level Security (RLS)

| Who | Can Do |
|-----|--------|
| Public | Read reference tables, read approved SG contributions, submit contributions |
| Admin | Full access to all tables |

## File Structure

```
lib/
├── database.types.ts    # TypeScript types matching schema
├── qr-parser.ts         # Client-side QR parsing + validation
└── supabase.ts          # Supabase client (to be created)

supabase/
└── schema.sql           # Complete database schema
```

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and anon key

### 2. Run Schema

1. Open SQL Editor in Supabase Dashboard
2. Paste contents of `supabase/schema.sql`
3. Execute

### 3. Configure Storage

1. Go to Storage in Supabase Dashboard
2. Create bucket: `contribution-images`
3. Set to private (not public)
4. Add policies for upload (anyone) and read (via signed URLs)

### 4. Configure Auth (Admin)

1. Enable Email auth in Supabase
2. Create admin user
3. Add custom claim `role: 'admin'` via SQL:
   ```sql
   UPDATE auth.users 
   SET raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'
   WHERE email = 'your-admin@email.com';
   ```

### 5. Environment Variables

Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Server-side only
```

## Next Steps

1. **Install Supabase Client**
   ```bash
   npm install @supabase/supabase-js
   ```

2. **Create Supabase Client** (`lib/supabase.ts`)

3. **Build Pages**
   - `/` - Public view of verified drinks
   - `/contribute` - QR scanning + submission form
   - `/admin` - Review queue with anomaly display
   - `/admin/analysis` - Sweetness mapping analysis

4. **Integrate QR Scanner**
   - Options: `html5-qrcode`, `react-qr-reader`, `jsQR`
   - Note: CHAGEE QR codes are V1/V2 with minimal error correction - requires good lighting and straight-on scanning

## Queries for Analysis

```sql
-- Find all SKU + sweetness combinations
SELECT * FROM sweetness_analysis ORDER BY observation_count DESC;

-- Check if "No Additional Sugar" omits mm-value
SELECT 
  reported_sweetness, 
  mm_was_omitted, 
  COUNT(*) as count
FROM sweetness_observations 
WHERE contribution_id IN (SELECT id FROM contributions WHERE status = 'approved')
GROUP BY reported_sweetness, mm_was_omitted;

-- Get highest sweetness preset discovered
SELECT MAX(preset_number) as max_preset FROM sweetness_codes;

-- Unmapped SKUs
SELECT DISTINCT c.sku_value 
FROM contributions c
LEFT JOIN drink_skus d ON d.sku_code = c.sku_value
WHERE d.id IS NULL AND c.status = 'approved';
```
