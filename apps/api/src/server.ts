import { readConfig } from "./config.js";
import { initializeDatabase, type SqliteDatabase } from "./db.js";
import { createApp } from "./app.js";

import { OllamaService } from "./services/ollama.js";

let database: SqliteDatabase | undefined;
try {
  const config = readConfig();
  database = initializeDatabase(config.databasePath);
  const app = createApp(config, database, new OllamaService(config), {
    allowDevelopmentOrigins: process.argv.includes("--dev") || process.env.NODE_ENV === "development",
  });
  const server = app.listen(config.port, "127.0.0.1", () => {
    console.log(`Point Nemo listening at http://127.0.0.1:${config.port}`);
  });
  server.once("error", () => {
    database?.close();
    console.error("Point Nemo could not listen on the configured local port.");
    process.exitCode = 1;
  });

  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    server.close(() => {
      database?.close();
      process.exit(0);
    });
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
} catch {
  database?.close();
  console.error("Point Nemo startup failed. Check the local configuration and database access.");
  process.exitCode = 1;
}
