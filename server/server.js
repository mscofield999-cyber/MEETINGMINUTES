const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const db = require('./database');
const { generatePDF } = require('./pdfGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.CORS_ORIGIN || true,
    credentials: true
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Session Middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'change_me_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.SESSION_COOKIE_SECURE === 'true' }
}));

// Auth Middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Auth Routes
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        bcrypt.compare(password, user.password_hash, (err, result) => {
            if (result) {
                req.session.userId = user.id;
                req.session.role = user.role;
                req.session.fullName = user.full_name;
                res.json({ success: true, role: user.role, fullName: user.full_name });
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ error: 'Could not log out' });
        res.json({ success: true });
    });
});

app.get('/api/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ 
            authenticated: true, 
            role: req.session.role, 
            fullName: req.session.fullName 
        });
    } else {
        res.json({ authenticated: false });
    }
});

// Health check
app.get('/healthz', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/ai/review-minutes', requireAuth, async (req, res) => {
    const { agendaItems, decisions } = req.body || {};

    const normalizeText = (t) => {
        if (!t) return '';
        return String(t)
            .replace(/\s+/g, ' ')
            .replace(/\s*([،,:؛.])\s*/g, '$1 ')
            .replace(/\s+$/g, '')
            .trim();
    };

    const fallback = () => {
        const agenda = Array.isArray(agendaItems) ? agendaItems : [];
        const decs = Array.isArray(decisions) ? decisions : [];
        return {
            agendaItems: agenda.map(a => ({
                item: normalizeText(a.item),
                speaker: normalizeText(a.speaker)
            })),
            decisions: decs.map(d => ({
                decision: normalizeText(d.decision),
                responsible: normalizeText(d.responsible),
                deadline: normalizeText(d.deadline)
            })),
            mode: 'basic'
        };
    };

    if (!process.env.OPENAI_API_KEY) {
        return res.json(fallback());
    }

    try {
        const input = {
            agendaItems: Array.isArray(agendaItems) ? agendaItems : [],
            decisions: Array.isArray(decisions) ? decisions : []
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: 'أنت مساعد لغوي عربي متخصص في صياغة محاضر الاجتماعات. حسّن الصياغة وصحّح الإملاء دون تغيير المعنى. أعِد JSON فقط.'
                    },
                    {
                        role: 'user',
                        content:
                            `راجع البنود والقرارات التالية وحسّن الصياغة والتدقيق الإملائي.\n` +
                            `أعد النتيجة بصيغة JSON فقط بالشكل:\n` +
                            `{\"agendaItems\":[{\"item\":\"\",\"speaker\":\"\"}],\"decisions\":[{\"decision\":\"\",\"responsible\":\"\",\"deadline\":\"\"}]}\n\n` +
                            `المدخل:\n${JSON.stringify(input)}`
                    }
                ]
            })
        });

        const json = await response.json();
        const text = json?.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(text.slice(start, end + 1));
            }
        }

        if (!parsed) return res.json(fallback());

        res.json({
            agendaItems: Array.isArray(parsed.agendaItems) ? parsed.agendaItems : [],
            decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
            mode: 'openai'
        });
    } catch (err) {
        console.error('AI review error:', err);
        res.json(fallback());
    }
});

