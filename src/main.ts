import 'reflect-metadata'
// ensure reflect-metadata is loaded before any other imports
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { container } from 'tsyringe'

import { setupContainer } from './container.js'
import { setupShutdownHandlers } from './utils/shutdown.utils.js'
import { LinkedInMcpServer } from './server.js'
import { LoggerService } from './services/logger.service.js'

/**
 * Application entry point
 */
async function main(): Promise<void> {
  try {
    setupContainer()
    const logger = container.resolve(LoggerService)

    logger.info(`LinkedIn MCP Server starting`, {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV ?? 'development'
    })

    const server = container.resolve(LinkedInMcpServer)
    setupShutdownHandlers(server, logger)
    const transport = new StdioServerTransport()



    await server.start(transport)
  } catch (error) {
    const logger = container.isRegistered(LoggerService) ? container.resolve(LoggerService) : console
    logger.error('Fatal error during startup', error)
    process.exit(1)
  }
}

// Run the application
main()
