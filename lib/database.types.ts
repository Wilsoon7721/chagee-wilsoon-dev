export type ContributionStatus = 'pending' | 'approved' | 'rejected';
export type SweetnessLevel = 'normal' | 'less' | 'slightly' | 'none';
export type IceLevel = 'normal' | 'less' | 'none' | 'hot';
export type CupSize = 'regular' | 'large';
export type SkuType = 'regular' | 'limited' | 'cake' | 'special' | 'bakery' | 'unknown';

export interface DrinkSku {
  id: string;
  sku_code: string;
  sku_type: SkuType;
  drink_name: string | null;
  drink_category: string | null;
  has_milk: boolean | null;
  uses_machine_milk: boolean;
  is_verified: boolean;
  verification_count: number;
  calories_regular: number | null;
  calories_large: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CupSizeCode {
  code: string;
  size: CupSize;
  description: string | null;
  created_at: string;
}

export interface MilkCode {
  code: string;
  milk_name: string;
  description: string | null;
  created_at: string;
}

export interface IceCode {
  code: string;
  ice_level: IceLevel;
  description: string | null;
  created_at: string;
}

export interface SweetnessCode {
  code: string;
  preset_number: number;
  description: string | null;
  first_seen_at: string;
  occurrence_count: number;
}

export interface Contribution {
  id: string;

  // Raw QR payload data
  raw_payload: string;

  // Parsed QR segments
  t_value: string;
  sku_value: string;
  sku_type: SkuType;
  segment_3_raw: string;

  // Parsed segment 3 fragments (nullable)
  a_value: string | null;
  c_value: string | null;
  m_value: string | null;
  mm_value: string | null;

  // User-reported drink details
  reported_drink_name: string;
  reported_size: CupSize | null;
  reported_sweetness: SweetnessLevel | null;
  reported_ice: IceLevel;
  reported_milk_type: string | null;

  // Image evidence
  image_storage_path: string | null;
  image_url: string | null;

  // Submission metadata
  submitter_ip_hash: string | null;
  user_agent: string | null;
  submitted_at: string;

  // Review workflow
  status: ContributionStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_notes: string | null;

  // Review flags
  flag_new_sku: boolean;
  flag_new_codes: boolean;
  flag_size_mismatch: boolean;
  flag_missing_expected_milk: boolean;
  flag_unexpected_milk: boolean;

