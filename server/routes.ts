import type { Express, Request, Response } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import {
  insertVehicleSchema, insertOfferSchema, insertBuyCodeSchema, createInitialVehicleSchema, insertDealerSchema,
  // Strategic Advisor Hub
  insertAdvisorSchema, insertLeadSchema, advisorSearchSchema, generateAdvisorSlug
} from "@shared/schema";
import { sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import session from 'express-session';
import { tmpdir } from 'os';

// Modify the generateBuyCode function to create 4-character codes
function generateBuyCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// Use system temp directory for serverless compatibility  
// Always use temp directory in serverless environments (Vercel sets VERCEL=1)
const isServerless = process.env.VERCEL || process.env.NODE_ENV === 'production';
const uploadDir = isServerless
  ? path.join(tmpdir(), 'uploads') 
  : path.join(process.cwd(), 'uploads');

// Debug logging for serverless
console.log('Upload directory config:', {
  cwd: process.cwd(),
  tmpdir: tmpdir(),
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  isServerless,
  uploadDir
});

// Ensure uploads directory exists
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log('Created upload directory:', uploadDir);
  } else {
    console.log('Upload directory already exists:', uploadDir);
  }
} catch (error) {
  console.error('Failed to create upload directory:', error);
  // Fallback to system temp directly
  const fallbackDir = tmpdir();
  console.log('Using fallback directory:', fallbackDir);
}

