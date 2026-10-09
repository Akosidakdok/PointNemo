import { readConfig } from "./config.js";
import { initializeDatabase } from "./db.js";
import { createApp } from "./app.js";

const config = readConfig();
const database = initializeDatabase(config.databasePath);
const app = createApp(config, database);
const server = app.listen(config.port, "127.0.0.1", () => {
  console.log(`Point Nemo API listening at http://localhost:${config.port}`);
  console.log(`SQLite database: ${config.databasePath}`);
});

function shutdown() {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
