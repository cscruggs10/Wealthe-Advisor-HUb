import { FirecrawlClient } from '@mendable/firecrawl-js';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq, or } from 'drizzle-orm';
import { advisors, generateAdvisorSlug } from '../shared/schema';
import { rewriteBioForSEO, generateFallbackBio } from './ai-rewriter';

// State abbreviation to full name mapping
const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia',
};

// State name to abbreviation reverse lookup
const STATE_ABBREVS: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([abbr, name]) => [name.toUpperCase(), abbr])
);

// Common city name normalizations
const CITY_NORMALIZATIONS: Record<string, string> = {
  'nyc': 'New York',
  'ny': 'New York',
  'la': 'Los Angeles',
  'sf': 'San Francisco',
  'dc': 'Washington',
  'philly': 'Philadelphia',
  'vegas': 'Las Vegas',
  'nola': 'New Orleans',
  'chi': 'Chicago',
  'atl': 'Atlanta',
  'dallas-fort worth': 'Dallas',
  'dfw': 'Dallas',
};

/**
 * Delay utility for rate limiting between page requests
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalize city name for clean SEO URLs
 */
function normalizeCity(city: string): string {
  const lowerCity = city.toLowerCase().trim();

  if (CITY_NORMALIZATIONS[lowerCity]) {
    return CITY_NORMALIZATIONS[lowerCity];
  }

  return city.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' ');
}

/**
 * Normalize state to 2-letter abbreviation
 */
function normalizeState(state: string): string {
  const upperState = state.toUpperCase().trim();

  if (STATE_NAMES[upperState]) {
    return upperState;
  }

  if (STATE_ABBREVS[upperState]) {
    return STATE_ABBREVS[upperState];
  }

  return upperState.substring(0, 2);
}

// Initialize Firecrawl
const firecrawl = new FirecrawlClient({
  apiKey: process.env.FIRECRAWL_API_KEY || '',
});

// Initialize database
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
const sql = neon(DATABASE_URL);
const db = drizzle(sql);

export interface ScrapedAdvisor {
  name: string;
  firmName?: string;
  designation: string;
  city: string;
  state: string;
  zipCode: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  bio?: string;
  specialties?: string[];
  profileUrl?: string;
  priorityScore?: number;
}

// Priority keywords for advisor scoring - ALPHA niche focus
const HIGH_PRIORITY_KEYWORDS = [
  'tax', 'captive', 'reinsurance', '831(b)', '831b',
  'high net worth', 'hnw', 'uhnw', 'ultra high',
  'business owner', 'entrepreneur', 'succession',
  'estate planning', 'wealth preservation', 'tax optimization',
  'strategic', 'proactive', 'advanced tax',
  'cpa', 'certified public accountant', 'tax planning'
];

const MEDIUM_PRIORITY_KEYWORDS = [
  'accounting', 'financial planning', 'wealth management',
  'investment', 'retirement', 'executive', 'corporate',
  'cfp', 'fiduciary', 'fee-only'
];

/**
 * Calculate priority score for an advisor (0-100)
 */
function calculatePriorityScore(advisor: ScrapedAdvisor): number {
  let score = 0;
  const searchText = [
    advisor.name,
    advisor.firmName,
    advisor.bio,
    advisor.designation,
    ...(advisor.specialties || [])
  ].filter(Boolean).join(' ').toLowerCase();

  // High priority keywords (10 points each, max 50)
  let highScore = 0;
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (searchText.includes(keyword)) {
      highScore += 10;
    }
  }
  score += Math.min(highScore, 50);

  // Medium priority keywords (5 points each, max 25)
  let mediumScore = 0;
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (searchText.includes(keyword)) {
      mediumScore += 5;
    }
  }
  score += Math.min(mediumScore, 25);

  // Bonus for CPA designation
  if (searchText.includes('cpa') || advisor.designation.includes('CPA')) {
    score += 15;
  }

  // Bonus for having specialties
  if (advisor.specialties && advisor.specialties.length > 0) {
    score += 10;
  }

  return Math.min(score, 100);
}

/**
 * Sort advisors by priority (highest first)
 */
