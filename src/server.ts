import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { inject, injectable } from 'tsyringe'

import { linkedinApiSchemas } from './schemas/linkedin.schema.js'
import { ClientService } from './services/client.service.js'
import { LoggerService } from './services/logger.service.js'
import { MarketingService } from './services/marketing.service.js'
import { TokenService } from './services/token.service.js'

import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { McpResourceResponse } from './types/mcp.js'

/**
 * Tool categories that can be enabled/disabled via TOOL_CATEGORIES env var
 *
 * - share: Basic posting tools (get-my-profile, create-text-post, etc.)
 * - partner: Partner API tools (search-people, get-profile, search-jobs, etc.)
 * - marketing: Marketing API tools (ad accounts, campaigns, creatives, analytics)
 * - conversions: Conversions API tools (conversion rules, events)
 * - audiences: Matched Audiences/DMP tools (requires rw_dmp_segments scope)
 */
type ToolCategory = 'share' | 'partner' | 'marketing' | 'conversions' | 'audiences'

const ALL_CATEGORIES: ToolCategory[] = ['share', 'partner', 'marketing', 'conversions', 'audiences']

/**
 * LinkedInMcpServer - Main server class for LinkedIn MCP integration
 *
 * Manages the MCP server lifecycle and registers LinkedIn-related tools
 * for interacting with LinkedIn's API through the Model Context Protocol.
 *
 * Tool categories can be filtered using the TOOL_CATEGORIES environment variable.
 * Set to a comma-separated list of categories to enable only specific tools.
 * Example: TOOL_CATEGORIES=share,marketing
 *
 * If not set, all categories are enabled by default.
 */
@injectable()
export class LinkedInMcpServer {
  private readonly server: McpServer
  private readonly enabledCategories: Set<ToolCategory>

  constructor(
    @inject(ClientService) private readonly clientService: ClientService,
    @inject(MarketingService) private readonly marketingService: MarketingService,
    @inject(TokenService) private readonly tokenService: TokenService,
    @inject(LoggerService) private readonly logger: LoggerService
  ) {
    this.enabledCategories = this.parseToolCategories()
    this.server = new McpServer({
      name: process.env.MCP_SERVER_NAME ?? 'linkedin-mcpserver',
      version: process.env.MCP_SERVER_VERSION ?? '0.1.0',
    })
    this.logger.info('Registering tools for categories', { categories: Array.from(this.enabledCategories) })
    this.registerTools();

    (async () => {
        // test simple request
        await this.ensureAuthenticated()
        const results = await this.clientService.getMyProfile()
        console.error(results)
    })().catch((error:unknown) => {
        this.logger.error('Error during LinkedIn MCP Server initialization', error)
        throw error
    })
  }

  /**
   * Start the server with the given transport
   *
   * @param transport - Transport mechanism for server communication
   */
  public async start(transport: StdioServerTransport): Promise<void> {
    this.logger.info('Starting LinkedIn MCP Server')
    try {
      // Connect to MCP transport without authentication
      // Authentication will happen lazily on first API call
      await this.server.connect(transport)
      this.logger.info('LinkedIn MCP Server started successfully')
    } catch (error) {
      this.logger.error('Failed to start LinkedIn MCP Server', error)
      throw error
    }
  }

  /**
   * Stop the server and clean up resources
   */
  public async stop(): Promise<void> {
    this.logger.info('Stopping LinkedIn MCP Server')
    await this.server.close()
    this.logger.info('LinkedIn MCP Server stopped')
  }

