const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./docs/swagger.yaml');
const authRoutes = require('./routes/authRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const { errorHandler } = require('./middleware/errorMiddleware');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/teachers', teacherRoutes);
app.use('/api/v1/student', studentRoutes);

// Error Handling Middleware
app.use(errorHandler);

// Basic route
app.get('/', (req, res) => {
  res.send('Welcome to the Teacher-Student Management Backend!');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
