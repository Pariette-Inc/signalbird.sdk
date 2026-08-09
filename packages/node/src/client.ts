import axios, { AxiosInstance } from 'axios'
import { SignalbirdConfig, API_URLS, TriggerResponse, SignalbirdError } from './types'

export class SignalbirdClient {
  private http: AxiosInstance
  readonly apiKey: string

  constructor(config: SignalbirdConfig) {
    this.apiKey = config.apiKey
    const baseURL = API_URLS[config.mode ?? 'production']

    this.http = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: config.timeout ?? 10000,
    })

    this.http.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          const data = error.response.data
          throw new SignalbirdError(
            data?.message || error.message,
            error.response.status,
            data
          )
        }
        throw new SignalbirdError(error.message, 0)
      }
    )
  }

  async trigger(title: string, message: string, level: string): Promise<TriggerResponse> {
    const response = await this.http.post<TriggerResponse>(
      `/sdk/log/${this.apiKey}`,
      { title, message, level }
    )
    return response.data
  }
}
