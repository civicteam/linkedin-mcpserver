import { inject, injectable } from 'tsyringe'
import { RestliClient, type RestliEntity } from 'linkedin-api-client'
import axios, { type AxiosInstance } from 'axios'

import { LoggerService } from './logger.service.js'
import { MetricsService } from './metrics.service.js'
import { TokenService } from './token.service.js'

import type {
  AssetRegistrationRequest,
  AssetRegistrationResponse,
  ClientMetrics,
  ConnectionsResult,
  CreateArticleShareParams,
  CreateImageShareParams,
  CreateTextPostParams,
  GetProfileParams,
  LinkedInProfile,
  MessageResponse,
  NetworkStats,
  SearchJobsParams,
  SearchJobsResult,
  SearchPeopleParams,
  SearchPeopleResult,
  SendMessageParams,
  ShareResponse
} from '../types/linkedin.js'
import type { DetailedMetrics } from '../types/metrics.js'

/**
 * ClientService - Manages the communication with LinkedIn API
 *
 * Provides access to LinkedIn API endpoints for searching people,
 * profiles, jobs and sending messages.
 */
@injectable()
export class ClientService {
  private restliClient: RestliClient
  private axiosClient: AxiosInstance

  constructor(
    @inject(TokenService) private readonly tokenService: TokenService,
    @inject(LoggerService) private readonly loggerService: LoggerService,
    @inject(MetricsService) private readonly metricsService: MetricsService
  ) {
    this.restliClient = new RestliClient()
    this.axiosClient = axios.create({
      baseURL: 'https://api.linkedin.com'
    })
  }

  /**
   * Makes an authenticated request to the LinkedIn API using RestliClient
   *
   * @param method - HTTP method (get, finder, create, update)
   * @param resourcePath - API resource path
   * @param params - Optional query parameters
   * @param data - Optional data to send with the request
   * @returns Typed API result
   */
  private async makeRequest<T, D = RestliEntity>(method: 'get' | 'finder' | 'create' | 'update', resourcePath: string, params?: Record<string, any>, data?: D): Promise<T> {
    try {
      const startTime = Date.now()
      await this.tokenService.authenticate()
      const accessToken = this.tokenService.getAccessToken()

      let response: any
      
      switch (method) {
        case 'get':
          response = await this.restliClient.get({
            resourcePath,
            accessToken
          })
          break
        case 'finder':
          response = await this.restliClient.finder({
            resourcePath,
            finderName: params?.finderName || 'search',
            queryParams: params?.queryParams || {},
            accessToken
          })
          break
        case 'create':
          response = await this.restliClient.create({
            resourcePath,
            entity: data!,
            accessToken
          })
          break
        case 'update':
          response = await this.restliClient.update({
            resourcePath,
            id: params?.id,
            entity: data!,
            accessToken
          })
          break
      }

      const responseTime = Date.now() - startTime
      this.metricsService.recordRequest(resourcePath, responseTime)
      this.loggerService.info(`Successful request to ${resourcePath}`)
      return response.data as T
    } catch (error) {
      this.handleRequestError(error, resourcePath)
      throw error
    }
  }

  /**
   * Handles and logs request errors
   *
   * @param error - Error object
   * @param endpoint - API endpoint that failed
   */
  private handleRequestError(error: unknown, endpoint: string): void {
    if (error instanceof Error) {
      this.loggerService.error(`Request failed for ${endpoint}: ${error.message}`, error)
    } else {
      this.loggerService.error(`Unexpected error accessing ${endpoint}`, error)
    }
  }

  /**
   * Searches for people on LinkedIn with advanced filters
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval (3-6 month review, <10% approval rate)
   *
   * @param params - Search parameters
   * @returns People search results
   */
  public async searchPeople(params: SearchPeopleParams): Promise<SearchPeopleResult> {
    const queryParams: Record<string, any> = {}
    
    if (params.keywords) queryParams.keywords = params.keywords
    if (params.location) queryParams.location = params.location
    if (params.currentCompany?.length) queryParams['current-company'] = params.currentCompany
    if (params.industries?.length) queryParams['facet-industry'] = params.industries

    return this.makeRequest<SearchPeopleResult>('finder', '/people', {
      finderName: 'search',
      queryParams
    })
  }

