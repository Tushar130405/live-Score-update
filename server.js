require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Corrected from bcrypt

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow cross-origin requests from your frontend
app.use(express.json()); // Parse JSON request bodies

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB Atlas!'))
    .catch(err => console.error('Could not connect to MongoDB Atlas:', err));

// --- Database Schemas (Models) ---
// Player Schema
const playerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    country: String,
    role: String, // e.g., Batsman, Bowler, All-Rounder, Wicket-Keeper
    dateOfBirth: Date,
    battingStyle: String, // e.g., Right-handed, Left-handed
    bowlingStyle: String, // e.g., Right-arm fast, Left-arm orthodox
    photoUrl: String,
    currentTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' } // Reference to Team model
    // Add more fields as needed for stats, etc.
});
const Player = mongoose.model('Player', playerSchema);

// User Schema for Admin Login
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Hashed password
    role: { type: String, enum: ['admin', 'editor'], default: 'admin' }
});
const User = mongoose.model('User', userSchema);

const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    country: String,
    logoUrl: String // Optional: URL for team logo
    // Add other team-specific fields like foundedYear, homeGround, etc.
});
const Team = mongoose.model('Team', teamSchema);


const matchSchema = new mongoose.Schema({
    matchDate: { type: Date, required: true },
    venue: String,
    format: { type: String, enum: ['Test', 'ODI', 'T20'], required: true },
    team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // Can be null for draw/ongoing
    manOfTheMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    tossWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    tossDecision: String, // 'Bat' or 'Bowl'
    // Consider embedding basic scores here, or linking to a separate MatchStats collection
    // e.g., team1Score: Number, team2Score: Number
});
const Match = mongoose.model('Match', matchSchema);

// Potentially a separate schema for detailed match stats per player per innings
const matchStatSchema = new mongoose.Schema({
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true }, // The team the player played for in this match
    inningsNumber: Number, // 1, 2, 3, or 4 for Tests
    // Batting Stats
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isNotOut: { type: Boolean, default: false },
    dismissalType: String, // e.g., 'bowled', 'caught', 'run out'
    bowlerDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' }, // Bowler who dismissed them
    fielderDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' }, // Fielder involved in dismissal (e.g., catch, run out)
    strikeRate: Number, // Calculate this on the fly or pre-save if needed
    // Bowling Stats
    overs: { type: Number, default: 0 }, // e.g., 10.3 overs
    maidens: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    economy: Number, // Calculate
    // Fielding Stats
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    runOuts: { type: Number, default: 0 }
});
const MatchStat = mongoose.model('MatchStat', matchStatSchema);


// --- Authentication Routes ---
app.post('/api/auth/register', async (req, res) => {
    // This route should only be used for initial admin creation, or secured
    // For simplicity, we'll only allow one admin user to be created manually or via a script
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const user = new User({
            username: req.body.username,
            password: hashedPassword,
            role: req.body.role || 'admin'
        });
        await user.save();
        res.status(201).send('User registered successfully.');
    } catch (error) {
        console.error("Registration error:", error);
        res.status(500).send('Error registering user.');
    }
});

// Initial Admin Setup (Run once, then comment out or secure heavily)
async function createInitialAdmin() {
    try {
        const adminExists = await User.findOne({ username: process.env.ADMIN_USERNAME });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
            const adminUser = new User({
                username: process.env.ADMIN_USERNAME,
                password: hashedPassword,
                role: 'admin'
            });
            await adminUser.save();
            console.log('Initial admin user created successfully!');
        } else {
            console.log('Admin user already exists.');
        }
    } catch (error) {
        console.error('Error creating initial admin:', error);
    }
}
createInitialAdmin(); // Call this on server start

app.post('/api/auth/login', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.body.username });
        if (!user) {
            return res.status(400).send('Invalid credentials.');
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(400).send('Invalid credentials.');
        }

        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );
        res.json({ token });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).send('Server error during login.');
    }
});

// --- Middleware for JWT Authentication ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(403).json({ message: 'Token expired.' }); // Token expired
            }
            return res.status(403).json({ message: 'Invalid token.' }); // Other token issues
        }
        req.user = user; // Attach user payload (id, role) to request
        next();
    });
};

// --- Player Routes (Protected by Authentication) ---
app.get('/api/players', authenticateToken, async (req, res) => {
    try {
        const players = await Player.find();
        res.json(players);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/players/:id', authenticateToken, async (req, res) => {
    try {
        const player = await Player.findById(req.params.id);
        if (!player) return res.status(404).json({ message: 'Player not found' });
        res.json(player);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/players', authenticateToken, async (req, res) => {
    const player = new Player(req.body);
    try {
        const newPlayer = await player.save();
        res.status(201).json(newPlayer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/players/:id', authenticateToken, async (req, res) => {
    try {
        const updatedPlayer = await Player.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedPlayer) return res.status(404).json({ message: 'Player not found' });
        res.json(updatedPlayer);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/players/:id', authenticateToken, async (req, res) => {
    try {
        const deletedPlayer = await Player.findByIdAndDelete(req.params.id);
        if (!deletedPlayer) return res.status(404).json({ message: 'Player not found' });
        res.json({ message: 'Player deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});