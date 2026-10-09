import { readConfig } from "./config.js";
import { initializeDatabase } from "./db.js";

try {
  const database = initializeDatabase(readConfig().databasePath);
  const version = database.pragma("user_version", { simple: true });
  database.close();
  console.log(`Point Nemo database initialized (schema ${version}).`);
} catch {
  console.error("Point Nemo database initialization failed. Check local configuration and storage access.");
  process.exitCode = 1;
}
