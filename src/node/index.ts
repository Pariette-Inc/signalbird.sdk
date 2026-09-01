/**
 * signalbird — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `signalbird/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 *
 * Üç sunucu istemcisi vardır; anahtarları ve kapıları farklıdır:
 *  - `SignalbirdClient`     → Telsiz (log yazma), `sb_secret_live_…`
 *  - `SignalbirdMessaging`  → Gönderim (e-posta/SMS/push/kişi/kampanya), `sb_…`
 *  - `SignalbirdManagement` → Yönetim (Telsiz projesi, sohbet gelen kutusu,
 *                             uygulama kaydı), `sb_…` + `radio|chat|apps` scope'ları
 *  - `SignalbirdPartner`    → Partner (müşteri sağlama, modül yetkisi, gömme),
 *                             gizli anahtar — yalnız sözleşmeli platformlar
 *
 * Son kullanıcı (ziyaretçi) yüzeyi ayrı giriş noktasındadır:
 * `signalbird/app` — ve onun çatı uyarlamaları `/react`, `/vue`,
 * `/angular`, `/react-native`.
 */
export { SignalbirdClient } from './client';
export { SignalbirdMessaging } from './messaging';
export { SignalbirdManagement } from './management';
export { SignalbirdPartner } from './partner';
export { verifyWebhook } from './webhook';
export type {
  TeamEmbedTokenInput,
  ManagementConfig,
  AppDevice,
  AppPlatform,
  CannedReply,
  CannedReplyInput,
  ChatConversation,
  ChatMessage,
  ChatVisitor,
  ConversationStatus,
  ListAppDevicesQuery,
  ListChatMessagesQuery,
  ListConversationsQuery,
  ListRadioEventsQuery,
  RadioEvent,
  RadioLevel,
  ReplyInput,
  StartConversationInput,
  UpdateConversationInput,
  UpdateVisitorInput,
} from './management-types';
export type {
  MessagingConfig,
  SbResult,
  MessageClass,
  Channel,
  SendEmailInput,
  SendSmsInput,
  SendPushInput,
  SendResult,
  SmsPreview,
  ContactInput,
  Contact,
  ListContactsQuery,
  BulkContactsInput,
  BulkContactsResult,
  ContactList,
  CreateContactListInput,
  CreateCampaignInput,
  Batch,
  CampaignCreateResult,
  CampaignDetail,
  ListCampaignsQuery,
  Message,
  ListMessagesQuery,
  ListCampaignMessagesQuery,
  Paginated,
  MessagingErrorCode,
} from './messaging-types';
export type {
  PartnerConfig,
  AddDomainInput,
  AddDomainResult,
  CreateCompanyInput,
  CreateCompanyResult,
  DnsRecord,
  EmbedModule,
  EmbedToken,
  EmbedTokenInput,
  GrantModuleInput,
  ModuleEntitlement,
  PartnerCompany,
  PartnerDomain,
  PartnerOwnerInput,
  PartnerUser,
  PartnerUserInput,
  UptimeIncident,
  UptimeRange,
  UptimeReport,
  VerifyDomainResult,
} from './partner-types';
export {
  SignalbirdError,
  DEFAULT_BASE_URL,
  type BatchResult,
  type Level,
  type LogInput,
  type LogResult,
  type SignalbirdConfig,
} from './types';

import { SignalbirdClient } from './client';
import { SignalbirdManagement } from './management';
import type { ManagementConfig } from './management-types';
import type { SignalbirdConfig } from './types';

let singleton: SignalbirdClient | null = null;

/**
 * Ortam değişkeninden kurulan paylaşımlı istemci.
 *
 * `SIGNALBIRD_DOMAIN_KEY` okunur. Uygulamanın her köşesinde istemci kurup
 * anahtarı elden ele taşımak yerine tek çağrı yeter:
 *
 *   import { signalbird } from 'signalbird'
 *   await signalbird().critical('kritikApiHatasi', 'ödeme servisi öldü')
 */
export function signalbird(config?: Partial<SignalbirdConfig>): SignalbirdClient {
  if (singleton && !config) {
    return singleton;
  }

  const domainKey = config?.domainKey ?? process.env.SIGNALBIRD_DOMAIN_KEY ?? '';

  const client = new SignalbirdClient({
    domainKey,
    baseUrl: config?.baseUrl ?? process.env.SIGNALBIRD_URL,
    source: config?.source ?? process.env.SIGNALBIRD_SOURCE,
    ...config,
  });

  if (!config) {
    singleton = client;
  }

  return client;
}

/** Test ve sıcak yeniden yükleme için tekil istemciyi sıfırlar. */
export function resetSignalbird(): void {
  singleton = null;
}

let managementSingleton: SignalbirdManagement | null = null;

/**
 * Ortam değişkeninden kurulan paylaşımlı yönetim istemcisi.
 *
 * `SIGNALBIRD_DOMAIN_KEY` okunur (yoksa `SIGNALBIRD_DOMAIN_KEY` — ikisi de aynı
 * takım anahtarı ailesidir ve çoğu kurulumda tek anahtar kullanılır).
 *
 *   import { management } from 'signalbird'
 *   await management().createModuleKey('logger', { title: 'Kritik API hatası' })
 */
export function management(config?: Partial<ManagementConfig>): SignalbirdManagement {
  if (managementSingleton && !config) {
    return managementSingleton;
  }

  const client = new SignalbirdManagement({
    domainKey:
      config?.domainKey ??
      process.env.SIGNALBIRD_DOMAIN_KEY ??
      process.env.SIGNALBIRD_DOMAIN_KEY ??
      '',
    baseUrl: config?.baseUrl ?? process.env.SIGNALBIRD_URL,
    ...config,
  });

  if (!config) {
    managementSingleton = client;
  }

  return client;
}

/** Test ve sıcak yeniden yükleme için yönetim istemcisini sıfırlar. */
export function resetManagement(): void {
  managementSingleton = null;
}
