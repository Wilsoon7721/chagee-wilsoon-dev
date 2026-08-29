import type { CupSize, IceLevel, ParsedQrPayload, QrParseResult, SkuType } from './database.types';
import { KNOWN_CUP_SIZES, KNOWN_ICE_LEVELS, KNOWN_MILK_TYPES, KNOWN_SKUS } from './database.types';

export function getSkuType(skuCode: string): SkuType {
  if (/^SG[0-9]{4}$/.test(skuCode)) return 'regular';
  if (/^SGL[0-9]{4}$/.test(skuCode)) return 'limited';
  if (/^SGC[0-9]{4}$/.test(skuCode)) return 'cake';
  if (/^SGSTC[0-9]+$/.test(skuCode)) return 'special';
  if (/^SG/.test(skuCode)) return 'unknown';

  return 'unknown';
}

/** Pattern for T-value (transaction number) */
const T_VALUE_PATTERN = /^T\d{4,}$/;
const SKU_PATTERN = /^SG[A-Z0-9]+$/;
const ACCEPTED_REGION = 'SG' as const;

/** Pattern for A-value (cup size) */
const A_VALUE_PATTERN = /^A\d{3}$/;

/** Pattern for C-value (milk type) */
const C_VALUE_PATTERN = /^C\d{3}$/;

/** Pattern for m-value (ice/water level) */
const M_VALUE_PATTERN = /^m\d{3}$/;

/** Pattern for mm-value (sweetness preset) */
const MM_VALUE_PATTERN = /^mm\d{3}$/;

/**
 * Parse a CHAGEE QR code payload string.
 *
 * @param rawPayload - The raw string from the QR code scanner
 * @returns A result object with either the parsed data or an error
 *
 * @example
 * const result = parseQrPayload("T0241|SG0422|A002,C003,m003,mm002|");
 * if (result.success) {
 *   console.log(result.data.skuValue); // "SG0422"
 * }
 */
export function parseQrPayload(rawPayload: string): QrParseResult {
  const normalized = rawPayload.trim().replace(/\|$/, '');
  const segments = normalized.split('|');
  if (segments.length !== 3)
    return {
      success: false,
      error: {
        type: 'invalid_format',
        message: `Expected 3 pipe-separated segments, got ${segments.length}`,
        raw: rawPayload
      }
    };

  const [tValue, skuValue, segment3Raw] = segments;
  if (!T_VALUE_PATTERN.test(tValue))
    return {
      success: false,
      error: {
        type: 'invalid_format',
        message: `Invalid T-value format: "${tValue}". Expected format: T0000`,
        raw: rawPayload
      }
    };

  if (!SKU_PATTERN.test(skuValue))
    return {
      success: false,
      error: {
        type: 'non_singapore',
        message: skuValue.length === 0 ? 'SKU is empty.' : `Only Singapore QR codes are accepted. "${skuValue}" does not start with "SG".`,
        raw: rawPayload
      }
    };

  const regionCode = ACCEPTED_REGION;
  const itemCode = skuValue.slice(2);
  const segment3Parts = segment3Raw.split(',').filter(Boolean);

  let aValue: string | null = null;
  let cValue: string | null = null;
  let mValue: string | null = null;
  let mmValue: string | null = null;

  for (const part of segment3Parts) {
    const trimmed = part.trim();

    if (A_VALUE_PATTERN.test(trimmed)) {
      if (aValue !== null)
        return {
          success: false,
          error: {
            type: 'invalid_format',
            message: `Duplicate A-value found: "${aValue}" and "${trimmed}"`,
            raw: rawPayload
          }
        };

      aValue = trimmed;
    } else if (C_VALUE_PATTERN.test(trimmed)) {
      if (cValue !== null)
        return {
          success: false,
          error: {
            type: 'invalid_format',
            message: `Duplicate C-value found: "${cValue}" and "${trimmed}"`,
            raw: rawPayload
          }
        };

      cValue = trimmed;
    } else if (MM_VALUE_PATTERN.test(trimmed)) {
      // Check mm BEFORE m (since mm also starts with m)
      if (mmValue !== null)
        return {
          success: false,
          error: {
            type: 'invalid_format',
            message: `Duplicate mm-value found: "${mmValue}" and "${trimmed}"`,
            raw: rawPayload
          }
        };

      mmValue = trimmed;
    } else if (M_VALUE_PATTERN.test(trimmed)) {
      if (mValue !== null)
        return {
          success: false,
          error: {
            type: 'invalid_format',
            message: `Duplicate m-value found: "${mValue}" and "${trimmed}"`,
            raw: rawPayload
          }
        };

      mValue = trimmed;
    } else console.warn(`Unknown segment 3 fragment: "${trimmed}"`);
  }

  return {
    success: true,
    data: { raw: rawPayload, tValue, skuValue, regionCode, itemCode, skuType: getSkuType(skuValue), segment3Raw, aValue, cValue, mValue, mmValue }
  };
}

