/**
 * Widget metinleri — tr + en. Sunucu metni (karşılama, çevrimdışı mesajı)
 * varsa onu ezer; burası yalnız varsayılan ve arayüz etiketleridir.
 */
const tr = {
  launcher: 'Sohbet',
  title: 'Sohbet',
  online: 'Çevrimiçi',
  offline: 'Genelde birkaç dakika içinde yanıtlıyoruz',
  greeting: 'Merhaba! Size nasıl yardımcı olabiliriz?',
  offlineMessage: 'Şu an çevrimdışıyız. Mesajınızı bırakın, en kısa sürede dönelim.',
  prechatTitle: 'Başlamadan önce',
  prechatHint: 'Size geri dönebilmemiz için bilgilerinizi bırakın.',
  topicLabel: 'Konu',
  topicPlaceholder: 'Konu seçin (isteğe bağlı)',
  name: 'Adınız',
  email: 'E-posta',
  start: 'Sohbete başla',
  skip: 'Atla',
  placeholder: 'Mesajınızı yazın…',
  send: 'Gönder',
  attach: 'Dosya ekle',
  typing: 'yazıyor…',
  today: 'Bugün',
  yesterday: 'Dün',
  reply: 'Yanıtla',
  react: 'Tepki ver',
  edit: 'Düzenle',
  delete: 'Sil',
  deleted: 'Bu mesaj silindi',
  edited: 'düzenlendi',
  save: 'Kaydet',
  cancel: 'Vazgeç',
  you: 'Siz',
  agent: 'Destek',
  system: 'Sistem',
  endChat: 'Sohbeti bitir',
  newChat: 'Yeni sohbet',
  resolved: 'Bu sohbet çözüldü olarak işaretlendi.',
  closed: 'Bu sohbet kapatıldı.',
  rateTitle: 'Bu sohbeti nasıl buldunuz?',
  rateComment: 'Eklemek istediğiniz bir şey var mı? (isteğe bağlı)',
  rateSend: 'Gönder',
  rateThanks: 'Geri bildiriminiz bize ulaştı.',
  rateThanksTitle: 'Teşekkürler!',
  /** Yıldız sayısının karşılığı — puan verilince altında görünür. */
  rateScale: ['Hiç iyi değildi', 'Beklediğim gibi olmadı', 'İdare eder', 'İyiydi', 'Harikaydı'],
  reviewIntro: 'Yardımcı olabildiysek bizi yorumlar mısınız?',
  reviewCta: 'Değerlendir',
  failed: 'Gönderilemedi — tekrar dene',
  fileTooLarge: 'Dosya çok büyük (en fazla {mb} MB)',
  fileNotAllowed: 'Bu dosya türünü yükleyemezsiniz',
  tooLong: 'Mesaj en fazla {max} karakter olabilir',
  unavailable: 'Sohbet şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
  close: 'Kapat',
  dismiss: 'Sohbet balonunu gizle',
  minimize: 'Küçült',
  unreadTitle: '({n}) Yeni mesaj',
  dropHere: 'Dosyayı buraya bırakın',
  replyingTo: 'Yanıtlanıyor',
  attachment: 'Ek',
  poweredBy: 'Signalbird ile',
  resize: 'Boyutlandır',
  emoji: 'Emoji ekle',
  jump: 'En alta in',
  newMessage: 'Yeni mesaj',
  /** Boş ekranda karşılamanın altında duran yanıt süresi vaadi. */
  replyFast: 'Şu an buradayız — genelde birkaç dakika içinde yanıtlıyoruz.',
};

const en: typeof tr = {
  launcher: 'Chat',
  title: 'Chat',
  online: 'Online',
  offline: 'We usually reply within a few minutes',
  greeting: 'Hi there! How can we help you?',
  offlineMessage: "We're offline right now. Leave a message and we'll get back to you.",
  prechatTitle: 'Before we start',
  prechatHint: 'Leave your details so we can get back to you.',
  topicLabel: 'Topic',
  topicPlaceholder: 'Pick a topic (optional)',
  name: 'Your name',
  email: 'Email',
  start: 'Start chat',
  skip: 'Skip',
  placeholder: 'Type your message…',
  send: 'Send',
  attach: 'Attach file',
  typing: 'is typing…',
  today: 'Today',
  yesterday: 'Yesterday',
  reply: 'Reply',
  react: 'React',
  edit: 'Edit',
  delete: 'Delete',
  deleted: 'This message was deleted',
  edited: 'edited',
  save: 'Save',
  cancel: 'Cancel',
  you: 'You',
  agent: 'Support',
  system: 'System',
  endChat: 'End chat',
  newChat: 'New chat',
  resolved: 'This conversation was marked as resolved.',
  closed: 'This conversation was closed.',
  rateTitle: 'How was this conversation?',
  rateComment: 'Anything to add? (optional)',
  rateSend: 'Send',
  rateThanks: 'Your feedback reached us.',
  rateThanksTitle: 'Thank you!',
  rateScale: ['Not good at all', 'Not what I expected', 'It was okay', 'Good', 'Excellent'],
  reviewIntro: 'If we were helpful, would you leave us a review?',
  reviewCta: 'Leave a review',
  failed: 'Not sent — tap to retry',
  fileTooLarge: 'File is too large (max {mb} MB)',
  fileNotAllowed: 'That file type cannot be uploaded',
  tooLong: 'A message may be at most {max} characters',
  unavailable: 'Chat is unavailable right now. Please try again later.',
  close: 'Close',
  dismiss: 'Hide the chat bubble',
  minimize: 'Minimize',
  unreadTitle: '({n}) New message',
  dropHere: 'Drop the file here',
  replyingTo: 'Replying to',
  attachment: 'Attachment',
  poweredBy: 'Powered by Signalbird',
  resize: 'Resize',
  emoji: 'Add emoji',
  jump: 'Jump to latest',
  newMessage: 'New message',
  replyFast: "We're here right now — we usually reply within a few minutes.",
};

export type Strings = typeof tr;
export type StringKey = keyof Strings;

export function resolveLocale(appLocale?: string | null, explicit?: string | null): 'tr' | 'en' {
  const pick = (v?: string | null) => (v && v !== 'auto' ? v.toLowerCase().slice(0, 2) : null);
  const chosen =
    pick(explicit) ||
    pick(appLocale) ||
    pick(typeof navigator !== 'undefined' ? navigator.language : null) ||
    'en';
  return chosen === 'tr' ? 'tr' : 'en';
}

export function strings(locale: 'tr' | 'en'): Strings {
  return locale === 'tr' ? tr : en;
}

export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
