/**
 * Partner (beşinci yüzey) tipleri.
 *
 * Sözleşme: docs/CONTRACT.md § 12 ve
 * signalbird.api/docs/PARTNER_PLATFORM_2026-08-20.md.
 *
 * Alan adları API ile birebir aynıdır (snake_case) — SDK yeniden adlandırmaz.
 */
import type { SbResult } from './http';

export type { SbResult };

export interface PartnerConfig {
  /** `sb_secret_live_…` — gizli domain anahtarı. Tarayıcıya İNMEZ. */
  domainKey: string;
  baseUrl?: string;
  timeout?: number;
  throwOnError?: boolean;
  debug?: boolean;
}

export interface PartnerOwnerInput {
  email: string;
  name?: string;
  /** Partner'ın kendi tarafındaki kullanıcı kimliği. */
  external_id?: string;
  locale?: string;
}

export interface CreateCompanyInput {
  /** Partner'ın kendi tarafındaki müşteri kimliği — idempotens anahtarı. */
  external_id: string;
  name: string;
  owner: PartnerOwnerInput;
  team_name?: string;
  link_email?: string;
}

export interface PartnerCompany {
  id: number;
  external_id: string;
  name: string;
  status: string;
  billing_managed_by_partner: boolean;
  modules: string[];
  created_at: string | null;
}

export interface CreateCompanyResult {
  created: boolean;
  company: PartnerCompany;
  team: { id: number | null; name: string | null };
  owner: { id: number | null; email: string | null; name: string | null };
  /** YALNIZ ilk oluşturmada döner. Kaybedilirse `rotateKey` yenisini üretir. */
  keys?: { api_key: string; app_key: string };
}

export interface DnsRecord {
  host: string;
  type: string;
  value: string;
}

export interface PartnerDomain {
  id: number;
  external_id: string;
  domain: string;
  verified_at: string | null;
  /** `txt` | `partner` — partner beyanı kampanya için YETMEZ. */
  verified_via: string | null;
  can_send_campaigns: boolean;
  is_active: boolean;
}

export interface AddDomainInput {
  external_id: string;
  domain: string;
  monitoring?: { enabled?: boolean; frequency?: number };
}

export interface AddDomainResult {
  created: boolean;
  domain: PartnerDomain;
  watcher: { id: number; frequency: number } | null;
  dns: DnsRecord[];
  note: string;
}

export interface VerifyDomainResult {
  verified: boolean;
  domain: PartnerDomain;
  dns: DnsRecord[];
}

export interface UptimeIncident {
  started_at: string;
  ended_at: string | null;
  duration_s: number;
  reason: string | null;
}

export interface UptimeReport {
  domain?: string;
  external_id?: string;
  monitored?: boolean;
  range: string;
  /** Hiç kontrol yoksa `null` döner — %100 DEĞİL. */
  uptime: number | null;
  avg_response_ms: number | null;
  checks: number;
  status: string | null;
  last_checked_at: string | null;
  incidents: UptimeIncident[];
}

export type UptimeRange = '24h' | '7d' | '30d';

export interface ModuleEntitlement {
  module: string;
  limits: Record<string, number>;
  source: string;
  expires_at: string | null;
}

export interface GrantModuleInput {
  module: string;
  limits?: Record<string, number>;
  /** Aboneliğin bittiği tarih; yenilemede tazelenmezse modül kendi kapanır. */
  expires_at?: string;
  reason?: string;
}

export interface PartnerUserInput {
  external_id: string;
  email: string;
  name?: string;
  role?: 'owner' | 'billing' | 'member';
  team_role?: string;
  permissions?: string[];
}

export interface PartnerUser {
  id: number;
  external_id: string | null;
  email: string;
  name: string | null;
  role: string | null;
}

export type EmbedModule =
  | 'chat'
  | 'monitoring'
  | 'campaigns'
  | 'contacts'
  | 'radio'
  | 'messages'
  | 'topics'
  | 'members';

export interface EmbedTokenInput {
  user_external_id: string;
  module: EmbedModule;
  locale?: string;
  theme?: 'light' | 'dark';
  accent?: string;
}

export interface EmbedToken {
  url: string;
  token: string;
  expires_at: string;
  ttl: number;
}