function sortByPriority(advisors: ScrapedAdvisor[]): ScrapedAdvisor[] {
  return advisors
    .map(advisor => ({
      ...advisor,
      priorityScore: calculatePriorityScore(advisor)
    }))
    .sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
}

export interface ScrapeResult {
  success: boolean;
  advisors: ScrapedAdvisor[];
  error?: string;
}

/**
 * Detect which scraper to use based on URL
 */
function detectSource(url: string): 'wealthtender' | 'samslist' | 'unknown' {
  if (url.includes('wealthtender.com')) return 'wealthtender';
  if (url.includes('samslist.co')) return 'samslist';
  return 'unknown';
}

/**
 * Parse Wealthtender advisor cards from markdown
 * Format: [![Headshot of NAME](img)![logo](logo)\\\\NAME CREDENTIALSCompanyTagline\\\\City, State\\...](profile_url)
 */
function parseWealthtenderAdvisors(content: string, limit: number): ScrapedAdvisor[] {
  const advisors: ScrapedAdvisor[] = [];
  const seenNames = new Set<string>();

  // Pattern to match Wealthtender advisor cards
  // Looking for: [Headshot of NAME] ... City, STATE ... ](profile_url)
  const cardPattern = /\[!\[Headshot of ([^\]]+)\][^\]]*\]\([^)]+\)!\[[^\]]*\]\([^)]+\)\\*\n*\\*\n*([^\\]+)\\*\n*\\*\n*([^,]+),\s*([A-Z]{2})/g;

  let match;
  while ((match = cardPattern.exec(content)) !== null && advisors.length < limit) {
    const headshot = match[1].trim();
    const nameBlock = match[2].trim();
    const city = match[3].trim();
    const state = match[4].trim();

    // The headshot alt text usually has the clean name
    const name = headshot;

    if (seenNames.has(name)) continue;
    seenNames.add(name);

    // Extract designation from name (CFP®, CPA, MBA, etc.)
    let designation = 'Wealth Manager';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('cpa')) {
      designation = nameLower.includes('cfp') ? 'CPA & Wealth Manager' : 'CPA';
    } else if (nameLower.includes('cfp')) {
      designation = 'Wealth Manager';
    }

    // Parse specialties from the name/credentials
    const specialties: string[] = [];
    if (nameLower.includes('cpa')) specialties.push('Tax Planning');
    if (nameLower.includes('cfp')) specialties.push('Financial Planning');
    if (nameLower.includes('cepa')) specialties.push('Exit Planning');
    if (nameLower.includes('ricp')) specialties.push('Retirement Planning');
    if (nameLower.includes('cfa')) specialties.push('Investment Management');

    // Extract company and tagline from nameBlock
    const lines = nameBlock.split(/[\n\\]+/).filter(l => l.trim().length > 0);
    let firmName = '';
    let bio = '';

    if (lines.length >= 2) {
      firmName = lines[1]?.trim() || '';
      bio = lines.slice(2).join(' ').trim();
    }

    advisors.push({
      name: name.replace(/,?\s*(CFP®?|CPA|MBA|CFA|ChFC|RICP|CEPA|AEP®?|CRPC®?|BFA™?|EA).*$/i, '').trim() || name,
      firmName: firmName || undefined,
      designation,
      city: normalizeCity(city),
      state: normalizeState(state),
      zipCode: '00000', // Will be enriched later
      bio: bio || `${name} is a financial professional based in ${city}, ${state}.`,
      specialties: specialties.length > 0 ? specialties : ['Financial Planning', 'Wealth Management'],
    });
  }

  // If regex didn't work, try alternative parsing
  if (advisors.length === 0) {
    return parseWealthtenderAlternative(content, limit);
  }

  return advisors;
}

/**
 * Alternative Wealthtender parsing - simpler pattern with better location extraction
 */
