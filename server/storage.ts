import {
  type Advisor, type InsertAdvisor,
  type Lead, type InsertLead,
  type AdvisorSearch,
  type BlogPost, type InsertBlogPost,
  advisors, leads, blogPosts,
} from '../shared/schema';
import { db } from './db';
import { eq, and, ilike, or, count, gte, sql, desc } from 'drizzle-orm';

class DatabaseStorage {
  // Advisors
  async getAdvisors(search?: AdvisorSearch): Promise<Advisor[]> {
    let query = db.select().from(advisors);
    const conditions: any[] = [];

    if (search?.city) {
      conditions.push(ilike(advisors.city, `%${search.city}%`));
    }
    if (search?.state) {
      conditions.push(eq(advisors.state, search.state.toUpperCase()));
    }
    if (search?.zipCode) {
      conditions.push(eq(advisors.zipCode, search.zipCode));
    }
    if (search?.designation) {
      conditions.push(eq(advisors.designation, search.designation));
    }
    if (search?.isVerifiedStrategist !== undefined) {
      conditions.push(eq(advisors.isVerifiedStrategist, search.isVerifiedStrategist));
    }
    if (search?.query) {
      conditions.push(
        or(
          ilike(advisors.name, `%${search.query}%`),
          ilike(advisors.city, `%${search.query}%`),
          ilike(advisors.firmName, `%${search.query}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const limit = search?.limit ?? 200;
    const offset = search?.offset ?? 0;

    return query.limit(limit).offset(offset);
  }

  async getAdvisorBySlug(slug: string): Promise<Advisor | undefined> {
    const [advisor] = await db.select().from(advisors).where(eq(advisors.slug, slug));
    return advisor;
  }

  async getAdvisorById(id: string): Promise<Advisor | undefined> {
    const [advisor] = await db.select().from(advisors).where(eq(advisors.id, id));
    return advisor;
  }

  async createAdvisor(data: InsertAdvisor): Promise<Advisor> {
    const [advisor] = await db.insert(advisors).values(data).returning();
    return advisor;
  }

  async updateAdvisor(id: string, data: Partial<Advisor>): Promise<Advisor> {
    const [advisor] = await db
      .update(advisors)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(advisors.id, id))
      .returning();
    return advisor;
  }

  // Leads
  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeadsByAdvisor(advisorId: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.advisorId, advisorId));
  }

  async getLeadsBySourcePage(sourcePage: string): Promise<Lead[]> {
    return db.select().from(leads).where(eq(leads.sourcePage, sourcePage));
  }

  async getAllLeads(): Promise<Lead[]> {
    return db.select().from(leads);
  }

  // Sitemap
  async getAllAdvisorSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return db.select({ slug: advisors.slug, updatedAt: advisors.updatedAt }).from(advisors);
  }

  // Stats
  async getStats(): Promise<{ totalAdvisors: number; leadsToday: number; totalLeads: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [advisorCount] = await db.select({ count: count() }).from(advisors);
    const [leadCount] = await db.select({ count: count() }).from(leads);
    const [todayLeadCount] = await db.select({ count: count() }).from(leads).where(gte(leads.createdAt, today));

    return {
      totalAdvisors: advisorCount?.count || 0,
      leadsToday: todayLeadCount?.count || 0,
      totalLeads: leadCount?.count || 0,
    };
  }

  // Blog Posts
  async getBlogPosts(): Promise<BlogPost[]> {
    return db.select().from(blogPosts).where(eq(blogPosts.isPublished, true)).orderBy(desc(blogPosts.createdAt));
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post;
  }

  async createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db.insert(blogPosts).values(data).returning();
    return post;
  }

  async getAllBlogSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    return db.select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt }).from(blogPosts).where(eq(blogPosts.isPublished, true));
  }

  // Get random verified strategists (advisors with Tax Strategy or Reinsurance specialties)
  async getRandomStrategists(limit: number = 3): Promise<Advisor[]> {
    const allAdvisors = await db.select().from(advisors);
    const strategists = allAdvisors.filter(a =>
      a.specialties?.some(s =>
        s.toLowerCase().includes('tax strategy') ||
        s.toLowerCase().includes('reinsurance') ||
        s.toLowerCase().includes('captive')
      )
    );
    // Shuffle and take limit
    const shuffled = strategists.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit);
  }

  // ============================================
  // pSEO Hub Page Methods
  // ============================================

  // Get all unique specialties with counts
  async getUniqueSpecialties(): Promise<{ specialty: string; slug: string; count: number }[]> {
    const allAdvisors = await db.select().from(advisors);
    const specialtyMap = new Map<string, number>();

    allAdvisors.forEach(advisor => {
      advisor.specialties?.forEach(specialty => {
        const normalized = specialty.trim();
        specialtyMap.set(normalized, (specialtyMap.get(normalized) || 0) + 1);
      });
    });

    return Array.from(specialtyMap.entries())
      .map(([specialty, count]) => ({
        specialty,
        slug: specialty.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Get all unique cities with counts
  async getUniqueCities(): Promise<{ city: string; state: string; slug: string; count: number }[]> {
    const allAdvisors = await db.select().from(advisors);
    const cityMap = new Map<string, { city: string; state: string; count: number }>();

    allAdvisors.forEach(advisor => {
      const key = `${advisor.city}-${advisor.state}`;
      if (cityMap.has(key)) {
        cityMap.get(key)!.count++;
      } else {
        cityMap.set(key, { city: advisor.city, state: advisor.state, count: 1 });
      }
    });

    return Array.from(cityMap.values())
      .map(({ city, state, count }) => ({
        city,
        state,
        slug: `${city}-${state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Get advisors by specialty
  async getAdvisorsBySpecialty(specialtySlug: string): Promise<Advisor[]> {
    const allAdvisors = await db.select().from(advisors);
    return allAdvisors.filter(advisor =>
      advisor.specialties?.some(s =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === specialtySlug
      )
    );
  }

  // Get advisors by city
  async getAdvisorsByCity(citySlug: string): Promise<Advisor[]> {
    const allAdvisors = await db.select().from(advisors);
    return allAdvisors.filter(advisor => {
      const advisorCitySlug = `${advisor.city}-${advisor.state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      return advisorCitySlug === citySlug;
    });
  }

  // Get advisors by specialty AND city (Golden Page)
  async getAdvisorsBySpecialtyAndCity(specialtySlug: string, citySlug: string): Promise<Advisor[]> {
    const allAdvisors = await db.select().from(advisors);
    return allAdvisors.filter(advisor => {
      const advisorCitySlug = `${advisor.city}-${advisor.state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const hasSpecialty = advisor.specialties?.some(s =>
        s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === specialtySlug
      );
      return advisorCitySlug === citySlug && hasSpecialty;
    });
  }

  // Get specialty info from slug
  async getSpecialtyFromSlug(slug: string): Promise<{ specialty: string; count: number } | undefined> {
    const specialties = await this.getUniqueSpecialties();
    return specialties.find(s => s.slug === slug);
  }

  // Get city info from slug
  async getCityFromSlug(slug: string): Promise<{ city: string; state: string; count: number } | undefined> {
    const cities = await this.getUniqueCities();
    return cities.find(c => c.slug === slug);
  }

  // Get all specialty/city combinations for sitemap (Golden Pages)
  async getAllSpecialtyCityCombinations(): Promise<{ specialtySlug: string; citySlug: string; count: number }[]> {
    const allAdvisors = await db.select().from(advisors);
    const comboMap = new Map<string, number>();

    allAdvisors.forEach(advisor => {
      const citySlug = `${advisor.city}-${advisor.state}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      advisor.specialties?.forEach(specialty => {
        const specialtySlug = specialty.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const key = `${specialtySlug}|${citySlug}`;
        comboMap.set(key, (comboMap.get(key) || 0) + 1);
      });
    });

    return Array.from(comboMap.entries())
      .map(([key, count]) => {
        const [specialtySlug, citySlug] = key.split('|');
        return { specialtySlug, citySlug, count };
      })
      .filter(combo => combo.count > 0)
      .sort((a, b) => b.count - a.count);
  }
}

export const storage = new DatabaseStorage();
