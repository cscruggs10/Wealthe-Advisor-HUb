/**
 * Seed Script: 10 High-Value CPA & Wealth Manager Profiles
 * Run via: npx tsx scripts/seed-advisors.ts
 * Or via API: Use the exported advisorSeedData with fetch()
 */

export const advisorSeedData = [
  {
    name: "Michael Harrison",
    firmName: "Harrison Wealth Partners",
    designation: "CPA & Wealth Manager",
    city: "Dallas",
    state: "TX",
    zipCode: "75201",
    websiteUrl: "https://harrisonwealth.com",
    linkedinUrl: "https://linkedin.com/in/michaelharrison",
    bio: "With over 25 years of experience, Michael Harrison specializes in proactive tax strategies for high-net-worth individuals and business owners. His expertise in captive insurance and reinsurance domiciles has saved clients millions in tax liabilities.",
    specialties: ["Reinsurance Domiciles", "Captive Insurance", "Tax Planning", "Estate Planning"],
    isVerifiedStrategist: true,
    slug: "michael-harrison-dallas-reinsurance"
  },
  {
    name: "Sarah Chen",
    firmName: "Chen Financial Advisory",
    designation: "Wealth Manager",
    city: "San Francisco",
    state: "CA",
    zipCode: "94105",
    websiteUrl: "https://chenfinancial.com",
    linkedinUrl: "https://linkedin.com/in/sarahchen",
    bio: "Sarah Chen is a fiduciary wealth advisor helping tech executives and entrepreneurs optimize their equity compensation and build multi-generational wealth through strategic tax planning.",
    specialties: ["Equity Compensation", "Tech Executive Planning", "RSU Optimization", "Wealth Transfer"],
    isVerifiedStrategist: true,
    slug: "sarah-chen-san-francisco-equity"
  },
  {
    name: "Robert Williams",
    firmName: "Williams & Associates CPAs",
    designation: "CPA",
    city: "New York",
    state: "NY",
    zipCode: "10017",
    websiteUrl: "https://williamscpa.com",
    linkedinUrl: "https://linkedin.com/in/robertwilliamscpa",
    bio: "Robert Williams leads a boutique CPA firm focused on real estate investors and private equity professionals. His innovative approach to cost segregation and 1031 exchanges has delivered exceptional results.",
    specialties: ["Real Estate Tax", "Cost Segregation", "1031 Exchanges", "Private Equity"],
    isVerifiedStrategist: true,
    slug: "robert-williams-new-york-real-estate"
  },
  {
    name: "Jennifer Martinez",
    firmName: "Pinnacle Wealth Strategies",
    designation: "Wealth Manager",
    city: "Miami",
    state: "FL",
    zipCode: "33131",
    websiteUrl: "https://pinnaclewealthstrategies.com",
    linkedinUrl: "https://linkedin.com/in/jennifermartinez",
    bio: "Jennifer Martinez specializes in cross-border wealth planning for international families and business owners. Her expertise spans domestic and offshore structures for optimal asset protection.",
    specialties: ["International Tax", "Cross-Border Planning", "Asset Protection", "Family Office"],
    isVerifiedStrategist: true,
    slug: "jennifer-martinez-miami-international"
  },
  {
    name: "David Thompson",
    firmName: "Thompson Tax Advisors",
    designation: "CPA",
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
    websiteUrl: "https://thompsontax.com",
    linkedinUrl: "https://linkedin.com/in/davidthompsoncpa",
    bio: "David Thompson has built a reputation for aggressive yet compliant tax strategies for medical professionals and practice owners. He specializes in retirement plan optimization and practice succession planning.",
    specialties: ["Medical Practice Tax", "Retirement Planning", "Practice Succession", "Defined Benefit Plans"],
    isVerifiedStrategist: false,
    slug: "david-thompson-chicago-medical"
  },
  {
    name: "Amanda Foster",
    firmName: "Foster Wealth Management",
    designation: "CPA & Wealth Manager",
    city: "Austin",
    state: "TX",
    zipCode: "78701",
    websiteUrl: "https://fosterwealth.com",
    linkedinUrl: "https://linkedin.com/in/amandafoster",
    bio: "Amanda Foster combines CPA expertise with comprehensive wealth management for startup founders and executives. She has guided over 200 clients through liquidity events and IPOs.",
    specialties: ["Startup Tax", "IPO Planning", "Qualified Small Business Stock", "Founder Planning"],
    isVerifiedStrategist: true,
    slug: "amanda-foster-austin-startup"
  },
  {
    name: "James Richardson",
    firmName: "Richardson Capital Partners",
    designation: "Wealth Manager",
    city: "Boston",
    state: "MA",
    zipCode: "02110",
    websiteUrl: "https://richardsoncapital.com",
    linkedinUrl: "https://linkedin.com/in/jamesrichardson",
    bio: "James Richardson manages over $500M in assets for ultra-high-net-worth families. His institutional approach to private wealth includes alternative investments, tax-loss harvesting, and philanthropic planning.",
    specialties: ["Ultra-HNW Planning", "Alternative Investments", "Philanthropic Planning", "Family Governance"],
    isVerifiedStrategist: true,
    slug: "james-richardson-boston-uhnw"
  },
  {
    name: "Lisa Patel",
    firmName: "Patel & Associates",
    designation: "CPA",
    city: "Houston",
    state: "TX",
    zipCode: "77002",
    websiteUrl: "https://patelcpa.com",
    linkedinUrl: "https://linkedin.com/in/lisapatelcpa",
    bio: "Lisa Patel is an energy sector tax specialist with deep expertise in oil & gas taxation, depletion allowances, and working interest structures. She serves both operators and passive investors.",
    specialties: ["Oil & Gas Tax", "Energy Investments", "Depletion Strategies", "Working Interests"],
    isVerifiedStrategist: false,
    slug: "lisa-patel-houston-energy"
  },
  {
    name: "Christopher Blake",
    firmName: "Blake Financial Group",
    designation: "Wealth Manager",
    city: "Scottsdale",
    state: "AZ",
    zipCode: "85251",
    websiteUrl: "https://blakefinancial.com",
    linkedinUrl: "https://linkedin.com/in/christopherblake",
    bio: "Christopher Blake focuses on retirement income optimization and tax-efficient withdrawal strategies. He has helped hundreds of retirees maximize their after-tax retirement income.",
    specialties: ["Retirement Income", "Social Security Optimization", "Roth Conversions", "Tax-Efficient Withdrawals"],
    isVerifiedStrategist: false,
    slug: "christopher-blake-scottsdale-retirement"
  },
  {
    name: "Elizabeth Morgan",
    firmName: "Morgan Strategic Advisors",
    designation: "CPA & Wealth Manager",
    city: "Atlanta",
    state: "GA",
    zipCode: "30309",
    websiteUrl: "https://morganstrategic.com",
    linkedinUrl: "https://linkedin.com/in/elizabethmorgan",
    bio: "Elizabeth Morgan leads a comprehensive financial planning practice for business owners. Her expertise in entity structuring, exit planning, and captive insurance has made her a sought-after advisor in the Southeast.",
    specialties: ["Business Exit Planning", "Entity Structuring", "Captive Insurance", "Succession Planning"],
    isVerifiedStrategist: true,
    slug: "elizabeth-morgan-atlanta-business"
  }
];

// Direct database seeding (for running via npx tsx)
async function seedDatabase() {
  const { db } = await import("../server/db");
  const { advisors } = await import("../shared/schema");

  console.log("🌱 Seeding 10 advisor profiles...\n");

  for (const advisor of advisorSeedData) {
    try {
      const [created] = await db.insert(advisors).values(advisor).returning();
      console.log(`✅ Created: ${created.name} (${created.designation}) - ${created.city}, ${created.state}`);
      console.log(`   Slug: ${created.slug}`);
      console.log(`   Verified Strategist: ${created.isVerifiedStrategist ? "Yes ⭐" : "No"}\n`);
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`⏭️  Skipped (already exists): ${advisor.name}\n`);
      } else {
        console.error(`❌ Error creating ${advisor.name}:`, error.message);
      }
    }
  }

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

// Run if executed directly
seedDatabase();
