import { pgTable, text, uuid, boolean, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// STRATEGIC ADVISOR HUB - Database Schema
// ============================================

export const advisors = pgTable("advisors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  firmName: text("firm_name"),
  designation: text("designation").notNull(), // 'CPA' | 'Wealth Manager' | 'CPA & Wealth Manager'
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCode: text("zip_code").notNull(),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  bio: text("bio"),
  specialties: text("specialties").array(),
  isVerifiedStrategist: boolean("is_verified_strategist").notNull().default(false),
  slug: text("slug").notNull().unique(), // Format: name-city-specialty
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("advisors_slug_idx").on(table.slug),
  cityIdx: index("advisors_city_idx").on(table.city),
  stateIdx: index("advisors_state_idx").on(table.state),
  zipCodeIdx: index("advisors_zip_code_idx").on(table.zipCode),
  designationIdx: index("advisors_designation_idx").on(table.designation),
}));

export const leads = pgTable("leads", {
  id: uuid("id").defaultRandom().primaryKey(),
  advisorId: uuid("advisor_id").references(() => advisors.id).notNull(),
  userName: text("user_name").notNull(),
  userEmail: text("user_email").notNull(),
  message: text("message"),
  estimatedRevenue: text("estimated_revenue"), // '$0-1M' | '$1M-5M' | '$5M+'
  interestedInCaptives: boolean("interested_in_captives").default(false),
  hasStrategicCpa: text("has_strategic_cpa"), // 'yes' | 'no' | 'looking-to-replace'
  sourcePage: text("source_page").notNull(),
  sourceType: text("source_type").notNull().default('reinsurance_cta'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  advisorIdIdx: index("leads_advisor_id_idx").on(table.advisorId),
  sourcePageIdx: index("leads_source_page_idx").on(table.sourcePage),
}));

export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default('strategy'), // 'strategy' | 'tax' | 'wealth'
  readTime: text("read_time").notNull().default('5 min read'),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  slugIdx: uniqueIndex("blog_posts_slug_idx").on(table.slug),
  categoryIdx: index("blog_posts_category_idx").on(table.category),
}));

// ============================================
// Validation Schemas
// ============================================

export function generateAdvisorSlug(name: string, city: string, primarySpecialty?: string): string {
  const parts = [name, city];
  if (primarySpecialty) parts.push(primarySpecialty);
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

export const insertAdvisorSchema = createInsertSchema(advisors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  designation: z.enum(["CPA", "Wealth Manager", "CPA & Wealth Manager"]),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "State must be 2-letter abbreviation"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(2000).optional(),
  specialties: z.array(z.string()).optional(),
  isVerifiedStrategist: z.boolean().optional().default(false),
  slug: z.string().min(5).regex(/^[a-z0-9-]+$/),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
}).extend({
  advisorId: z.string().uuid(),
  userName: z.string().min(2, "Name is required"),
  userEmail: z.string().email("Valid email is required"),
  message: z.string().max(1000).optional(),
  estimatedRevenue: z.enum(["$0-1M", "$1M-5M", "$5M+"]).optional(),
  interestedInCaptives: z.boolean().optional().default(false),
  hasStrategicCpa: z.enum(["yes", "no", "looking-to-replace"]).optional(),
  sourcePage: z.string().min(1),
  sourceType: z.enum(["reinsurance_cta", "contact_form", "schedule_call"]).optional().default("reinsurance_cta"),
});

export const advisorSearchSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  designation: z.enum(["CPA", "Wealth Manager", "CPA & Wealth Manager"]).optional(),
  query: z.string().optional(),
  isVerifiedStrategist: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(10, "Title must be at least 10 characters"),
  slug: z.string().min(5).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().min(50).max(300),
  content: z.string().min(500),
  category: z.enum(["strategy", "tax", "wealth"]).optional().default("strategy"),
  readTime: z.string().optional().default("5 min read"),
  isPublished: z.boolean().optional().default(true),
});

export function generateBlogSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 100);
}

// Types
export type Advisor = typeof advisors.$inferSelect;
export type InsertAdvisor = z.infer<typeof insertAdvisorSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type AdvisorSearch = z.infer<typeof advisorSearchSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
