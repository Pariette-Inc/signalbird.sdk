import axios from 'axios';

// src/node/client.ts

// src/node/types.ts
var SignalbirdError = class extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "SignalbirdError";
  }
};
var API_URLS = {
  production: "https://live.signalbird.io/api",
  test: "http://localhost/api"
};

// src/node/client.ts
var SignalbirdClient = class {
  constructor(config) {
    this.apiKey = config.apiKey;
    const baseURL = API_URLS[config.mode ?? "production"];
    this.http = axios.create({
      baseURL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      timeout: config.timeout ?? 1e4
    });
    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const data = error.response.data;
          throw new SignalbirdError(
            data?.message || error.message,
            error.response.status,
            data
          );
        }
        throw new SignalbirdError(error.message, 0);
      }
    );
  }
  async trigger(title, message, level) {
    const response = await this.http.post(
      `/sdk/log/${this.apiKey}`,
      { title, message, level }
    );
    return response.data;
  }
};

// src/node/signalbird.ts
var Signalbird = class {
  constructor(config) {
    this.client = new SignalbirdClient(config);
  }
  /** Bilgilendirme bildirimi gönder */
  info(payload) {
    return this.client.trigger(payload.title, payload.message, "info");
  }
  /** Uyarı bildirimi gönder */
  warn(payload) {
    return this.client.trigger(payload.title, payload.message, "warn");
  }
  /** Hata bildirimi gönder */
  error(payload) {
    return this.client.trigger(payload.title, payload.message, "error");
  }
  /** Kritik hata bildirimi gönder (acil bildirim) */
  critical(payload) {
    return this.client.trigger(payload.title, payload.message, "critical");
  }
  /** Onay/başarı bildirimi gönder */
  confirm(payload) {
    return this.client.trigger(payload.title, payload.message, "confirm");
  }
  /** Debug bildirimi gönder */
  debug(payload) {
    return this.client.trigger(payload.title, payload.message, "debug");
  }
  /** Özel seviyede bildirim gönder */
  send(payload) {
    return this.client.trigger(payload.title, payload.message, payload.level);
  }
};

export { Signalbird, SignalbirdClient, SignalbirdError };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map