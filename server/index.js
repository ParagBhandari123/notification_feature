const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Project = require('./models/project');
const Notification = require('./models/notification');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.mongodb, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDB is connected');
}).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
});

// Socket logic
io.on('connection', async (socket) => {
  console.log('Client connected');

  // Send unread notifications on login
  const unreadNotifications = await Notification.find({ userType: 'vendor', isRead: false });
  socket.emit('unread-notifications', unreadNotifications.length);

  // Mark as read on client request
  socket.on('mark-read', async () => {
    await Notification.updateMany({ userType: 'vendor', isRead: false }, { isRead: true });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// GET projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await Project.find();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST project
app.post('/api/projects', async (req, res) => {
  const { title, description } = req.body;

  try {
    const newProject = new Project({ title, description });
    await newProject.save();

    const notification = new Notification({
      message: `New project added: ${title}`,
      userType: 'vendor'
    });
    await notification.save();

    io.emit('new-project', newProject); // real-time
    res.status(201).json(newProject);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create project' });
  }
});

const PORT = 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
