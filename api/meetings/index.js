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
  const db = getDb();
  if (req.method === 'GET') {
    const snap = await db.collection('meetings').orderBy('created_at', 'desc').get();
    const list = [];
    snap.forEach(doc => {
      const d = doc.data();
      list.push({
        id: d.id,
        meeting_title: d.meeting_title,
        meeting_date: d.meeting_date,
        department: d.department,
        chairman: d.chairman,
        reference_number: d.reference_number || '-',
        status: d.status || 'pending'
      });
    });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(list));
    return;
  }
  if (req.method === 'POST') {
    const body = await parseBody(req);
    const now = Date.now();
    const doc = {
      id: `${now}`,
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
      status: 'pending',
      created_by: user.username,
      created_at: now,
      updated_at: now
    };
    await db.collection('meetings').doc(doc.id).set(doc);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, id: doc.id }));
    return;
  }
  res.statusCode = 405;
  res.end();
};

module.exports = allowCors(handler);
