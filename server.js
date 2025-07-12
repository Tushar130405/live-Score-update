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


// Team Schema
const teamSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    country: String,
    logoUrl: String // Optional: URL for team logo
    // Add other team-specific fields like foundedYear, homeGround, etc.
});
const Team = mongoose.model('Team', teamSchema);

// BatsmanStats Schema - Dedicated table for batting statistics
const batsmanStatsSchema = new mongoose.Schema({
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    innings: { type: Number, required: true }, // Which innings in the match
    battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    
    // Batting Statistics
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isNotOut: { type: Boolean, default: false },
    
    // Dismissal Information
    dismissalType: {
        type: String,
        enum: ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 
               'retired hurt', 'obstructing the field', 'handled the ball', 
               'timed out', 'did not bat', 'not out'],
        default: null
    },
    bowlerDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    fielderDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    
    // Match Context
    matchDate: { type: Date, required: true },
    venue: { type: String, required: true },
    format: { type: String, enum: ['Test', 'ODI', 'T20'], required: true },
    
    // Calculated Fields
    strikeRate: { type: Number, default: 0 }, // (runs/balls) * 100
    average: { type: Number, default: 0 }, // Will be calculated from career stats
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
batsmanStatsSchema.index({ player: 1, match: 1, innings: 1 }, { unique: true });
batsmanStatsSchema.index({ player: 1, matchDate: -1 });
batsmanStatsSchema.index({ battingTeam: 1, matchDate: -1 });

const BatsmanStats = mongoose.model('BatsmanStats', batsmanStatsSchema);

// BowlerStats Schema - Dedicated table for bowling statistics
const bowlerStatsSchema = new mongoose.Schema({
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    match: { type: mongoose.Schema.Types.ObjectId, ref: 'Match', required: true },
    innings: { type: Number, required: true }, // Which innings in the match
    bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    
    // Bowling Statistics
    wickets: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    overs: { type: Number, default: 0 }, // Store as decimal (e.g., 4.3 for 4 overs 3 balls)
    maidens: { type: Number, default: 0 },
    
    // Detailed Bowling Stats
    wides: { type: Number, default: 0 },
    noBalls: { type: Number, default: 0 },
    byes: { type: Number, default: 0 },
    legByes: { type: Number, default: 0 },
    
    // Fielding Statistics (for the same player)
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    runOuts: { type: Number, default: 0 },
    
    // Match Context
    matchDate: { type: Date, required: true },
    venue: { type: String, required: true },
    format: { type: String, enum: ['Test', 'ODI', 'T20'], required: true },
    
    // Calculated Fields
    economyRate: { type: Number, default: 0 }, // (runs/overs)
    bowlingAverage: { type: Number, default: 0 }, // (runs/wickets)
    strikeRate: { type: Number, default: 0 }, // (balls/wickets)
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
bowlerStatsSchema.index({ player: 1, match: 1, innings: 1 }, { unique: true });
bowlerStatsSchema.index({ player: 1, matchDate: -1 });
bowlerStatsSchema.index({ bowlingTeam: 1, matchDate: -1 });

const BowlerStats = mongoose.model('BowlerStats', bowlerStatsSchema);

// Match Schema
const matchSchema = new mongoose.Schema({
    matchDate: { type: Date, required: true },
    venue: { type: String, required: true },
    format: { type: String, enum: ['Test', 'ODI', 'T20'], required: true },
    team1: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    team2: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    manOfTheMatch: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    tossWinner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    tossDecision: String,
    matchNotes: String
});

// PlayerStatsInInnings Schema (for embedding) - Keep for backward compatibility
const playerStatsInInningsSchema = new mongoose.Schema({
    player: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    runs: { type: Number, default: 0 },
    balls: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isNotOut: { type: Boolean, default: false },
    dismissalType: String,
    bowlerDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    fielderDismissal: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
    wickets: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    runOuts: { type: Number, default: 0 }
});

// Modify Match Schema to include innings and player stats
matchSchema.add({
    innings: [new mongoose.Schema({
        inningsNumber: { type: Number, required: true },
        battingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
        bowlingTeam: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
        runsScored: { type: Number, default: 0 },
        wicketsLost: { type: Number, default: 0 },
        oversBowled: { type: Number, default: 0 },
        isDeclared: { type: Boolean, default: false },
        isFollowOn: { type: Boolean, default: false },
        playerStats: [playerStatsInInningsSchema]
    })]
});

const Match = mongoose.model('Match', matchSchema);

// --- Authentication Routes ---
// This route should only be used for initial admin creation, or secured
// For simplicity, we'll only allow one admin user to be created manually or via a script
app.post('/api/auth/register', async (req, res) => {
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
// This middleware MUST be defined BEFORE any routes that use it.
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

// --- Team Routes (Protected by Authentication) ---
app.get('/api/teams', authenticateToken, async (req, res) => {
    try {
        const teams = await Team.find();
        res.json(teams);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/teams/:id', authenticateToken, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id);
        if (!team) return res.status(404).json({ message: 'Team not found' });
        res.json(team);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/teams', authenticateToken, async (req, res) => {
    const team = new Team(req.body);
    try {
        const newTeam = await team.save();
        res.status(201).json(newTeam);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/teams/:id', authenticateToken, async (req, res) => {
    try {
        const updatedTeam = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedTeam) return res.status(404).json({ message: 'Team not found' });
        res.json(updatedTeam);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/teams/:id', authenticateToken, async (req, res) => {
    try {
        const deletedTeam = await Team.findByIdAndDelete(req.params.id);
        if (!deletedTeam) return res.status(404).json({ message: 'Team not found' });
        res.json({ message: 'Team deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- Match Routes (Protected by Authentication) ---
// These routes are now correctly placed AFTER the authenticateToken definition.
app.get('/api/matches', authenticateToken, async (req, res) => {
    try {
        const matches = await Match.find()
            .populate('team1', 'name logoUrl')
            .populate('team2', 'name logoUrl')
            .populate('winner', 'name')
            .populate('manOfTheMatch', 'name')
            .sort({ matchDate: -1 });
        res.json(matches);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/matches/:id', authenticateToken, async (req, res) => {
    try {
        const match = await Match.findById(req.params.id)
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('winner', 'name')
            .populate('manOfTheMatch', 'name')
            .populate('tossWinner', 'name')
            .populate('innings.battingTeam', 'name')
            .populate('innings.bowlingTeam', 'name')
            .populate('innings.playerStats.player', 'name')
            .populate('innings.playerStats.bowlerDismissal', 'name')
            .populate('innings.playerStats.fielderDismissal', 'name');

        if (!match) return res.status(404).json({ message: 'Match not found' });
        res.json(match);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/matches', authenticateToken, async (req, res) => {
    const match = new Match(req.body);
    try {
        const newMatch = await match.save();
        res.status(201).json(newMatch);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/matches/:id', authenticateToken, async (req, res) => {
    try {
        const updatedMatch = await Match.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
            .populate('team1', 'name')
            .populate('team2', 'name')
            .populate('winner', 'name')
            .populate('manOfTheMatch', 'name')
            .populate('tossWinner', 'name');

        if (!updatedMatch) return res.status(404).json({ message: 'Match not found' });
        res.json(updatedMatch);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/matches/:id', authenticateToken, async (req, res) => {
    try {
        const deletedMatch = await Match.findByIdAndDelete(req.params.id);
        if (!deletedMatch) return res.status(404).json({ message: 'Match not found' });
        res.json({ message: 'Match deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- BatsmanStats Routes (Protected by Authentication) ---
app.get('/api/batsman-stats', authenticateToken, async (req, res) => {
    try {
        const { player, match, format, team, limit = 50, skip = 0 } = req.query;
        let query = {};
        
        if (player) query.player = player;
        if (match) query.match = match;
        if (format) query.format = format;
        if (team) query.battingTeam = team;
        
        const stats = await BatsmanStats.find(query)
            .populate('player', 'name country role')
            .populate('match', 'matchDate venue format')
            .populate('battingTeam', 'name')
            .populate('bowlingTeam', 'name')
            .populate('bowlerDismissal', 'name')
            .populate('fielderDismissal', 'name')
            .sort({ matchDate: -1, innings: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/batsman-stats/:id', authenticateToken, async (req, res) => {
    try {
        const stats = await BatsmanStats.findById(req.params.id)
            .populate('player', 'name country role')
            .populate('match', 'matchDate venue format')
            .populate('battingTeam', 'name')
            .populate('bowlingTeam', 'name')
            .populate('bowlerDismissal', 'name')
            .populate('fielderDismissal', 'name');
        
        if (!stats) return res.status(404).json({ message: 'Batsman stats not found' });
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/batsman-stats', authenticateToken, async (req, res) => {
    try {
        // Calculate strike rate
        const { runs, balls } = req.body;
        const strikeRate = balls > 0 ? (runs / balls) * 100 : 0;
        
        const batsmanStats = new BatsmanStats({
            ...req.body,
            strikeRate: Math.round(strikeRate * 100) / 100 // Round to 2 decimal places
        });
        
        const newStats = await batsmanStats.save();
        await newStats.populate([
            { path: 'player', select: 'name country role' },
            { path: 'match', select: 'matchDate venue format' },
            { path: 'battingTeam', select: 'name' },
            { path: 'bowlingTeam', select: 'name' },
            { path: 'bowlerDismissal', select: 'name' },
            { path: 'fielderDismissal', select: 'name' }
        ]);
        
        res.status(201).json(newStats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/batsman-stats/:id', authenticateToken, async (req, res) => {
    try {
        // Calculate strike rate
        const { runs, balls } = req.body;
        const strikeRate = balls > 0 ? (runs / balls) * 100 : 0;
        
        const updatedStats = await BatsmanStats.findByIdAndUpdate(
            req.params.id, 
            { 
                ...req.body, 
                strikeRate: Math.round(strikeRate * 100) / 100,
                updatedAt: Date.now()
            }, 
            { new: true, runValidators: true }
        ).populate([
            { path: 'player', select: 'name country role' },
            { path: 'match', select: 'matchDate venue format' },
            { path: 'battingTeam', select: 'name' },
            { path: 'bowlingTeam', select: 'name' },
            { path: 'bowlerDismissal', select: 'name' },
            { path: 'fielderDismissal', select: 'name' }
        ]);
        
        if (!updatedStats) return res.status(404).json({ message: 'Batsman stats not found' });
        res.json(updatedStats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/batsman-stats/:id', authenticateToken, async (req, res) => {
    try {
        const deletedStats = await BatsmanStats.findByIdAndDelete(req.params.id);
        if (!deletedStats) return res.status(404).json({ message: 'Batsman stats not found' });
        res.json({ message: 'Batsman stats deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get career batting statistics for a player
app.get('/api/batsman-stats/player/:playerId/career', authenticateToken, async (req, res) => {
    try {
        const stats = await BatsmanStats.find({ player: req.params.playerId })
            .populate('match', 'matchDate venue format')
            .populate('battingTeam', 'name')
            .populate('bowlingTeam', 'name')
            .sort({ matchDate: -1 });
        
        if (stats.length === 0) {
            return res.status(404).json({ message: 'No batting stats found for this player' });
        }
        
        // Calculate career totals
        const careerStats = {
            totalMatches: new Set(stats.map(s => s.match.toString())).size,
            totalInnings: stats.length,
            totalRuns: stats.reduce((sum, s) => sum + s.runs, 0),
            totalBalls: stats.reduce((sum, s) => sum + s.balls, 0),
            totalFours: stats.reduce((sum, s) => sum + s.fours, 0),
            totalSixes: stats.reduce((sum, s) => sum + s.sixes, 0),
            notOuts: stats.filter(s => s.isNotOut).length,
            dismissals: stats.filter(s => !s.isNotOut).length,
            careerStrikeRate: 0,
            careerAverage: 0
        };
        
        // Calculate averages
        if (careerStats.totalBalls > 0) {
            careerStats.careerStrikeRate = Math.round((careerStats.totalRuns / careerStats.totalBalls) * 10000) / 100;
        }
        
        if (careerStats.dismissals > 0) {
            careerStats.careerAverage = Math.round((careerStats.totalRuns / careerStats.dismissals) * 100) / 100;
        }
        
        res.json({
            careerStats,
            matchStats: stats
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// --- BowlerStats Routes (Protected by Authentication) ---
app.get('/api/bowler-stats', authenticateToken, async (req, res) => {
    try {
        const { player, match, format, team, limit = 50, skip = 0 } = req.query;
        let query = {};
        
        if (player) query.player = player;
        if (match) query.match = match;
        if (format) query.format = format;
        if (team) query.bowlingTeam = team;
        
        const stats = await BowlerStats.find(query)
            .populate('player', 'name country role')
            .populate('match', 'matchDate venue format')
            .populate('bowlingTeam', 'name')
            .populate('battingTeam', 'name')
            .sort({ matchDate: -1, innings: 1 })
            .limit(parseInt(limit))
            .skip(parseInt(skip));
        
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.get('/api/bowler-stats/:id', authenticateToken, async (req, res) => {
    try {
        const stats = await BowlerStats.findById(req.params.id)
            .populate('player', 'name country role')
            .populate('match', 'matchDate venue format')
            .populate('bowlingTeam', 'name')
            .populate('battingTeam', 'name');
        
        if (!stats) return res.status(404).json({ message: 'Bowler stats not found' });
        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/bowler-stats', authenticateToken, async (req, res) => {
    try {
        // Calculate bowling statistics
        const { wickets, runsConceded, overs, catches, stumpings, runOuts } = req.body;
        const economyRate = overs > 0 ? runsConceded / overs : 0;
        const bowlingAverage = wickets > 0 ? runsConceded / wickets : 0;
        const strikeRate = wickets > 0 ? (overs * 6) / wickets : 0; // balls per wicket
        
        const bowlerStats = new BowlerStats({
            ...req.body,
            economyRate: Math.round(economyRate * 100) / 100,
            bowlingAverage: Math.round(bowlingAverage * 100) / 100,
            strikeRate: Math.round(strikeRate * 100) / 100
        });
        
        const newStats = await bowlerStats.save();
        await newStats.populate([
            { path: 'player', select: 'name country role' },
            { path: 'match', select: 'matchDate venue format' },
            { path: 'bowlingTeam', select: 'name' },
            { path: 'battingTeam', select: 'name' }
        ]);
        
        res.status(201).json(newStats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.put('/api/bowler-stats/:id', authenticateToken, async (req, res) => {
    try {
        // Calculate bowling statistics
        const { wickets, runsConceded, overs, catches, stumpings, runOuts } = req.body;
        const economyRate = overs > 0 ? runsConceded / overs : 0;
        const bowlingAverage = wickets > 0 ? runsConceded / wickets : 0;
        const strikeRate = wickets > 0 ? (overs * 6) / wickets : 0;
        
        const updatedStats = await BowlerStats.findByIdAndUpdate(
            req.params.id, 
            { 
                ...req.body, 
                economyRate: Math.round(economyRate * 100) / 100,
                bowlingAverage: Math.round(bowlingAverage * 100) / 100,
                strikeRate: Math.round(strikeRate * 100) / 100,
                updatedAt: Date.now()
            }, 
            { new: true, runValidators: true }
        ).populate([
            { path: 'player', select: 'name country role' },
            { path: 'match', select: 'matchDate venue format' },
            { path: 'bowlingTeam', select: 'name' },
            { path: 'battingTeam', select: 'name' }
        ]);
        
        if (!updatedStats) return res.status(404).json({ message: 'Bowler stats not found' });
        res.json(updatedStats);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

app.delete('/api/bowler-stats/:id', authenticateToken, async (req, res) => {
    try {
        const deletedStats = await BowlerStats.findByIdAndDelete(req.params.id);
        if (!deletedStats) return res.status(404).json({ message: 'Bowler stats not found' });
        res.json({ message: 'Bowler stats deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get career bowling statistics for a player
app.get('/api/bowler-stats/player/:playerId/career', authenticateToken, async (req, res) => {
    try {
        const stats = await BowlerStats.find({ player: req.params.playerId })
            .populate('match', 'matchDate venue format')
            .populate('bowlingTeam', 'name')
            .populate('battingTeam', 'name')
            .sort({ matchDate: -1 });
        
        if (stats.length === 0) {
            return res.status(404).json({ message: 'No bowling stats found for this player' });
        }
        
        // Calculate career totals
        const careerStats = {
            totalMatches: new Set(stats.map(s => s.match.toString())).size,
            totalInnings: stats.length,
            totalWickets: stats.reduce((sum, s) => sum + s.wickets, 0),
            totalRunsConceded: stats.reduce((sum, s) => sum + s.runsConceded, 0),
            totalOvers: stats.reduce((sum, s) => sum + s.overs, 0),
            totalMaidens: stats.reduce((sum, s) => sum + s.maidens, 0),
            totalWides: stats.reduce((sum, s) => sum + s.wides, 0),
            totalNoBalls: stats.reduce((sum, s) => sum + s.noBalls, 0),
            totalCatches: stats.reduce((sum, s) => sum + s.catches, 0),
            totalStumpings: stats.reduce((sum, s) => sum + s.stumpings, 0),
            totalRunOuts: stats.reduce((sum, s) => sum + s.runOuts, 0),
            careerEconomyRate: 0,
            careerBowlingAverage: 0,
            careerStrikeRate: 0
        };
        
        // Calculate averages
        if (careerStats.totalOvers > 0) {
            careerStats.careerEconomyRate = Math.round((careerStats.totalRunsConceded / careerStats.totalOvers) * 100) / 100;
        }
        
        if (careerStats.totalWickets > 0) {
            careerStats.careerBowlingAverage = Math.round((careerStats.totalRunsConceded / careerStats.totalWickets) * 100) / 100;
            careerStats.careerStrikeRate = Math.round((careerStats.totalOvers * 6 / careerStats.totalWickets) * 100) / 100;
        }
        
        res.json({
            careerStats,
            matchStats: stats
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
