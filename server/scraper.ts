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
 * Normalize city name for clean SEO URLs
 */
function normalizeCity(city: string): string {
  const lowerCity = city.toLowerCase().trim();

  // Check for common abbreviations/nicknames
  if (CITY_NORMALIZATIONS[lowerCity]) {
    return CITY_NORMALIZATIONS[lowerCity];
  }

  // Proper case the city name
  return city.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .replace(/\s+/g, ' '); // Remove extra spaces
}

/**
 * Normalize state to 2-letter abbreviation
 */
function normalizeState(state: string): string {
  const upperState = state.toUpperCase().trim();

  // If already a valid abbreviation, return it
  if (STATE_NAMES[upperState]) {
    return upperState;
  }

  // Check if it's a full state name and convert to abbreviation
  const entry = Object.entries(STATE_NAMES).find(
    ([_, name]) => name.toUpperCase() === upperState
  );

  if (entry) {
    return entry[0];
  }

  // Return as-is if can't normalize
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
  priorityScore?: number; // Higher = more valuable for our niche
}

// Priority keywords for advisor scoring
const HIGH_PRIORITY_KEYWORDS = [
  'tax', 'captive', 'reinsurance', '831(b)', '831b',
  'high net worth', 'hnw', 'uhnw', 'ultra high',
  'business owner', 'entrepreneur', 'succession',
  'estate planning', 'wealth preservation', 'tax optimization',
  'strategic', 'proactive', 'advanced tax'
];

const MEDIUM_PRIORITY_KEYWORDS = [
  'cpa', 'accounting', 'financial planning', 'wealth management',
  'investment', 'retirement', 'executive', 'corporate'
];

/**
 * Calculate priority score for an advisor (0-100)
 * Higher scores = more valuable for our Tax/Captive/HNW niche
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
  for (const keyword of HIGH_PRIORITY_KEYWORDS) {
    if (searchText.includes(keyword)) {
      score += 10;
    }
  }
  score = Math.min(score, 50);

  // Medium priority keywords (5 points each, max 25)
  let mediumScore = 0;
  for (const keyword of MEDIUM_PRIORITY_KEYWORDS) {
    if (searchText.includes(keyword)) {
      mediumScore += 5;
    }
  }
  score += Math.min(mediumScore, 25);

  // Bonus for CPA designation
  if (advisor.designation.includes('CPA')) {
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
 * Scrape advisors directly from the listing page content
 */
export async function scrapeAdvisorsFromListingPage(url: string, limit: number = 10): Promise<ScrapeResult> {
  console.log(`Scraping listing page: ${url}`);

  try {
    const result = await firecrawl.scrape(url, {
      formats: ['markdown'],
    });

    const content = result.markdown || '';

    if (!content) {
      return { success: false, advisors: [], error: 'No content returned from Firecrawl' };
    }

    // Parse advisors from the markdown content
    const advisors = parseAdvisorsFromMarkdown(content, limit);

    console.log(`Parsed ${advisors.length} advisors from page`);

    return { success: true, advisors };
  } catch (error) {
    return { success: false, advisors: [], error: `Scrape error: ${error}` };
  }
}

/**
 * Parse advisor data from the markdown content
 * Format: ![Name | Specialties](image_url)\n\nName\n\n...\n\n"testimonial"
 */
function parseAdvisorsFromMarkdown(content: string, limit: number): ScrapedAdvisor[] {
  const advisors: ScrapedAdvisor[] = [];

  // Pattern to match advisor entries
  // ![Name | Specialties](url)\n\nName
  const advisorPattern = /!\[([^\|]+)\s*\|\s*([^\]]+)\]\([^)]+\)\s*\n\n([^\n]+?)(?:\n|$)/g;

  let match;
  while ((match = advisorPattern.exec(content)) !== null && advisors.length < limit) {
    const imageAltName = match[1].trim();
    const specialtiesStr = match[2].trim();
    const displayName = match[3].trim();

    // Skip navigation items, logos, etc.
    if (displayName.includes('Home') ||
        displayName.includes('Contact') ||
        displayName.includes('View More') ||
        displayName.length < 3 ||
        displayName.startsWith('#') ||
        displayName.startsWith('!')) {
      continue;
    }

    // Parse specialties
    const specialties = specialtiesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

    // Extract any testimonial/bio that follows
    const afterMatch = content.substring(match.index + match[0].length);
    const bioMatch = afterMatch.match(/"([^"]{50,500})"/);
    const bio = bioMatch ? bioMatch[1] : undefined;

    // Determine designation based on specialties
    let designation: 'CPA' | 'Wealth Manager' | 'CPA & Wealth Manager' = 'Wealth Manager';
    const specialtiesLower = specialtiesStr.toLowerCase();
    if (specialtiesLower.includes('tax') && (specialtiesLower.includes('wealth') || specialtiesLower.includes('financial'))) {
      designation = 'CPA & Wealth Manager';
    } else if (specialtiesLower.includes('tax') || specialtiesLower.includes('accounting')) {
      designation = 'CPA';
    }

    // Use the display name (cleaner) but fall back to image alt name
    const name = displayName || imageAltName;

    // Skip if we already have this advisor
    if (advisors.some(a => a.name === name)) {
      continue;
    }

    advisors.push({
      name,
      designation,
      city: 'New York', // Default - samslist doesn't show location on listing
      state: 'NY',
      zipCode: '10001',
      bio,
      specialties: specialties.slice(0, 5), // Limit to 5 specialties
    });
  }

  // If regex didn't work well, try alternative parsing
  if (advisors.length === 0) {
    return parseAdvisorsAlternative(content, limit);
  }

  return advisors;
}