  created_at: string;
  updated_at: string;
}

export interface SweetnessObservation {
  id: string;
  contribution_id: string;
  sku_code: string;
  drink_name: string | null;
  cup_size: CupSize | null;
  mm_code: string | null;
  reported_sweetness: SweetnessLevel | null;
  mm_was_omitted: boolean;
  created_at: string;
}

export interface PublicDrink {
  sku_code: string;
  sku_type: SkuType;
  drink_name: string | null;
  drink_category: string | null;
  has_milk: boolean | null;
  uses_machine_milk: boolean;
  calories_regular: number | null;
  calories_large: number | null;
  verification_count: number;
  is_verified: boolean;
}

export interface AdminPendingContribution {
  id: string;
  raw_payload: string;
  t_value: string;
  sku_value: string;
  sku_type: SkuType;
  segment_3_raw: string;
  a_value: string | null;
  c_value: string | null;
  m_value: string | null;
  mm_value: string | null;
  reported_drink_name: string;
  reported_size: CupSize | null;
  reported_sweetness: SweetnessLevel | null;
  reported_ice: IceLevel;
  reported_milk_type: string | null;
  image_url: string | null;
  submitted_at: string;
  flag_new_sku: boolean;
  flag_new_codes: boolean;
  flag_size_mismatch: boolean;
  flag_missing_expected_milk: boolean;
  flag_unexpected_milk: boolean;
  has_flags: boolean;
  known_drink_name: string | null;
  known_category: string | null;
  known_uses_machine_milk: boolean | null;
}

export interface SweetnessAnalysisRow {
  sku_code: string;
  drink_name: string | null;
  drink_category: string | null;
  cup_size: CupSize | null;
  reported_sweetness: SweetnessLevel | null;
  mm_code: string | null;
  mm_was_omitted: boolean;
  observation_count: number;
}

export interface ParsedQrPayload {
  raw: string;
  tValue: string;
  skuValue: string;
  regionCode: 'SG';
  itemCode: string;
  skuType: SkuType;
  segment3Raw: string;
  aValue: string | null;
  cValue: string | null;
  mValue: string | null;
  mmValue: string | null;
}

export interface QrParseError {
  type: 'invalid_format' | 'missing_segments' | 'non_singapore';
  message: string;
  raw?: string;
}

export type QrParseResult = { success: true; data: ParsedQrPayload } | { success: false; error: QrParseError };

export interface ContributionFormData {
  rawPayload: string;
  reportedDrinkName: string;
  reportedSize: CupSize | null;
  reportedSweetness: SweetnessLevel | null;
  reportedIce: IceLevel;
  reportedMilkType?: string;
  imageFile?: File;
}

export interface ContributionSubmission extends ContributionFormData {
  parsedPayload: ParsedQrPayload;
}

export const KNOWN_REGIONS: Record<string, string> = {
  SG: 'Singapore',
  PHL: 'Philippines'
};

export const KNOWN_CUP_SIZES: Record<string, CupSize> = {
  A001: 'large',
  A002: 'regular'
};

export const KNOWN_MILK_TYPES: Record<string, string> = {
  C001: 'Regular Fresh Milk',
  C002: 'Oat Milk',
  C003: 'Non-Fat Milk'
};

export const KNOWN_ICE_LEVELS: Record<string, IceLevel> = {
  m001: 'normal',
  m002: 'less',
  m003: 'none'
};

// ALREADY KNOWN SKUs
export const KNOWN_SKUS: Record<string, { name: string; hasMilk: boolean; usesMachineMilk: boolean; category: string }> = {
  // Regular menu - Milk Teas
  SG0101: { name: 'BO.YA Jasmine Milk Tea', hasMilk: true, usesMachineMilk: true, category: 'Milk Tea' },
  SG0103: { name: 'Tie Guan Yin Milk Tea', hasMilk: true, usesMachineMilk: true, category: 'Milk Tea' },
  SG0108: { name: 'Da Hong Pao Milk Tea', hasMilk: true, usesMachineMilk: true, category: 'Milk Tea' },
  SG0422: { name: 'Peach Oolong Milk Tea', hasMilk: true, usesMachineMilk: true, category: 'Milk Tea' },
  // Regular menu - Pure Teas
  SG0426: { name: 'Peach Oolong Tea', hasMilk: false, usesMachineMilk: false, category: 'Pure Tea' },
  // Snow Cap series (hand-poured milk)
  SG0388: { name: 'Da Hong Pao Snow Cap Milk Tea', hasMilk: true, usesMachineMilk: false, category: 'Snow Cap' },
  // Special items
  SGSTC001: { name: 'Free Milk', hasMilk: true, usesMachineMilk: true, category: 'Special' }
};

export interface Database {
  chagee: {
    Tables: {
      drink_skus: {
        Row: DrinkSku;
        Insert: Omit<DrinkSku, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DrinkSku, 'id'>>;
      };
      cup_size_codes: {
        Row: CupSizeCode;
        Insert: Omit<CupSizeCode, 'created_at'>;
        Update: Partial<Omit<CupSizeCode, 'code'>>;
      };
      milk_codes: {
        Row: MilkCode;
        Insert: Omit<MilkCode, 'created_at'>;
        Update: Partial<Omit<MilkCode, 'code'>>;
      };
      ice_codes: {
        Row: IceCode;
        Insert: Omit<IceCode, 'created_at'>;
        Update: Partial<Omit<IceCode, 'code'>>;
      };
      sweetness_codes: {
        Row: SweetnessCode;
        Insert: Omit<SweetnessCode, 'first_seen_at' | 'occurrence_count'>;
        Update: Partial<Omit<SweetnessCode, 'code'>>;
      };
      contributions: {
        Row: Contribution;
        Insert: Omit<
          Contribution,
          'id' | 'created_at' | 'updated_at' | 'submitted_at' | 'reviewed_at' | 'reviewed_by' | 'review_notes' | 'flag_new_sku' | 'flag_new_codes' | 'flag_size_mismatch' | 'flag_missing_expected_milk' | 'flag_unexpected_milk'
        > & { status?: ContributionStatus; submitted_at?: string };
        Update: Partial<Omit<Contribution, 'id'>>;
      };
      sweetness_observations: {
        Row: SweetnessObservation;
        Insert: Omit<SweetnessObservation, 'id' | 'created_at'>;
        Update: Partial<Omit<SweetnessObservation, 'id'>>;
      };
    };
    Views: {
      public_drinks: {
        Row: PublicDrink;
      };
      admin_pending_contributions: {
        Row: AdminPendingContribution;
      };
      sweetness_analysis: {
        Row: SweetnessAnalysisRow;
      };
    };
    Functions: {
      get_sku_type: {
        Args: { sku_code: string };
        Returns: SkuType;
      };
      set_contribution_flags: {
        Args: { contrib_id: string };
        Returns: void;
      };
    };
    Enums: {
      contribution_status: ContributionStatus;
      sweetness_level: SweetnessLevel;
      ice_level: IceLevel;
      cup_size: CupSize;
      sku_type: SkuType;
    };
    CompositeTypes: Record<string, never>;
  };
}
