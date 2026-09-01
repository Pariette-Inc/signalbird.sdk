/**
 * Partner istemcisi — BEŞİNCİ yüzey.
 *
 * Signalbird'ü kendi ürününün içinde satan sözleşmeli platform (veribenim,
 * submitcms) müşterisini bununla sağlar ve yetkilendirir: company + takım +
 * owner açar, domain ekler ve izlemeye alır, uptime okur, modül açar/kapatır,
 * gömme jetonu üretir.
 *
 * **Bu, CLAUDE.md'deki "Admin yüzeyi OLMAYACAK" kuralının bilinçli
 * istisnasıdır** ve istisna olduğu için ayrı anahtar türü taşır. Kural,
 * müşterinin kendi anahtarıyla (`sb_`) şirket açamaması içindi; o kural aynen
 * duruyor. Sözleşmeli partner farklı bir taraftır.
 *
 * Anahtar `sbp_live_…` **asla tarayıcıya inmez**: gömme jetonunu partner'ın
 * kendi sunucusu üretir, tarayıcı yalnız o kısa ömürlü jetonu görür.
 *
 * Sözleşme: docs/CONTRACT.md § 12
 */
import { SbTransport, seg, type SbResult } from './http';
import { DEFAULT_BASE_URL, SignalbirdError } from './types';
import type {
  AddDomainInput,
  AddDomainResult,
  CreateCompanyInput,
  CreateCompanyResult,
  EmbedToken,
  EmbedTokenInput,
  GrantModuleInput,
  ModuleEntitlement,
  PartnerCompany,
  PartnerConfig,
  PartnerDomain,
  PartnerUser,
  PartnerUserInput,
  UptimeRange,
  UptimeReport,
  VerifyDomainResult,
} from './partner-types';

export class SignalbirdPartner {
  private readonly http: SbTransport;

  constructor(config: PartnerConfig) {
    if (!config.domainKey) {
      throw new SignalbirdError('Signalbird: domainKey zorunlu.', 0, 'NO_KEY');
    }
    /*
     * Açık anahtar (`sb_public_live_…`) buraya verilirse her istek 403 döner
     * (`SECRET_KEY_REQUIRED`). Kurulumda söylemek, haftalar sonra bulunacak
     * bir hatayı önler.
     */
    if (!config.domainKey.startsWith('sb_secret_live_')) {
      throw new SignalbirdError(
        'Signalbird: bu istemci GİZLİ domain anahtarı ister (sb_secret_live_…). ' +
          'Açık anahtar (sb_public_live_…) yalnız tarayıcı ve mobil içindir.',
        0,
        'WRONG_KEY_TYPE'
      );
    }

    this.http = new SbTransport({
      domainKey: config.domainKey,
      baseUrl: (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, ''),
      timeout: config.timeout ?? 15000,
      throwOnError: config.throwOnError ?? false,
      debug: config.debug ?? false,
    });
  }

  // ── Müşteri ───────────────────────────────────────────────────────────

  /**
   * Company + takım + owner açar. **Idempotenttir**: aynı `external_id` ile
   * ikinci çağrı yeni kayıt açmaz, `created:false` ile var olanı döner.
   * Anahtarlar (`keys`) yalnız ilk oluşturmada gelir.
   */
  createCompany(input: CreateCompanyInput): Promise<SbResult<CreateCompanyResult>> {
    return this.http.request('POST', '/v1/partner/companies', input);
  }

  listCompanies(query?: { page?: number; q?: string; per_page?: number }): Promise<
    SbResult<{ data: PartnerCompany[]; meta: Record<string, number> }>
  > {
    return this.http.request('GET', '/v1/partner/companies', undefined, query);
  }

  getCompany(externalId: string): Promise<SbResult<{ company: PartnerCompany }>> {
    return this.http.request('GET', `/v1/partner/companies/${seg(externalId)}`);
  }

  updateCompany(
    externalId: string,
    input: { name?: string; is_active?: boolean }
  ): Promise<SbResult<{ company: PartnerCompany }>> {
    return this.http.request('PATCH', `/v1/partner/companies/${seg(externalId)}`, input);
  }

  /** Askıya alır — SİLMEZ. Müşterinin izleme ve mesaj geçmişi durur. */
  suspendCompany(externalId: string): Promise<SbResult<{ company: PartnerCompany }>> {
    return this.http.request('DELETE', `/v1/partner/companies/${seg(externalId)}`);
  }

  rotateKey(externalId: string, type: 'api' | 'app'): Promise<SbResult<{ type: string; key: string }>> {
    return this.http.request('POST', `/v1/partner/companies/${seg(externalId)}/keys/rotate`, { type });
  }

  // ── Domain ────────────────────────────────────────────────────────────

  /**
   * Domain ekler ve (istenirse) izlemeye alır. Kayıt `verified_via:'partner'`
   * ile doğar: izleme, sohbet ve push için yeter — **e-posta/SMS kampanyası
   * için TXT şarttır**. Yanıttaki `dns` kaydını yayınlayıp `verifyDomain`
   * çağırmak kapıyı açar.
   */
  addDomain(companyExternalId: string, input: AddDomainInput): Promise<SbResult<AddDomainResult>> {
    return this.http.request('POST', `/v1/partner/companies/${seg(companyExternalId)}/domains`, input);
  }

