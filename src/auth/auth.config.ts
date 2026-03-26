import { envSchema } from '../schemas/env.schema.js'
import { inject, injectable } from 'tsyringe'
import { z } from 'zod'
import { LoggerService } from '../services/logger.service.js'

/**
 * AuthConfig - Authentication configuration management
 *
 * Manages and validates the credentials required for LinkedIn API authentication.
 * Loads environment variables and ensures all required credentials are present.
 *
 * @example
 * ```typescript
 * // Inject the config
 * constructor(@inject(AuthConfig) private config: AuthConfig) {}
 *
 * // Usage
 * const clientId = this.config.getClientId();
 * const authUrl = this.config.getAuthUrl();
 * ```
 */
@injectable()
export class AuthConfig {
  private readonly authUrl: string = 'https://www.linkedin.com/oauth/v2'
  private readonly clientId?: string
  private readonly clientSecret?: string
  private readonly configurationValidationSchema = envSchema

  constructor(@inject(LoggerService) private readonly logger: LoggerService) {
    const env = this.validateEnvironment()
    this.clientId = env.LINKEDIN_CLIENT_ID
    this.clientSecret = env.LINKEDIN_CLIENT_SECRET
    this.logger.debug('Authentication configuration loaded successfully')
  }

  /**
   * Gets the client ID for authentication
   * @returns The LinkedIn API client ID (undefined if using pre-existing tokens)
   */
  public getClientId(): string | undefined {
    return this.clientId
  }

  /**
   * Gets the client secret for authentication
   * @returns The LinkedIn API client secret (undefined if using pre-existing tokens)
   */
  public getClientSecret(): string | undefined {
    return this.clientSecret
  }

  /**
   * Gets the authentication URL
   * @returns The LinkedIn OAuth authentication endpoint URL
   */
  public getAuthUrl(): string {
    return this.authUrl
  }

  /**
   * Validates all environment variables using Zod schema
   * @returns Object containing validated environment variables
   * @throws Error if validation fails
   */
  private validateEnvironment(): z.infer<typeof this.configurationValidationSchema> {
    try {
      return this.configurationValidationSchema.parse(process.env)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.errors.map((err) => `${err.path.join('.')}: ${err.message}`).join(', ')
        this.logger.error(`Environment validation failed: ${errorDetails}`)
        throw new Error(`Missing or invalid environment variables: ${errorDetails}`)
      }
      this.logger.error('Unexpected error validating environment variables', error)
      throw new Error('Error validating environment variables')
    }
  }
}
