const fs = require('node:fs');
const path = require('node:path');
const filename = path.join(__dirname, '..', '.env');
// Tests supply isolated connection settings; never import a developer's .env there.
if (process.env.NODE_ENV !== 'test' && fs.existsSync(filename)) {
  process.loadEnvFile(filename);
}
