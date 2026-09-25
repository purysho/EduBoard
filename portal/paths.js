// Every file the Portal writes lives under one data directory — portal/data by default,
// or PORTAL_DATA_DIR. One place to back up, and tests can point it at a throwaway folder
// instead of the live uploads next to the code.
const path = require('path')

const DATA_DIR = process.env.PORTAL_DATA_DIR || path.join(__dirname, 'data')

module.exports = {
  DATA_DIR,
  DB_PATH: process.env.PORTAL_DB_PATH || path.join(DATA_DIR, 'portal.db'),
  UPLOADS_DIR: path.join(DATA_DIR, 'homework-uploads'),
  SUBMISSIONS_DIR: path.join(DATA_DIR, 'submission-uploads'),
  POSTS_DIR: path.join(DATA_DIR, 'post-images')
}
