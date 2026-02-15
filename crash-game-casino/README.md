# 🎰 Crash Game Casino

A real-time multiplayer crash game casino with Paystack payment integration, built with Node.js, Express, Socket.io, and PostgreSQL.

## Features

✅ **User Authentication**
- Secure registration and login with JWT
- Password hashing with bcrypt
- Session management

✅ **Wallet System**
- Real-time balance updates
- Secure transaction tracking
- Deposit via Paystack

✅ **Crash Game**
- Real-time multiplier updates via WebSocket
- Provably fair crash point generation
- Live betting and cash-out functionality
- Round history tracking
- Live player feed

✅ **Payment Integration**
- Paystack payment gateway
- Automatic wallet updates via webhooks
- Transaction history

✅ **Security**
- HTTPS support
- Rate limiting
- Input validation
- SQL injection prevention
- XSS protection with Helmet

## Tech Stack

- **Backend**: Node.js, Express.js
- **WebSocket**: Socket.io
- **Database**: PostgreSQL with Sequelize ORM
- **Authentication**: JWT, bcrypt
- **Payment**: Paystack API
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL (v12 or higher)
- A Paystack account (for payment integration)

## Installation & Setup

### 1. Clone or Download the Project

```bash
cd crash-game-casino
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

#### Option A: Using PostgreSQL CLI

Create the database:
```bash
# Login to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE crash_game_db;

# Exit
\q
```

#### Option B: Using pgAdmin or other GUI tools
- Create a new database named `crash_game_db`

### 4. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
HOST=localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crash_game_db
DB_USER=postgres
DB_PASSWORD=your_actual_password

# JWT Secret (generate a random string)
JWT_SECRET=your_very_secret_jwt_key_here_change_this

# Paystack Configuration
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# Game Configuration
MIN_BET=10
MAX_BET=10000
ROUND_DURATION=10000
COUNTDOWN_DURATION=5000
```

**Important**: 
- Replace `DB_PASSWORD` with your PostgreSQL password
- Get Paystack keys from https://dashboard.paystack.com/#/settings/developers
- Generate a strong random string for `JWT_SECRET`

### 5. Initialize Database

Run the database initialization script:

```bash
npm run init-db
```

This will create all necessary tables and relationships.

### 6. Update Paystack Public Key in Frontend

Edit `public/app.js` and replace the Paystack public key on line ~447:

```javascript
key: 'pk_test_your_actual_public_key_here',
```

Or better yet, fetch it from the server for security.

## Running the Application

### Development Mode

```bash
npm run dev
```

This uses nodemon for auto-restart on file changes.

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured PORT).

## Usage Guide

### 1. Register an Account
- Navigate to `http://localhost:3000`
- Click "Register" tab
- Enter username, email, and password
- Click "Register"

### 2. Deposit Funds
- Click the "+ Deposit" button
- Enter amount (minimum ₦100)
- Complete payment via Paystack popup
- Your wallet will be updated automatically

### 3. Play the Game
- Wait for the countdown to place your bet
- Enter bet amount (₦10 - ₦10,000)
- Click "Place Bet"
- Click "Cash Out" before the crash to win!
- Your winnings are calculated as: bet × multiplier

### 4. View History
- Check your bet history at the bottom of the page
- View recent crash points
- See live bets from other players

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info (requires auth)

### Payment
- `POST /api/payment/initialize` - Initialize deposit (requires auth)
- `GET /api/payment/verify` - Verify payment
- `POST /api/payment/webhook` - Paystack webhook
- `GET /api/payment/transactions` - Get transaction history (requires auth)

### Game
- `GET /api/game/state` - Get current game state (requires auth)
- `POST /api/game/bet` - Place bet (requires auth)
- `POST /api/game/cashout` - Cash out (requires auth)
- `GET /api/game/history` - Get bet history (requires auth)
- `GET /api/game/rounds` - Get recent rounds

### WebSocket Events

**Client → Server:**
- `placeBet` - Place a bet with amount
- `cashOut` - Cash out current bet

