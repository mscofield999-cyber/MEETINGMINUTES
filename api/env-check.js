const allowCors = require('../lib/cors');

const handler = async (req, res) => {
  const hasProject = !!process.env.FIREBASE_PROJECT_ID;
  const hasServiceJson = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const hasSecret = !!process.env.SESSION_SECRET;
  const secure = process.env.SESSION_COOKIE_SECURE === 'true';
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    hasProject,
    hasServiceJson,
    hasSecret,
    secure
  }));
};
