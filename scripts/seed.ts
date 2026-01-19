import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { advisors, generateAdvisorSlug } from '../shared/schema';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

const advisorData = [
  {
    name: "Robert Chen",
    firmName: "Chen Financial Partners",
    designation: "CPA & Wealth Manager" as const,
    city: "New York",
    state: "NY",
    zipCode: "10001",
    websiteUrl: "https://chenfinancial.com",
    bio: "With over 20 years of experience in wealth management and tax planning, Robert Chen specializes in helping high-net-worth individuals optimize their financial strategies through captive insurance and reinsurance solutions.",
    specialties: ["Captive Insurance", "Tax Planning", "Estate Planning", "Retirement Planning"],
    isVerifiedStrategist: true,
  },
  {
    name: "Sarah Mitchell",
    firmName: "Mitchell Wealth Advisory",
    designation: "Wealth Manager" as const,
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    websiteUrl: "https://mitchellwealth.com",
    linkedinUrl: "https://linkedin.com/in/sarahmitchell",
    bio: "Sarah Mitchell is a certified wealth manager specializing in reinsurance strategies for business owners. She helps clients protect and grow their wealth through innovative risk management solutions.",
    specialties: ["Reinsurance", "Business Succession", "Asset Protection", "Investment Management"],
    isVerifiedStrategist: true,
  },
  {
    name: "Michael Thompson",
    firmName: "Thompson & Associates CPAs",
    designation: "CPA" as const,
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
    websiteUrl: "https://thompsonCPAs.com",
    bio: "Michael Thompson leads a team of strategic CPAs focused on tax optimization for entrepreneurs and business owners utilizing captive insurance structures.",
    specialties: ["Tax Optimization", "Captive Insurance", "Business Tax Planning", "IRS Representation"],
    isVerifiedStrategist: true,
  },
  {
    name: "Jennifer Williams",
    firmName: "Williams Financial Group",
    designation: "CPA & Wealth Manager" as const,
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    websiteUrl: "https://williamsfinancialgroup.com",
    bio: "Jennifer Williams combines her CPA expertise with wealth management to deliver comprehensive financial strategies. She specializes in reinsurance domicile planning for Texas business owners.",
    specialties: ["Reinsurance Domiciles", "Tax Strategy", "Wealth Preservation", "Business Planning"],
    isVerifiedStrategist: true,
  },
  {
    name: "David Martinez",
    firmName: "Martinez Wealth Strategies",
    designation: "Wealth Manager" as const,
    city: "Phoenix",
    state: "AZ",
    zipCode: "85001",
    bio: "David Martinez helps clients navigate complex financial decisions with a focus on risk management and wealth accumulation through strategic insurance solutions.",
    specialties: ["Risk Management", "Insurance Planning", "Retirement Strategies", "Investment Advisory"],
    isVerifiedStrategist: false,
  },
  {
    name: "Amanda Foster",
    firmName: "Foster CPA Services",
    designation: "CPA" as const,
    city: "Philadelphia",
    state: "PA",
    zipCode: "19101",
    websiteUrl: "https://fostercpa.com",
    bio: "Amanda Foster is a strategic CPA with expertise in tax planning for high-income professionals and business owners seeking alternative risk financing solutions.",
    specialties: ["Tax Planning", "Alternative Risk Financing", "Business Advisory", "Financial Reporting"],
    isVerifiedStrategist: true,
  },
  {
    name: "Christopher Lee",
    firmName: "Lee Capital Management",
    designation: "Wealth Manager" as const,
    city: "San Antonio",
    state: "TX",
    zipCode: "78201",
    linkedinUrl: "https://linkedin.com/in/christopherlee",
    bio: "Christopher Lee specializes in comprehensive wealth management for business owners, with particular expertise in captive insurance and reinsurance structures.",
    specialties: ["Captive Insurance", "Portfolio Management", "Estate Planning", "Business Exit Planning"],
    isVerifiedStrategist: true,
  },
  {
    name: "Lisa Anderson",
    firmName: "Anderson Financial Advisors",
    designation: "CPA & Wealth Manager" as const,
    city: "San Diego",
    state: "CA",
    zipCode: "92101",
    websiteUrl: "https://andersonfa.com",
    bio: "Lisa Anderson provides integrated tax and wealth management services, helping California business owners leverage strategic insurance solutions for tax efficiency.",
    specialties: ["Integrated Tax Planning", "Wealth Management", "Insurance Strategies", "Succession Planning"],
    isVerifiedStrategist: true,
  },
  {
    name: "James Wilson",
    firmName: "Wilson Tax & Advisory",
    designation: "CPA" as const,
    city: "Dallas",
    state: "TX",
    zipCode: "75201",
    websiteUrl: "https://wilsontax.com",
    bio: "James Wilson is a strategic CPA focused on helping Texas entrepreneurs minimize their tax burden through sophisticated planning strategies including captive insurance.",
    specialties: ["Tax Minimization", "Captive Insurance", "Business Structuring", "Audit Defense"],
    isVerifiedStrategist: false,
  },
  {
    name: "Emily Rodriguez",
    firmName: "Rodriguez Wealth Partners",
    designation: "Wealth Manager" as const,
    city: "San Jose",
    state: "CA",
    zipCode: "95101",
    websiteUrl: "https://rodriguezwealth.com",
    linkedinUrl: "https://linkedin.com/in/emilyrodriguez",
    bio: "Emily Rodriguez works with tech executives and entrepreneurs in Silicon Valley, providing strategic wealth planning that includes innovative risk management solutions.",
    specialties: ["Tech Executive Planning", "Equity Compensation", "Risk Management", "Reinsurance"],
    isVerifiedStrategist: true,
  },
];

async function seed() {
  console.log('Seeding advisors...');

  for (const advisor of advisorData) {
    const slug = generateAdvisorSlug(
      advisor.name,
      advisor.city,
      advisor.specialties?.[0]
    );

    await db.insert(advisors).values({
      ...advisor,
      slug,
    });

    console.log(`Added: ${advisor.name} (${slug})`);
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
