import { container } from 'tsyringe'

import { AuthConfig } from './auth/auth.config.js'
import { LinkedInMcpServer } from './server.js'
import { ClientService } from './services/client.service.js'
import { LoggerService } from './services/logger.service.js'
import { MetricsService } from './services/metrics.service.js'
import { TokenService } from './services/token.service.js'

export function setupContainer(): void {
  container.registerSingleton(LoggerService)
  container.registerSingleton(AuthConfig)
  container.registerSingleton(MetricsService)
  container.registerSingleton(ClientService)
  container.registerSingleton(LinkedInMcpServer)
  container.register(TokenService, { useClass: TokenService })
}
