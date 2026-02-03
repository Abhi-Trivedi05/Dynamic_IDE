const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require("socket.io");
const os = require('os');
const pty = require('node-pty');
const fs = require('fs-extra');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        const parsedUrl = parse(req.url, true);
        const { pathname, query } = parsedUrl;

        // Custom API Routes can be here or in Next.js App Router
        // We'll use Next.js App Router for most things, but Terminal MUST be here.

        handle(req, res, parsedUrl);
    });

    const io = new Server(server);

    io.on('connection', (socket) => {
        const { cwd } = socket.handshake.query;
        console.log('Terminal Client connected, requested cwd:', cwd);

        const shell = os.platform() === 'win32' ? 'cmd.exe' : 'bash';

        // Security check: ensure cwd is within the user's ide-repos folder
        // For simplicity in this demo, we'll check if the path contains 'ide-repos'
        // and is an absolute path. In production, this would be much stricter.
        const safeCwd = (cwd && cwd.includes('ide-repos')) ? cwd : os.homedir();

        const ptyProcess = pty.spawn(shell, [], {
            name: 'xterm-color',
            cols: 80,
            rows: 24,
            cwd: safeCwd,
            env: process.env
        });

        socket.on('terminal-input', (data) => {
            ptyProcess.write(data);
        });

        socket.on('terminal-resize', (size) => {
            ptyProcess.resize(size.cols, size.rows);
        });

        ptyProcess.on('data', (data) => {
            socket.emit('terminal-output', data);
        });

        socket.on('disconnect', () => {
            ptyProcess.kill();
        });
    });

    server.listen(3000, (err) => {
        if (err) throw err;
        console.log('> Ready on http://localhost:3000');
    });
});
