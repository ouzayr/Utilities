/**
 * Database Setup Script
 * 
 * This script initializes the database by:
 * 1. Checking if tables exist
 * 2. Creating tables if they don't exist
 * 3. Syncing schema with Drizzle ORM
 * 
 * Usage: npx tsx script/setup-db.ts
 */

import "dotenv/config";
import { db } from "../server/db";
import { tasks } from "@shared/schema";
import { execSync } from "child_process";

async function setupDatabase() {
  try {
    console.log("🔧 Setting up database...");

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    console.log("✓ DATABASE_URL is configured");

    // Try to query the tasks table to see if it exists
    try {
      const result = await db.select().from(tasks).limit(1);
      console.log("✓ Database tables already exist");
      return;
    } catch (tableError: any) {
      if (tableError.code === "42P01" || tableError.message?.includes("does not exist")) {
        console.log("📝 Tables not found, running migrations...");
        
        // Run drizzle push to create tables
        console.log("Running: npm run db:push");
        execSync("npm run db:push", { stdio: "inherit" });
        
        console.log("✓ Database tables created successfully");
      } else {
        throw tableError;
      }
    }

    console.log("\n✅ Database setup completed successfully!");
    console.log("📌 Your application is ready to use.");
    
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Database setup failed:");
    console.error(error instanceof Error ? error.message : String(error));
    console.error("\nMake sure:");
    console.error("  1. PostgreSQL is running");
    console.error("  2. DATABASE_URL is set correctly");
    console.error("  3. You have network access to the database");
    process.exit(1);
  }
}

setupDatabase();
