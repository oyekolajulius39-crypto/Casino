const { sequelize } = require('../models/database');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  try {
    console.log('Testing database connection...');
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    console.log('\nSynchronizing database models...');
    await sequelize.sync({ force: true });
    console.log('✓ Database models synchronized');

    console.log('\nDatabase initialization complete!');
    console.log('\nYou can now start the server with: npm start');
    
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    console.error('\nPlease check your database configuration in .env file');
    process.exit(1);
  }
}

initDatabase();