  /**
   * Ensures authentication before API calls
   * Implements lazy authentication pattern
   */
  private async ensureAuthenticated(): Promise<void> {
    try {
      await this.tokenService.authenticate()
    } catch (error) {
      this.logger.error('LinkedIn authentication failed', error)
      throw new Error(`LinkedIn authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Parses the TOOL_CATEGORIES environment variable
   * Returns a Set of enabled categories, defaulting to all if not set
   */
  private parseToolCategories(): Set<ToolCategory> {
    const envValue = process.env.TOOL_CATEGORIES?.trim()

    if (!envValue) {
      return new Set(ALL_CATEGORIES)
    }

    const categories = envValue
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter((c): c is ToolCategory => ALL_CATEGORIES.includes(c as ToolCategory))

    if (categories.length === 0) {
      this.logger.warn('No valid TOOL_CATEGORIES found, enabling all categories', {
        provided: envValue,
        valid: ALL_CATEGORIES
      })
      return new Set(ALL_CATEGORIES)
    }

    return new Set(categories)
  }

  /**
   * Checks if a tool category is enabled
   */
  private isCategoryEnabled(category: ToolCategory): boolean {
    return this.enabledCategories.has(category)
  }

  /**
   * Register MCP tools for LinkedIn API interactions
   * Implements tool definitions for various LinkedIn data operations
   * Only registers tools for enabled categories (via TOOL_CATEGORIES env var)
   */
  private registerTools(): void {
    // ===== Partner API Tools (Requires Partner Program Membership) =====
    if (this.isCategoryEnabled('partner')) {
      // Search People Tool
      this.server.tool(
        'search-people',
        'Search for LinkedIn profiles based on various criteria',
        linkedinApiSchemas.searchPeople,
        async (params) => {
          this.logger.info('Executing LinkedIn People Search', { keywords: params.keywords })
          try {
            await this.ensureAuthenticated()
            const results = await this.clientService.searchPeople(params)
            return this.createResourceResponse(results)
          } catch (error) {
            this.logger.error('LinkedIn People Search Failed', error)
            throw error
          }
        }
      )

      // Get Profile Tool
      this.server.tool(
        'get-profile',
        'Retrieve detailed LinkedIn profile information',
        linkedinApiSchemas.getProfile,
        async (params) => {
          this.logger.info('Retrieving LinkedIn Profile', {
            publicId: params.publicId,
            urnId: params.urnId
          })
          try {
            await this.ensureAuthenticated()
            const profile = await this.clientService.getProfile(params)
            return this.createResourceResponse(profile)
          } catch (error) {
            this.logger.error('LinkedIn Profile Retrieval Failed', error)
            throw error
          }
        }
      )

      // Search Jobs Tool
      this.server.tool(
        'search-jobs',
        'Search for LinkedIn job postings based on various criteria',
        linkedinApiSchemas.searchJobs,
        async (params) => {
          this.logger.info('Executing LinkedIn Job Search', {
            keywords: params.keywords,
            location: params.location
          })
          try {
            await this.ensureAuthenticated()
            const jobs = await this.clientService.searchJobs(params)
            return this.createResourceResponse(jobs)
          } catch (error) {
            this.logger.error('LinkedIn Job Search Failed', error)
            throw error
          }
        }
      )

      // Send Message Tool
      this.server.tool(
        'send-message',
        'Send a message to a LinkedIn connection',
        linkedinApiSchemas.sendMessage,
        async (params) => {
          this.logger.info('Sending LinkedIn Message', {
            recipientUrn: params.recipientUrn
          })
          try {
            await this.ensureAuthenticated()
            const result = await this.clientService.sendMessage(params)
            return this.createResourceResponse(result)
          } catch (error) {
            this.logger.error('LinkedIn Message Sending Failed', error)
            throw error
          }
        }
      )

      // Get Network Statistics Tool
      this.server.tool(
        'get-network-stats',
        'Retrieve network statistics for the current user',
        linkedinApiSchemas.emptyParams,
        async () => {
          this.logger.info('Retrieving Network Statistics')
          try {
            await this.ensureAuthenticated()
            const stats = await this.clientService.getNetworkStats()
            return this.createResourceResponse(stats)
          } catch (error) {
            this.logger.error('Network Statistics Retrieval Failed', error)
            throw error
          }
        }
      )

      // Get Connections Tool
      this.server.tool(
        'get-connections',
        'Retrieve the current user connections',
        linkedinApiSchemas.emptyParams,
        async () => {
          this.logger.info('Retrieving User Connections')
          try {
            await this.ensureAuthenticated()
            const connections = await this.clientService.getConnections()
            return this.createResourceResponse(connections)
          } catch (error) {
            this.logger.error('User Connections Retrieval Failed', error)
            throw error
          }
        }
      )
    }

    // ===== Share API Tools (Standard OAuth) =====
    if (this.isCategoryEnabled('share')) {
      // Get My Profile Tool
      this.server.tool(
        'get-my-profile',
        "Retrieve the current user's LinkedIn profile information",
        linkedinApiSchemas.emptyParams,
        async () => {
          this.logger.info('Retrieving Current User Profile')
          try {
            await this.ensureAuthenticated()
            const profile = await this.clientService.getMyProfile()
            return this.createResourceResponse(profile)
          } catch (error) {
            this.logger.error('Current User Profile Retrieval Failed', error)
            throw error
          }
        }
      )

      // Create Text Post Tool
      this.server.tool(
        'create-text-post',
        'Create a text-only post on LinkedIn',
        linkedinApiSchemas.createTextPost,
        async (params) => {
          this.logger.info('Creating LinkedIn Text Post')
          try {
            await this.ensureAuthenticated()
            const result = await this.clientService.createTextPost(params)
            return this.createResourceResponse(result)
          } catch (error) {
            this.logger.error('LinkedIn Text Post Creation Failed', error)
            throw error
          }
        }
      )

      // Create Article Share Tool
      this.server.tool(
        'create-article-share',
        'Share an article/URL on LinkedIn with optional commentary',
        linkedinApiSchemas.createArticleShare,
        async (params) => {
          this.logger.info('Creating LinkedIn Article Share', { url: params.url })
          try {
            await this.ensureAuthenticated()
            const result = await this.clientService.createArticleShare(params)
            return this.createResourceResponse(result)
          } catch (error) {
            this.logger.error('LinkedIn Article Share Creation Failed', error)
            throw error
          }
        }
      )

      // Create Image Share Tool
      this.server.tool(
        'create-image-share',
        'Share an image on LinkedIn with optional commentary',
        linkedinApiSchemas.createImageShare,
        async (params) => {
          this.logger.info('Creating LinkedIn Image Share', { imageUrl: params.imageUrl })
          try {
            await this.ensureAuthenticated()
            const result = await this.clientService.createImageShare(params)
            return this.createResourceResponse(result)
          } catch (error) {
            this.logger.error('LinkedIn Image Share Creation Failed', error)
            throw error
          }
        }
      )
    }

    // ===== Marketing API Tools (Requires Marketing API Access) =====
    if (this.isCategoryEnabled('marketing')) {
      // Search Ad Accounts Tool
      this.server.tool(
        'search-ad-accounts',
        'Search for accessible LinkedIn ad accounts',
        linkedinApiSchemas.searchAdAccounts,
        async (params) => {
          this.logger.info('Searching Ad Accounts')
          try {
            await this.ensureAuthenticated()
            const result = await this.marketingService.searchAdAccounts(params)
            return this.createResourceResponse(result)
          } catch (error) {
            this.logger.error('Ad Accounts Search Failed', error)
            throw error
          }
        }
      )

    // Get Ad Account Tool
    this.server.tool(
      'get-ad-account',
      'Get details of a specific LinkedIn ad account',
      linkedinApiSchemas.getAdAccount,
      async (params) => {
        this.logger.info('Getting Ad Account', { accountId: params.accountId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getAdAccount(params.accountId)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Ad Account Failed', error)
          throw error
        }
      }
    )

    // Create Ad Account Tool
    this.server.tool(
      'create-ad-account',
      'Create a new LinkedIn ad account (requires Standard tier)',
      linkedinApiSchemas.createAdAccount,
      async (params) => {
        this.logger.info('Creating Ad Account', { name: params.name })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createAdAccount(params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Ad Account Failed', error)
          throw error
        }
      }
    )

    // Search Campaign Groups Tool
    this.server.tool(
      'search-campaign-groups',
      'Search campaign groups in a LinkedIn ad account',
      linkedinApiSchemas.searchCampaignGroups,
      async (params) => {
        this.logger.info('Searching Campaign Groups', { accountId: params.accountId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.searchCampaignGroups(params.accountId, params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Campaign Groups Search Failed', error)
          throw error
        }
      }
    )

    // Get Campaign Group Tool
    this.server.tool(
      'get-campaign-group',
      'Get details of a specific campaign group',
      linkedinApiSchemas.getCampaignGroup,
      async (params) => {
        this.logger.info('Getting Campaign Group', { accountId: params.accountId, campaignGroupId: params.campaignGroupId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getCampaignGroup(params.accountId, params.campaignGroupId)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Campaign Group Failed', error)
          throw error
        }
      }
    )

    // Create Campaign Group Tool
    this.server.tool(
      'create-campaign-group',
      'Create a new campaign group in a LinkedIn ad account',
      linkedinApiSchemas.createCampaignGroup,
      async (params) => {
        this.logger.info('Creating Campaign Group', { name: params.name })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createCampaignGroup(params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Campaign Group Failed', error)
          throw error
        }
      }
    )

    // Search Campaigns Tool
    this.server.tool(
      'search-campaigns',
      'Search campaigns in a LinkedIn ad account',
      linkedinApiSchemas.searchCampaigns,
      async (params) => {
        this.logger.info('Searching Campaigns', { accountId: params.accountId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.searchCampaigns(params.accountId, params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Campaigns Search Failed', error)
          throw error
        }
      }
    )

    // Get Campaign Tool
    this.server.tool(
      'get-campaign',
      'Get details of a specific campaign',
      linkedinApiSchemas.getCampaign,
      async (params) => {
        this.logger.info('Getting Campaign', { accountId: params.accountId, campaignId: params.campaignId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getCampaign(params.accountId, params.campaignId)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Campaign Failed', error)
          throw error
        }
      }
    )

    // Create Campaign Tool
    this.server.tool(
      'create-campaign',
      'Create a new campaign in a LinkedIn ad account',
      linkedinApiSchemas.createCampaign,
      async (params) => {
        this.logger.info('Creating Campaign', { name: params.name })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createCampaign(params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Campaign Failed', error)
          throw error
        }
      }
    )

    // Update Campaign Status Tool
    this.server.tool(
      'update-campaign-status',
      'Update the status of a LinkedIn campaign (activate, pause, or archive)',
      linkedinApiSchemas.updateCampaignStatus,
      async (params) => {
        this.logger.info('Updating Campaign Status', { accountId: params.accountId, campaignId: params.campaignId, status: params.status })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.updateCampaignStatus(params.accountId, params.campaignId, params.status)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Update Campaign Status Failed', error)
          throw error
        }
      }
    )

    // Search Creatives Tool
    this.server.tool(
      'search-creatives',
      'Search creatives in a LinkedIn campaign',
      linkedinApiSchemas.searchCreatives,
      async (params) => {
        this.logger.info('Searching Creatives', { campaign: params.campaign })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.searchCreatives(params.campaign, params)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Creatives Search Failed', error)
          throw error
        }
      }
    )

    // Get Creative Tool
    this.server.tool(
      'get-creative',
      'Get details of a specific creative',
      linkedinApiSchemas.getCreative,
      async (params) => {
        this.logger.info('Getting Creative', { creativeId: params.creativeId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getCreative(params.creativeId)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Creative Failed', error)
          throw error
        }
      }
    )

    // Get Ad Analytics Tool
    this.server.tool(
      'get-ad-analytics',
      'Get advertising analytics for LinkedIn campaigns, creatives, or accounts',
      linkedinApiSchemas.getAdAnalytics,
      async (params) => {
        this.logger.info('Getting Ad Analytics')
        try {
          await this.ensureAuthenticated()
          const analyticsParams = {
            accounts: params.accounts,
            campaigns: params.campaigns,
            creatives: params.creatives,
            dateRange: {
              start: {
                year: params.startYear,
                month: params.startMonth,
                day: params.startDay
              },
              end: {
                year: params.endYear,
                month: params.endMonth,
                day: params.endDay
              }
            },
            pivot: params.pivot,
            timeGranularity: params.timeGranularity
          }
          const result = await this.marketingService.getAdAnalytics(analyticsParams)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Ad Analytics Failed', error)
          throw error
        }
      }
    )

      // ===== Creative Management Tools =====

      // Create Creative Tool
      this.server.tool(
        'create-creative',
      'Create a new creative (ad) in a LinkedIn campaign',
      linkedinApiSchemas.createCreative,
      async (params) => {
        this.logger.info('Creating Creative', { campaign: params.campaign })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createCreative(params.accountId, {
            campaign: params.campaign,
            contentReference: params.contentReference,
            intendedStatus: params.intendedStatus,
            name: params.name,
            leadgenFormUrn: params.leadgenFormUrn,
            leadgenCallToAction: params.leadgenCallToAction
          })
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Creative Failed', error)
          throw error
        }
      }
    )

    // Update Creative Tool
    this.server.tool(
      'update-creative',
      'Update an existing creative (change status or name)',
      linkedinApiSchemas.updateCreative,
      async (params) => {
        this.logger.info('Updating Creative', { creativeId: params.creativeId })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.updateCreative(
            params.accountId,
            params.creativeId,
            {
              intendedStatus: params.intendedStatus,
              name: params.name
            }
          )
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Update Creative Failed', error)
          throw error
        }
      }
    )

    // Delete Creative Tool
    this.server.tool(
      'delete-creative',
      'Delete a creative (marks for deletion)',
      linkedinApiSchemas.deleteCreative,
      async (params) => {
        this.logger.info('Deleting Creative', { creativeId: params.creativeId })
        try {
          await this.ensureAuthenticated()
          await this.marketingService.deleteCreative(params.accountId, params.creativeId)
          return this.createResourceResponse({ success: true, message: 'Creative marked for deletion' })
        } catch (error) {
          this.logger.error('Delete Creative Failed', error)
          throw error
        }
      }
    )

    // ===== Campaign Update Tools =====

    // Update Campaign Tool
    this.server.tool(
      'update-campaign',
      'Update a LinkedIn campaign (budget, schedule, status, targeting options)',
      linkedinApiSchemas.updateCampaign,
      async (params) => {
        this.logger.info('Updating Campaign', { campaignId: params.campaignId })
        try {
          await this.ensureAuthenticated()
          const updateParams: {
            name?: string
            status?: string
            dailyBudget?: { amount: string; currencyCode: string }
            totalBudget?: { amount: string; currencyCode: string } | null
            unitCost?: { amount: string; currencyCode: string }
            runScheduleEnd?: number
            audienceExpansionEnabled?: boolean
            offsiteDeliveryEnabled?: boolean
          } = {}

          if (params.name) updateParams.name = params.name
          if (params.status) updateParams.status = params.status
          if (params.dailyBudgetAmount && params.dailyBudgetCurrency) {
            updateParams.dailyBudget = { amount: params.dailyBudgetAmount, currencyCode: params.dailyBudgetCurrency }
          }
          if (params.totalBudgetAmount === 'REMOVE') {
            updateParams.totalBudget = null
          } else if (params.totalBudgetAmount && params.totalBudgetCurrency) {
            updateParams.totalBudget = { amount: params.totalBudgetAmount, currencyCode: params.totalBudgetCurrency }
          }
          if (params.unitCostAmount && params.unitCostCurrency) {
            updateParams.unitCost = { amount: params.unitCostAmount, currencyCode: params.unitCostCurrency }
          }
          if (params.endTime) updateParams.runScheduleEnd = params.endTime
          if (params.audienceExpansionEnabled !== undefined) {
            updateParams.audienceExpansionEnabled = params.audienceExpansionEnabled
          }
          if (params.offsiteDeliveryEnabled !== undefined) {
            updateParams.offsiteDeliveryEnabled = params.offsiteDeliveryEnabled
          }

          const result = await this.marketingService.updateCampaign(
            params.accountId,
            params.campaignId,
            updateParams
          )
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Update Campaign Failed', error)
          throw error
        }
      }
    )

    // Update Campaign Group Tool
    this.server.tool(
      'update-campaign-group',
      'Update a LinkedIn campaign group (budget, schedule, status)',
      linkedinApiSchemas.updateCampaignGroup,
      async (params) => {
        this.logger.info('Updating Campaign Group', { campaignGroupId: params.campaignGroupId })
        try {
          await this.ensureAuthenticated()
          const updateParams: {
            name?: string
            status?: string
            totalBudget?: { amount: string; currencyCode: string } | null
            runScheduleEnd?: number
          } = {}

          if (params.name) updateParams.name = params.name
          if (params.status) updateParams.status = params.status
          if (params.totalBudgetAmount === 'REMOVE') {
            updateParams.totalBudget = null
          } else if (params.totalBudgetAmount && params.totalBudgetCurrency) {
            updateParams.totalBudget = { amount: params.totalBudgetAmount, currencyCode: params.totalBudgetCurrency }
          }
          if (params.endTime) updateParams.runScheduleEnd = params.endTime

          const result = await this.marketingService.updateCampaignGroup(
            params.accountId,
            params.campaignGroupId,
            updateParams
          )
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Update Campaign Group Failed', error)
          throw error
        }
      }
    )

    } // End marketing category

    // ===== Conversions API Tools =====
    if (this.isCategoryEnabled('conversions')) {
      // Create Conversion Rule Tool
      this.server.tool(
        'create-conversion-rule',
      'Create a conversion tracking rule for measuring campaign performance',
      linkedinApiSchemas.createConversionRule,
      async (params) => {
        this.logger.info('Creating Conversion Rule', { name: params.name, type: params.type })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createConversionRule({
            name: params.name,
            account: params.account,
            type: params.type,
            postClickAttributionWindowSize: parseInt(params.postClickAttributionWindow, 10),
            viewThroughAttributionWindowSize: parseInt(params.viewThroughAttributionWindow, 10),
            attributionType: params.attributionType
          })
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Conversion Rule Failed', error)
          throw error
        }
      }
    )

    // Get Conversion Rules Tool
    this.server.tool(
      'get-conversion-rules',
      'Get all conversion tracking rules for an ad account',
      linkedinApiSchemas.getConversionRules,
      async (params) => {
        this.logger.info('Getting Conversion Rules', { account: params.account })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getConversionRules(params.account)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Conversion Rules Failed', error)
          throw error
        }
      }
    )

    // Stream Conversion Event Tool
    this.server.tool(
      'stream-conversion-event',
      'Send a conversion event to LinkedIn for attribution tracking',
      linkedinApiSchemas.streamConversionEvent,
      async (params) => {
        this.logger.info('Streaming Conversion Event', { conversionRuleId: params.conversionRuleId })
        try {
          await this.ensureAuthenticated()
          const eventParams: {
            conversion: string
            conversionHappenedAt: number
            userIdType: string
            userIdValue: string
            eventId?: string
            conversionValue?: { currencyCode: string; amount: string }
            userInfo?: { firstName?: string; lastName?: string; countryCode?: string }
          } = {
            conversion: params.conversionRuleId,
            conversionHappenedAt: params.conversionHappenedAt,
            userIdType: params.userIdType,
            userIdValue: params.userIdValue
          }

          if (params.eventId) eventParams.eventId = params.eventId
          if (params.conversionValueAmount && params.conversionValueCurrency) {
            eventParams.conversionValue = {
              amount: params.conversionValueAmount,
              currencyCode: params.conversionValueCurrency
            }
          }
          if (params.userFirstName || params.userLastName || params.userCountryCode) {
            eventParams.userInfo = {}
            if (params.userFirstName) eventParams.userInfo.firstName = params.userFirstName
            if (params.userLastName) eventParams.userInfo.lastName = params.userLastName
            if (params.userCountryCode) eventParams.userInfo.countryCode = params.userCountryCode
          }

          await this.marketingService.streamConversionEvent(eventParams)
          return this.createResourceResponse({ success: true, message: 'Conversion event streamed successfully' })
        } catch (error) {
          this.logger.error('Stream Conversion Event Failed', error)
          throw error
        }
      }
    )

    // Associate Campaign Conversion Tool
    this.server.tool(
      'associate-campaign-conversion',
      'Associate a campaign with a conversion tracking rule',
      linkedinApiSchemas.associateCampaignConversion,
      async (params) => {
        this.logger.info('Associating Campaign Conversion', { campaignUrn: params.campaignUrn, conversionUrn: params.conversionUrn })
        try {
          await this.ensureAuthenticated()
          await this.marketingService.associateCampaignConversion(params.campaignUrn, params.conversionUrn)
          return this.createResourceResponse({ success: true, message: 'Campaign associated with conversion rule' })
        } catch (error) {
          this.logger.error('Associate Campaign Conversion Failed', error)
          throw error
        }
      }
    )

    } // End conversions category

    // ===== Matched Audiences / DMP Segment Tools (requires rw_dmp_segments scope) =====
    if (this.isCategoryEnabled('audiences')) {
      // Create Audience Tool
      this.server.tool(
        'create-audience',
      'Create a matched audience segment for targeting (requires rw_dmp_segments scope)',
      linkedinApiSchemas.createAudience,
      async (params) => {
        this.logger.info('Creating Audience', { name: params.name, type: params.type })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.createAudience({
            account: params.account,
            name: params.name,
            type: params.type
          })
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Create Audience Failed', error)
          throw error
        }
      }
    )

    // Get Audiences Tool
    this.server.tool(
      'get-audiences',
      'Get all matched audience segments for an ad account (requires rw_dmp_segments scope)',
      linkedinApiSchemas.getAudiences,
      async (params) => {
        this.logger.info('Getting Audiences', { account: params.account })
        try {
          await this.ensureAuthenticated()
          const result = await this.marketingService.getAudiences(params.account)
          return this.createResourceResponse(result)
        } catch (error) {
          this.logger.error('Get Audiences Failed', error)
          throw error
        }
      }
    )

    // Add Audience Users Tool
    this.server.tool(
      'add-audience-users',
      'Add hashed email users to a matched audience segment (requires rw_dmp_segments scope)',
      linkedinApiSchemas.addAudienceUsers,
      async (params) => {
        this.logger.info('Adding Audience Users', { segmentId: params.segmentId, userCount: params.users.length })
        try {
          await this.ensureAuthenticated()
          await this.marketingService.addAudienceUsers(params.segmentId, params.users)
          return this.createResourceResponse({ success: true, message: `${params.users.length} users added to audience` })
        } catch (error) {
          this.logger.error('Add Audience Users Failed', error)
          throw error
        }
      }
    )

      // Add Audience Companies Tool
      this.server.tool(
        'add-audience-companies',
        'Add companies to a matched audience segment for account-based targeting (requires rw_dmp_segments scope)',
        linkedinApiSchemas.addAudienceCompanies,
        async (params) => {
          this.logger.info('Adding Audience Companies', { segmentId: params.segmentId, companyCount: params.companies.length })
          try {
            await this.ensureAuthenticated()
            await this.marketingService.addAudienceCompanies(params.segmentId, params.companies)
            return this.createResourceResponse({ success: true, message: `${params.companies.length} companies added to audience` })
          } catch (error) {
            this.logger.error('Add Audience Companies Failed', error)
            throw error
          }
        }
      )
    } // End audiences category
  }

  private createResourceResponse(data: unknown): McpResourceResponse {
    const jsonString = JSON.stringify(data)
    const base64Data = Buffer.from(jsonString).toString('base64')
    return {
      content: [
        {
          type: 'resource',
          resource: {
            text: jsonString,
            uri: `data:application/json;base64,${base64Data}`,
            mimeType: 'application/json'
          }
        }
      ]
    }
  }
}
