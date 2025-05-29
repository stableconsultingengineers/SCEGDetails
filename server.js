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
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        console.log('File received:', file.originalname, file.mimetype);
        cb(null, true);
    }
});

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
    uploadDate: { type: Date, default: Date.now },
    fileSize: Number,
    originalName: String
});

const Model = mongoose.model('Model', modelSchema);

// ===== FILE HANDLING ROUTES (MUST BE BEFORE express.static) =====

// Handle uploads with better error handling
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    
    console.log('📁 File request:', req.params.filename);
    console.log('📂 Looking for file at:', filePath);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
        console.log('✅ File found, serving...');
        res.sendFile(filePath);
    } else {
        console.log('❌ File not found!');
        console.log('📋 Available files:', fs.existsSync(path.join(__dirname, 'uploads')) ? 
            fs.readdirSync(path.join(__dirname, 'uploads')) : 'uploads directory does not exist');
        
        res.status(404).json({ 
            error: 'File not found',
            message: 'The requested file is no longer available. Files are temporarily stored and may be removed during server maintenance.',
            filename: req.params.filename,
            suggestion: 'Please re-upload your model.'
        });
    }
});

// Debug route to check file system
app.get('/debug/files', (req, res) => {
    const uploadsPath = path.join(__dirname, 'uploads');
    
    try {
        if (!fs.existsSync(uploadsPath)) {
            return res.json({
                error: 'uploads directory does not exist',
                path: uploadsPath,
                serverTime: new Date().toISOString(),
                processUptime: process.uptime() + ' seconds'
            });
        }
        
        const files = fs.readdirSync(uploadsPath);
        const fileDetails = files.map(file => {
            const filePath = path.join(uploadsPath, file);
            const stats = fs.statSync(filePath);
            return {
                name: file,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime,
                sizeFormatted: (stats.size / 1024 / 1024).toFixed(2) + 'MB'
            };
        });
        
        res.json({
            uploadsPath: uploadsPath,
            fileCount: files.length,
            files: fileDetails,
            totalSize: fileDetails.reduce((sum, file) => sum + file.size, 0),
            totalSizeFormatted: (fileDetails.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(2) + 'MB',
            serverTime: new Date().toISOString(),
            processUptime: process.uptime() + ' seconds'
        });
        
    } catch (error) {
        res.status(500).json({
            error: error.message,
            stack: error.stack
        });
    }
});

// Debug route to check MongoDB models
app.get('/debug/models', async (req, res) => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return res.status(500).json({ error: 'Database not connected' });
        }

        const models = await Model.find().sort({ uploadDate: -1 });
        
        res.json({
            count: models.length,
            models: models.map(model => ({
                id: model._id,
                name: model.name,
                category: model.category,
                filePath: model.filePath,
                uploadDate: model.uploadDate,
                fileSize: model.fileSize,
                originalName: model.originalName
            })),
            mongoConnection: {
                state: mongoose.connection.readyState,
                database: mongoose.connection.name
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== UPLOAD ROUTES =====

// Basic upload route (for testing)
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

// Main API upload route
app.post('/api/upload', upload.single('model'), async (req, res) => {
    console.log('\n=== UPLOAD REQUEST START ===');
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('File:', req.file);
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
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
            filePath: `/uploads/${req.file.filename}`,
            fileSize: req.file.size,
            originalName: req.file.originalname
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

// ===== API ROUTES =====

// Get all models
app.get('/api/models', async (req, res) => {
    console.log('\n=== GET MODELS REQUEST ===');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('❌ MongoDB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const models = await Model.find().sort({ uploadDate: -1 });
        console.log('✅ Found models:', models.length);
        
        // Add file existence check to each model
        const modelsWithStatus = models.map(model => {
            const filePath = path.join(__dirname, 'uploads', path.basename(model.filePath));
            const fileExists = fs.existsSync(filePath);
            
            return {
                ...model.toObject(),
                fileExists: fileExists,
                fileStatus: fileExists ? 'available' : 'missing'
            };
        });
        
        res.json(modelsWithStatus);
    } catch (error) {
        console.error('❌ Get models error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single model by ID
app.get('/api/models/:id', async (req, res) => {
    console.log('\n=== GET SINGLE MODEL REQUEST ===');
    console.log('Model ID:', req.params.id);
    
    try {
        if (mongoose.connection.readyState !== 1) {
            console.log('❌ MongoDB not connected');
            return res.status(500).json({ error: 'Database not connected' });
        }

        const model = await Model.findById(req.params.id);
        
        if (!model) {
            console.log('❌ Model not found');
            return res.status(404).json({ error: 'Model not found' });
        }

        console.log('✅ Model found:', model.name);
        
        // Check if file exists
        const filePath = path.join(__dirname, 'uploads', path.basename(model.filePath));
        const fileExists = fs.existsSync(filePath);
        
        res.json({
            ...model.toObject(),
            fileExists: fileExists,
            fileStatus: fileExists ? 'available' : 'missing'
        });
        
    } catch (error) {
        console.error('❌ Get model error:', error);
        if (error.name === 'CastError') {
            res.status(400).json({ error: 'Invalid model ID' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime() + ' seconds',
        mongodb: {
            connected: mongoose.connection.readyState === 1,
            state: mongoose.connection.readyState,
            database: mongoose.connection.name
        },
        uploads: {
            directory: fs.existsSync(uploadsDir) ? 'exists' : 'missing',
            fileCount: fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).length : 0
        },
        memory: process.memoryUsage(),
        env: {
            node_version: process.version,
            port: port,
            mongodb_configured: !!process.env.MONGODB_URI
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

// Handle 404
app.use((req, res) => {
    console.log('404 - Not found:', req.method, req.url);
    res.status(404).json({ error: 'Not found', path: req.url });
});

// Start the server
app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/health`);
    console.log(`🔍 Debug files: http://localhost:${port}/debug/files`);
    console.log(`🔍 Debug models: http://localhost:${port}/debug/models`);
});
