import 'dotenv/config';
import { runScraperPipeline } from '../server/scraper';

const DEFAULT_URL = 'https://samslist.co/advisors';
const DEFAULT_LIMIT = 20; // Per page limit
const DEFAULT_MAX_PAGES = 1;

async function main() {
  // Parse arguments: [limit] [maxPages] or [url] [limit] [maxPages]
  const args = process.argv.slice(2);

  let url = DEFAULT_URL;
  let limit = DEFAULT_LIMIT;
  let maxPages = DEFAULT_MAX_PAGES;

  if (args.length === 1 && /^\d+$/.test(args[0])) {
    // Single number = limit per page
    limit = parseInt(args[0], 10);
  } else if (args.length === 2 && /^\d+$/.test(args[0]) && /^\d+$/.test(args[1])) {
    // Two numbers = limit, maxPages
    limit = parseInt(args[0], 10);
    maxPages = parseInt(args[1], 10);
  } else if (args.length >= 1 && !(/^\d+$/.test(args[0]))) {
    // First arg is URL
    url = args[0];
    if (args[1]) limit = parseInt(args[1], 10);
    if (args[2]) maxPages = parseInt(args[2], 10);
  }

  // Validate environment variables
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set in .env');
    process.exit(1);
  }

  if (!process.env.FIRECRAWL_API_KEY) {
    console.error('ERROR: FIRECRAWL_API_KEY is not set in .env');
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ERROR: ANTHROPIC_API_KEY is not set in .env');
    process.exit(1);
  }

  console.log('Environment variables validated.\n');
  console.log('Usage: npm run scraper [limit] [maxPages]');
  console.log('       npm run scraper [url] [limit] [maxPages]\n');

  try {
    await runScraperPipeline(url, limit, maxPages);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

main();
