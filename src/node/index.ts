/**
 * @signalbird/sdk — sunucu tarafı giriş noktası.
 *
 * Next.js sunucu bileşenleri, API route'ları, Express/Fastify/NestJS ve düz
 * Node betikleri buradan alır. TARAYICI için `@signalbird/sdk/browser`
 * kullanılır — gizli anahtar istemciye inmez.
 *
 * Üç sunucu istemcisi vardır; anahtarları ve kapıları farklıdır:
 *  - `SignalbirdClient`     → Telsiz (log yazma), `sbr_live_…`
 *  - `SignalbirdMessaging`  → Gönderim (e-posta/SMS/push/kişi/kampanya), `sb_…`
 *  - `SignalbirdManagement` → Yönetim (Telsiz projesi, sohbet gelen kutusu,
 *                             uygulama kaydı), `sb_…` + `radio|chat|apps` scope'ları
 *
 * Son kullanıcı (ziyaretçi) yüzeyi ayrı giriş noktasındadır:
 * `@signalbird/sdk/app` — ve onun çatı uyarlamaları `/react`, `/vue`,
 * `/angular`, `/react-native`.
 */
export { SignalbirdClient } from './client';
export { SignalbirdMessaging } from './messaging';
export { SignalbirdManagement } from './management';
export { verifyWebhook } from './webhook';
export type {
  ManagementConfig,
  AppDevice,
  AppInput,
  AppPlatform,
  AppRecord,
  CannedReply,
  CannedReplyInput,
  ChatConversation,
  ChatMessage,
  ChatVisitor,
  ConversationStatus,
  CreateRadioProjectInput,
  ListAppDevicesQuery,
  ListChatMessagesQuery,
  ListConversationsQuery,
  ListRadioEventsQuery,
  RadioChannel,
  RadioChannelInput,
  RadioEvent,
  RadioLevel,
  RadioProject,
  RadioProjectCreated,
  ReplyInput,
  StartConversationInput,
  UpdateConversationInput,
  UpdateRadioProjectInput,
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
 * `SIGNALBIRD_KEY` okunur. Uygulamanın her köşesinde istemci kurup anahtarı
 * elden ele taşımak yerine tek çağrı yeter:
 *
 *   import { signalbird } from '@signalbird/sdk'
 *   await signalbird().critical('critical', 'ödeme servisi öldü')
 */
export function signalbird(config?: Partial<SignalbirdConfig>): SignalbirdClient {
  if (singleton && !config) {
    return singleton;
  }

  const apiKey = config?.apiKey ?? process.env.SIGNALBIRD_KEY ?? '';

  const client = new SignalbirdClient({
    apiKey,
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
 * `SIGNALBIRD_API_KEY` okunur (yoksa `SIGNALBIRD_MESSAGING_KEY` — ikisi de aynı
 * takım anahtarı ailesidir ve çoğu kurulumda tek anahtar kullanılır).
 *
 *   import { management } from '@signalbird/sdk'
 *   await management().createRadioProject({ name: 'ödeme-servisi' })
 */
export function management(config?: Partial<ManagementConfig>): SignalbirdManagement {
  if (managementSingleton && !config) {
    return managementSingleton;
  }

  const client = new SignalbirdManagement({
    apiKey:
      config?.apiKey ??
      process.env.SIGNALBIRD_API_KEY ??
      process.env.SIGNALBIRD_MESSAGING_KEY ??
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