// Configure multer for disk storage
const upload = multer({ 
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
      cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      'video/mp4',
      'video/quicktime',
      'video/x-m4v',
      'video/webm',
      'video/3gpp',
      'video/3gpp2',
      'video/x-msvideo',
      'video/mpeg',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

// Real VIN decoder implementation using NHTSA API
async function decodeVIN(vin: string) {
  try {
    console.log('Decoding VIN:', vin);
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`
    );

    if (!response.ok) {
      throw new Error('Failed to decode VIN');
    }

    const data = await response.json();
    const results = data.Results;

    const vehicleInfo = {
      year: results.find((item: any) => item.Variable === "Model Year")?.Value || "",
      make: results.find((item: any) => item.Variable === "Make")?.Value || "",
      model: results.find((item: any) => item.Variable === "Model")?.Value || "",
      trim: results.find((item: any) => item.Variable === "Trim")?.Value || "",
    };

    console.log('Decoded vehicle info:', vehicleInfo);
    return vehicleInfo;
  } catch (error) {
    console.error('Error decoding VIN:', error);
    throw new Error('Failed to decode VIN');
  }
}


async function requireAdmin(req: Request, res: Response, next: Function) {
  // Check for token in Authorization header first (for serverless)
  const authHeader = req.headers.authorization;
  console.log('RequireAdmin - Auth header:', authHeader);
  let adminEmail: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    console.log('RequireAdmin - Token found:', token);
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      console.log('RequireAdmin - Decoded token:', decoded);
      const [type, email, timestamp] = decoded.split(':');
      
      if (type === 'admin' && email) {
        // Check if token is not too old (24 hours)
        const tokenAge = Date.now() - parseInt(timestamp);
        if (tokenAge < 24 * 60 * 60 * 1000) {
          adminEmail = email;
          console.log('RequireAdmin - Admin email from token:', adminEmail);
        }
      }
    } catch (e) {
      console.error('Token decode error:', e);
    }
  }
  
  // Fall back to session if no valid token
  if (!adminEmail) {
    adminEmail = req.session?.adminEmail;
  }
  
  if (!adminEmail) {
    return res.status(401).json({ message: "Admin authentication required" });
  }

  const admin = await storage.getAdminByEmail(adminEmail);
  if (!admin) {
    return res.status(403).json({ message: "Not authorized as admin" });
  }

  next();
}

export async function registerRoutes(app: Express) {
  const httpServer = createServer(app);

  // Configure static file serving for uploads
  app.use('/uploads', express.static(uploadDir));

  // Add session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    })
  );

  // Admin authentication routes
  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email } = req.body;

      const admin = await storage.getAdminByEmail(email);
      if (!admin) {
        return res.status(401).json({ message: "Not authorized as admin" });
      }

      // For serverless, we'll use a simple token approach
      // In production, you'd want to use JWT or similar
      const token = Buffer.from(`admin:${email}:${Date.now()}`).toString('base64');
      
      res.json({ 
        message: "Admin login successful",
        token: token,
        email: email
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: "Admin login failed" });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.adminEmail = undefined;
    res.json({ message: "Admin logged out" });
  });

  // Protect admin routes
  app.get("/api/admin/check", requireAdmin, (req, res) => {
    console.log('Admin check passed for:', req.session?.adminEmail || 'token auth');
    res.json({ authorized: true });
  });
  
  // Debug endpoint to check session
  app.get("/api/session-debug", (req, res) => {
    res.json({
      hasSession: !!req.session,
      sessionId: req.sessionID,
      adminEmail: req.session?.adminEmail,
      sessionData: req.session
    });
  });


  // Admin dealer management routes
  // TEMPORARILY DISABLED requireAdmin FOR DEBUGGING
  app.post("/api/dealers", async (req, res) => {
    try {
      const result = insertDealerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: result.error.message });
      }

      console.log('Creating dealer with data:', result.data);

      // Create dealer
      const dealer = await storage.createDealer(result.data);

      // Generate and create buy code for the dealer without limits
      const buyCode = await storage.createBuyCode({
        code: generateBuyCode(),
        dealerId: dealer.id,
      });

      // Return both dealer and buy code information
      res.status(201).json({ dealer, buyCode });
    } catch (error) {
      console.error('Error creating dealer:', error);
      res.status(500).json({ message: "Failed to create dealer", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // TEMPORARILY DISABLED requireAdmin FOR DEBUGGING
  app.get("/api/dealers", async (_req, res) => {
    try {
      const dealers = await storage.getDealers();
      res.json(dealers);
    } catch (error) {
      console.error('Error fetching dealers:', error);
      res.status(500).json({ message: "Failed to fetch dealers" });
    }
  });

  // TEMPORARILY DISABLED requireAdmin FOR DEBUGGING
  app.patch("/api/dealers/:id", async (req, res) => {
    try {
      const { active } = req.body;
      const dealer = await storage.updateDealer(
        parseInt(req.params.id),
        { active }
      );
      res.json(dealer);
    } catch (error) {
      console.error('Error updating dealer:', error);
      res.status(500).json({ message: "Failed to update dealer" });
    }
  });

  // Public vehicle routes
  app.get("/api/vehicles", async (_req, res) => {
    const vehicles = await storage.getVehicles();
    res.json(vehicles);
  });

  app.get("/api/vehicles/:id", async (req, res) => {
    const vehicle = await storage.getVehicle(parseInt(req.params.id));
    if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });
    res.json(vehicle);
  });

  // Update vehicle status route
  // TEMPORARILY DISABLED requireAdmin FOR DEBUGGING
  app.patch("/api/vehicles/:id", async (req, res) => {
    try {
      const { status, inQueue, ...otherUpdates } = req.body;

      // Validate status
      if (status && !['active', 'sold', 'removed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const vehicleId = parseInt(req.params.id);
      
      // Get the current vehicle to check if status is changing
      const currentVehicle = await storage.getVehicle(vehicleId);
      if (!currentVehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      const vehicle = await storage.updateVehicle(
        vehicleId,
        { status, inQueue, ...otherUpdates }
      );

      // If vehicle is being re-listed (changed to 'active'), cancel existing transactions
      if (status === 'active' && currentVehicle.status !== 'active') {
        console.log(`Vehicle ${vehicleId} re-listed - cancelling existing transactions`);
        await storage.cancelVehicleTransactions(vehicleId);
      }

      res.json(vehicle);
    } catch (error) {
      console.error('Error updating vehicle:', error);
      res.status(500).json({ message: "Failed to update vehicle" });
    }
  });

  // Buy code verification with transaction creation
  app.post("/api/verify-code", async (req, res) => {
    const { code, vehicleId } = req.body;
    if (!code || !vehicleId) {
      return res.status(400).json({ message: "Code and vehicleId required" });
    }

    try {
      // Get the buy code
      const buyCode = await storage.getBuyCode(code);
      console.log('Found buy code:', buyCode); // Debug log

      if (!buyCode || !buyCode.active) {
        return res.status(403).json({ message: "Invalid buy code" });
      }

      // Get the vehicle
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }

      if (vehicle.status === 'sold') {
        return res.status(400).json({ message: "Vehicle is no longer available" });
      }

      // Create transaction
      const transaction = await storage.createTransaction({
        vehicleId,
        dealerId: buyCode.dealerId,
        buyCodeId: buyCode.id,
        amount: Number(vehicle.price),
        status: 'pending'
      });

      // Update buy code usage
      await storage.updateBuyCodeUsage(buyCode.id);

      // Mark vehicle as sold
      await storage.updateVehicle(vehicleId, {
        status: 'sold',
        inQueue: false
      });

      res.json({ 
        valid: true,
        transaction
      });
    } catch (error) {
      console.error('Error verifying buy code:', error);
      res.status(500).json({ message: "Failed to verify buy code" });
    }
  });

  // Test endpoint for debugging
  app.post("/api/test-vehicle", async (req, res) => {
    console.log("TEST ENDPOINT - Raw body:", req.body);
    console.log("TEST ENDPOINT - Headers:", req.headers);
    res.json({ 
      success: true, 
      received: req.body,
      bodyType: typeof req.body,
      isArray: Array.isArray(req.body),
      keys: Object.keys(req.body || {})
    });
  });

  // Debug endpoint to check form content
  app.get("/api/debug/form-check", async (req, res) => {
    const fs = await import('fs');
    const path = await import('path');
    try {
      const formPath = path.join(process.cwd(), 'client/src/components/forms/OfferForm.tsx');
      const content = await fs.promises.readFile(formPath, 'utf-8');
      const hasBuyCode = content.includes('buyCode');
      const hasDealerName = content.includes('dealerName');
      const hasContactInfo = content.includes('contactInfo');
      
      res.json({
        status: "Form content check",
        path: formPath,
        hasBuyCode,
        hasDealerName,
        hasContactInfo,
        firstLine: content.split('\n')[0],
        formFields: hasBuyCode && !hasDealerName && !hasContactInfo ? "CORRECT - Only buyCode" : "WRONG - Old fields present"
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Health check endpoint
  app.get("/api/health", async (req, res) => {
    try {
      // Test database connection
      const { db } = await import("./db");
      const testQuery = await db.execute(sql`SELECT 1 as test`);
      
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasSessionSecret: !!process.env.SESSION_SECRET
        },
        database: {
          connected: true,
          testQuery: testQuery.rows[0]
        }
      });
    } catch (error) {
      res.status(500).json({
        status: "ERROR",
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          hasSessionSecret: !!process.env.SESSION_SECRET
        },
        database: {
          connected: false,
          error: error.message
        }
      });
    }
  });

  // Cloudinary signature endpoint
  app.post("/api/cloudinary-signature", async (req, res) => {
    try {
      const { generateSignedUploadParams } = await import("./cloudinary");
      const signedParams = generateSignedUploadParams();
      res.json(signedParams);
    } catch (error) {
      console.error('Error generating Cloudinary signature:', error);
      res.status(500).json({ message: "Failed to generate upload signature" });
    }
  });

  // Test Cloudinary configuration
  app.get("/api/cloudinary-test", async (req, res) => {
    try {
      const { cloudinary, generateSignedUploadParams } = await import("./cloudinary");
      
      // Test if we can access Cloudinary API
      const timestamp = Math.round(new Date().getTime() / 1000);
      const testParams = {
        timestamp,
        folder: 'dealmachine-vehicle-videos',
        resource_type: 'video'
      };
      
      // Generate a test signature
      const signature = cloudinary.utils.api_sign_request(testParams, process.env.CLOUDINARY_API_SECRET?.trim() || '');
      
      // Also test the actual upload params generation
      const uploadParams = generateSignedUploadParams();
      
      res.json({
        status: "OK",
        environment: {
          hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
          hasApiKey: !!process.env.CLOUDINARY_API_KEY,
          hasApiSecret: !!process.env.CLOUDINARY_API_SECRET,
          cloudNameLength: process.env.CLOUDINARY_CLOUD_NAME?.trim().length,
          apiKeyLength: process.env.CLOUDINARY_API_KEY?.trim().length,
          apiSecretLength: process.env.CLOUDINARY_API_SECRET?.trim().length,
          cloudNameValue: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
          apiKeyValue: process.env.CLOUDINARY_API_KEY?.trim()
        },
        testSignature: {
          generated: !!signature,
          timestamp: timestamp
        },
        actualUploadParams: uploadParams
      });
    } catch (error) {
      console.error('Cloudinary test error:', error);
      res.status(500).json({ 
        status: "ERROR",
        error: error.message,
        environment: {
          hasCloudName: !!process.env.CLOUDINARY_CLOUD_NAME,
          hasApiKey: !!process.env.CLOUDINARY_API_KEY,
          hasApiSecret: !!process.env.CLOUDINARY_API_SECRET
        }
      });
    }
  });

  // Test Cloudinary direct upload
  app.post("/api/cloudinary-test-upload", async (req, res) => {
    try {
      const { cloudinary } = await import("./cloudinary");
      
      // Upload a test image
      const result = await cloudinary.uploader.upload(
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyODVGNCIvPjwvc3ZnPg==",
        {
          folder: 'dealmachine-vehicle-videos',
          resource_type: 'auto',
          public_id: 'test-' + Date.now()
        }
      );
      
      res.json({
        success: true,
        result: {
          public_id: result.public_id,
          url: result.secure_url,
          folder: result.folder
        }
      });
    } catch (error) {
      console.error('Test upload error:', error);
      res.status(500).json({ 
        success: false,
        error: error.message 
      });
    }
  });

  // Vehicle upload routes
  app.post("/api/vehicles", async (req, res) => {
    console.log('Received vehicle data:', req.body);
    console.log('Data types received:', {
      vin: typeof req.body.vin,
      year: typeof req.body.year,
      make: typeof req.body.make,
      model: typeof req.body.model,
      videos: Array.isArray(req.body.videos)
    });
    
    const result = createInitialVehicleSchema.safeParse(req.body);
    if (!result.success) {
      console.error('Schema validation failed:', JSON.stringify(result.error.format(), null, 2));
      const firstError = result.error.issues[0];
      return res.status(400).json({ 
        message: firstError.message,
        field: firstError.path.join('.'),
        code: firstError.code,
        details: result.error.format()
      });
    }

    try {
      const vehicleInfo = await decodeVIN(result.data.vin);
      console.log('Creating vehicle with info:', vehicleInfo);

      const vehicle = await storage.createVehicle({
        ...result.data,
        year: parseInt(vehicleInfo.year),
        make: vehicleInfo.make,
        model: vehicleInfo.model,
        trim: vehicleInfo.trim,
      });

      res.status(201).json(vehicle);
    } catch (error) {
      console.error('Error creating vehicle:', error);
      res.status(500).json({ message: "Failed to create vehicle" });
    }
  });

  app.post("/api/upload", upload.array('files'), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const fileUrls = files.map(file => {
        return `/uploads/${file.filename}`;
      });

      res.json(fileUrls);
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ message: "Failed to upload files" });
    }
  });

  // Buy code management
  app.post("/api/buy-codes", async (req, res) => {
    try {
      const buyCode = await storage.createBuyCode({
        code: generateBuyCode(),
        dealerId: req.body.dealerId,
      });
      res.status(201).json(buyCode);
    } catch (error) {
      console.error('Error generating buy code:', error);
      res.status(500).json({ message: "Failed to generate buy code" });
    }
  });

  // Add this GET endpoint for buy codes after the existing buy code routes
  app.get("/api/buy-codes", async (_req, res) => {
    try {
      const buyCodes = await storage.getAllBuyCodes();
      res.json(buyCodes);
    } catch (error) {
      console.error('Error fetching buy codes:', error);
      res.status(500).json({ message: "Failed to fetch buy codes" });
    }
  });

  // Dealer-specific routes
  app.get("/api/dealer/buycodes", async (req, res) => {
    try {
      // Get dealer ID from the session - TODO: Add proper auth
      const dealerId = 1; // Temporarily hardcoded
      const buyCodes = await storage.getDealerBuyCodes(dealerId);
      res.json(buyCodes);
    } catch (error) {
      console.error('Error fetching dealer buy codes:', error);
      res.status(500).json({ message: "Failed to fetch buy codes" });
    }
  });

  app.get("/api/dealer/transactions", async (req, res) => {
    try {
      // Try to get dealer ID from various sources
      let dealerId = req.session?.dealerId;
      
      // If no session, try to parse from a header (for debugging)
      if (!dealerId && req.headers['x-dealer-id']) {
        dealerId = parseInt(req.headers['x-dealer-id'] as string);
      }
      
      // Default to 1 if nothing else works
      if (!dealerId) {
        console.log('No dealer ID found, defaulting to 1');
        dealerId = 1;
      }
      
      console.log('Fetching transactions for dealer:', dealerId);

      const transactions = await storage.getDealerTransactions(dealerId);
      const transactionsWithVehicles = await Promise.all(
        transactions.map(async (transaction) => {
          const vehicle = await storage.getVehicle(transaction.vehicleId);
          return { ...transaction, vehicle };
        })
      );

      res.json(transactionsWithVehicles);
    } catch (error) {
      console.error('Error fetching dealer transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/dealer/offers", async (req, res) => {
    try {
      // Try to get dealer ID from session or default to 1 for testing
      let dealerId = req.session?.dealerId || 1;
      
      // Expire old offers first
      await storage.expireOldOffers();
      
      const offers = await storage.getDealerOffers(dealerId);
      const offersWithDetails = await Promise.all(
        offers.map(async (offer) => {
          const vehicle = await storage.getVehicle(offer.vehicleId);
          const activities = await storage.getOfferActivities(offer.id);
          return { ...offer, vehicle, activities };
        })
      );
      res.json(offersWithDetails);
    } catch (error) {
      console.error('Error fetching dealer offers:', error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  // Dealer responds to counter offer
  app.patch("/api/dealer/offers/:id", async (req, res) => {
    try {
      const { action } = req.body; // 'accept' or 'decline'
      const offerId = parseInt(req.params.id);
      
      // Get the current offer
      const currentOffer = await storage.getOfferWithActivities(offerId);
      if (!currentOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      if (currentOffer.status !== 'countered') {
        return res.status(400).json({ message: "Offer is not in countered state" });
      }

      let newStatus = '';
      let activityMessage = '';
      let actionType = '';

      if (action === 'accept') {
        newStatus = 'accepted';
        actionType = 'counter_accepted';
        activityMessage = `Dealer accepted counter offer for ${currentOffer.counterAmount}`;
        
        // Create transaction and mark vehicle as sold
        const vehicle = await storage.getVehicle(currentOffer.vehicleId);
        if (vehicle) {
          await storage.createTransaction({
            vehicleId: currentOffer.vehicleId,
            dealerId: currentOffer.dealerId,
            buyCodeId: 1, // We'll need to track this better
            amount: currentOffer.counterAmount || currentOffer.amount,
            status: 'pending'
          });
          
          await storage.updateVehicle(currentOffer.vehicleId, { status: 'sold' });
        }
      } else {
        newStatus = 'declined';
        actionType = 'counter_declined';
        activityMessage = 'Dealer declined counter offer';
      }

      // Update the offer
      const offer = await storage.updateOffer(offerId, { status: newStatus });

      // Create activity record
      await storage.createOfferActivity({
        offerId,
        actorType: 'dealer',
        actorId: currentOffer.dealerId,
        actionType,
        amount: currentOffer.counterAmount || currentOffer.amount,
        message: activityMessage,
      });

      res.json(offer);
    } catch (error) {
      console.error('Error updating dealer offer:', error);
      res.status(500).json({ message: "Failed to update offer" });
    }
  });

  // Transaction management
  app.patch("/api/transactions/:id", requireAdmin, async (req, res) => {
    try {
      const { status, isPaid } = req.body;
      const transaction = await storage.updateTransaction(
        parseInt(req.params.id),
        { status, isPaid }
      );
      res.json(transaction);
    } catch (error) {
      console.error('Error updating transaction:', error);
      res.status(500).json({ message: "Failed to update transaction" });
    }
  });

  // TEMPORARILY DISABLED requireAdmin FOR DEBUGGING
  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions();
      const transactionsWithDetails = await Promise.all(
        transactions.map(async (transaction) => {
          const vehicle = await storage.getVehicle(transaction.vehicleId);
          const dealer = await storage.getDealerById(transaction.dealerId);
          return { 
            ...transaction, 
            vehicle,
            dealerName: dealer?.dealerName 
          };
        })
      );
      res.json(transactionsWithDetails);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Bill of Sale upload
  app.post("/api/transactions/:id/bill-of-sale", upload.single('billOfSale'), async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const fileUrl = `/uploads/${file.filename}`;

      const transaction = await storage.updateTransaction(
        parseInt(req.params.id),
        { billOfSale: fileUrl }
      );

      res.json(transaction);
    } catch (error) {
      console.error('Error uploading bill of sale:', error);
      res.status(500).json({ message: "Failed to upload bill of sale" });
    }
  });

  // Create offer route with buy code verification
  app.post("/api/vehicles/:vehicleId/offers", async (req, res) => {
    try {
      const { amount, buyCode } = req.body;
      const vehicleId = parseInt(req.params.vehicleId);

      if (!amount || !buyCode) {
        return res.status(400).json({ message: "Amount and buy code are required" });
      }

      // Verify buy code and get dealer info
      const buyCodeRecord = await storage.getBuyCode(buyCode);
      if (!buyCodeRecord || !buyCodeRecord.active) {
        return res.status(403).json({ message: "Invalid or inactive buy code" });
      }

      const dealer = await storage.getDealerById(buyCodeRecord.dealerId);
      if (!dealer || !dealer.active) {
        return res.status(403).json({ message: "Dealer account is inactive" });
      }

      // Check if vehicle exists and is available for offers
      const vehicle = await storage.getVehicle(vehicleId);
      if (!vehicle) {
        return res.status(404).json({ message: "Vehicle not found" });
      }
      
      if (vehicle.status === 'sold') {
        return res.status(400).json({ message: "Vehicle is no longer available" });
      }

      // Set expiration to 48 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // Create offer with activity tracking
      const offer = await storage.createOfferWithActivity(
        {
          vehicleId,
          dealerId: dealer.id,
          amount: amount.toString(),
          expiresAt,
        },
        {
          offerId: 0, // Will be set by createOfferWithActivity
          actorType: 'dealer',
          actorId: dealer.id,
          actionType: 'offer_submitted',
          amount: amount.toString(),
          message: `Offer submitted by ${dealer.dealerName}`,
        }
      );

      console.log(`New offer received: ${dealer.dealerName} offered ${amount} for vehicle ${vehicleId}, expires at ${expiresAt}`);

      res.status(201).json(offer);
    } catch (error) {
      console.error('Error creating offer:', error);
      res.status(500).json({ message: "Failed to create offer" });
    }
  });

  // Get all offers (admin) - also expires old offers
  app.get("/api/offers", async (_req, res) => {
    try {
      // First expire any old offers
      await storage.expireOldOffers();
      
      const offers = await storage.getAllOffers();
      const offersWithDetails = await Promise.all(
        offers.map(async (offer) => {
          const vehicle = await storage.getVehicle(offer.vehicleId);
          const dealer = await storage.getDealerById(offer.dealerId);
          const activities = await storage.getOfferActivities(offer.id);
          return { 
            ...offer, 
            vehicle,
            dealer: { id: dealer?.id, dealerName: dealer?.dealerName },
            activities 
          };
        })
      );
      res.json(offersWithDetails);
    } catch (error) {
      console.error('Error fetching offers:', error);
      res.status(500).json({ message: "Failed to fetch offers" });
    }
  });

  // Update offer status (admin) - handle counter-offers, acceptance, decline
  app.patch("/api/offers/:id", async (req, res) => {
    try {
      const { status, counterAmount, counterMessage } = req.body;
      const offerId = parseInt(req.params.id);
      
      // Get the current offer
      const currentOffer = await storage.getOfferWithActivities(offerId);
      if (!currentOffer) {
        return res.status(404).json({ message: "Offer not found" });
      }

      // Prepare update data
      const updateData: any = { status };
      if (counterAmount) updateData.counterAmount = counterAmount.toString();
      if (counterMessage) updateData.counterMessage = counterMessage;

      // Update the offer
      const offer = await storage.updateOffer(offerId, updateData);

      // Create activity record
      let activityMessage = '';
      let actionType = '';
      
      switch (status) {
        case 'accepted':
          actionType = 'offer_accepted';
          activityMessage = `Offer accepted by admin for ${offer.amount}`;
          
          // Create transaction and mark vehicle as sold
          const vehicle = await storage.getVehicle(offer.vehicleId);
          if (vehicle) {
            await storage.createTransaction({
              vehicleId: offer.vehicleId,
              dealerId: offer.dealerId,
              buyCodeId: 1, // We'll need to track this better
              amount: offer.amount,
              status: 'pending'
            });
            
            await storage.updateVehicle(offer.vehicleId, { status: 'sold' });
          }
          break;
          
        case 'declined':
          actionType = 'offer_declined';
          activityMessage = 'Offer declined by admin';
          break;
          
        case 'countered':
          actionType = 'offer_countered';
          activityMessage = `Admin counter-offered ${counterAmount}${counterMessage ? ': ' + counterMessage : ''}`;
          break;
      }

      // Create activity record
      await storage.createOfferActivity({
        offerId,
        actorType: 'admin',
        actorId: 1, // We'd need admin user ID here
        actionType,
        amount: counterAmount || offer.amount,
        message: activityMessage,
      });

      res.json(offer);
    } catch (error) {
      console.error('Error updating offer:', error);
      res.status(500).json({ message: "Failed to update offer" });
    }
  });

  // Dealer Authentication
  app.post("/api/dealer/login", async (req, res) => {
    try {
      const { dealerName, buyCode } = req.body;
      if (!dealerName || !buyCode) {
        return res.status(400).json({ message: "Dealer name and buy code required" });
      }

      // Find dealer by name
      const dealer = await storage.getDealerByDealerName(dealerName);
      if (!dealer) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Check active buy codes for this dealer
      const dealerBuyCodes = await storage.getDealerBuyCodes(dealer.id);
      const validCode = dealerBuyCodes.find(code => code.code === buyCode && code.active);
      if (!validCode) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Set session data
      req.session.dealerId = dealer.id;

      // Return dealer info (excluding sensitive data)
      const { id, dealerName: name, email, address } = dealer;
      return res.json({ id, dealerName: name, email, address });
    } catch (error) {
      console.error("Error during dealer login:", error);
      return res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/dealer/logout", (req, res) => {
    req.session.destroy(() => {
      res.sendStatus(200);
    });
  });

  // ============================================
  // STRATEGIC ADVISOR HUB - Advisor Routes
  // ============================================

  // Search/list advisors with filters
  app.get("/api/advisors", async (req, res) => {
    try {
      const searchParams = {
        city: req.query.city as string | undefined,
        state: req.query.state as string | undefined,
        zipCode: req.query.zipCode as string | undefined,
        designation: req.query.designation as "CPA" | "Wealth Manager" | "CPA & Wealth Manager" | undefined,
        specialty: req.query.specialty as string | undefined,
        isVerifiedStrategist: req.query.isVerifiedStrategist === 'true' ? true : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };

      const result = advisorSearchSchema.safeParse(searchParams);
      if (!result.success) {
        return res.status(400).json({ message: "Invalid search parameters", errors: result.error.format() });
      }

      const advisors = await storage.getAdvisors(result.data);
      res.json(advisors);
    } catch (error) {
      console.error('Error fetching advisors:', error);
      res.status(500).json({ message: "Failed to fetch advisors" });
    }
  });

  // Get single advisor by slug (SEO-friendly URL)
  app.get("/api/advisors/slug/:slug", async (req, res) => {
    try {
      const advisor = await storage.getAdvisorBySlug(req.params.slug);
      if (!advisor) {
        return res.status(404).json({ message: "Advisor not found" });
      }
      res.json(advisor);
    } catch (error) {
      console.error('Error fetching advisor:', error);
      res.status(500).json({ message: "Failed to fetch advisor" });
    }
  });

  // Get single advisor by ID
  app.get("/api/advisors/:id", async (req, res) => {
    try {
      const advisor = await storage.getAdvisorById(req.params.id);
      if (!advisor) {
        return res.status(404).json({ message: "Advisor not found" });
      }
      res.json(advisor);
    } catch (error) {
      console.error('Error fetching advisor:', error);
      res.status(500).json({ message: "Failed to fetch advisor" });
    }
  });

  // Create new advisor
  app.post("/api/advisors", async (req, res) => {
    try {
      // Auto-generate slug if not provided
      let advisorData = { ...req.body };
      if (!advisorData.slug && advisorData.name && advisorData.city) {
        const primarySpecialty = advisorData.specialties?.[0];
        advisorData.slug = generateAdvisorSlug(advisorData.name, advisorData.city, primarySpecialty);
      }

      const result = insertAdvisorSchema.safeParse(advisorData);
      if (!result.success) {
        return res.status(400).json({ message: "Validation failed", errors: result.error.format() });
      }

      const advisor = await storage.createAdvisor(result.data);
      res.status(201).json(advisor);
    } catch (error: any) {
      console.error('Error creating advisor:', error);
      // Handle unique constraint violation for slug
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        return res.status(409).json({ message: "An advisor with this slug already exists. Try a different name or specialty." });
      }
      res.status(500).json({ message: "Failed to create advisor" });
    }
  });

  // Update advisor
  app.patch("/api/advisors/:id", async (req, res) => {
    try {
      const advisor = await storage.updateAdvisor(req.params.id, req.body);
      if (!advisor) {
        return res.status(404).json({ message: "Advisor not found" });
      }
      res.json(advisor);
    } catch (error) {
      console.error('Error updating advisor:', error);
      res.status(500).json({ message: "Failed to update advisor" });
    }
  });

  // ============================================
  // STRATEGIC ADVISOR HUB - Lead Routes
  // ============================================

  // Create new lead (from Reinsurance CTA or contact form)
  app.post("/api/leads", async (req, res) => {
    try {
      const result = insertLeadSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: "Validation failed", errors: result.error.format() });
      }

      // Verify advisor exists
      const advisor = await storage.getAdvisorById(result.data.advisorId);
      if (!advisor) {
        return res.status(404).json({ message: "Advisor not found" });
      }

      const lead = await storage.createLead(result.data);

      console.log(`New lead captured: ${lead.userName} from ${lead.sourcePage} (${lead.sourceType})`);

      res.status(201).json({
        success: true,
        message: "Thank you for your interest. We'll be in touch shortly.",
        leadId: lead.id
      });
    } catch (error) {
      console.error('Error creating lead:', error);
      res.status(500).json({ message: "Failed to submit. Please try again." });
    }
  });

  // Get leads by advisor (admin/advisor dashboard)
  app.get("/api/advisors/:id/leads", async (req, res) => {
    try {
      const leads = await storage.getLeadsByAdvisor(req.params.id);
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Get all leads (admin dashboard)
  app.get("/api/leads", async (_req, res) => {
    try {
      const leads = await storage.getAllLeads();
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // Get leads by source page (analytics)
  app.get("/api/leads/source/:sourcePage", async (req, res) => {
    try {
      const leads = await storage.getLeadsBySourcePage(decodeURIComponent(req.params.sourcePage));
      res.json(leads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      res.status(500).json({ message: "Failed to fetch leads" });
    }
  });

  // ============================================
  // SEO: Dynamic Meta Tags for Advisor Profiles
  // ============================================

  // This endpoint returns meta tag data for SSR/prerendering
  // Title format: [Name] - Strategic [Designation] in [City] | Wealth Advisor Hub
  app.get("/api/seo/advisor/:slug", async (req, res) => {
    try {
      const advisor = await storage.getAdvisorBySlug(req.params.slug);
      if (!advisor) {
        return res.status(404).json({ message: "Advisor not found" });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const title = `${advisor.name} - Strategic ${advisor.designation} in ${advisor.city} | Wealth Advisor Hub`;
      const description = advisor.bio
        ? advisor.bio.substring(0, 155) + '...'
        : `Connect with ${advisor.name}, a strategic ${advisor.designation} in ${advisor.city}, ${advisor.state}. Specializing in ${advisor.specialties?.slice(0, 3).join(', ') || 'tax planning, wealth management, and proactive strategies'}.`;

      res.json({
        title,
        description,
        ogTitle: title,
        ogDescription: description,
        ogType: 'profile',
        ogSiteName: 'Wealth Advisor Hub',
        canonical: `${baseUrl}/advisor/${advisor.slug}`,
        structuredData: {
          "@context": "https://schema.org",
          "@type": "FinancialService",
          "name": advisor.name,
          "description": description,
          "address": {
            "@type": "PostalAddress",
            "addressLocality": advisor.city,
            "addressRegion": advisor.state,
            "postalCode": advisor.zipCode,
            "addressCountry": "US"
          },
          ...(advisor.websiteUrl && { "url": advisor.websiteUrl }),
          ...(advisor.linkedinUrl && { "sameAs": [advisor.linkedinUrl] }),
          ...(advisor.isVerifiedStrategist && { "award": "Verified Strategic Partner" }),
        }
      });
    } catch (error) {
      console.error('Error generating SEO data:', error);
      res.status(500).json({ message: "Failed to generate SEO data" });
    }
  });

  // Test endpoint to simulate bot crawl and verify meta tag injection
  app.get("/api/seo/test/:slug", async (req, res) => {
    try {
      const advisor = await storage.getAdvisorBySlug(req.params.slug);
      if (!advisor) {
        return res.status(404).json({
          success: false,
          message: "Advisor not found. Create a test advisor first."
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const title = `${advisor.name} - Strategic ${advisor.designation} in ${advisor.city} | Wealth Advisor Hub`;
      const description = advisor.bio
        ? advisor.bio.substring(0, 155) + '...'
        : `Connect with ${advisor.name}, a strategic ${advisor.designation} in ${advisor.city}, ${advisor.state}. Specializing in ${advisor.specialties?.slice(0, 3).join(', ') || 'tax planning, wealth management, and proactive strategies'}.`;

      // Return what LinkedIn/Google would see
      const htmlPreview = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${baseUrl}/advisor/${advisor.slug}" />
    <meta property="og:site_name" content="Wealth Advisor Hub" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <link rel="canonical" href="${baseUrl}/advisor/${advisor.slug}" />
</head>
<body>
    <h1>SEO Meta Tag Preview</h1>
    <p>This is what search engines and social media crawlers will see.</p>
</body>
</html>`;

      res.json({
        success: true,
        advisor: {
          name: advisor.name,
          designation: advisor.designation,
          city: advisor.city,
          state: advisor.state,
          slug: advisor.slug,
          isVerifiedStrategist: advisor.isVerifiedStrategist,
        },
        seo: {
          title,
          description,
          canonical: `${baseUrl}/advisor/${advisor.slug}`,
        },
        htmlPreview,
        testUrl: `${baseUrl}/advisor/${advisor.slug}`,
        instructions: "Use a tool like https://www.opengraph.xyz/ or LinkedIn Post Inspector to verify the meta tags are being served correctly."
      });
    } catch (error) {
      console.error('Error testing SEO:', error);
      res.status(500).json({ success: false, message: "Failed to test SEO" });
    }
  });

  return httpServer;
}