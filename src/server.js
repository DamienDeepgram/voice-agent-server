import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url'; // Import utilities for handling module URLs
import { CONFIG } from './config.js';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Success v1.0.0');
});

// Twilio webhook endpoint for incoming calls
app.post('/voice', (req, res) => {
    console.log("twilio: /voice request received");
    
    let filePath = path.join(__dirname, "templates", "streams.xml");
    let stat = fs.statSync(filePath);

    res.writeHead(200, {
        "Content-Type": "text/xml",
        "Content-Length": stat.size,
    });

    let readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
});

// WebSocket handler for audio streaming
const wsServer = new WebSocketServer({ noServer: true });

// Function to send Twilio media message
async function sendTwilioMediaMessage(twilioWs, streamSid, rawMulaw) {
    // Construct the Twilio media message
    const mediaMessage = {
        event: "media",
        streamSid: streamSid,
        media: {
            payload: Buffer.from(rawMulaw).toString("base64"), // Encode raw mulaw to Base64
        },
    };

    // Send the TTS audio to the attached phone call
    try {
        await twilioWs.send(JSON.stringify(mediaMessage));
    } catch (err) {
        console.error("Failed to send media message:", err);
    }
}

wsServer.on('connection', async (twilioWs) => {
    console.log("twilio: connection received");
    let streamSid = null;
    let hasSeenMedia = false;
    let playbackPaused = false;

    const deepgramWs = new WebSocket("wss://agent.deepgram.com/agent", {
        headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`
        }
    });

    // Replace the simple message handler with Twilio-specific handling
    twilioWs.on('message', (data, isBinary) => {
        // console.log("twilio: message received");
        try {
            if (!isBinary) {
                const message = data.toString('utf8');
                // Handle UTF8 messages
                const parsedData = JSON.parse(message);

                switch (parsedData.event) {
                    case 'connected':
                        console.log("twilio: Connected event received: ", parsedData);
                        break;
                    case 'start':
                        streamSid = parsedData.start.streamSid;
                        console.log("twilio: Start event received: ", parsedData, streamSid);
                        break;
                    case 'media':
                        if (!hasSeenMedia) {
                            console.log("twilio: Media event received: ", parsedData);
                            console.log("twilio: Suppressing additional messages...");
                            hasSeenMedia = true;
                        }
                        if (!streamSid) {
                            console.log('twilio: streamSid=', streamSid);
                            streamSid = parsedData.streamSid;
                        }
                        if (parsedData.media.track === "inbound") {
                            const rawAudio = Buffer.from(parsedData.media.payload, 'base64');
                            if (deepgramWs.readyState === WebSocket.OPEN) {
                                deepgramWs.send(rawAudio);
                            }
                        }
                        break;
                    case 'mark':
                        console.log("twilio: Mark event received", parsedData);
                        break;
                    case 'close':
                        console.log("twilio: Close event received: ", parsedData);
                        twilioWs.close();
                        break;
                }
            } else {
                // Handle binary messages
                console.log("twilio: binary message received (not supported)");
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    deepgramWs.on("open", function open() {
        console.log("deepgram: sending config");
        deepgramWs.send(JSON.stringify(CONFIG));
    });

    // Forward responses from Deepgram back to Twilio
    deepgramWs.on('message', async (data, isBinary) => {
        if(!isBinary) {
            const message = JSON.parse(data.toString('utf8'));
            // console.log("deepgram: json message received", message);
            if(message.type === "UserStartedSpeaking"){
                console.log("deepgram: UserStartedSpeaking event received");
                playbackPaused = true;
                // Handles Barge In
                const mediaMessage = JSON.stringify({
                    "event": "clear",
                    "streamSid": streamSid,
                });
                try {
                    if (twilioWs.readyState === WebSocket.OPEN) {
                        console.log("XXX twilio: UserStartedSpeaking send clear");
                        await twilioWs.send(JSON.stringify(mediaMessage));
                    }
                } catch (err) {
                    console.error("Failed to send media message:", err);
                }
            } else if (message.type === "AgentStartedSpeaking") {
                playbackPaused = false;
            }
        } else {
            if (twilioWs.readyState === WebSocket.OPEN) {
                if(!playbackPaused) {
                    sendTwilioMediaMessage(twilioWs, streamSid, data);
                } else {
                    console.log("XXX twilio: playback paused");
                }
            }
        }
    });

    // Handle connection cleanup
    twilioWs.on('close', () => {
        deepgramWs.close();
    });

    deepgramWs.on('close', () => {
        twilioWs.close();
    });
});

// Start the server
const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

// Handle websocket upgrade requests
server.on('upgrade', (request, socket, head) => {
    if (request.url === '/streams') {
        console.log(`Upgrade request to /streams received`);
        wsServer.handleUpgrade(request, socket, head, (ws) => {
            wsServer.emit('connection', ws, request);
        });
    } else {
        console.log(`Rejected upgrade request for path: ${request.url}`);
        socket.destroy();
    }
});