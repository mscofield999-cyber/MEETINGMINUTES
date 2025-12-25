const { getUserFromRequest } = require('../../lib/session');
const { getDb } = require('../../lib/firebase');

async function parseBody(req) {
  const chunks = [];
  req.on('data', d => chunks.push(d));
  await new Promise(r => req.on('end', r));
  const s = Buffer.concat(chunks).toString() || '{}';
  return JSON.parse(s);
}

module.exports = async (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }
  const id = (req.query && req.query.id) || (req.url.split('/').pop());
  const db = getDb();
  const ref = db.collection('meetings').doc(String(id));
  if (req.method === 'GET') {
    const snap = await ref.get();
    if (!snap.exists) {
      res.statusCode = 404;
      res.end();
      return;
    }
    const data = snap.data();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
    return;
  }
  if (req.method === 'PUT') {
    const body = await parseBody(req);
    const update = {
      org_name: body.orgName || '',
      executive_summary: body.executiveSummary || '',
      reference_number: body.referenceNumber || '',
      department: body.department || '',
      meeting_title: body.meetingTitle || '',
      meeting_date: body.meetingDate || '',
      meeting_time: body.meetingTime || '',
      duration: body.duration || '',
      meeting_location: body.meetingLocation || '',
      meeting_type: body.meetingType || '',
      chairman: body.chairman || '',
      secretary: body.secretary || '',
      next_meeting_date: body.nextMeetingDate || '',
      attendees: JSON.stringify(body.attendees || []),
      agenda_items: JSON.stringify(body.agendaItems || []),
      decisions: JSON.stringify(body.decisions || []),
      secretary_signature: body.secretarySignature || '',
      chairman_signature: body.chairmanSignature || '',
      logoData: body.logoData || '',
      watermark_image: body.watermarkImage || '',
      updated_at: Date.now()
    };
    if (body.chairmanSignature) update.status = 'approved';
    await ref.set(update, { merge: true });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true }));
    return;
  }
  res.statusCode = 405;
  res.end();
};

module.exports = allowCors(handler);
