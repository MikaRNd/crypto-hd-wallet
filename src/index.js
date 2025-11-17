const { port } = require('./config');
const { app, ensureMetadataTable } = require('./server');
const { startListener } = require('./listener');
const { initDb } = require('./db');

(async () => {
  await initDb();
  console.log('Database initialized');

  await ensureMetadataTable();
  console.log('Metadata table verified');

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  startListener();
})();
