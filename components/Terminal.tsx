"use client";

import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

export default function TerminalComponent({ workingDirectory }: { workingDirectory?: string }) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const socketRef = useRef<Socket | null>(null);
    const termRef = useRef<Terminal | null>(null);

    useEffect(() => {
        if (!workingDirectory) return;

        const socket = io({
            query: { cwd: workingDirectory }
        });
        socketRef.current = socket;

        const term = new Terminal({
            theme: {
                background: '#0a0a0a',
                foreground: '#ffffff',
            },
            cursorBlink: true,
            fontFamily: 'monospace',
            fontSize: 14,
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        if (terminalRef.current) {
            term.open(terminalRef.current);
            fitAddon.fit();
            termRef.current = term;
        }

        socket.on('terminal-output', (data: string) => {
            term.write(data);
        });

        term.onData((data) => {
            socket.emit('terminal-input', data);
        });

        const handleResize = () => {
            fitAddon.fit();
            socket.emit('terminal-resize', {
                cols: term.cols,
                rows: term.rows
            });
        };

        window.addEventListener('resize', handleResize);

        return () => {
            socket.disconnect();
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return <div ref={terminalRef} className="w-full h-full" />;
}