  /**
   * Gets a LinkedIn profile by public ID or URN ID
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval
   *
   * @param params - Profile search parameters
   * @returns LinkedIn profile
   */
  public async getProfile(params: GetProfileParams): Promise<LinkedInProfile> {
    if (!params.publicId && !params.urnId) {
      throw new Error('Either publicId or urnId must be provided')
    }

    const resourcePath = params.urnId ? `/people/${encodeURIComponent(params.urnId)}` : `/people/${params.publicId}`

    return this.makeRequest<LinkedInProfile>('get', resourcePath)
  }

  /**
   * Searches for jobs on LinkedIn with advanced filters
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval
   *
   * @param params - Job search parameters
   * @returns Job search results
   */
  public async searchJobs(params: SearchJobsParams): Promise<SearchJobsResult> {
    const queryParams: Record<string, any> = {}
    
    if (params.keywords) queryParams.keywords = params.keywords
    if (params.location) queryParams.location = params.location
    if (params.companies?.length) queryParams['company-name'] = params.companies
    if (params.jobType?.length) queryParams['job-type'] = params.jobType

    return this.makeRequest<SearchJobsResult>('finder', '/jobs', {
      finderName: 'search',
      queryParams
    })
  }


  /**
   * Sends a message to a LinkedIn connection
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval
   *
   * @param params - Message parameters
   * @returns Confirmation response
   */
  public async sendMessage(params: SendMessageParams): Promise<MessageResponse> {
    const messageData = {
      recipients: {
        person: params.recipientUrn
      },
      subject: params.subject,
      body: params.messageBody,
      messageType: 'INMAIL'
    }
    return this.makeRequest<MessageResponse>('create', '/messages', undefined, messageData)
  }

  /**
   * Gets the current user's LinkedIn profile using OpenID Connect userinfo endpoint
   *
   * @returns Current user profile
   */
  public async getMyProfile(): Promise<LinkedInProfile> {
    try {
      await this.tokenService.authenticate()
      const accessToken = this.tokenService.getAccessToken()

      const response = await this.axiosClient.get<{
        sub: string
        given_name: string
        family_name: string
        name?: string
        picture?: string
        email?: string
        email_verified?: boolean
        locale?: string
      }>('/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      })

      // Map OpenID Connect userinfo response to LinkedInProfile format
      return {
        id: response.data.sub,
        firstName: response.data.given_name,
        lastName: response.data.family_name,
        profilePicture: response.data.picture
          ? {
              displayImage: response.data.picture
            }
          : undefined
      }
    } catch (error) {
      this.loggerService.error('Failed to get profile via userinfo endpoint', error)
      throw error
    }
  }

  /**
   * Gets network statistics for the current user
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval and r_1st_connections_size scope
   *
   * @returns Network statistics
   */
  public async getNetworkStats(): Promise<NetworkStats> {
    return this.makeRequest<NetworkStats>('get', '/networkSizes/~')
  }

  /**
   * Gets the user's LinkedIn connections
   *
   * **REQUIRES LINKEDIN PARTNER API ACCESS**
   * This endpoint requires Partner Program approval and r_1st_connections_size scope
   *
   * @returns List of connections
   */
  public async getConnections(): Promise<ConnectionsResult> {
    return this.makeRequest<ConnectionsResult>('finder', '/connections', {
      finderName: 'connections',
      queryParams: { start: 0, count: 100 }
    })
  }

  /**
   * Gets API request metrics and performance
   *
   * @returns Detailed metrics about API usage
   */
  public getMetrics(): DetailedMetrics {
    return this.metricsService.getDetailedMetrics()
  }

  /**
   * Gets basic client metrics for backward compatibility
   *
   * @returns Basic client metrics
   * @deprecated Use getDetailedMetrics() instead
   */
  public getBasicMetrics(): ClientMetrics {
    const metrics = this.metricsService.getDetailedMetrics().overall
    return {
      requestCount: metrics.requestCount,
      lastRequestTimestamp: metrics.lastRequestTimestamp,
      averageRequestTime: metrics.averageResponseTime
    }
  }

  /**
   * Gets the author URN for the authenticated user
   * Required for creating posts
   *
   * @returns Author URN in the format urn:li:person:{id}
   */
  private async getAuthorUrn(): Promise<string> {
    const profile = await this.getMyProfile()
    return `urn:li:person:${profile.id}`
  }

  /**
   * Makes an authenticated request to LinkedIn v2 API using axios
   * Used for Share API endpoints
   *
   * @param method - HTTP method
   * @param path - API path
   * @param data - Optional request body
   * @returns Response data
   */
  private async makeV2Request<T>(method: 'get' | 'post', path: string, data?: any): Promise<T> {
    try {
      const startTime = Date.now()
      await this.tokenService.authenticate()
      const accessToken = this.tokenService.getAccessToken()

      const response = await this.axiosClient.request<T>({
        method,
        url: path,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        },
        data
      })

      const responseTime = Date.now() - startTime
      this.metricsService.recordRequest(path, responseTime)
      this.loggerService.info(`Successful v2 request to ${path}`)
      return response.data
    } catch (error) {
      this.handleRequestError(error, path)
      throw error
    }
  }

