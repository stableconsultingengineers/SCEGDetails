const express = require('express');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bim-details', {
    useNewUrlParser: true,
    useUnifiedTopology: true
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

// Routes
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        path: `/uploads/${req.file.filename}`
    });
});

app.post('/api/upload', upload.single('model'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const model = new Model({
            name: req.body.name,
            category: req.body.category,
            description: req.body.description,
            materials: req.body.materials.split(',').map(m => m.trim()),
            specifications: req.body.specifications.split(',').map(s => s.trim()),
            filePath: `/uploads/${req.file.filename}`
        });

        await model.save();
        res.json({ success: true, model });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/models', async (req, res) => {
    try {
        const models = await Model.find();
        res.json(models);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
}); 