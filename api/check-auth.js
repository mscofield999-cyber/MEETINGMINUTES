const { getUserFromRequest } = require('../lib/session');
const allowCors = require('../lib/cors');

const handler = async (req, res) => {
  const user = getUserFromRequest(req);
  res.setHeader('Content-Type', 'application/json');
  if (!user) {
    res.end(JSON.stringify({ authenticated: false }));
    return;
  }
  res.end(JSON.stringify({ authenticated: true, ...user }));
};

module.exports = allowCors(handler);
