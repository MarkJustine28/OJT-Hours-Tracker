const path = require('path');
const dotenv = require('dotenv');

const { createOJTApp } = require('./functions/firestore-app');

dotenv.config();

const { app, ready } = createOJTApp({ staticDir: path.join(__dirname) });
const INITIAL_PORT = Number(process.env.PORT || 3000);
const MAX_PORT_ATTEMPTS = 20;

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort =
      typeof address === 'object' && address
        ? address.port
        : port;

    console.log(`Server is running at http://localhost:${actualPort}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Trying ${nextPort}...`);
      return startServer(nextPort, attempt + 1);
    }

    console.error('Server failed to start:', error.message);
    process.exit(1);
  });

  return server;
}

ready
  .then(() => startServer(INITIAL_PORT))
  .catch((error) => {
    console.error('Firestore initialization failed:');
    console.error(error && error.stack ? error.stack : error);
    startServer(INITIAL_PORT);
  });
