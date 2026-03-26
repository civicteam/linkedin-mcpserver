import { injectable, singleton } from 'tsyringe'
import { DetailedMetrics, MetricCategory, MetricData } from '../types/metrics.js'

/**
 * MetricsService - Collects and analyzes application performance metrics
 *
 * Tracks API request/response times, calculates statistical metrics,
 * and provides insights into system performance by category.
 */
@injectable()
@singleton()
export class MetricsService {
  private readonly DEFAULT_HISTORY_SIZE = 100
  private readonly requestCounts: Record<MetricCategory, number> = {
    search: 0,
    profile: 0,
    job: 0,
    message: 0,
    connection: 0,
    auth: 0,
    other: 0
  }

  private readonly lastRequestTimestamps: Record<MetricCategory, number | null> = {
    search: null,
    profile: null,
    job: null,
    message: null,
    connection: null,
    auth: null,
    other: null
  }

  private readonly responseTimes: Record<MetricCategory, number[]> = {
    search: [],
    profile: [],
    job: [],
    message: [],
    connection: [],
    auth: [],
    other: []
  }

  private readonly categoryMapping: Record<string, MetricCategory> = {
    '/search/people': 'search',
    '/people': 'profile',
    '/jobs': 'job',
    '/messages': 'message',
    '/connections': 'connection',
    '/me': 'profile',
    '/networkSizes': 'connection',
    '/auth': 'auth'
  }

  /**
   * Records a completed request with its response time
   *
   * @param endpoint - The API endpoint that was called
   * @param responseTimeMs - The time taken to complete the request in milliseconds
   */
  public recordRequest(endpoint: string, responseTimeMs: number): void {
    const category = this.getCategoryFromEndpoint(endpoint)
    this.requestCounts[category]++
    this.lastRequestTimestamps[category] = Date.now()
    this.responseTimes[category].push(responseTimeMs)
    if (this.responseTimes[category].length > this.DEFAULT_HISTORY_SIZE) {
      this.responseTimes[category].shift()
    }
  }

  /**
   * Gets metrics for a specific category
   *
   * @param category - The category to get metrics for
   * @returns Metrics data for the specified category
   */
  public getMetricsForCategory(category: MetricCategory): MetricData {
    const times = this.responseTimes[category]
    if (times.length === 0) {
      return {
        requestCount: this.requestCounts[category],
        lastRequestTimestamp: this.lastRequestTimestamps[category],
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p90ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0
      }
    }
    const sortedTimes = [...times].sort((a, b) => a - b)
    return {
      requestCount: this.requestCounts[category],
      lastRequestTimestamp: this.lastRequestTimestamps[category],
      averageResponseTime: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
      p50ResponseTime: this.getPercentile(sortedTimes, 50),
      p90ResponseTime: this.getPercentile(sortedTimes, 90),
      p95ResponseTime: this.getPercentile(sortedTimes, 95),
      p99ResponseTime: this.getPercentile(sortedTimes, 99),
      minResponseTime: sortedTimes[0],
      maxResponseTime: sortedTimes[sortedTimes.length - 1]
    }
  }

  /**
   * Gets complete metrics for all categories
   *
   * @returns Detailed metrics for all request categories
   */
  public getDetailedMetrics(): DetailedMetrics {
    const allTimes: number[] = Object.values(this.responseTimes).flat()
    const sortedAllTimes = [...allTimes].sort((a, b) => a - b)
    const totalRequests = Object.values(this.requestCounts).reduce((sum, count) => sum + count, 0)
    const lastTimestamp = Math.max(
      ...Object.values(this.lastRequestTimestamps).filter((timestamp): timestamp is number => timestamp !== null)
    )

    const overall: MetricData =
      allTimes.length > 0
        ? {
            requestCount: totalRequests,
            lastRequestTimestamp: lastTimestamp || null,
            averageResponseTime: Math.round(allTimes.reduce((sum, time) => sum + time, 0) / allTimes.length),
            p50ResponseTime: this.getPercentile(sortedAllTimes, 50),
            p90ResponseTime: this.getPercentile(sortedAllTimes, 90),
            p95ResponseTime: this.getPercentile(sortedAllTimes, 95),
            p99ResponseTime: this.getPercentile(sortedAllTimes, 99),
            minResponseTime: sortedAllTimes[0],
            maxResponseTime: sortedAllTimes[sortedAllTimes.length - 1]
          }
        : {
            requestCount: totalRequests,
            lastRequestTimestamp: totalRequests > 0 ? lastTimestamp || null : null,
            averageResponseTime: 0,
            p50ResponseTime: 0,
            p90ResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            minResponseTime: 0,
            maxResponseTime: 0
          }

    const byCategory: Record<MetricCategory, MetricData> = {
      search: this.getMetricsForCategory('search'),
      profile: this.getMetricsForCategory('profile'),
      job: this.getMetricsForCategory('job'),
      message: this.getMetricsForCategory('message'),
      connection: this.getMetricsForCategory('connection'),
      auth: this.getMetricsForCategory('auth'),
      other: this.getMetricsForCategory('other')
    }
    return { overall, byCategory }
  }

  /**
   * Resets all metrics to their initial state
   */
  public resetMetrics(): void {
    Object.keys(this.requestCounts).forEach((category) => {
      this.requestCounts[category as MetricCategory] = 0
      this.lastRequestTimestamps[category as MetricCategory] = null
      this.responseTimes[category as MetricCategory] = []
    })
  }

  /**
   * Identifies the appropriate category for an endpoint
   *
   * @param endpoint - The API endpoint
   * @returns The matched category
   */
  private getCategoryFromEndpoint(endpoint: string): MetricCategory {
    const matchingPrefix = Object.keys(this.categoryMapping)
      .filter((prefix) => endpoint.startsWith(prefix))
      .sort((a, b) => b.length - a.length)[0]
    return matchingPrefix ? this.categoryMapping[matchingPrefix] : 'other'
  }

  /**
   * Calculates percentile value from sorted array
   *
   * @param sortedValues - Array of values sorted in ascending order
   * @param percentile - Percentile to calculate (0-100)
   * @returns The value at the specified percentile
   */
  private getPercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0
    if (sortedValues.length === 1) return sortedValues[0]
    const index = (percentile / 100) * (sortedValues.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)

    if (lower === upper) {
      return sortedValues[lower]
    }

    const weight = index - lower
    return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight)
  }
}
