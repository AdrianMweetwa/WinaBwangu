// Transactions are permanent. Resetting a populated database is not an application operation.
console.error("Database reset is disabled: transactions cannot be deleted. Use npm run seed to initialize a fresh database.");
process.exitCode = 1;