/**
 * Check if a SKU is already known/mapped.
 */
export function isKnownSku(skuValue: string): boolean {
  return skuValue in KNOWN_SKUS;
}

/**
 * Get the known drink name for a SKU, if available.
 */
export function getKnownDrinkName(skuValue: string): string | null {
  return KNOWN_SKUS[skuValue]?.name ?? null;
}

/**
 * Check if a drink SKU is expected to have milk based on known data.
 */
export function isExpectedToHaveMilk(skuValue: string): boolean | null {
  const known = KNOWN_SKUS[skuValue];
  return known ? known.hasMilk : null;
}

/**
 * Decode cup size from A-value.
 */
export function decodeCupSize(aValue: string | null): CupSize | null {
  if (!aValue) return null;

  return KNOWN_CUP_SIZES[aValue] ?? null;
}

/**
 * Decode milk type from C-value.
 */
export function decodeMilkType(cValue: string | null): string | null {
  if (!cValue) return null;

  return KNOWN_MILK_TYPES[cValue] ?? null;
}

/**
 * Decode ice level from m-value.
 */
export function decodeIceLevel(mValue: string | null): IceLevel | null {
  if (!mValue) return null;

  return KNOWN_ICE_LEVELS[mValue] ?? null;
}

/**
 * Extract the numeric preset from mm-value.
 * Returns null if no mm-value, or the number (e.g., 2 from "mm002").
 */
