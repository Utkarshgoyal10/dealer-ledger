import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { bootstrap } from './services/bootstrap.js';

await connectDB();
await bootstrap();
createApp().listen(env.PORT, () => console.log(`API running on http://localhost:${env.PORT}`));