function parseWealthtenderAlternative(content: string, limit: number): ScrapedAdvisor[] {
  const advisors: ScrapedAdvisor[] = [];
  const seenNames = new Set<string>();

  // Match "Headshot of NAME" pattern
  const namePattern = /\[Headshot of ([^\]]+)\]/g;
  const names: string[] = [];
  let match;

  while ((match = namePattern.exec(content)) !== null) {
    const name = match[1].trim();
    if (!seenNames.has(name) && name.length > 3) {
      seenNames.add(name);
      names.push(name);
    }
  }

  // Find ALL locations - pattern: "City, ST" (with various trailing chars)
  // Look for patterns like "Duluth, GA\n" or "Houston, TX\"
  const locationPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z.]+)*),\s*([A-Z]{2})(?:\s*\\|\s*\n|$)/g;
  const locations: { city: string; state: string }[] = [];

  while ((match = locationPattern.exec(content)) !== null) {
    const city = match[1].trim();
    const state = match[2].trim();
    // Filter out false positives (navigation items, etc.)
    if (city.length > 2 && city.length < 30 && STATE_NAMES[state]) {
      locations.push({ city, state });
    }
  }

  // Combine names with locations (locations appear after each advisor card)
  for (let i = 0; i < Math.min(names.length, limit); i++) {
    const name = names[i];
    // Use location at same index, or cycle through if we have some locations
    const location = locations[i] || locations[i % Math.max(locations.length, 1)] || { city: 'New York', state: 'NY' };

    // Extract designation from credentials
    let designation = 'Wealth Manager';
    const nameLower = name.toLowerCase();
    if (nameLower.includes('cpa')) {
      designation = nameLower.includes('cfp') ? 'CPA & Wealth Manager' : 'CPA';
    }

    // Build specialties from credentials
    const specialties: string[] = [];
    if (nameLower.includes('cpa')) specialties.push('Tax Planning');
    if (nameLower.includes('cfp')) specialties.push('Financial Planning');
    if (nameLower.includes('cepa')) specialties.push('Exit Planning');
    if (nameLower.includes('ricp')) specialties.push('Retirement Planning');
    if (nameLower.includes('cfa')) specialties.push('Investment Management');
    if (nameLower.includes('mba')) specialties.push('Business Strategy');

    advisors.push({
      name,
      designation,
      city: normalizeCity(location.city),
      state: normalizeState(location.state),
      zipCode: '00000',
      specialties: specialties.length > 0 ? specialties : ['Financial Planning', 'Wealth Management'],
    });
  }

  return advisors;
}

/**
 * Parse Samslist advisors (original parser)
 */
function parseSamslistAdvisors(content: string, limit: number): ScrapedAdvisor[] {
  const advisors: ScrapedAdvisor[] = [];

  const advisorPattern = /!\[([^\|]+)\s*\|\s*([^\]]+)\]\([^)]+\)\s*\n\n([^\n]+?)(?:\n|$)/g;

  let match;
  while ((match = advisorPattern.exec(content)) !== null && advisors.length < limit) {
    const specialtiesStr = match[2].trim();
    const displayName = match[3].trim();

    if (displayName.includes('Home') ||
        displayName.includes('Contact') ||
        displayName.includes('View More') ||
        displayName.includes('Professional Services') ||
        displayName.includes('Help Guides') ||
        displayName.includes('Choose Specialties') ||
        displayName.length < 3 ||
        displayName.startsWith('#') ||
        displayName.startsWith('!')) {
      continue;
    }

    const specialties = specialtiesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    let designation: 'CPA' | 'Wealth Manager' | 'CPA & Wealth Manager' = 'Wealth Manager';
    const specialtiesLower = specialtiesStr.toLowerCase();
    if (specialtiesLower.includes('tax') && (specialtiesLower.includes('wealth') || specialtiesLower.includes('financial'))) {
      designation = 'CPA & Wealth Manager';
    } else if (specialtiesLower.includes('tax') || specialtiesLower.includes('accounting')) {
      designation = 'CPA';
    }

    const name = displayName;
    if (advisors.some(a => a.name === name)) continue;

    advisors.push({
      name,
      designation,
      city: 'New York',
      state: 'NY',
      zipCode: '10001',
      specialties: specialties.slice(0, 5),
    });
  }

  return advisors;
}

/**
 * Scrape advisors from any supported listing page
 */