**Server → Client:**
- `gameState` - Current game state update
- `countdown` - Countdown timer
- `multiplier` - Real-time multiplier update
- `betPlaced` - Bet placement confirmation
- `cashedOut` - Cash out confirmation
- `playerBet` - Another player placed a bet
- `playerCashedOut` - Another player cashed out
- `error` - Error message

## Database Schema

### Users Table
- `id` - Primary key
- `username` - Unique username
- `email` - Unique email
- `password_hash` - Hashed password
- `wallet_balance` - Current balance
- `created_at`, `updated_at` - Timestamps

### Crash Rounds Table
- `id` - Primary key
- `crash_point` - Multiplier where crash occurred
- `hash` - Provably fair hash
- `started_at`, `ended_at` - Timestamps

### Bets Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `round_id` - Foreign key to crash_rounds
- `amount` - Bet amount
- `cashed_out_at` - Multiplier when cashed out (null if lost)
- `won_amount` - Amount won
- `status` - pending/won/lost
- `created_at` - Timestamp

### Transactions Table
- `id` - Primary key
- `user_id` - Foreign key to users
- `type` - Transaction type (deposit/withdrawal)
- `amount` - Transaction amount
- `status` - pending/completed/failed
- `reference` - Unique payment reference
- `metadata` - Additional data (JSON)
- `created_at`, `updated_at` - Timestamps

## Security Considerations

### For Production Deployment:

1. **Environment Variables**
   - Never commit `.env` file to version control
   - Use strong, unique JWT_SECRET
   - Keep Paystack secret key secure

2. **HTTPS**
   - Enable HTTPS in production
   - Set `USE_HTTPS=true` in `.env`
   - Provide SSL certificate paths

3. **Database**
   - Use strong database passwords
   - Enable SSL for database connections
   - Regular backups

4. **Rate Limiting**
   - Adjust rate limits based on your needs
   - Implement IP-based blocking for suspicious activity

5. **Input Validation**
   - All user inputs are validated server-side
   - SQL injection prevention via Sequelize ORM
   - XSS protection via Helmet

6. **Webhooks**
   - Paystack webhooks verify signature
   - Always verify payment status server-side

## Troubleshooting

### Database Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Make sure PostgreSQL is running and credentials in `.env` are correct.

### Paystack Payment Not Working
**Solution**: 
- Verify Paystack keys in `.env`
- Update public key in `public/app.js`
- Check Paystack dashboard for test mode status

### WebSocket Connection Failed
**Solution**: 
- Ensure JWT token is valid
- Check browser console for errors
- Verify server is running

### Game Not Starting
**Solution**: 
- Check server logs for errors
- Ensure database connection is established
- Restart the server

## Development Tips

### Testing Payments
- Use Paystack test cards: https://paystack.com/docs/payments/test-payments
- Test card: 4084084084084081
- Any future expiry date and CVV

### Database Reset
```bash
npm run init-db
```
⚠️ This will delete all data!

### View Logs
```bash
# Development
npm run dev

# Production
pm2 logs crash-game-casino
```

## Deployment

### Deploying to Production

1. **Prepare Server**
   - Ubuntu 20.04+ or similar Linux distribution
   - Install Node.js, PostgreSQL, Nginx
   - Configure firewall (allow ports 80, 443)

2. **Clone Repository**
   ```bash
   git clone your-repo-url
   cd crash-game-casino
   npm install --production
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env
   # Set NODE_ENV=production
   # Configure production database
   # Add production Paystack keys
   ```

4. **Initialize Database**
   ```bash
   npm run init-db
   ```

5. **Start with PM2**
   ```bash
   npm install -g pm2
   pm2 start server.js --name crash-game-casino
   pm2 save
   pm2 startup
   ```

6. **Configure Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

7. **Enable HTTPS with Let's Encrypt**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

8. **Configure Paystack Webhook**
   - Go to Paystack Dashboard → Settings → Webhooks
   - Add webhook URL: `https://yourdomain.com/api/payment/webhook`

## License

MIT License - Feel free to use this project for learning or commercial purposes.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review server logs
3. Check PostgreSQL logs
4. Verify Paystack integration

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## Acknowledgments

- Socket.io for real-time communication
- Paystack for payment processing
- Sequelize for database ORM
- Express.js for the backend framework

---

**Created with ❤️ for educational purposes**
