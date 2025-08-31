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