app.post('/api/ai/assist', requireAuth, async (req, res) => {
    const {
        meetingTitle,
        meetingDate,
        meetingTime,
        meetingLocation,
        meetingType,
        department,
        chairman,
        secretary,
        agendaItems,
        decisions
    } = req.body || {};

    const normalizeText = (t) => {
        if (!t) return '';
        return String(t)
            .replace(/\s+/g, ' ')
            .replace(/\s*([،,:؛.])\s*/g, '$1 ')
            .replace(/\s+$/g, '')
            .trim();
    };

    const computeIssues = (agenda, decs) => {
        const issues = [];
        if (!normalizeText(meetingTitle)) issues.push('عنوان الاجتماع غير محدد.');
        if (!normalizeText(meetingDate)) issues.push('تاريخ الاجتماع غير محدد.');
        if (!normalizeText(meetingTime)) issues.push('وقت الاجتماع غير محدد.');
        if (!normalizeText(meetingLocation)) issues.push('مكان الاجتماع غير محدد.');
        if (!normalizeText(meetingType)) issues.push('نوع الاجتماع غير محدد.');
        if (!normalizeText(department)) issues.push('الإدارة/القسم غير محدد.');
        if (!normalizeText(chairman)) issues.push('اسم رئيس الاجتماع غير محدد.');
        if (!normalizeText(secretary)) issues.push('اسم مقرر الاجتماع غير محدد.');

        (agenda || []).forEach((a, idx) => {
            if (!normalizeText(a.item)) issues.push(`بند جدول الأعمال رقم ${idx + 1} فارغ.`);
            if (!normalizeText(a.speaker)) issues.push(`المتحدث في بند رقم ${idx + 1} غير محدد.`);
        });
        (decs || []).forEach((d, idx) => {
            if (!normalizeText(d.decision)) issues.push(`نص القرار/التوصية رقم ${idx + 1} فارغ.`);
            if (!normalizeText(d.responsible)) issues.push(`المسؤول في القرار/التوصية رقم ${idx + 1} غير محدد.`);
            if (!normalizeText(d.deadline)) issues.push(`المدة/الموعد في القرار/التوصية رقم ${idx + 1} غير محدد.`);
        });
        return issues;
    };

    const agenda = Array.isArray(agendaItems) ? agendaItems : [];
    const decs = Array.isArray(decisions) ? decisions : [];

    const fallback = () => {
        const fixedAgenda = agenda.map(a => ({
            item: normalizeText(a.item),
            speaker: normalizeText(a.speaker)
        }));
        const fixedDecs = decs.map(d => ({
            decision: normalizeText(d.decision),
            responsible: normalizeText(d.responsible),
            deadline: normalizeText(d.deadline)
        }));

        const summaryParts = [];
        if (normalizeText(meetingTitle)) summaryParts.push(`عُقد اجتماع بعنوان: ${normalizeText(meetingTitle)}.`);
        if (fixedAgenda.length) summaryParts.push(`نوقشت ${fixedAgenda.length} بنود ضمن جدول الأعمال.`);
        if (fixedDecs.length) summaryParts.push(`تمت صياغة ${fixedDecs.length} قرارات/توصيات وتحديد المسؤوليات والمواعيد.`);        
        const executiveSummary = summaryParts.join(' ');

        return {
            agendaItems: fixedAgenda,
            decisions: fixedDecs,
            executiveSummary,
            issues: computeIssues(fixedAgenda, fixedDecs),
            mode: 'basic'
        };
    };

    if (!process.env.OPENAI_API_KEY) {
        return res.json(fallback());
    }

    try {
        const input = {
            meetingTitle: meetingTitle || '',
            meetingDate: meetingDate || '',
            meetingTime: meetingTime || '',
            meetingLocation: meetingLocation || '',
            meetingType: meetingType || '',
            department: department || '',
            chairman: chairman || '',
            secretary: secretary || '',
            agendaItems: agenda,
            decisions: decs
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                temperature: 0.2,
                messages: [
                    {
                        role: 'system',
                        content: 'أنت مساعد عربي لصياغة محاضر الاجتماعات. المطلوب: تدقيق لغوي، تحسين صياغة، إنتاج ملخص تنفيذي رسمي، واكتشاف النواقص. أعِد JSON فقط.'
                    },
                    {
                        role: 'user',
                        content:
                            `حسّن الصياغة وصحّح الإملاء دون تغيير المعنى. اكتب ملخصاً تنفيذياً واضحاً ومختصراً.\n` +
                            `أعد النتيجة بصيغة JSON فقط بالشكل:\n` +
                            `{\"agendaItems\":[{\"item\":\"\",\"speaker\":\"\"}],\"decisions\":[{\"decision\":\"\",\"responsible\":\"\",\"deadline\":\"\"}],\"executiveSummary\":\"\",\"issues\":[\"\"]}\n\n` +
                            `المدخل:\n${JSON.stringify(input)}`
                    }
                ]
            })
        });

        const json = await response.json();
        const text = json?.choices?.[0]?.message?.content || '';
        let parsed = null;
        try {
            parsed = JSON.parse(text);
        } catch (e) {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                parsed = JSON.parse(text.slice(start, end + 1));
            }
        }
        if (!parsed) return res.json(fallback());

        const fixedAgenda = Array.isArray(parsed.agendaItems) ? parsed.agendaItems : [];
        const fixedDecs = Array.isArray(parsed.decisions) ? parsed.decisions : [];
        const issues = Array.isArray(parsed.issues) ? parsed.issues : computeIssues(fixedAgenda, fixedDecs);

        res.json({
            agendaItems: fixedAgenda,
            decisions: fixedDecs,
            executiveSummary: parsed.executiveSummary || '',
            issues,
            mode: 'openai'
        });
    } catch (err) {
        console.error('AI assist error:', err);
        res.json(fallback());
    }
});

