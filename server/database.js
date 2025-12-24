const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // Meeting Minutes Table
        db.run(`
            CREATE TABLE IF NOT EXISTS meeting_minutes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reference_number TEXT,
                department TEXT,
                org_name TEXT,
                executive_summary TEXT,
                meeting_title TEXT NOT NULL,
                meeting_date TEXT NOT NULL,
                meeting_time TEXT NOT NULL,
                duration TEXT,
                meeting_location TEXT NOT NULL,
                meeting_type TEXT NOT NULL,
                chairman TEXT NOT NULL,
                secretary TEXT NOT NULL,
                attendees TEXT NOT NULL,
                absent_attendees TEXT,
                external_attendees TEXT,
                agenda_items TEXT NOT NULL,
                decisions TEXT NOT NULL,
                action_items TEXT,
                next_meeting_date TEXT,
                chairman_signature TEXT,
                secretary_signature TEXT,
                signature_timestamp TEXT,
                watermark_image TEXT,
                status TEXT DEFAULT 'draft',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) console.error('Error creating meeting_minutes table:', err);
            else {
                console.log('Meeting minutes table ready');
                ensureMeetingMinutesSchema();
            }
        });

        // Users Table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL,
                full_name TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Users table ready');
                seedUsers();
            }
        });
    });
}

function ensureMeetingMinutesSchema() {
    db.all('PRAGMA table_info(meeting_minutes)', (err, columns) => {
        if (err) {
            console.error('Error reading meeting_minutes schema:', err);
            return;
        }
        const columnNames = new Set((columns || []).map(c => c.name));
        if (!columnNames.has('org_name')) {
            db.run('ALTER TABLE meeting_minutes ADD COLUMN org_name TEXT', (err) => {
                if (err) console.error('Error adding org_name column:', err);
                else console.log('Added org_name column');
            });
        }
        if (!columnNames.has('executive_summary')) {
            db.run('ALTER TABLE meeting_minutes ADD COLUMN executive_summary TEXT', (err) => {
                if (err) console.error('Error adding executive_summary column:', err);
                else console.log('Added executive_summary column');
            });
        }
        if (!columnNames.has('watermark_image')) {
            db.run('ALTER TABLE meeting_minutes ADD COLUMN watermark_image TEXT', (err) => {
                if (err) console.error('Error adding watermark_image column:', err);
                else console.log('Added watermark_image column');
            });
        }
    });
}

function seedUsers() {
    const users = [
        { username: 'admin', password: 'admin123', role: 'chairman', full_name: 'مدير النظام' },
        { username: 'user', password: 'user123', role: 'secretary', full_name: 'مقرر الاجتماع' }
    ];

    users.forEach(user => {
        db.get('SELECT id FROM users WHERE username = ?', [user.username], (err, row) => {
            if (err) {
                console.error('Error checking user:', err);
                return;
            }
            if (!row) {
                const saltRounds = 10;
                bcrypt.hash(user.password, saltRounds, (err, hash) => {
                    if (err) {
                        console.error('Error hashing password:', err);
                        return;
                    }
                    db.run('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
                        [user.username, hash, user.role, user.full_name],
                        (err) => {
                            if (err) console.error('Error seeding user:', err);
                            else console.log(`User ${user.username} created`);
                        }
                    );
                });
            }
        });
    });
}

module.exports = db;
