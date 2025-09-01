require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/db');

(async () => {
  try {
  const cardNumber = '1111222233334444';
  const pin = '1234';
   const startingBalance = 500.0;

    const [existing] = await pool.query(
      'SELECT id FROM accounts WHERE card_number = ? LIMIT 1',
      [cardNumber]
    );

    if (existing.length) {
      console.log('Account already exists.');
      process.exit(0);
    }

    const pinHash = await bcrypt.hash(pin, 10);

    await pool.query(
      'INSERT INTO accounts (card_number, pin_hash, balance) VALUES (?,?,?)',
      [cardNumber, pinHash, startingBalance]
    );

    console.log('Seeded account:');
    console.log(' Card Number:', cardNumber);
    console.log(' PIN:', pin);
    console.log(' Starting Balance:', startingBalance);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
