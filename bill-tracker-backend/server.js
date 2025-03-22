const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;
const fs = require('fs');
const path = require('path');
const axios = require('axios');

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com', 'http://localhost:3000'] 
    : 'http://localhost:3000',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
}));

app.use(express.json());

app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'up', 
      timestamp: new Date().toISOString(),
      message: 'NEW CODE VERSION IS RUNNING!'
    });
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
    
    console.log("*****************************************************");
    console.log("EXECUTING PYTHON WITH COMMAND:", `python3 sutra_scraper_enhanced.py "${sanitizedUrl}" --no-extract`);
    console.log("*****************************************************");

    // Execute the Python scraper with the --no-extract flag to skip text extraction
    exec(`python3 sutra_scraper_enhanced.py "${sanitizedUrl}" --no-extract`, (error, stdout, stderr) => {
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
      return res.status(400).json({ error: 'URL parameter is required' });
    }
    
    console.log(`Proxying document: ${url}`);
    
    try {
    // Use the URL as-is without sanitization
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      httpsAgent: new (require('https').Agent)({ 
        rejectUnauthorized: false
      })
    });

      // Set headers to avoid caching issues
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Set appropriate content type based on file extension
      if (url.toLowerCase().endsWith('.pdf')) {
        res.setHeader('Content-Type', 'application/pdf');
      } else if (url.toLowerCase().endsWith('.docx')) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else if (url.toLowerCase().endsWith('.doc')) {
        res.setHeader('Content-Type', 'application/msword');
      }
      
      // Pass through original headers that might help with format detection
      const contentType = response.headers['content-type'];
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      // Pipe the document stream to the response
      response.data.pipe(res);
      
    } catch (error) {
      console.error('Error proxying document:', error.message);
      res.status(500).json({ 
        error: 'Failed to proxy document', 
        details: error.message,
        url: url
      });
    }
  });

// Fast document loading
app.post('/api/fast-bill-info', (req, res) => {
  console.log("Received fast bill info request:", req.body);
  const { sutraUrl } = req.body;

  if (!sutraUrl) {
      console.error("Missing sutraUrl parameter");
      return res.status(400).json({ success: false, error: 'Sutra URL is required.' });
  }

  if (sanitizedUrl !== sutraUrl) {
      console.warn(`URL was sanitized: ${sutraUrl} -> ${sanitizedUrl}`);
  }

  console.log(`Executing fast Python scraper with URL: ${sanitizedUrl}`);
  
  // Execute our new optimized fast scraper with a timeout
  exec(`python3 fast_scraper.py "${sanitizedUrl}" --fast`, { timeout: 3000 }, (error, stdout, stderr) => {
      if (error) {
          console.error(`Fast scraper exec error: ${error}`);
          console.error(`Stderr: ${stderr}`);
          return res.status(500).json({ 
              success: false, 
              error: 'Fast scraping failed.', 
              details: stderr,
              errorCode: error.code === 'ETIMEDOUT' ? 'TIMEOUT' : error.code
          });
      }

      try {
          // Parse the JSON output from the Python script
          console.log("Fast scraper completed successfully");
          
          // Check if stdout is empty
          if (!stdout || stdout.trim() === '') {
              console.error('Fast scraper returned empty output');
              return res.status(500).json({ 
                  success: false, 
                  error: 'Fast scraper returned empty output.'
              });
          }
          
          const result = JSON.parse(stdout);
          console.log(`Fast scraper parsed result with ${result.eventos?.length || 0} eventos`);
          
          // Add timing info if not already present
          if (!result.scrape_time) {
              result.scrape_time = 'unknown';
          }
          
          // Send the result to the client
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

// On-demand document processing
app.post('/api/process-document', (req, res) => {
  const { documentUrl } = req.body;

  if (!documentUrl) {
      console.error("Missing documentUrl parameter");
      return res.status(400).json({ success: false, error: 'Document URL is required.' });
  }

  // Sanitize the URL
  // Allow spaces, parentheses, and brackets in URLs by using encodeURIComponent instead of sanitization
  const safeUrl = encodeURIComponent(documentUrl);
  // When passing to Python, we need to decode it again so Python can use it
  const decodedForPython = decodeURIComponent(safeUrl);
  
  console.log(`Processing document on demand: ${sanitizedUrl}`);
  
  // Create a temporary Python script to process just this document
  const tempFileName = path.join(__dirname, 'temp', `process_doc_${Date.now()}.py`);
  const tempDir = path.join(__dirname, 'temp');
  
  if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
  }
  
  // Write Python code to process just this document
  const pythonCode = `
import sys
sys.path.append('.')
from fast_scraper import on_demand_document_processor
import json
import urllib3
import urllib.parse

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# URL needs to be raw - we'll decode it in Python
url = """${documentUrl}"""

# Process just this document
result = on_demand_document_processor(url, "scraped_data")

# Print the result as JSON
print(json.dumps(result))
`;

  fs.writeFileSync(tempFileName, pythonCode);
  
  // Execute the Python code with a reasonable timeout
  exec(`python3 ${tempFileName}`, { timeout: 15000 }, (error, stdout, stderr) => {
      // Clean up the temp file
      try {
          fs.unlinkSync(tempFileName);
      } catch (err) {
          console.error(`Error removing temp file: ${err}`);
      }
      
      if (error) {
          console.error(`Document processing error: ${error}`);
          console.error(`Stderr: ${stderr}`);
          return res.status(500).json({ 
              success: false, 
              error: 'Failed to process document.', 
              details: stderr 
          });
      }

      try {
          // Parse the result
          if (!stdout || stdout.trim() === '') {
              console.error('Document processor returned empty output');
              return res.status(500).json({ 
                  success: false, 
                  error: 'Document processor returned empty output.'
              });
          }
          
          const result = JSON.parse(stdout);
          console.log(`Successfully processed document: ${sanitizedUrl}`);
          res.json(result);
      } catch (parseError) {
          console.error(`JSON parse error: ${parseError}`);
          console.error(`Raw Python output: ${stdout}`);
          res.status(500).json({ 
              success: false, 
              error: 'Failed to parse document processor output.', 
              rawOutput: stdout.substring(0, 1000)
          });
      }
  });
});

app.listen(port, () => {
    console.log(`Bill Tracker server listening at http://localhost:${port}`);
});