import { z } from 'zod'

export const envSchema = z.object({
  // OAuth credentials - required for token refresh flow
  LINKEDIN_CLIENT_ID: z.string().min(1, { message: 'LINKEDIN_CLIENT_ID cannot be empty' }).optional(),
  LINKEDIN_CLIENT_SECRET: z.string().min(1, { message: 'LINKEDIN_CLIENT_SECRET cannot be empty' }).optional(),

  // OAuth tokens - can be provided directly to skip OAuth flow
  ACCESS_TOKEN: z.string().optional(),
  REFRESH_TOKEN: z.string().optional(),
  ACCESS_TOKEN_EXPIRES_IN: z.string().optional()
}).refine(
  (data) => {
    // Either provide ACCESS_TOKEN OR both client credentials
    const hasToken = !!data.ACCESS_TOKEN
    const hasCredentials = !!(data.LINKEDIN_CLIENT_ID && data.LINKEDIN_CLIENT_SECRET)
    return hasToken || hasCredentials
  },
  {
    message: 'Either ACCESS_TOKEN or both LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be provided'
  }
)
