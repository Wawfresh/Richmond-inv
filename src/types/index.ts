export interface InvestorProfile {
  id: number;
  user_id: number;
  account_number: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  telephone: string;
  date_of_birth: string;
  country_of_residence: string;
  residential_address: string;
  city: string;
  state_region: string;
  postal_code: string;
  kyc_status: 'not_submitted' | 'submitted' | 'under_review' | 'additional_info_required' | 'approved' | 'rejected';
  terms_accepted_at: string;
  privacy_accepted_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  accountType: 'investor' | 'admin';
  accountStatus: string;
  roleSlug: string;
  roleName: string;
  permissions: string[];
  profile: InvestorProfile | null;
}

export interface OfferingDocument {
  id: number;
  offering_id: number;
  title: string;
  document_type: string;
  original_filename: string | null;
  summary_notes: string | null;
  created_at: string;
}

export type PlanDurationUnit = 'month' | 'days' | 'hours' | 'daily';

export interface ShareOffering {
  id: number;
  reference_code: string;
  title: string;
  slug: string;
  sector: string;
  summary: string;
  description: string;
  currency: string;
  share_price: number;
  roi_percent?: number;
  duration_unit?: PlanDurationUnit;
  duration_value?: number;
  duration_months?: number;
  duration_days?: number;
  duration_hours?: number;
  min_amount?: number;
  max_amount?: number;
  min_quantity: number;
  max_quantity: number;
  total_authorized_quantity: number;
  available_quantity: number;
  opening_date: string;
  closing_date: string;
  status: 'draft' | 'published' | 'suspended' | 'closed';
  risk_disclosures: string;
  requires_kyc: boolean | number;
  documents?: OfferingDocument[];
}

export interface Announcement {
  id: number;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  is_published: boolean | number;
  published_at: string;
}

export interface FaqEntry {
  id: number;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
}
