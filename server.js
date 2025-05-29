const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public'));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: function (req, file, cb) {
        console.log('File received:', file.originalname, file.mimetype);
        cb(null, true);
    }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// MongoDB connection with better error handling
console.log('Attempting to connect to MongoDB...');
console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bim-details')
    .then(() => {
        console.log('✅ Connected to MongoDB successfully');
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('Full error:', error);
        // Don't exit - let's see if we can still debug
    });

// Model Schema
const modelSchema = new mongoose.Schema({
    name: String,
    category: String,
    description: String,
    materials: [String],
    specifications: [String],
    filePath: String,
    uploadDate: { type: Date, default: Date.now }
});

const Model = mongoose.model('Model', modelSchema);

// Routes with extensive logging
app.post('/upload', upload.single('file'), (req, res) => {
    console.log('Basic upload route hit');
    if (!req.file) {
        console.log('No file in basic upload');
        return res.status(400).send('No file uploaded.');
    }
    console.log('Basic upload successful:', req.file.filename);
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    });
});

app.post('/api/upload', upload.single('model'), async (req, res) => {
    console.log('\n=== UPLOAD REQUEST START ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
    
    try {
        if (!req.file) {
            console.log('❌ No file uploaded');
            return res.status(400).json({ error: 'No file uploaded' });
        }

        console.log('✅ File uploaded:', req.file.filename);
        console.log('File path:', req.file.path);
        console.log('File size:', req.file.size);

        // Check if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('❌ MongoDB not connected, state:', mongoose.connection.readyState);
            return res.status(500).json({ error: 'Database not connected' });
        }

        // Parse arrays safely
        const materials = req.body.materials ? 
            req.body.materials.split(',').map(m => m.trim()).filter(m => m.length > 0) : [];
        const specifications = req.body.specifications ? 
            req.body.specifications.split(',').map(s => s.trim()).filter(s => s.length > 0) : [];

        console.log('Parsed materials:', materials);
        console.log('Parsed specifications:', specifications);

        const modelData = {
            name: req.body.name || 'Unnamed Model',
            category: req.body.category || 'Uncategorized',
            description: req.body.description || 'No description',
            materials: materials,
            specifications: specifications,
            filePath: `/uploads/${req.file.filename}`
        };

        console.log('Creating model with data:', modelData);

        const model = new Model(modelData);
        
        console.log('Attempting to save to MongoDB...');
        const savedModel = await model.save();
        console.log('✅ Model saved successfully:', savedModel._id);

        res.json({ success: true, model: savedModel });
        console.log('=== UPLOAD REQUEST SUCCESS ===\n');

    } catch (error) {
        console.error('❌ Upload error:', error.message);
        console.error('Full error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: error.message, stack: error.stack });
        console.log('=== UPLOAD REQUEST FAILED ===\n');
    }
});

app.get('/api/models', async (req, res) => {
    console.log('\n=== GET MODELS REQUEST ===');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('❌ MongoDB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const models = await Model.find();
        console.log('✅ Found models:', models.length);
        res.json(models);
    } catch (error) {
        console.error('❌ Get models error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint with more info
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: {
            connected: mongoose.connection.readyState === 1,
            state: mongoose.connection.readyState,
            database: mongoose.connection.name
        },
        uploads: {
            directory: fs.existsSync(uploadsDir) ? 'exists' : 'missing'
        }
    };
    console.log('Health check:', health);
    res.status(200).json(health);
});

// Catch all errors
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
});
