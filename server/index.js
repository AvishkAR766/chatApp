require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://127.0.0.1:5500",
        methods: ["GET", "POST"]
    }
});

// Cloudinary configuration
cloudinary.config({
    cloud_name: 'dgi6i6qpz',
    api_key: '888545921376281',
    api_secret: 'Ii606eRsEq88gyI-ifspG4JMOD0'
});

// Test Cloudinary connection
cloudinary.api.ping()
    .then(result => {
        console.log('Cloudinary connection successful:', result);
    })
    .catch(error => {
        console.error('Cloudinary connection failed:', error);
    });

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
}).single('image');

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Store users and their status
const users = new Map();
const typingUsers = new Set();

// File upload endpoint
app.post('/upload', (req, res) => {
    upload(req, res, async function (err) {
        if (err instanceof multer.MulterError) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: err.message });
        } else if (err) {
            console.error('Unknown error:', err);
            return res.status(500).json({ error: err.message });
        }

        try {
            if (!req.file) {
                return res.status(400).json({ error: 'No file uploaded' });
            }

            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'chat_uploads',
                resource_type: 'auto'
            });

            fs.unlink(req.file.path, (unlinkErr) => {
                if (unlinkErr) console.error('Error deleting local file:', unlinkErr);
            });

            res.json({
                url: result.secure_url,
                success: true
            });
        } catch (error) {
            console.error('Cloudinary upload error:', error);
            res.status(500).json({ error: 'Upload to cloud failed' });
        }
    });
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('new-user-joined', (name) => {
        if (!name || name.trim() === '') return;
        
        const userName = name.trim();
        users.set(socket.id, userName);
        socket.broadcast.emit('user-joined', userName);
    });

    socket.on('send', (data) => {
        const userName = users.get(socket.id);
        if (!userName) return;

        socket.broadcast.emit('receive', {
            name: userName,
            ...data
        });
    });

    socket.on('typing', () => {
        const userName = users.get(socket.id);
        if (!userName) return;
        socket.broadcast.emit('typing', userName);
    });

    socket.on('stop-typing', () => {
        socket.broadcast.emit('stop-typing');
    });

    socket.on('disconnect', () => {
        const userName = users.get(socket.id);
        if (userName) {
            socket.broadcast.emit('left', userName);
            users.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});