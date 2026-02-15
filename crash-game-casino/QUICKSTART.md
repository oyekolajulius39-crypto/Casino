# 🚀 Quick Start Guide

Get your Crash Game Casino running in 5 minutes!

## Step 1: Install Dependencies
```bash
npm install
```

## Step 2: Setup PostgreSQL Database

**Option A - Using psql:**
```bash
psql -U postgres
CREATE DATABASE crash_game_db;
\q
```

**Option B - Using pgAdmin:**
- Open pgAdmin
- Right-click "Databases" → Create → Database
- Name: `crash_game_db`

## Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env file with your text editor
nano .env
# or
code .env
```

**Required changes in .env:**
1. Set `DB_PASSWORD` to your PostgreSQL password
2. Add your Paystack keys from https://dashboard.paystack.com/#/settings/developers
3. Generate a random string for `JWT_SECRET` (use any random string generator)

**Minimum .env configuration:**
```env
DB_PASSWORD=your_postgres_password
JWT_SECRET=any_random_long_string_here
PAYSTACK_SECRET_KEY=sk_test_your_key_from_paystack
PAYSTACK_PUBLIC_KEY=pk_test_your_key_from_paystack
```

## Step 4: Initialize Database

```bash
npm run init-db
```

You should see:
```
✓ Database connection successful
✓ Database models synchronized
Database initialization complete!
```

## Step 5: Update Frontend Paystack Key

Edit `public/app.js` (around line 447) and replace:
```javascript
key: 'pk_test_your_public_key_here',
```
with your actual Paystack public key from step 3.

## Step 6: Start the Server

```bash
npm start
```

You should see:
```
Server running on http://localhost:3000
Environment: development
Starting new round...
```

## Step 7: Open in Browser

Navigate to: **http://localhost:3000**

## Step 8: Test the Game

1. **Register** a new account
2. Click **"+ Deposit"** to add funds
3. Use test card: **4084084084084081** (Paystack test mode)
4. Place a bet and enjoy!

---

## Troubleshooting

### ❌ Database Connection Error
- Make sure PostgreSQL is running
- Check `DB_PASSWORD` in `.env` matches your PostgreSQL password
- Verify database `crash_game_db` exists

### ❌ Paystack Not Working
- Double-check keys in `.env` are correct
- Update public key in `public/app.js`
- Use test cards from: https://paystack.com/docs/payments/test-payments

### ❌ Port Already in Use
Edit `.env` and change:
```env
PORT=3001
```

---

## Test Cards (Paystack Test Mode)

✅ **Success**: 4084084084084081  
❌ **Failure**: 4084080000000408

Any future expiry date and any 3-digit CVV.

---

## Need Help?

Check the full **README.md** for detailed documentation, API endpoints, and deployment guides.

**Happy Gaming! 🎰**
