import pino, { type Logger, type Bindings } from 'pino'
import { injectable, singleton } from 'tsyringe'
import { ILogger } from '../types/logger.js'

/**
 * LoggerService - Centralized logging service using Pino
 *
 * Provides structured logging capabilities for the application with different
 * log levels and formatted output. Uses singleton pattern to ensure a single
 * logger instance across the application.
 *
 * @example
 * ```typescript
 * // In a service that needs logging
 * constructor(@inject(LoggerService) private logger: LoggerService) {}
 *
 * // Usage
 * this.logger.info('Operation completed successfully');
 * this.logger.error('Failed to process request', error);
 * ```
 */
@injectable()
@singleton()
export class LoggerService implements ILogger {
  private logger: Logger

  constructor() {
    this.logger = pino({
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      },
      level: process.env.LOG_LEVEL ?? 'info'
    })
  }

  /** @inheritdoc */
  public trace(message: string, obj?: object): void {
    this.logger.trace(obj ?? {}, message)
  }

  /** @inheritdoc */
  public debug(message: string, obj?: object): void {
    this.logger.debug(obj ?? {}, message)
  }

  /** @inheritdoc */
  public info(message: string, obj?: object): void {
    this.logger.info(obj ?? {}, message)
  }

  /** @inheritdoc */
  public warn(message: string, obj?: object): void {
    this.logger.warn(obj ?? {}, message)
  }

  /** @inheritdoc */
  public error(message: string, error?: unknown): void {
    if (error instanceof Error) {
      this.logger.error({ err: error }, message)
    } else {
      this.logger.error(error ?? {}, message)
    }
  }

  /** @inheritdoc */
  public child(bindings: Bindings): LoggerService {
    const childService = new LoggerService()
    childService.logger = this.logger.child(bindings)
    return childService
  }
}
