// server.js improvements
const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;
const fs = require('fs');
const path = require('path');

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

app.post('/api/extract-document-text', (req, res) => {
    const { documentUrl } = req.body;

    if (!documentUrl) {
        console.error("Missing documentUrl parameter");
        return res.status(400).json({ success: false, error: 'Document URL is required.' });
    }

    // Sanitize the URL
    const sanitizedUrl = documentUrl.replace(/[^\w\-\:\/\.\?\=\&\%]/g, '');
    
    console.log(`Extracting text from document on demand: ${sanitizedUrl}`);
    
    // Create a temporary Python script file
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    
    const tempFileName = path.join(tempDir, `extract_${Date.now()}.py`);
    
    // Write the Python code to the file
    const pythonCode = `
import sys
sys.path.append('.')
from sutra_scraper_enhanced import download_and_process_doc
import json

# Process the document WITH text extraction
result = download_and_process_doc(
    {"link_url": "${sanitizedUrl}"}, 
    "scraped_data",
    extract_text=True
)

# Print the result as JSON for the Node.js server to parse
print(json.dumps(result))
`;

    fs.writeFileSync(tempFileName, pythonCode);
    
    // Execute the Python file
    exec(`python3 ${tempFileName}`, (error, stdout, stderr) => {
        // Clean up temp file
        try {
            fs.unlinkSync(tempFileName);
        } catch (err) {
            console.error(`Error removing temp file: ${err}`);
        }
        
        if (error) {
            console.error(`Exec error: ${error}`);
            console.error(`Stderr: ${stderr}`);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to extract document text.', 
                details: stderr 
            });
        }

        try {
            if (!stdout || stdout.trim() === '') {
                console.error('Python script returned empty output');
                return res.status(500).json({ 
                    success: false, 
                    error: 'Document processor returned empty output.'
                });
            }
            
            const result = JSON.parse(stdout);
            console.log(`Successfully extracted text from: ${sanitizedUrl}`);
            res.json(result);
        } catch (parseError) {
            console.error(`JSON parse error: ${parseError}`);
            console.error(`Raw Python output: ${stdout}`);
            res.status(500).json({ 
                success: false, 
                error: 'Failed to parse text extraction output.', 
                rawOutput: stdout.substring(0, 1000)
            });
        }
    });
});

app.get('/api/proxy-document', async (req, res) => {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).send('URL parameter is required');
    }
    
    try {
      const response = await axios({
        method: 'GET',
        url: url,
        responseType: 'stream'
      });
      
      // Set appropriate content type header
      if (url.endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (url.endsWith('.docx')) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else if (url.endsWith('.doc')) {
        res.setHeader('Content-Type', 'application/msword');
      }
      
      // Pipe the document stream to the response
      response.data.pipe(res);
    } catch (error) {
      console.error('Error proxying document:', error);
      res.status(500).send('Error fetching document');
    }
  });

app.listen(port, () => {
    console.log(`Bill Tracker server listening at http://localhost:${port}`);
});