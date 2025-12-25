const { clearSessionCookie } = require('../lib/session');

module.exports = async (req, res) => {
  clearSessionCookie(res);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: true }));
};

module.exports = allowCors(handler);
