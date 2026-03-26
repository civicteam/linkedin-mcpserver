import axios from 'axios'
import _ from 'lodash'
import { inject, injectable } from 'tsyringe'
import { AuthConfig } from '../auth/auth.config.js'
import { LoggerService } from './logger.service.js'

/**
 * TokenService - Manages authentication tokens for LinkedIn API
 *
 * Responsible for obtaining, refreshing and managing access tokens.
 * Handles token expiration, refresh mechanisms and authentication flows.
 *
 * @example
 * ```typescript
 * // Inject the service
 * constructor(@inject(TokenService) private tokenService: TokenService) {}
 *
 * // Usage
 * await tokenService.authenticate();
 * const token = tokenService.getAccessToken();
 * ```
 */
@injectable()
export class TokenService {
  private accessToken: string | null = process.env.ACCESS_TOKEN || null
  private readonly EXPIRY_THRESHOLD = 5 * 60 * 1000
  private refreshToken: string | null = process.env.REFRESH_TOKEN || null
  private tokenExpiry: number | null = process.env.ACCESS_TOKEN_EXPIRES_IN
    ? Date.now() + parseInt(process.env.ACCESS_TOKEN_EXPIRES_IN) * 1000
    : null

  private readonly getAuthUrl = _.memoize(() => this.config.getAuthUrl())
  private readonly getClientId = _.memoize(() => this.config.getClientId())
  private readonly getClientSecret = _.memoize(() => this.config.getClientSecret())

  constructor(
    @inject(AuthConfig) private readonly config: AuthConfig,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {}

  /**
   * Authenticates with the LinkedIn API
   * If a valid token exists, it's reused; otherwise obtains a new one
   */
  public async authenticate(): Promise<void> {
    if (this.hasValidToken()) {
      this.logger.info('Using existing valid token.')
      return
    }
    await this.fetchToken(this.refreshToken ? 'refresh_token' : 'client_credentials')
  }

  /**
   * Returns the current access token
   * Automatically initiates token refresh if expiring soon
   * @returns The current access token
   * @throws Error if not authenticated
   */
  public getAccessToken(): string {
    if (!this.accessToken) {
      this.logger.warn('Unauthorized token access attempt.')
      throw new Error('Authentication required. Please call authenticate() first.')
    }

    if (this.isTokenExpiringSoon()) {
      this.fetchToken('refresh_token').catch((error) => {
        this.logger.error('Background token refresh failed.', error)
      })
    }
    return this.accessToken
  }

  /**
   * Checks if the current token is valid
   * @returns True if a valid token exists
   */
  private hasValidToken(): boolean {
    return !!(this.accessToken && (this.tokenExpiry ? (Date.now() < this.tokenExpiry) : true))
  }

  /**
   * Checks if the token is close to expiration
   * @returns True if token will expire soon
   */
  private isTokenExpiringSoon(): boolean {
    return this.tokenExpiry ? this.tokenExpiry - Date.now() < this.EXPIRY_THRESHOLD : false
  }

  /**
   * Fetches a new token from the authentication server
   * @param grantType - The OAuth grant type to use
   */
  private async fetchToken(grantType: 'client_credentials' | 'refresh_token'): Promise<void> {
    try {
      const clientId = this.getClientId()
      const clientSecret = this.getClientSecret()

      if (!clientId || !clientSecret) {
        throw new Error('Client credentials not configured. Cannot refresh token without LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.')
      }

      const params: Record<string, string> = {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: grantType
      }

      if (grantType === 'refresh_token') {
        if (!this.refreshToken) throw new Error('No refresh token available.')
        params.refresh_token = this.refreshToken
      }

      const response = await axios.post(`${this.getAuthUrl()}/accessToken`, null, { params })
      this.accessToken = response.data.access_token
      this.refreshToken = response.data.refresh_token ?? this.refreshToken
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000
      this.logger.info('Token successfully obtained.')
    } catch (error) {
      this.logger.error('Token fetch failed.', error)
      this.resetTokens()
      throw new Error(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Resets all token information
   */
  private resetTokens(): void {
    this.accessToken = null
    this.refreshToken = null
    this.tokenExpiry = null
  }
}
