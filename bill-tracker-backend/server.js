// server.js improvements
const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;

// Improved CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com', 'http://localhost:3000'] 
    : 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Add a health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

app.post('/api/download-documents', (req, res) => {
    console.log("Received scraper request:", req.body);
    const { sutraUrl } = req.body;

    if (!sutraUrl) {
        console.error("Missing sutraUrl parameter");
        return res.status(400).json({ success: false, error: 'Sutra URL is required.' });
    }

    // Improved sanitization that allows more URL characters
    const sanitizedUrl = sutraUrl.replace(/[^\w\-\:\/\.\?\=\&\%]/g, '');
    
    if (sanitizedUrl !== sutraUrl) {
        console.warn(`URL was sanitized: ${sutraUrl} -> ${sanitizedUrl}`);
    }

    console.log(`Executing Python scraper with URL: ${sanitizedUrl}`);
    
    // Execute the ENHANCED Python scraper with better error handling
    exec(`python3 sutra_scraper_enhanced.py "${sanitizedUrl}"`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Exec error: ${error}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ success: false, error: 'Failed to download documents.', details: stderr });
        }

        try {
            // The Python script should output JSON
            console.log("Python script completed successfully");
            
            // Check if stdout is empty
            if (!stdout || stdout.trim() === '') {
                console.error('Python script returned empty output');
                return res.status(500).json({ 
                    success: false, 
                    error: 'Scraper returned empty output.'
                });
            }
            
            const result = JSON.parse(stdout);
            console.log(`Parsed result with ${result.eventos?.length || 0} eventos`);
            res.json(result);
        } catch (parseError) {
            console.error(`JSON parse error: ${parseError}`);
            console.error(`Raw Python output: ${stdout}`);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to parse Python script output.', 
                rawOutput: stdout.substring(0, 1000) // Limit output size
            });
        }
    });
});

app.listen(port, () => {
    console.log(`Bill Tracker server listening at http://localhost:${port}`);
});