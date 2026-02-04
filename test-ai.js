const https = require('https');

const apiKey = process.env.XAI_API_KEY;

const data = JSON.stringify({
    model: 'grok-beta',
    messages: [
        { role: 'user', content: 'Hello, are you working?' }
    ]
});

const options = {
    hostname: 'api.x.ai',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': data.length
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => {
        body += d;
    });
    res.on('end', () => {
        console.log('Status Code:', res.statusCode);
        console.log('Response Body:', body);
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(data);
req.end();