  /**
   * Creates a text-only post on LinkedIn
   *
   * @param params - Post parameters
   * @returns Share response with post ID
   */
  public async createTextPost(params: CreateTextPostParams): Promise<ShareResponse> {
    const authorUrn = await this.getAuthorUrn()

    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: params.text
          },
          shareMediaCategory: 'NONE'
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'CONNECTIONS'
      }
    }

    const response = await this.makeV2Request<{ id: string }>('post', '/v2/ugcPosts', postData)

    return {
      id: response.id,
      createdAt: Date.now(),
      author: authorUrn
    }
  }

  /**
   * Creates an article share on LinkedIn
   *
   * @param params - Article share parameters
   * @returns Share response with post ID
   */
  public async createArticleShare(params: CreateArticleShareParams): Promise<ShareResponse> {
    const authorUrn = await this.getAuthorUrn()

    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: params.text || ''
          },
          shareMediaCategory: 'ARTICLE',
          media: [
            {
              status: 'READY',
              originalUrl: params.url,
              ...(params.title && {
                title: {
                  text: params.title
                }
              }),
              ...(params.description && {
                description: {
                  text: params.description
                }
              })
            }
          ]
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'CONNECTIONS'
      }
    }

    const response = await this.makeV2Request<{ id: string }>('post', '/v2/ugcPosts', postData)

    return {
      id: response.id,
      createdAt: Date.now(),
      author: authorUrn
    }
  }

  /**
   * Registers an asset for upload (step 1 of image upload)
   *
   * @param authorUrn - Author URN
   * @returns Asset registration response with upload URL
   */
  private async registerAsset(authorUrn: string): Promise<AssetRegistrationResponse> {
    const requestData: AssetRegistrationRequest = {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: authorUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }
        ]
      }
    }

    return this.makeV2Request<AssetRegistrationResponse>(
      'post',
      '/v2/assets?action=registerUpload',
      requestData
    )
  }

  /**
   * Uploads image binary to LinkedIn (step 2 of image upload)
   *
   * @param uploadUrl - Upload URL from asset registration
   * @param imageUrl - Public URL of the image to download and upload
   */
  private async uploadAsset(uploadUrl: string, imageUrl: string): Promise<void> {
    try {
      // Download the image
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' })
      const imageData = imageResponse.data

      // Upload to LinkedIn
      await axios.put(uploadUrl, imageData, {
        headers: {
          'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg'
        }
      })

      this.loggerService.info('Successfully uploaded image to LinkedIn')
    } catch (error) {
      this.loggerService.error('Failed to upload image', error)
      throw new Error('Image upload failed')
    }
  }

  /**
   * Creates an image share on LinkedIn
   * Handles the 3-step process: register, upload, share
   *
   * @param params - Image share parameters
   * @returns Share response with post ID
   */
  public async createImageShare(params: CreateImageShareParams): Promise<ShareResponse> {
    const authorUrn = await this.getAuthorUrn()

    // Step 1: Register the asset
    this.loggerService.info('Registering asset for image upload')
    const registration = await this.registerAsset(authorUrn)
    const uploadUrl = registration.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl
    const assetUrn = registration.value.asset

    // Step 2: Upload the image
    this.loggerService.info('Uploading image binary')
    await this.uploadAsset(uploadUrl, params.imageUrl)

    // Step 3: Create the share with the asset
    this.loggerService.info('Creating image share post')
    const postData = {
      author: authorUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: {
            text: params.text || ''
          },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              media: assetUrn
            }
          ]
        }
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'CONNECTIONS'
      }
    }

    const response = await this.makeV2Request<{ id: string }>('post', '/v2/ugcPosts', postData)

    return {
      id: response.id,
      createdAt: Date.now(),
      author: authorUrn
    }
  }
}
