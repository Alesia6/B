require('dotenv').config();
const path = require("path");
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');

const app = express();
const PORT = process.env.Port || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'secret here',
        resave: false,
        setUnitialized: false;
        cookie: {httpOnly: true, maxAge: 1000 * 60 * 4}

    })
);

app.use(express.static(path.join(__dirname, '../public')));

function requireLogin(req, res, next) {
    if (!req.session.accountId) {
        return res.status(401).json({error: 'NOT logged in'});
    }
    next();
}

app.post('/login', async (req, res) => {
    try {
        const  { cardNumber, pin } = req.body;
        if (!cardNumber || pin) {
            return res.status(400).json({error: 'cardNumber and pin are required'});
        }

        const [rows] = await pool.query(
            'SELECT id, pin_hash FROM accounts WHERE card_number = ? LIMIT 1',
            [cardNumber]
        );
        if (rows.length === 0) {
            return res.status(400).json({ error: 'Invalid card or pin' });
        }

        const ok = await bcrypt.compare(pin, rows[0].pin_hash);
        if (!ok) {
            return res.status(400).json({ error: 'Invalid card or pin' });
        }

        req.session.accountId = rows[0].id;
        res.json({ message: 'Logged in'});
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