export function extractSweetnessPreset(mmValue: string | null): number | null {
  if (!mmValue) return null;

  const match = /^mm(\d+)$/.exec(mmValue);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Anomaly Detection
 */
export interface PayloadAnomaly {
  type: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  field?: string;
}

/**
 * Detect potential anomalies in a parsed payload.
 * This is a preliminary check before server-side validation.
 */
export function detectAnomalies(parsed: ParsedQrPayload): PayloadAnomaly[] {
  const anomalies: PayloadAnomaly[] = [];

  // Check 1: Unknown SKU (new drink discovery!)
  if (!isKnownSku(parsed.skuValue))
    anomalies.push({
      type: 'unknown_sku',
      severity: 'info',
      message: `This SKU (${parsed.skuValue}) hasn't been mapped yet. Your contribution will help identify it!`,
      field: 'skuValue'
    });
  else {
    anomalies.push({
      type: 'known_sku',
      severity: 'info',
      message: 'This item is already mapped. If the autofilled data matches your drink, simply press "Submit contribution". Otherwise, please manually change the values (a sticker photo will be required) before submitting.',
      field: 'skuValue'
    });
  }

  if (getSkuType(parsed.skuValue) === 'limited')
    anomalies.push({
      type: 'limited_edition',
      severity: 'info',
      message: 'This seems like a limited-edition item.',
      field: 'skuValue'
    });

  // Check 2: Milk inconsistency
  const expectedMilk = isExpectedToHaveMilk(parsed.skuValue);
  const isNonDrink = ['special', 'cake', 'bakery'].includes(getSkuType(parsed.skuValue));

  if (expectedMilk !== null && !isNonDrink) {
    const hasMilkCode = parsed.cValue !== null;
    if (expectedMilk && !hasMilkCode)
      anomalies.push({
        type: 'missing_milk_code',
        severity: 'critical',
        message: `This drink (${getKnownDrinkName(parsed.skuValue)}) should have a milk code, but none was found.`,
        field: 'cValue'
      });
    else if (!expectedMilk && hasMilkCode)
      anomalies.push({
        type: 'unexpected_milk_code',
        severity: 'critical',
        message: `This drink (${getKnownDrinkName(parsed.skuValue)}) is a pure tea but has a milk code (${parsed.cValue}).`,
        field: 'cValue'
      });
  }

  // Check 3: Unknown codes
  if (parsed.aValue && !(parsed.aValue in KNOWN_CUP_SIZES))
    anomalies.push({
      type: 'unknown_cup_size',
      severity: 'warning',
      message: `New cup size code discovered: ${parsed.aValue}`,
      field: 'aValue'
    });

  if (parsed.cValue && !(parsed.cValue in KNOWN_MILK_TYPES))
    anomalies.push({
      type: 'unknown_milk_type',
      severity: 'warning',
      message: `New milk type code discovered: ${parsed.cValue}`,
      field: 'cValue'
    });

  if (parsed.mValue && !(parsed.mValue in KNOWN_ICE_LEVELS))
    anomalies.push({
      type: 'unknown_ice_level',
      severity: 'warning',
      message: `New ice level code discovered: ${parsed.mValue}`,
      field: 'mValue'
    });

  // Check 4: Missing A-value (should always be present for regular drinks)
  if (!parsed.aValue && !isNonDrink)
    anomalies.push({
      type: 'missing_cup_size',
      severity: 'critical',
      message: 'No cup size code (A-value) found in the payload.',
      field: 'aValue'
    });

  return anomalies;
}

// Generate a human-readable summary of a parsed payload
export function generatePayloadSummary(parsed: ParsedQrPayload): string {
  const parts: string[] = [];

  // Drink name or SKU
  const drinkName = getKnownDrinkName(parsed.skuValue);
  parts.push(drinkName ? drinkName : `Unknown Drink (${parsed.skuValue})`);

  // Size
  const size = decodeCupSize(parsed.aValue);
  if (size) parts.push(size === 'large' ? 'Large' : 'Regular');

  // Milk
  const milk = decodeMilkType(parsed.cValue);
  if (milk) parts.push(`with ${milk}`);
  else if (parsed.cValue === null) {
    // No milk (pure tea)
  }

  // Ice
  const ice = decodeIceLevel(parsed.mValue);
  if (ice) {
    const iceLabels: Record<IceLevel, string> = {
      normal: 'Normal Ice',
      less: 'Less Ice',
      none: 'No Ice',
      hot: 'Hot'
    };
    parts.push(iceLabels[ice]);
  }

  // Sweetness preset (can't decode to user selection, just show preset)
  const sweetnessPreset = extractSweetnessPreset(parsed.mmValue);
  if (sweetnessPreset !== null) parts.push(`Sweetness Preset ${sweetnessPreset}`);
  else if (parsed.mmValue === null) parts.push('No Sugar');

  return parts.join(' • ');
}

/**
 * Format a parsed payload for display in a debug/admin view.
 */
export function formatPayloadDebug(parsed: ParsedQrPayload): string {
  return [
    `Raw: ${parsed.raw}`,
    `Transaction: ${parsed.tValue}`,
    `SKU: ${parsed.skuValue} (Region: ${parsed.regionCode})`,
    `Cup Size: ${parsed.aValue ?? '(none)'} → ${decodeCupSize(parsed.aValue) ?? 'unknown'}`,
    `Milk: ${parsed.cValue ?? '(none)'} → ${decodeMilkType(parsed.cValue) ?? 'no milk'}`,
    `Ice: ${parsed.mValue ?? '(none)'} → ${decodeIceLevel(parsed.mValue) ?? 'unknown'}`,
    `Sweetness: ${parsed.mmValue ?? '(none)'} → Preset ${extractSweetnessPreset(parsed.mmValue) ?? 'none'}`
  ].join('\n');
}
