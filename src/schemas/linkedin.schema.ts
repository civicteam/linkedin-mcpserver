import { z } from 'zod'

/**
 * Schemas for LinkedIn MCP tools
 *
 * Defines the parameter structures for all LinkedIn API operations
 * using Zod schemas in raw shape format
 */
export const linkedinApiSchemas = {
  /**
   * Empty parameters schema for endpoints without required parameters
   */
  emptyParams: {},

  /**
   * Schema for searching people on LinkedIn
   */
  searchPeople: {
    currentCompany: z.array(z.string()).optional().describe('Filter by current company'),
    industries: z.array(z.string()).optional().describe('Filter by industries'),
    keywords: z.string().optional().describe('Keywords to search for LinkedIn Profiles'),
    location: z.string().optional().describe('Filter by location')
  },

  /**
   * Schema for getting a LinkedIn profile
   */
  getProfile: {
    publicId: z.string().optional().describe('Public ID of the LinkedIn profile'),
    urnId: z.string().optional().describe('URN ID of the LinkedIn profile')
  },

  /**
   * Schema for searching jobs on LinkedIn
   */
  searchJobs: {
    companies: z.array(z.string()).optional().describe('Filter by companies'),
    jobType: z.array(z.string()).optional().describe('Filter by job type (e.g., Full-Time, Contract)'),
    keywords: z.string().optional().describe('Keywords to search for in job postings'),
    location: z.string().optional().describe('Filter by location')
  },

  /**
   * Schema for sending messages on LinkedIn
   */
  sendMessage: {
    messageBody: z.string().describe('Content of the message to send'),
    recipientUrn: z.string().describe('URN of the message recipient'),
    subject: z.string().optional().default('LinkedIn Connection').describe('Subject of the message')
  },

  /**
   * Schema for creating a text post on LinkedIn
   */
  createTextPost: {
    text: z.string().describe('The text content of the post'),
    visibility: z.enum(['PUBLIC', 'CONNECTIONS']).optional().default('CONNECTIONS').describe('Who can see the post: PUBLIC or CONNECTIONS (1st-degree only)')
  },

  /**
   * Schema for creating an article share on LinkedIn
   */
  createArticleShare: {
    url: z.string().url().describe('URL of the article to share'),
    text: z.string().optional().describe('Commentary text to accompany the article'),
    title: z.string().optional().describe('Custom title for the article (optional)'),
    description: z.string().optional().describe('Custom description for the article (optional)'),
    visibility: z.enum(['PUBLIC', 'CONNECTIONS']).optional().default('CONNECTIONS').describe('Who can see the post: PUBLIC or CONNECTIONS (1st-degree only)')
  },

  /**
   * Schema for creating an image share on LinkedIn
   */
  createImageShare: {
    imageUrl: z.string().url().describe('URL of the image to share (must be publicly accessible)'),
    text: z.string().optional().describe('Commentary text to accompany the image'),
    visibility: z.enum(['PUBLIC', 'CONNECTIONS']).optional().default('CONNECTIONS').describe('Who can see the post: PUBLIC or CONNECTIONS (1st-degree only)')
  },

  /**
   * Marketing API Schemas
   */

  // Ad Account Management
  searchAdAccounts: {
    pageSize: z.number().min(1).max(1000).optional().default(100).describe('Number of results per page (max 1000)'),
    pageToken: z.string().optional().describe('Pagination token from previous response'),
    status: z.enum(['ACTIVE', 'DRAFT', 'CANCELED']).optional().describe('Filter by account status')
  },

  getAdAccount: {
    accountId: z.string().describe('Ad account ID')
  },

  createAdAccount: {
    name: z.string().describe('Name of the ad account'),
    type: z.literal('BUSINESS').default('BUSINESS').describe('Account type (always BUSINESS)'),
    currency: z.string().length(3).describe('ISO 4217 currency code (e.g., USD, EUR, GBP)'),
    reference: z.string().optional().describe('Optional reference identifier')
  },

  // Campaign Group Management
  searchCampaignGroups: {
    accountId: z.string().describe('Ad account ID'),
    pageSize: z.number().min(1).max(1000).optional().default(100).describe('Number of results per page'),
    pageToken: z.string().optional().describe('Pagination token from previous response'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT']).optional().describe('Filter by campaign group status')
  },

  getCampaignGroup: {
    accountId: z.string().describe('Ad account ID'),
    campaignGroupId: z.string().describe('Campaign group ID')
  },

  createCampaignGroup: {
    account: z.string().describe('Ad account URN'),
    name: z.string().describe('Name of the campaign group'),
    status: z.enum(['ACTIVE', 'DRAFT']).optional().default('DRAFT').describe('Initial status of the campaign group'),
    totalBudgetAmount: z.string().optional().describe('Total budget amount (e.g., "1000.00")'),
    totalBudgetCurrency: z.string().length(3).optional().describe('Currency code (e.g., USD)'),
    startTime: z.number().optional().describe('Unix timestamp for campaign start'),
    endTime: z.number().optional().describe('Unix timestamp for campaign end')
  },

  // Campaign Management
  searchCampaigns: {
    accountId: z.string().describe('Ad account ID'),
    campaignGroup: z.string().optional().describe('Filter by campaign group URN'),
    pageSize: z.number().min(1).max(1000).optional().default(100).describe('Number of results per page'),
    pageToken: z.string().optional().describe('Pagination token from previous response'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT']).optional().describe('Filter by campaign status')
  },

  getCampaign: {
    accountId: z.string().describe('Ad account ID'),
    campaignId: z.string().describe('Campaign ID')
  },

  createCampaign: {
    account: z.string().describe('Ad account URN'),
    campaignGroup: z.string().describe('Campaign group URN'),
    name: z.string().describe('Name of the campaign'),
    type: z.enum(['TEXT_AD', 'SPONSORED_UPDATES', 'SPONSORED_INMAILS', 'DISPLAY_ADS']).describe('Type of campaign'),
    objective: z.enum(['BRAND_AWARENESS', 'WEBSITE_VISITS', 'ENGAGEMENT', 'VIDEO_VIEWS', 'LEAD_GENERATION', 'WEBSITE_CONVERSIONS', 'JOB_APPLICANTS']).describe('Campaign objective'),
    costType: z.enum(['CPM', 'CPC', 'CPV']).describe('Cost type (CPM=cost per mille, CPC=cost per click, CPV=cost per view)'),
    status: z.enum(['ACTIVE', 'DRAFT']).optional().default('DRAFT').describe('Initial status of the campaign'),
    dailyBudgetAmount: z.string().optional().describe('Daily budget amount (e.g., "100.00")'),
    dailyBudgetCurrency: z.string().length(3).optional().describe('Currency code for daily budget'),
    totalBudgetAmount: z.string().optional().describe('Total budget amount (e.g., "1000.00")'),
    totalBudgetCurrency: z.string().length(3).optional().describe('Currency code for total budget'),
    unitCostAmount: z.string().optional().describe('Bid amount (e.g., "5.00")'),
    unitCostCurrency: z.string().length(3).optional().describe('Currency code for unit cost'),
    startTime: z.number().optional().describe('Unix timestamp for campaign start'),
    endTime: z.number().optional().describe('Unix timestamp for campaign end')
  },

  updateCampaignStatus: {
    accountId: z.string().describe('Ad account ID'),
    campaignId: z.string().describe('Campaign ID'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).describe('New status for the campaign')
  },

  // Creative Management
  searchCreatives: {
    campaign: z.string().describe('Campaign URN to filter by'),
    pageSize: z.number().min(1).max(1000).optional().default(100).describe('Number of results per page'),
    pageToken: z.string().optional().describe('Pagination token from previous response'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED', 'DRAFT']).optional().describe('Filter by creative status')
  },

  getCreative: {
    creativeId: z.string().describe('Creative ID')
  },

  // Analytics
  getAdAnalytics: {
    accounts: z.array(z.string()).optional().describe('Ad account URNs to include in analytics'),
    campaigns: z.array(z.string()).optional().describe('Campaign URNs to include in analytics'),
    creatives: z.array(z.string()).optional().describe('Creative URNs to include in analytics'),
    startYear: z.number().min(2000).max(2100).describe('Start year (e.g., 2025)'),
    startMonth: z.number().min(1).max(12).describe('Start month (1-12)'),
    startDay: z.number().min(1).max(31).describe('Start day (1-31)'),
    endYear: z.number().min(2000).max(2100).describe('End year (e.g., 2025)'),
    endMonth: z.number().min(1).max(12).describe('End month (1-12)'),
    endDay: z.number().min(1).max(31).describe('End day (1-31)'),
    pivot: z.enum(['ACCOUNT', 'CAMPAIGN', 'CAMPAIGN_GROUP', 'CREATIVE', 'CONVERSION', 'COMPANY', 'MEMBER_COMPANY_SIZE', 'MEMBER_INDUSTRY', 'MEMBER_SENIORITY', 'MEMBER_JOB_TITLE', 'MEMBER_JOB_FUNCTION', 'MEMBER_COUNTRY_REGION']).optional().describe('Dimension to pivot by'),
    timeGranularity: z.enum(['DAILY', 'MONTHLY', 'ALL']).optional().default('ALL').describe('Time granularity for results')
  },

  // Creative Management (Create/Update/Delete)
  createCreative: {
    accountId: z.string().describe('Ad account ID'),
    campaign: z.string().describe('Campaign URN (e.g., urn:li:sponsoredCampaign:123456)'),
    contentReference: z.string().optional().describe('Content URN to sponsor (ugcPost or share URN)'),
    intendedStatus: z.enum(['ACTIVE', 'PAUSED', 'DRAFT']).optional().default('DRAFT').describe('Initial status of the creative'),
    name: z.string().optional().describe('Name for the creative'),
    leadgenFormUrn: z.string().optional().describe('Lead gen form URN for LEAD_GENERATION campaigns'),
    leadgenCallToAction: z.enum(['APPLY', 'DOWNLOAD', 'VIEW_QUOTE', 'LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE', 'REGISTER', 'REQUEST_DEMO', 'JOIN', 'ATTEND', 'UNLOCK_FULL_DOCUMENT']).optional().describe('Call-to-action label for lead gen')
  },

  updateCreative: {
    accountId: z.string().describe('Ad account ID'),
    creativeId: z.string().describe('Creative ID or URN'),
    intendedStatus: z.enum(['ACTIVE', 'PAUSED', 'DRAFT', 'ARCHIVED', 'PENDING_DELETION']).optional().describe('New status for the creative'),
    name: z.string().optional().describe('New name for the creative')
  },

  deleteCreative: {
    accountId: z.string().describe('Ad account ID'),
    creativeId: z.string().describe('Creative ID or URN')
  },

  // Campaign Updates (Budget, Schedule, etc.)
  updateCampaign: {
    accountId: z.string().describe('Ad account ID'),
    campaignId: z.string().describe('Campaign ID'),
    name: z.string().optional().describe('New campaign name'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional().describe('New campaign status'),
    dailyBudgetAmount: z.string().optional().describe('Daily budget amount (e.g., "100.00")'),
    dailyBudgetCurrency: z.string().length(3).optional().describe('Currency code for daily budget'),
    totalBudgetAmount: z.string().optional().describe('Total budget amount (e.g., "1000.00"), use "REMOVE" to set unlimited'),
    totalBudgetCurrency: z.string().length(3).optional().describe('Currency code for total budget'),
    unitCostAmount: z.string().optional().describe('Bid amount (e.g., "5.00")'),
    unitCostCurrency: z.string().length(3).optional().describe('Currency code for unit cost'),
    endTime: z.number().optional().describe('Unix timestamp for campaign end'),
    audienceExpansionEnabled: z.boolean().optional().describe('Enable audience expansion'),
    offsiteDeliveryEnabled: z.boolean().optional().describe('Enable LinkedIn Audience Network')
  },

  // Campaign Group Updates
  updateCampaignGroup: {
    accountId: z.string().describe('Ad account ID'),
    campaignGroupId: z.string().describe('Campaign group ID'),
    name: z.string().optional().describe('New campaign group name'),
    status: z.enum(['ACTIVE', 'PAUSED', 'ARCHIVED']).optional().describe('New campaign group status'),
    totalBudgetAmount: z.string().optional().describe('Total budget amount (e.g., "1000.00"), use "REMOVE" to set unlimited'),
    totalBudgetCurrency: z.string().length(3).optional().describe('Currency code for total budget'),
    endTime: z.number().optional().describe('Unix timestamp for campaign group end')
  },

  // Conversions API
  createConversionRule: {
    name: z.string().describe('Name for the conversion rule'),
    account: z.string().describe('Ad account URN (e.g., urn:li:sponsoredAccount:123456)'),
    type: z.enum(['ADD_TO_CART', 'DOWNLOAD', 'INSTALL', 'KEY_PAGE_VIEW', 'LEAD', 'PURCHASE', 'SIGN_UP', 'ADD_BILLING_INFO', 'BOOK_APPOINTMENT', 'COMPLETE_SIGNUP', 'SUBMIT_APPLICATION', 'PHONE_CALL', 'INVITE', 'LOGIN', 'SHARE', 'DONATE', 'ADD_TO_LIST', 'START_TRIAL', 'OUTBOUND_CLICK', 'CONTACT', 'QUALIFIED_LEAD', 'SAVE', 'START_CHECKOUT', 'SCHEDULE', 'VIEW_CONTENT', 'VIEW_VIDEO', 'REQUEST_QUOTE', 'SEARCH', 'SUBSCRIBE', 'AD_CLICK', 'AD_VIEW']).describe('Type of conversion to track'),
    postClickAttributionWindow: z.enum(['1', '7', '30', '90', '365']).optional().default('30').describe('Post-click attribution window in days'),
    viewThroughAttributionWindow: z.enum(['1', '7', '30', '90', '365']).optional().default('7').describe('View-through attribution window in days'),
    attributionType: z.enum(['LAST_TOUCH_BY_CAMPAIGN', 'LAST_TOUCH_BY_CONVERSION']).optional().default('LAST_TOUCH_BY_CAMPAIGN').describe('Attribution model')
  },

  getConversionRules: {
    account: z.string().describe('Ad account URN (e.g., urn:li:sponsoredAccount:123456)')
  },

  streamConversionEvent: {
    conversionRuleId: z.string().describe('Conversion rule URN (e.g., urn:lla:llaPartnerConversion:123)'),
    conversionHappenedAt: z.number().describe('Unix timestamp in milliseconds when conversion occurred'),
    userIdType: z.enum(['SHA256_EMAIL', 'LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID', 'ACXIOM_ID', 'ORACLE_MOAT_ID']).describe('Type of user identifier'),
    userIdValue: z.string().describe('User identifier value (e.g., SHA256 hash of email)'),
    eventId: z.string().optional().describe('Unique event ID for deduplication'),
    conversionValueAmount: z.string().optional().describe('Conversion value amount (e.g., "50.00")'),
    conversionValueCurrency: z.string().length(3).optional().describe('Currency code for conversion value'),
    userFirstName: z.string().optional().describe('User first name for improved matching'),
    userLastName: z.string().optional().describe('User last name for improved matching'),
    userCountryCode: z.string().length(2).optional().describe('User country code (e.g., US)')
  },

  associateCampaignConversion: {
    campaignUrn: z.string().describe('Campaign URN (e.g., urn:li:sponsoredCampaign:123456)'),
    conversionUrn: z.string().describe('Conversion rule URN (e.g., urn:lla:llaPartnerConversion:123)')
  },

  // Matched Audiences / DMP Segments (requires rw_dmp_segments scope)
  createAudience: {
    account: z.string().describe('Ad account URN (e.g., urn:li:sponsoredAccount:123456)'),
    name: z.string().describe('Name for the audience segment'),
    type: z.enum(['LIST_UPLOAD', 'STREAMING']).describe('Segment type: LIST_UPLOAD for CSV, STREAMING for real-time')
  },

  getAudiences: {
    account: z.string().describe('Ad account URN (e.g., urn:li:sponsoredAccount:123456)')
  },

  addAudienceUsers: {
    segmentId: z.string().describe('DMP Segment ID'),
    users: z.array(z.object({
      idType: z.enum(['SHA256_EMAIL', 'SHA512_EMAIL']).describe('Hash algorithm used'),
      idValue: z.string().describe('Hashed email value')
    })).min(1).max(5000).describe('Array of hashed user identifiers (max 5000 per call)')
  },

  addAudienceCompanies: {
    segmentId: z.string().describe('DMP Segment ID'),
    companies: z.array(z.object({
      companyName: z.string().optional().describe('Company name'),
      companyDomain: z.string().optional().describe('Company domain (e.g., example.com)')
    })).min(1).describe('Array of company identifiers')
  }
}
