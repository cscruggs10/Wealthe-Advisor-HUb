import {
  type Vehicle, type InsertVehicle,
  type BuyCode, type InsertBuyCode,
  type Offer, type InsertOffer,
  type OfferActivity, type InsertOfferActivity,
  type Dealer, type InsertDealer,
  type Transaction, type InsertTransaction,
  vehicles, buyCodes, offers, offerActivities, dealers, transactions,
  type AdminUser, type InsertAdminUser,
  adminUsers,
  // Strategic Advisor Hub
  type Advisor, type InsertAdvisor,
  type Lead, type InsertLead,
  type AdvisorSearch,
  advisors, leads,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, lt, or, ilike, arrayContains } from "drizzle-orm";

export interface IStorage {
  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  getVehicleByVin(vin: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle>;

  // Dealers
  createDealer(dealer: InsertDealer): Promise<Dealer>;
  getDealerByUsername(username: string): Promise<Dealer | undefined>;
  getDealerById(id: number): Promise<Dealer | undefined>;
  getDealers(): Promise<Dealer[]>;
  updateDealer(id: number, update: Partial<Dealer>): Promise<Dealer>;
  getDealerByDealerName(dealerName: string): Promise<Dealer | undefined>;

  // Buy Codes
  getBuyCode(code: string): Promise<BuyCode | undefined>;
  createBuyCode(buyCode: InsertBuyCode): Promise<BuyCode>;
  updateBuyCodeUsage(id: number): Promise<BuyCode>;
  getDealerBuyCodes(dealerId: number): Promise<BuyCode[]>;
  getAllBuyCodes(): Promise<BuyCode[]>;

  // Transactions
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getDealerTransactions(dealerId: number): Promise<Transaction[]>;
  getTransactions(): Promise<Transaction[]>;
  updateTransaction(id: number, update: Partial<Transaction>): Promise<Transaction>;
  cancelVehicleTransactions(vehicleId: number): Promise<void>;

  // Offers
  getOffers(vehicleId: number): Promise<Offer[]>;
  getAllOffers(): Promise<Offer[]>;
  getDealerOffers(dealerId: number): Promise<Offer[]>;
  createOffer(offer: InsertOffer): Promise<Offer>;
  updateOffer(id: number, update: Partial<Offer>): Promise<Offer>;
  getOfferWithActivities(offerId: number): Promise<(Offer & { activities: OfferActivity[] }) | undefined>;
  
  // Offer Activities
  createOfferActivity(activity: InsertOfferActivity): Promise<OfferActivity>;
  getOfferActivities(offerId: number): Promise<OfferActivity[]>;
  
  // Offer Management
  expireOldOffers(): Promise<void>;
  createOfferWithActivity(offer: InsertOffer, activity: InsertOfferActivity): Promise<Offer>;

  // Admin Users
  getAdminByEmail(email: string): Promise<AdminUser | undefined>;
  createAdminUser(admin: InsertAdminUser): Promise<AdminUser>;

  // Strategic Advisor Hub - Advisors
  getAdvisors(search?: AdvisorSearch): Promise<Advisor[]>;
  getAdvisorBySlug(slug: string): Promise<Advisor | undefined>;
  getAdvisorById(id: string): Promise<Advisor | undefined>;
  createAdvisor(advisor: InsertAdvisor): Promise<Advisor>;
  updateAdvisor(id: string, advisor: Partial<Advisor>): Promise<Advisor>;

  // Strategic Advisor Hub - Leads
  createLead(lead: InsertLead): Promise<Lead>;
  getLeadsByAdvisor(advisorId: string): Promise<Lead[]>;
  getLeadsBySourcePage(sourcePage: string): Promise<Lead[]>;
  getAllLeads(): Promise<Lead[]>;
}

export class DatabaseStorage implements IStorage {
  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return db.select().from(vehicles);
  }

  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle;
  }

  async getVehicleByVin(vin: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.vin, vin));
    return vehicle;
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(insertVehicle).returning();
    return vehicle;
  }

  async updateVehicle(id: number, update: Partial<Vehicle>): Promise<Vehicle> {
    const [vehicle] = await db
      .update(vehicles)
      .set(update)
      .where(eq(vehicles.id, id))
      .returning();
    return vehicle;
  }

  // Dealers
  async createDealer(insertDealer: InsertDealer): Promise<Dealer> {
    try {
      console.log('Creating dealer with data:', insertDealer);
      const [dealer] = await db.insert(dealers).values(insertDealer).returning();
      console.log('Created dealer:', dealer);
      return dealer;
    } catch (error) {
      console.error('Error in createDealer:', error);
      throw error;
    }
  }

  async getDealerByUsername(username: string): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.username, username));
    return dealer;
  }

  async getDealerById(id: number): Promise<Dealer | undefined> {
    const [dealer] = await db.select().from(dealers).where(eq(dealers.id, id));
    return dealer;
  }

  async getDealers(): Promise<Dealer[]> {
    return db.select().from(dealers);
  }

  async updateDealer(id: number, update: Partial<Dealer>): Promise<Dealer> {
    const [dealer] = await db
      .update(dealers)
      .set(update)
      .where(eq(dealers.id, id))
      .returning();
    return dealer;
  }

  async getDealerByDealerName(dealerName: string): Promise<Dealer | undefined> { 
    const [dealer] = await db.select().from(dealers).where(eq(dealers.dealerName, dealerName));
    return dealer;
  }

  // Buy Codes
  async getBuyCode(code: string): Promise<BuyCode | undefined> {
    const [buyCode] = await db
      .select()
      .from(buyCodes)
      .where(
        eq(buyCodes.code, code)
      );
    return buyCode;
  }

  async createBuyCode(insertBuyCode: InsertBuyCode): Promise<BuyCode> {
    const [buyCode] = await db.insert(buyCodes).values(insertBuyCode).returning();
    return buyCode;
  }

  async updateBuyCodeUsage(id: number): Promise<BuyCode> {
    // First get the current usage count
    const [current] = await db
      .select()
      .from(buyCodes)
      .where(eq(buyCodes.id, id));

    // Then increment it
    const [buyCode] = await db
      .update(buyCodes)
      .set({ 
        usageCount: (current?.usageCount || 0) + 1
      })
      .where(eq(buyCodes.id, id))
      .returning();
    return buyCode;
  }

  async getDealerBuyCodes(dealerId: number): Promise<BuyCode[]> {
    return db.select().from(buyCodes).where(eq(buyCodes.dealerId, dealerId));
  }

  async getAllBuyCodes(): Promise<BuyCode[]> { 
    return db.select().from(buyCodes);
  }

  // Transactions
  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async getDealerTransactions(dealerId: number): Promise<Transaction[]> {
    return db.select().from(transactions)
      .where(and(
        eq(transactions.dealerId, dealerId),
        eq(transactions.cancelled, false)
      )); // Only show non-cancelled transactions
  }

  async getTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions);
  }

  async updateTransaction(id: number, update: Partial<Transaction>): Promise<Transaction> {
    const [transaction] = await db
      .update(transactions)
      .set(update)
      .where(eq(transactions.id, id))
      .returning();
    return transaction;
  }

  async cancelVehicleTransactions(vehicleId: number): Promise<void> {
    await db
      .update(transactions)
      .set({ cancelled: true })
      .where(eq(transactions.vehicleId, vehicleId));
  }

  // Offers
  async getOffers(vehicleId: number): Promise<Offer[]> {
    return db.select().from(offers).where(eq(offers.vehicleId, vehicleId));
  }

  async getAllOffers(): Promise<Offer[]> {
    return db.select().from(offers);
  }

  async getDealerOffers(dealerId: number): Promise<Offer[]> {
    return db.select().from(offers).where(eq(offers.dealerId, dealerId));
  }

  async createOffer(insertOffer: InsertOffer): Promise<Offer> {
    const [offer] = await db.insert(offers).values(insertOffer).returning();
    return offer;
  }

  async updateOffer(id: number, update: Partial<Offer>): Promise<Offer> {
    const [offer] = await db
      .update(offers)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(offers.id, id))
      .returning();
    return offer;
  }

  async getOfferWithActivities(offerId: number): Promise<(Offer & { activities: OfferActivity[] }) | undefined> {
    const [offer] = await db.select().from(offers).where(eq(offers.id, offerId));
    if (!offer) return undefined;
    
    const activities = await this.getOfferActivities(offerId);
    return { ...offer, activities };
  }

  // Offer Activities
  async createOfferActivity(activity: InsertOfferActivity): Promise<OfferActivity> {
    const [offerActivity] = await db.insert(offerActivities).values(activity).returning();
    return offerActivity;
  }

  async getOfferActivities(offerId: number): Promise<OfferActivity[]> {
    return db.select().from(offerActivities).where(eq(offerActivities.offerId, offerId));
  }

  // Offer Management
  async expireOldOffers(): Promise<void> {
    await db
      .update(offers)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(
        lt(offers.expiresAt, new Date()),
        eq(offers.status, 'pending')
      ));
  }

  async createOfferWithActivity(offer: InsertOffer, activity: InsertOfferActivity): Promise<Offer> {
    // Create the offer first
    const createdOffer = await this.createOffer(offer);
    
    // Then create the activity record with the offer ID
    await this.createOfferActivity({
      ...activity,
      offerId: createdOffer.id,
    });
    
    return createdOffer;
  }

  // Admin Users
  async getAdminByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }

  async createAdminUser(admin: InsertAdminUser): Promise<AdminUser> {
    const [newAdmin] = await db.insert(adminUsers).values(admin).returning();
    return newAdmin;
  }

  // ============================================
  // STRATEGIC ADVISOR HUB - Advisors
  // ============================================

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

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    // Apply limit and offset
    const limit = search?.limit ?? 20;
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

  async createAdvisor(insertAdvisor: InsertAdvisor): Promise<Advisor> {
    const [advisor] = await db.insert(advisors).values(insertAdvisor).returning();
    return advisor;
  }

  async updateAdvisor(id: string, update: Partial<Advisor>): Promise<Advisor> {
    const [advisor] = await db
      .update(advisors)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(advisors.id, id))
      .returning();
    return advisor;
  }

  // ============================================
  // STRATEGIC ADVISOR HUB - Leads
  // ============================================

  async createLead(insertLead: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(insertLead).returning();
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
}

export const storage = new DatabaseStorage();