import 'dotenv/config';
import { runScraperPipeline } from '../server/scraper';

const DEFAULT_URL = 'https://samslist.co/advisors';
const DEFAULT_LIMIT = 3;

async function main() {
  const url = process.argv[2] || DEFAULT_URL;
  const limit = parseInt(process.argv[3] || String(DEFAULT_LIMIT), 10);

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

  try {
    await runScraperPipeline(url, limit);
  } catch (error) {
    console.error('Pipeline failed:', error);
    process.exit(1);
  }
}

main();
