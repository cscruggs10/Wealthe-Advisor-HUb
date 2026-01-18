import { pgTable, text, serial, integer, decimal, boolean, timestamp, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================
// STRATEGIC ADVISOR HUB - Directory Schema
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
  specialties: text("specialties").array(), // e.g., ['Tax Planning', 'Estate Planning', 'Reinsurance']
  isVerifiedStrategist: boolean("is_verified_strategist").notNull().default(false),
  slug: text("slug").notNull().unique(), // Format: name-city-specialty (e.g., john-smith-new-york-tax-planning)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  // Index on slug for fast lookups (SEO critical)
  slugIdx: uniqueIndex("advisors_slug_idx").on(table.slug),
  // Index for search queries
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
  sourcePage: text("source_page").notNull(), // Track which advisor profile generated the lead (slug or full URL)
  sourceType: text("source_type").notNull().default('reinsurance_cta'), // 'reinsurance_cta' | 'contact_form' | 'schedule_call'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  advisorIdIdx: index("leads_advisor_id_idx").on(table.advisorId),
  sourcePageIdx: index("leads_source_page_idx").on(table.sourcePage),
}));

// ============================================
// DEALMACHINE - Original Schema
// ============================================

export const dealers = pgTable("dealers", {
  id: serial("id").primaryKey(),
  dealerName: text("dealer_name").notNull(),
  address: text("address").notNull(),
  contactName: text("contact_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  // Billing contact information
  billingContactName: text("billing_contact_name").notNull(),
  billingContactEmail: text("billing_contact_email").notNull(),
  billingContactPhone: text("billing_contact_phone").notNull(),
  // Title contact information
  titleContactName: text("title_contact_name").notNull(),
  titleContactEmail: text("title_contact_email").notNull(),
  titleContactPhone: text("title_contact_phone").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  vin: text("vin").notNull(),
  make: text("make"),
  model: text("model"),
  trim: text("trim"),
  year: integer("year"),
  mileage: integer("mileage"),
  price: text("price"),
  description: text("description"),
  condition: text("condition"),
  videos: text("videos").array(),
  status: text("status").notNull().default('pending'), // 'pending', 'active', 'sold'
  inQueue: boolean("in_queue").notNull().default(true),
  billOfSale: text("bill_of_sale"), // URL to uploaded bill of sale document
  isPaid: boolean("is_paid").default(false),
});

export const buyCodes = pgTable("buy_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  dealerId: integer("dealer_id").notNull(),
  maxUses: integer("max_uses"),
  usageCount: integer("usage_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  dealerId: integer("dealer_id").notNull(),
  buyCodeId: integer("buy_code_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'completed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  isPaid: boolean("is_paid").default(false),
  billOfSale: text("bill_of_sale"), // URL to uploaded bill of sale document
  cancelled: boolean("cancelled").notNull().default(false), // Mark transaction as cancelled when vehicle is re-listed
});

export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull(),
  dealerId: integer("dealer_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'countered', 'accepted', 'declined', 'expired'
  counterAmount: decimal("counter_amount", { precision: 10, scale: 2 }),
  counterMessage: text("counter_message"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const offerActivities = pgTable("offer_activities", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  actorType: text("actor_type").notNull(), // 'dealer', 'admin'
  actorId: integer("actor_id"), // dealer_id for dealers, admin_user_id for admins
  actionType: text("action_type").notNull(), // 'offer_submitted', 'offer_countered', 'offer_accepted', 'offer_declined'
  amount: decimal("amount", { precision: 10, scale: 2 }),
  message: text("message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDealerSchema = createInsertSchema(dealers).omit({
  id: true,
  active: true,
  createdAt: true,
});

export const createInitialVehicleSchema = z.object({
  vin: z.string().length(17, "Please enter the full 17-character VIN"),
  videos: z.array(z.string()).optional().default([]),
});

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  id: true,
  status: true,
  inQueue: true,
  billOfSale: true,
  isPaid: true,
}).extend({
  vin: z.string().length(17, "VIN must be 17 characters"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  trim: z.string().optional(),
  year: z.number().int().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year"),
  mileage: z.number().int().min(0, "Invalid mileage"),
  price: z.string().min(1, "Price is required"),
  condition: z.enum(["Deal Machine Certified", "Auction Certified"], {
    required_error: "Certification type is required",
  }),
  videos: z.array(z.string()).min(1, "Video walkthrough is required"),
});

export const insertBuyCodeSchema = createInsertSchema(buyCodes).omit({
  id: true,
  usageCount: true,
  active: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  isPaid: true,
  billOfSale: true,
  cancelled: true,
});

export const insertOfferSchema = createInsertSchema(offers).omit({
  id: true,
  status: true,
  counterAmount: true,
  counterMessage: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOfferActivitySchema = createInsertSchema(offerActivities).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSchema = createInsertSchema(adminUsers).omit({
  id: true,
  createdAt: true,
});

export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type InitialVehicle = z.infer<typeof createInitialVehicleSchema>;
export type Dealer = typeof dealers.$inferSelect;
export type InsertDealer = z.infer<typeof insertDealerSchema>;
export type BuyCode = typeof buyCodes.$inferSelect;
export type InsertBuyCode = z.infer<typeof insertBuyCodeSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Offer = typeof offers.$inferSelect;
export type InsertOffer = z.infer<typeof insertOfferSchema>;
export type OfferActivity = typeof offerActivities.$inferSelect;
export type InsertOfferActivity = z.infer<typeof insertOfferActivitySchema>;
export type AdminUser = typeof adminUsers.$inferSelect;
export type InsertAdminUser = z.infer<typeof insertAdminSchema>;

// ============================================
// STRATEGIC ADVISOR HUB - Schemas & Types
// ============================================

// Helper to generate SEO-friendly slug: name-city-specialty
export function generateAdvisorSlug(name: string, city: string, primarySpecialty?: string): string {
  const parts = [name, city];
  if (primarySpecialty) {
    parts.push(primarySpecialty);
  }
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
    .replace(/^-|-$/g, '')       // Remove leading/trailing hyphens
    .substring(0, 100);          // Limit length for URL friendliness
}

export const insertAdvisorSchema = createInsertSchema(advisors).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  designation: z.enum(["CPA", "Wealth Manager", "CPA & Wealth Manager"], {
    required_error: "Designation is required",
  }),
  city: z.string().min(2, "City is required"),
  state: z.string().length(2, "State must be 2-letter abbreviation"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  bio: z.string().max(2000, "Bio must be under 2000 characters").optional(),
  specialties: z.array(z.string()).optional(),
  isVerifiedStrategist: z.boolean().optional().default(false),
  slug: z.string().min(5, "Slug is required").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
}).extend({
  advisorId: z.string().uuid("Invalid advisor ID"),
  userName: z.string().min(2, "Name is required"),
  userEmail: z.string().email("Valid email is required"),
  message: z.string().max(1000, "Message must be under 1000 characters").optional(),
  sourcePage: z.string().min(1, "Source page is required"), // Track the advisor slug/URL
  sourceType: z.enum(["reinsurance_cta", "contact_form", "schedule_call"]).optional().default("reinsurance_cta"),
});

// Search/filter schema for advisor queries
export const advisorSearchSchema = z.object({
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  designation: z.enum(["CPA", "Wealth Manager", "CPA & Wealth Manager"]).optional(),
  specialty: z.string().optional(),
  isVerifiedStrategist: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export type Advisor = typeof advisors.$inferSelect;
export type InsertAdvisor = z.infer<typeof insertAdvisorSchema>;
export type Lead = typeof leads.$inferSelect;
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type AdvisorSearch = z.infer<typeof advisorSearchSchema>;