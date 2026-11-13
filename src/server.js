const app = require("./app");
const { pool } = require("./config/db");
const { port: PORT } = require("./config/env");

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor ejecutándose en puerto ${PORT}`);
});
const stop = async () => {
  server.close();
  await pool.end().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
