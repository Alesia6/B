require('dotenv').config();
const path = require("path");
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const pool = require('./db');

const { REFUSED } = require('dns');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'secret here',
        resave: false,
        saveUninitialized: false,
        cookie: {httpOnly: true, maxAge: 1000 * 60 * 60 * 4}

    })
);

app.use(express.static(path.join(__dirname, '../public')));

function requireLogin(req, res, next) {
    if (!req.session.accountId) {
        return res.status(401).json({error: 'NOT logged in'});
    }
    next();
}

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login', { error: null }); 
});

app.post('/login', async (req, res) => {
    try {
        const  { cardNumber, pin } = req.body;
        if (!cardNumber || !pin) {
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
       res.redirect('/dashboard');
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/withdraw', requireLogin, (req, res) => {
    res.render('withdraw');
});

app.post('/withdraw', requireLogin, async (req, res) =>{
    let {amount} = req.body;
    amount = parseFloat(amount);
    if (!Number.isFinite(amount) || amount <=0) {
        return res.status(400).json({ error: 'Amount must be a positive number'});
    }

    const conn = await pool.getConnection();

    try{
        await conn.beginTransaction();
        const [rows] = await conn.query(
            'SELECT balance FROM accounts WHERE id = ? FOR UPDATE',
            [req.session.accountId]
        );

if (rows.length === 0) {
    throw new Error('Account not found');
}

const currentBalance = parseFloat(rows[0].balance);
if (currentBalance < amount) {
    await conn.rollback();
    return res.status(400).json({ error: 'Insufficient funds'});
}

const newBalance = (currentBalance - amount).toFixed(2);
await conn.query(
    'UPDATE accounts SET balance = ? WHERE ID = ?',
    [newBalance, req.session.accountId]
);

await conn.query(
    'INSERT INTO transactions (account_id, type, amount, balance_after) VALUES (?, ?, ?, ?)',
    [req.session.accountId, 'WITHDRAW', amount.toFixed(2), newBalance]);

await conn.commit();

res.redirect('/dashboard');
} catch (err) {

   await conn.rollback();
     console.error('Withdrawal error:', err);

    res.status(500).json({ error: 'Transaction failed' });
    } finally {
        conn.release();
}
});


app.get('/deposit', requireLogin, (req, res) => {
    res.render('deposit');
});

app.post('/deposit', requireLogin, async (req, res) => {
    let {amount} = req.body;
    amount = parseFloat(amount);
    if (!Number.isFinite(amount) || amount <=0) {
        return res.status(400).json({ error: 'Amount must be a positive number'});
 }
 const conn = await pool.getConnection();
 try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
        'SELECT balance FROM accounts WHERE id = ? FOR UPDATE',
        [req.session.accountId]
    );
    if (rows.length === 0) throw new Error('Account not found');

    const currentBalance = parseFloat(rows[0].balance);
    const newBalance = (currentBalance + amount).toFixed(2);

    await conn.query(
        'UPDATE accounts SET balance = ? WHERE id = ?',
        [newBalance, req.session.accountId]
    );

    await conn.query(
        'INSERT INTO transactions (account_id, type, amount, balance_after) VALUES(?, ?, ?, ?)',
    [req.session.accountId, 'DEPOSIT', amount.toFixed(2), newBalance]
    );

    await conn.commit();
     res.redirect('/dashboard');
 } catch (err) {
    await conn.rollback();
    console.error('Deposit error:', err);
    res.status(500).json({ error: 'Transaction failed'});
 } finally {
    conn.release();
 }
});


app.get('/balance', requireLogin, async(req, res) => {
    try{
        const [rows] = await pool.query(
            'SELECT balance FROM accounts WHERE id =?',
            [req.session.accountId]
        );
        if (rows.length > 0) {
            res.json( {balance: Number(rows[0].balance)});
        } else {
              res.status(404).json({ error: 'Account not found' });
        }
    } catch (err) {
        console.error('Balance fetch error:', err);
        res.status(500).json({ error: 'Failed to retrieve balance'});
    }
});

// Transaction history

app.get('/transactions', requireLogin, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const [rows]= await pool.query(
            'SELECT id, type, amount, balance_after, created_at FROM transactions WHERE account_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
            [req.session.accountId, limit] );

    const transactions = rows.map(row => ({
        id: row.id,
        type: row.type,
        amount: Number(row.amount),
        balance_after: Number(row.balance_after),
        created_at: row.created_at
    }));

    res.render('transactions', { transactions: transactions });
    
    } catch (err) {
        console.error('Transactions failed to fetch', err);
        res.status(500).json({error: 'Failed to retrieve transactions'});
    }
});


app.get('/dashboard', requireLogin, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT balance from accounts WHERE id= ?',
            [req.session.accountId]
        );

        res.render('dashboard', {
            balance: rows[0].balance,
            accountId: req.session.accountId
        });
    } catch (err) {
        console.error('Dashboard error', err);
        res.redirect('/login');
    }
 });

 app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.redirect('/dashboard');

        }
        res.clearCookie('connect.sid');
        res.redirect('/login');
    });
});



app.listen(PORT, () =>{
    console.log(`ATM server running on http://localhost:${PORT}`);
});

