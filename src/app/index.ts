/**
 * `@signalbird/sdk/app` — son kullanıcı (uygulama) yüzeyi.
 *
 * Müşterinin MÜŞTERİSİ için: canlı sohbet ve push cihaz kaydı. Açık uygulama
 * anahtarıyla (`sbw_pub_…`) çalışır ve yalnız ziyaretçinin kendi verisine
 * dokunur — gönderim yapmaz, kişi listesi okumaz.
 *
 * Çatı uyarlamaları bunun üstüne oturur:
 *   `@signalbird/sdk/react` · `/vue` · `/angular` · `/react-native`
 *
 * Hazır arayüz isteyen (kod yazmadan) `signalbird.js` widget'ını gömer.
 */
export { SignalbirdApp, clientId } from './client';
export { ChatSession, type ChatListener, type ChatSessionOptions, type ChatState } from './session';
export type {
  AppConfig,
  AppStorage,
  Attachment,
  BootstrapResult,
  Conversation,
  ConversationQuery,
  DevicePlatform,
  IdentifyInput,
  Message,
  MessageSender,
  RegisterDeviceInput,
  SbResult,
  SendMessageInput,
  SessionInput,
  StartConversationInput,
  Visitor,
} from './types';
