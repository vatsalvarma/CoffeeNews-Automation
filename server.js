const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');

const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

require('dotenv').config();

const openRouterApiKey = process.env.OPENROUTER_API_KEY;

let client;
let isAuthenticated = false;
let currentCronJob = null;
let currentQrDataUrl = null;

const initializeWhatsApp = () => {
    client = new Client({
        authStrategy: new LocalAuth(),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        }
    });

    const qrcode = require('qrcode');
    
    client.on('qr', async (qr) => {
        console.log('QR RECEIVED');
        try {
            currentQrDataUrl = await qrcode.toDataURL(qr);
            io.emit('qr', currentQrDataUrl);
        } catch (err) {
            console.error('Error generating QR data URL', err);
        }
    });

    client.on('ready', () => {
        console.log('Client is ready!');
        isAuthenticated = true;
        io.emit('ready');
    });

    client.on('authenticated', () => {
        console.log('AUTHENTICATED');
        isAuthenticated = true;
        io.emit('authenticated');
    });

    client.on('auth_failure', msg => {
        console.error('AUTHENTICATION FAILURE', msg);
        io.emit('error', 'Authentication failed');
    });

    client.on('disconnected', (reason) => {
        console.log('Client was logged out', reason);
        isAuthenticated = false;
        io.emit('disconnected');
    });

    client.initialize();
};

const performResearchAndSend = async () => {
    try {
        io.emit('research_started');
        console.log('Starting research...');

        const prompt = `Research current global coffee prices for today. Also, provide a few interesting magazine links or recent news articles about coffee. Format the response with emojis so it looks great as a WhatsApp message.`;

        const apiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "google/gemini-2.5-pro",
                "messages": [
                    {"role": "user", "content": prompt}
                ],
                "max_tokens": 2000
            })
        });

        const data = await apiResponse.json();
        if (data.error) {
            throw new Error(data.error.message || JSON.stringify(data.error));
        }
        
        const report = data.choices && data.choices.length > 0 
            ? data.choices[0].message.content 
            : "No report generated.";
        console.log('Research complete. Sending message...');
        io.emit('research_completed', report);

        if (isAuthenticated && client && client.info) {
            const targetPhone = client.info.wid._serialized;
            await client.sendMessage(targetPhone, report);
            console.log(`Message sent successfully to ${targetPhone}!`);
            io.emit('message_sent');
        } else {
            console.log('WhatsApp client not authenticated or client info missing. Cannot send.');
            io.emit('error', 'WhatsApp not authenticated properly.');
        }

    } catch (error) {
        console.error('Error during research or sending:', error);
        io.emit('error', 'Failed to perform research: ' + error.message);
    }
};

app.post('/api/start', (req, res) => {
    const { time } = req.body; // expected format: "HH:mm" (24-hour)
    
    if (!time) {
        return res.status(400).json({ error: 'Time is required (HH:mm format)' });
    }

    const [hours, minutes] = time.split(':');

    if (currentCronJob) {
        currentCronJob.stop();
    }

    // Cron expression: "minute hour * * *"
    const cronExpression = `${minutes} ${hours} * * *`;
    
    currentCronJob = cron.schedule(cronExpression, () => {
        console.log(`Cron job triggered at ${time}`);
        performResearchAndSend();
    });

    console.log(`Scheduled daily automation at ${time}`);
    
    res.json({ success: true, message: `Scheduled daily at ${time}.` });
});

app.post('/api/init-whatsapp', (req, res) => {
    if (!client) {
        initializeWhatsApp();
    } else if (isAuthenticated) {
        io.emit('ready');
    } else if (currentQrDataUrl) {
        io.emit('qr', currentQrDataUrl);
    }
    res.json({ success: true });
});

app.post('/api/send-message', async (req, res) => {
    const { message } = req.body;
    if (isAuthenticated && client && client.info) {
        try {
            const targetPhone = client.info.wid._serialized;
            await client.sendMessage(targetPhone, message || 'Test message');
            res.json({ success: true, message: 'Message sent!' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(400).json({ error: 'WhatsApp not authenticated' });
    }
});

io.on('connection', (socket) => {
    console.log('Frontend connected');
    if (isAuthenticated) {
        socket.emit('ready');
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