app.post('/api/meetings', requireAuth, (req, res) => {
    const {
        orgName,
        executiveSummary,
        referenceNumber,
        department,
        meetingTitle,
        meetingDate,
        meetingTime,
        duration,
        meetingLocation,
        meetingType,
        chairman,
        secretary,
        attendees,
        absentAttendees,
        externalAttendees,
        agendaItems,
        decisions,
        actionItems,
        nextMeetingDate,
        chairmanSignature,
        secretarySignature,
        watermarkImage
    } = req.body;

    const signatureTimestamp = new Date().toISOString();
    // If created by secretary, it's pending chairman. If created by chairman (unlikely workflow but possible), could be approved.
    // Default to pending_chairman if secretary signature is present but not chairman.
    let status = 'draft';
    if (secretarySignature && !chairmanSignature) {
        status = 'pending_chairman';
    } else if (secretarySignature && chairmanSignature) {
        status = 'approved';
    }

    // Convert structured data to JSON strings if they are objects
    const attendeesStr = (typeof attendees === 'object' ? JSON.stringify(attendees) : attendees) || '[]';
    const agendaItemsStr = (typeof agendaItems === 'object' ? JSON.stringify(agendaItems) : agendaItems) || '[]';
    const decisionsStr = (typeof decisions === 'object' ? JSON.stringify(decisions) : decisions) || '[]';
    
    // Legacy/Unused fields handling
    const absentAttendeesStr = (typeof absentAttendees === 'object' ? JSON.stringify(absentAttendees) : absentAttendees) || '';
    const externalAttendeesStr = (typeof externalAttendees === 'object' ? JSON.stringify(externalAttendees) : externalAttendees) || '';
    const actionItemsStr = (typeof actionItems === 'object' ? JSON.stringify(actionItems) : actionItems) || '';

    db.run(
        `INSERT INTO meeting_minutes 
         (org_name, executive_summary, reference_number, department, meeting_title, meeting_date, meeting_time, duration,
          meeting_location, meeting_type, chairman, secretary, attendees, absent_attendees, external_attendees,
          agenda_items, decisions, action_items, next_meeting_date, chairman_signature, secretary_signature, signature_timestamp, watermark_image, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            orgName || null, executiveSummary || null, referenceNumber, department, meetingTitle, meetingDate, meetingTime, duration,
            meetingLocation, meetingType, chairman, secretary, attendeesStr, absentAttendeesStr, externalAttendeesStr,
            agendaItemsStr, decisionsStr, actionItemsStr, nextMeetingDate, chairmanSignature, secretarySignature, signatureTimestamp, watermarkImage, status
        ],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                res.status(500).json({ error: 'Failed to save meeting minutes' });
            } else {
                res.json({ 
                    success: true, 
                    id: this.lastID,
                    message: 'Meeting minutes saved successfully' 
                });
            }
        }
    );
});

app.put('/api/meetings/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    const {
        orgName,
        executiveSummary,
        referenceNumber,
        department,
        meetingTitle,
        meetingDate,
        meetingTime,
        duration,
        meetingLocation,
        meetingType,
        chairman,
        secretary,
        attendees,
        agendaItems,
        decisions,
        nextMeetingDate,
        chairmanSignature,
        watermarkImage
    } = req.body;

    if (req.session.role === 'chairman' && chairmanSignature) {
        const signatureTimestamp = new Date().toISOString();
        const attendeesStr = (typeof attendees === 'object' ? JSON.stringify(attendees) : attendees) || '[]';
        const agendaItemsStr = (typeof agendaItems === 'object' ? JSON.stringify(agendaItems) : agendaItems) || '[]';
        const decisionsStr = (typeof decisions === 'object' ? JSON.stringify(decisions) : decisions) || '[]';

        db.run(
            `UPDATE meeting_minutes SET 
                org_name = ?,
                executive_summary = ?,
                reference_number = ?,
                department = ?,
                meeting_title = ?,
                meeting_date = ?,
                meeting_time = ?,
                duration = ?,
                meeting_location = ?,
                meeting_type = ?,
                chairman = ?,
                secretary = ?,
                attendees = ?,
                agenda_items = ?,
                decisions = ?,
                next_meeting_date = ?,
                chairman_signature = ?,
                watermark_image = ?,
                status = 'approved',
                signature_timestamp = ?
             WHERE id = ?`,
            [
                orgName || null,
                executiveSummary || null,
                referenceNumber || null,
                department || null,
                meetingTitle || null,
                meetingDate || null,
                meetingTime || null,
                duration || null,
                meetingLocation || null,
                meetingType || null,
                chairman || null,
                secretary || null,
                attendeesStr,
                agendaItemsStr,
                decisionsStr,
                nextMeetingDate || null,
                chairmanSignature,
                watermarkImage || null,
                signatureTimestamp,
                id
            ],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    res.status(500).json({ error: 'Failed to update meeting minutes' });
                } else {
                    res.json({ success: true, message: 'Meeting approved successfully' });
                }
            }
        );
    } else {
        res.status(403).json({ error: 'Only chairman can approve' });
    }
});

app.get('/api/meetings', requireAuth, (req, res) => {
    // Select summary fields only for the list to improve performance
    db.all('SELECT id, meeting_title, meeting_date, department, chairman, reference_number, status, created_at FROM meeting_minutes ORDER BY created_at DESC', (err, rows) => {
        if (err) {
            res.status(500).json({ error: 'Failed to fetch meetings' });
        } else {
            res.json(rows);
        }
    });
});

app.get('/api/meetings/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM meeting_minutes WHERE id = ?', [id], (err, row) => {
        if (err) {
            res.status(500).json({ error: 'Failed to fetch meeting details' });
        } else if (!row) {
            res.status(404).json({ error: 'Meeting not found' });
        } else {
            res.json(row);
        }
    });
});

app.post('/api/generate-pdf', requireAuth, async (req, res) => {
    console.log('Received PDF generation request');
    try {
        const meetingData = req.body;
        const pdfBuffer = await generatePDF(meetingData);
        
        console.log('PDF generated successfully, size:', pdfBuffer.length);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="meeting_minutes_${meetingData.meetingDate}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('PDF generation error in route:', error);
        res.status(500).json({ error: 'Failed to generate PDF: ' + error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
