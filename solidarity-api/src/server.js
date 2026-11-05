import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { createApp } from './app.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5003;

// Connect to MongoDB
connectDB();

const app = createApp();

console.log('🌐 CORS allowed origins:', process.env.FRONTEND_URL || '(none from env)');
console.log('🔧 Environment:', process.env.NODE_ENV);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