/**
 * Alternative parsing method - look for name patterns
 */
function parseAdvisorsAlternative(content: string, limit: number): ScrapedAdvisor[] {
  const advisors: ScrapedAdvisor[] = [];
  const lines = content.split('\n');

  // Common advisor name patterns (CFP, CPA, etc after name)
  const namePatterns = [
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s*(?:CFP|CPA|EA|BFA|CEPA)/,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*$/,
  ];

  const seenNames = new Set<string>();

  for (let i = 0; i < lines.length && advisors.length < limit; i++) {
    const line = lines[i].trim();

    // Skip short lines, headers, links
    if (line.length < 5 || line.startsWith('#') || line.startsWith('[') || line.startsWith('!')) {
      continue;
    }

    for (const pattern of namePatterns) {
      const match = line.match(pattern);
      if (match) {
        const name = match[1] || match[0];

        // Skip if already seen or looks like a company
        if (seenNames.has(name) ||
            name.includes('LLC') ||
            name.includes('Inc') ||
            name.includes('Group') ||
            name.includes('Wealth') ||
            name.length < 5) {
          continue;
        }

        seenNames.add(name);

        // Look for specialties in surrounding lines
        const context = lines.slice(Math.max(0, i - 3), i + 5).join(' ');
        const specialties: string[] = [];

        const specialtyKeywords = [
          '401(k)', 'IRA', 'Tax', 'Estate', 'Retirement', 'Investment',
          'Financial Planning', 'Wealth Management', 'Portfolio', 'Insurance'
        ];

        for (const keyword of specialtyKeywords) {
          if (context.includes(keyword)) {
            specialties.push(keyword.includes('401') ? '401(k) Management' : keyword);
          }
        }

        // Look for bio/testimonial
        const bioMatch = context.match(/"([^"]{30,300})"/);

        advisors.push({
          name: name.trim(),
          designation: 'Wealth Manager',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          bio: bioMatch ? bioMatch[1] : undefined,
          specialties: specialties.length > 0 ? specialties : ['Financial Planning', 'Wealth Management'],
        });

        break;
      }
    }
  }

  return advisors;
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
    // Normalize city and state for clean SEO URLs
    const normalizedCity = normalizeCity(scraped.city);
    const normalizedState = normalizeState(scraped.state);

    console.log(`  Location: ${scraped.city}, ${scraped.state} -> ${normalizedCity}, ${normalizedState}`);

    // Generate slug with normalized location
    const slug = generateAdvisorSlug(scraped.name, normalizedCity, scraped.specialties?.[0] || scraped.designation);

    // Check for duplicates
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

    // Merge specialties
    const finalSpecialties = [
      ...new Set([
        ...(scraped.specialties || []),
        ...(rewrittenData.specialties || []),
      ])
    ].slice(0, 6);

    // Insert into database with normalized location data
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
 * Main scraping pipeline
 */
export async function runScraperPipeline(listingUrl: string, limit: number = 3): Promise<void> {
  console.log('='.repeat(50));
  console.log('Starting Advisor Scraper Pipeline');
  console.log(`Target: ${listingUrl}`);
  console.log(`Limit: ${limit} profiles`);
  console.log('='.repeat(50));

  // Step 1: Scrape advisors from listing page
  const scrapeResult = await scrapeAdvisorsFromListingPage(listingUrl, limit);

  if (!scrapeResult.success || scrapeResult.advisors.length === 0) {
    console.log(`No advisors found: ${scrapeResult.error || 'Unknown error'}`);
    return;
  }

  console.log(`\nFound ${scrapeResult.advisors.length} advisors to process`);

  // Step 2: Sort advisors by priority (Tax/Captive/HNW keywords first)
  const prioritizedAdvisors = sortByPriority(scrapeResult.advisors);

  console.log('\nPriority-sorted advisors:');
  prioritizedAdvisors.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.name} (score: ${a.priorityScore})`);
  });
  console.log('');

  // Step 3: Process each advisor (highest priority first)
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const advisor of prioritizedAdvisors) {
    console.log('-'.repeat(40));
    console.log(`Processing: ${advisor.name}`);

    const insertResult = await processAndInsertAdvisor(advisor);

    if (insertResult.success) {
      console.log(`SUCCESS: Added ${advisor.name} -> ${insertResult.slug}`);
      successCount++;
    } else if (insertResult.error?.includes('Duplicate')) {
      console.log(`SKIPPED: ${advisor.name} - ${insertResult.error}`);
      skipCount++;
    } else {
      console.log(`ERROR: ${advisor.name} - ${insertResult.error}`);
      errorCount++;
    }

    // Rate limiting for AI calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n' + '='.repeat(50));
  console.log('Scraper Pipeline Complete');
  console.log(`Success: ${successCount} | Skipped: ${skipCount} | Errors: ${errorCount}`);
  console.log('='.repeat(50));
}
