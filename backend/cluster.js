const cluster = require('cluster');
const os = require('os');

if (cluster.isMaster || cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(`=========================================================================`);
  console.log(`🚀 MASTER CLUSTER PROCESS RUNNING (PID: ${process.pid})`);
  console.log(`⚡ Spawning ${numCPUs} load-balanced worker processes across CPU cores...`);
  console.log(`=========================================================================\n`);

  // Fork workers for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    const worker = cluster.fork();
    console.log(`  └─ Spawning Worker #${i + 1} (PID: ${worker.processpid || worker.process.pid})`);
  }

  // Automatic Crash Recovery: If a worker process exits, restart a new one immediately
  cluster.on('exit', (worker, code, signal) => {
    console.warn(`⚠️ Worker PID ${worker.process.pid} exited (Code: ${code}, Signal: ${signal}). Spawning replacement worker...`);
    const newWorker = cluster.fork();
    console.log(`  └─ Replacement Worker spawned (PID: ${newWorker.process.pid})`);
  });

} else {
  // Worker processes execute server.js and handle incoming HTTP/WebSocket connections
  require('./server.js');
}