  listDomains(companyExternalId: string): Promise<SbResult<{ data: PartnerDomain[] }>> {
    return this.http.request('GET', `/v1/partner/companies/${seg(companyExternalId)}/domains`);
  }

  getDomain(externalId: string): Promise<SbResult<{ domain: PartnerDomain }>> {
    return this.http.request('GET', `/v1/partner/domains/${seg(externalId)}`);
  }

  /** TXT'yi hemen sorgular; eşleşirse domain kampanya kapısından geçer olur. */
  verifyDomain(externalId: string): Promise<SbResult<VerifyDomainResult>> {
    return this.http.request('POST', `/v1/partner/domains/${seg(externalId)}/verify`);
  }

  removeDomain(externalId: string): Promise<SbResult<{ deleted: boolean }>> {
    return this.http.request('DELETE', `/v1/partner/domains/${seg(externalId)}`);
  }

  domainUptime(externalId: string, range: UptimeRange = '24h'): Promise<SbResult<UptimeReport>> {
    return this.http.request('GET', `/v1/partner/domains/${seg(externalId)}/uptime`, undefined, { range });
  }

  /** Tek istekte müşterinin tüm domainleri — liste ekranı N+1 atmasın. */
  companyUptime(
    companyExternalId: string,
    range: UptimeRange = '24h'
  ): Promise<SbResult<{ range: string; data: UptimeReport[] }>> {
    return this.http.request(
      'GET',
      `/v1/partner/companies/${seg(companyExternalId)}/uptime`,
      undefined,
      { range }
    );
  }

  // ── Mesaj günlüğü ─────────────────────────────────────────────────────
  //
  // Salt okur; alıcı maskeli, gövde yok (MESSAGING_UNIFICATION §5.1).

  listMessages(
    companyExternalId: string,
    query: Record<string, string | number | undefined> = {}
  ): Promise<SbResult<unknown>> {
    return this.http.request(
      'GET',
      `/v1/partner/companies/${seg(companyExternalId)}/messages`,
      undefined,
      query
    );
  }

  getMessage(companyExternalId: string, messageId: string): Promise<SbResult<unknown>> {
    return this.http.request(
      'GET',
      `/v1/partner/companies/${seg(companyExternalId)}/messages/${seg(messageId)}`
    );
  }

  messageSummary(companyExternalId: string, range = '7d'): Promise<SbResult<unknown>> {
    return this.http.request(
      'GET',
      `/v1/partner/companies/${seg(companyExternalId)}/message-summary`,
      undefined,
      { range }
    );
  }

  // ── Modül yetkisi ─────────────────────────────────────────────────────

  listModules(companyExternalId: string): Promise<SbResult<{ data: ModuleEntitlement[] }>> {
    return this.http.request('GET', `/v1/partner/companies/${seg(companyExternalId)}/modules`);
  }

  /** "Bu müşteri şu modül için ödeme yaptı, kullanabilir." */
  grantModule(companyExternalId: string, input: GrantModuleInput): Promise<SbResult<ModuleEntitlement>> {
    return this.http.request('POST', `/v1/partner/companies/${seg(companyExternalId)}/modules`, input);
  }

  /** Yalnız partner'ın KENDİ verdiği hakkı geri alır; plan hakkına dokunmaz. */
  revokeModule(companyExternalId: string, module: string): Promise<SbResult<{ removed: boolean }>> {
    return this.http.request(
      'DELETE',
      `/v1/partner/companies/${seg(companyExternalId)}/modules/${seg(module)}`
    );
  }

  // ── Kullanıcı ─────────────────────────────────────────────────────────

  createUser(
    companyExternalId: string,
    input: PartnerUserInput
  ): Promise<SbResult<{ created: boolean; user: PartnerUser }>> {
    return this.http.request('POST', `/v1/partner/companies/${seg(companyExternalId)}/users`, input);
  }

  listUsers(companyExternalId: string): Promise<SbResult<{ data: PartnerUser[] }>> {
    return this.http.request('GET', `/v1/partner/companies/${seg(companyExternalId)}/users`);
  }

  /** Üyeliği kaldırır, kişinin Signalbird hesabını SİLMEZ. */
  removeUser(companyExternalId: string, userExternalId: string): Promise<SbResult<{ removed: boolean }>> {
    return this.http.request(
      'DELETE',
      `/v1/partner/companies/${seg(companyExternalId)}/users/${seg(userExternalId)}`
    );
  }

  // ── Gömme ─────────────────────────────────────────────────────────────

  /**
   * Panel ekranını partner sayfasına gömmek için kısa ömürlü jeton üretir.
   * 120 saniye yaşar ve TEK KULLANIMLIKTIR — jeton URL'de gider, log ve
   * `Referer` başlığına düşer.
   */
  createEmbedToken(companyExternalId: string, input: EmbedTokenInput): Promise<SbResult<EmbedToken>> {
    return this.http.request('POST', `/v1/partner/companies/${seg(companyExternalId)}/embed`, input);
  }
}