export async function scrapeAdvisorsFromListingPage(url: string, limit: number = 20): Promise<ScrapeResult> {
  console.log(`Scraping: ${url}`);

  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    const content = result.markdown || '';

    if (!content) {
      return { success: false, advisors: [], error: 'No content returned from Firecrawl' };
    }

    // Detect source and use appropriate parser
    const source = detectSource(url);
    let advisors: ScrapedAdvisor[];

    switch (source) {
      case 'wealthtender':
        advisors = parseWealthtenderAdvisors(content, limit);
        break;
      case 'samslist':
        advisors = parseSamslistAdvisors(content, limit);
        break;
      default:
        // Try Wealthtender parser as default (more robust)
        advisors = parseWealthtenderAdvisors(content, limit);
    }

    console.log(`Parsed ${advisors.length} advisors from ${source}`);

    return { success: true, advisors };
  } catch (error) {
    return { success: false, advisors: [], error: `Scrape error: ${error}` };
  }
}

/**
 * Check if an advisor already exists in the database (by slug)
 */
export async function checkDuplicateBySlug(name: string, city: string, specialty: string): Promise<boolean> {
  const normalizedCity = normalizeCity(city);
  const slug = generateAdvisorSlug(name, normalizedCity, specialty);

  const existing = await db
    .select({ id: advisors.id })
    .from(advisors)
    .where(eq(advisors.slug, slug))
    .limit(1);

  return existing.length > 0;
}

/**
 * Check if an advisor already exists in the database
 */
export async function checkDuplicate(websiteUrl?: string, slug?: string): Promise<boolean> {
  if (!websiteUrl && !slug) return false;

  const conditions = [];
  if (websiteUrl) {
    conditions.push(eq(advisors.websiteUrl, websiteUrl));
  }
  if (slug) {
    conditions.push(eq(advisors.slug, slug));
  }

  const existing = await db
    .select({ id: advisors.id })
    .from(advisors)
    .where(or(...conditions))
    .limit(1);

  return existing.length > 0;
}

/**
 * Process and insert a scraped advisor into the database
 */
export async function processAndInsertAdvisor(scraped: ScrapedAdvisor): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    const normalizedCity = normalizeCity(scraped.city);
    const normalizedState = normalizeState(scraped.state);

    console.log(`  Location: ${scraped.city}, ${scraped.state} -> ${normalizedCity}, ${normalizedState}`);

    const slug = generateAdvisorSlug(scraped.name, normalizedCity, scraped.specialties?.[0] || scraped.designation);

    const isDuplicate = await checkDuplicate(scraped.websiteUrl, slug);
    if (isDuplicate) {
      return { success: false, error: 'Duplicate advisor (website or slug already exists)' };
    }

    // Rewrite bio with AI for SEO
    let rewrittenData;
    try {
      rewrittenData = await rewriteBioForSEO(
        scraped.bio || '',
        scraped.name,
        scraped.designation,
        `${normalizedCity}, ${normalizedState}`
      );
    } catch (aiError) {
      console.warn(`AI rewrite failed, using fallback: ${aiError}`);
      rewrittenData = await generateFallbackBio(
        scraped.name,
        scraped.designation,
        `${normalizedCity}, ${normalizedState}`,
        scraped.firmName
      );
    }

    const finalSpecialties = [
      ...new Set([
        ...(scraped.specialties || []),
        ...(rewrittenData.specialties || []),
      ])
    ].slice(0, 6);

    await db.insert(advisors).values({
      name: scraped.name,
      firmName: scraped.firmName,
      designation: scraped.designation,
      city: normalizedCity,
      state: normalizedState,
      zipCode: scraped.zipCode,
      websiteUrl: scraped.websiteUrl,
      linkedinUrl: scraped.linkedinUrl,
      bio: rewrittenData.bio,
      specialties: finalSpecialties,
      isVerifiedStrategist: false,
      slug,
    });

    console.log(`Inserted advisor: ${scraped.name} (${slug})`);
    return { success: true, slug };
  } catch (error) {
    return { success: false, error: `Insert error: ${error}` };
  }
}

/**
 * Wealthtender source URLs - since pagination is JS-based, we use multiple URLs
 * Each URL shows different advisors (main listing, reviewed, sorted differently)
 */
const WEALTHTENDER_SOURCES = [
  'https://wealthtender.com/financial-advisors/',
  'https://wealthtender.com/financial-advisors-reviewed/',
  'https://wealthtender.com/financial-advisors/?orderby=menu_order',
  'https://wealthtender.com/financial-advisors/?orderby=title',
  'https://wealthtender.com/financial-advisors/?orderby=date',
];

