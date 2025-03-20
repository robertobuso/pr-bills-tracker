// server.js update
const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/download-documents', (req, res) => {
    const { sutraUrl } = req.body;

    if (!sutraUrl) {
        return res.status(400).json({ success: false, error: 'Sutra URL is required.' });
    }

    // Sanitize the URL to prevent command injection
    const sanitizedUrl = sutraUrl.replace(/[^a-zA-Z0-9/:.-]/g, '');

    // Execute the ENHANCED Python scraper
    exec(`python sutra_scraper_enhanced.py "${sanitizedUrl}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            return res.status(500).json({ success: false, error: 'Failed to download documents.' });
        }

        try {
            // The Python script should output JSON
            console.log("Python output:", stdout);
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error(`JSON parse error: ${parseError}`);
            console.error(`Raw Python output: ${stdout}`);
            res.status(500).json({ success: false, error: 'Failed to parse Python script output.' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});