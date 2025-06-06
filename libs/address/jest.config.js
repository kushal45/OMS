module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // <rootDir> for this file is PROJECT_ROOT/libs/address
  // So, to get to PROJECT_ROOT, we use <rootDir>/../..
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../../apps/$1',
    '^@lib/(.*)$': '<rootDir>/../../libs/$1',
    '^@app/config$': '<rootDir>/../../libs/config/src',
    '^@app/config/(.*)$': '<rootDir>/../../libs/config/src/$1',
    '^@app/address$': '<rootDir>/../../libs/address/src', // This will map to itself, which is fine
    '^@app/address/(.*)$': '<rootDir>/../../libs/address/src/$1',
    '^@app/databaseMigration/(.*)$': '<rootDir>/../../apps/database/migrations/$1',
    '^@libs/http$': '<rootDir>/../../libs/http',
    '^@libs/constants$': '<rootDir>/../../libs/constants',
    '^@libs/swagger$': '<rootDir>/../../libs/swagger',
    '^@libs/dtos$': '<rootDir>/../../libs/dtos',
    '^@app/log$': '<rootDir>/../../libs/logger/src',
    '^@app/log/(.*)$': '<rootDir>/../../libs/logger/src/$1',
  },
};