/**
 * Main scraping pipeline with multi-source support
 */
export async function runScraperPipeline(
  baseUrl: string,
  limitPerPage: number = 20,
  maxPages: number = 1
): Promise<void> {
  const source = detectSource(baseUrl);
  const isWealthtender = source === 'wealthtender';

  console.log('='.repeat(60));
  console.log('Starting Advisor Scraper Pipeline');
  console.log(`Source: ${source}`);
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Limit per source: ${limitPerPage}`);
  console.log(`Max sources/pages: ${maxPages}`);
  console.log('='.repeat(60));

  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let totalScraped = 0;

  // For Wealthtender, use multiple source URLs since pagination is JS-based
  const urls = isWealthtender
    ? WEALTHTENDER_SOURCES.slice(0, maxPages)
    : Array.from({ length: maxPages }, (_, i) => {
        const url = new URL(baseUrl);
        if (i > 0) url.searchParams.set('page', String(i + 1));
        return url.toString();
      });

  for (let i = 0; i < urls.length; i++) {
    const pageUrl = urls[i];
    const pageNum = i + 1;

    console.log('\n' + '~'.repeat(60));
    console.log(`SOURCE ${pageNum}/${urls.length}: ${pageUrl}`);
    console.log('~'.repeat(60));

    const scrapeResult = await scrapeAdvisorsFromListingPage(pageUrl, limitPerPage);

    if (!scrapeResult.success) {
      console.log(`Failed to scrape: ${scrapeResult.error}`);
      continue;
    }

    if (scrapeResult.advisors.length === 0) {
      console.log(`No advisors found. Continuing...`);
      continue;
    }

    totalScraped += scrapeResult.advisors.length;
    console.log(`Found ${scrapeResult.advisors.length} advisors`);

    // Early duplicate check
    console.log('\nChecking for duplicates before AI processing...');
    const newAdvisors: ScrapedAdvisor[] = [];

    for (const advisor of scrapeResult.advisors) {
      const isDuplicate = await checkDuplicateBySlug(
        advisor.name,
        advisor.city,
        advisor.specialties?.[0] || advisor.designation
      );

      if (isDuplicate) {
        console.log(`  [SKIP] ${advisor.name} - already in database`);
        totalSkipped++;
      } else {
        newAdvisors.push(advisor);
      }
    }

    if (newAdvisors.length === 0) {
      console.log(`All advisors already exist. Moving to next source.`);
      if (i < urls.length - 1) {
        console.log('\nWaiting 3 seconds...');
        await delay(3000);
      }
      continue;
    }

    console.log(`\n${newAdvisors.length} new advisors to process`);

    // Sort by priority
    const prioritizedAdvisors = sortByPriority(newAdvisors);

    console.log('\nPriority-sorted new advisors:');
    prioritizedAdvisors.forEach((a, idx) => {
      console.log(`  ${idx + 1}. ${a.name} (score: ${a.priorityScore})`);
    });

    // Process each advisor
    for (const advisor of prioritizedAdvisors) {
      console.log('\n' + '-'.repeat(40));
      console.log(`Processing: ${advisor.name} (priority: ${advisor.priorityScore})`);

      const insertResult = await processAndInsertAdvisor(advisor);

      if (insertResult.success) {
        console.log(`SUCCESS: Added ${advisor.name} -> ${insertResult.slug}`);
        totalSuccess++;
      } else if (insertResult.error?.includes('Duplicate')) {
        console.log(`SKIPPED: ${advisor.name} - ${insertResult.error}`);
        totalSkipped++;
      } else {
        console.log(`ERROR: ${advisor.name} - ${insertResult.error}`);
        totalErrors++;
      }

      await delay(500);
    }

    // Delay between sources
    if (i < urls.length - 1) {
      console.log('\n>>> Waiting 3 seconds before next source...');
      await delay(3000);
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('SCRAPER PIPELINE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Sources scraped: ${urls.length}`);
  console.log(`Total advisors found: ${totalScraped}`);
  console.log(`Successfully added: ${totalSuccess}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log('='.repeat(60));
}
