const express = require('express');
const { exec } = require('child_process');
const util = require('util'); // For promisifying exec
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3001;
const fs = require('fs');
const path = require('path');
const axios = require('axios');

app.use(cors({
  // Adjust origin in production to your actual domain
  // For development, 'http://localhost:3000' is fine
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
  const response = await axios.get(url, { // Use axios.get instead of http/https.get
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
    },
    responseType: 'stream', // Important:  Get response as a stream for piping
    validateStatus: status => status >= 200 && status < 400, // Ensure axios doesn't throw error for 3xx redirects (it will follow them)
    httpsAgent: new require('https').Agent({ rejectUnauthorized: false }), // Keep rejectUnauthorized: false
  });

  console.log(`Received response from upstream with status ${response.status}`);
  console.log(`Content-Type: ${response.headers['content-type']}`);
  console.log(`Content-Length: ${response.headers['content-length'] || 'unknown'}`);

  // Set appropriate response headers from the upstream response
  res.setHeader('Content-Type', response.headers['content-type'] || 'application/pdf');
  if (response.headers['content-length']) {
    res.setHeader('Content-Length', response.headers['content-length']);
  }
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');


  // Pipe the response stream directly to the client
  response.data.pipe(res); // Pipe response.data (which is a stream from axios)

  response.data.on('end', () => {
    console.log('Proxy document streaming completed successfully');
  });
  response.data.on('error', (err) => {
    console.error('Upstream document stream error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Upstream stream error', details: err.message });
    }
  });


} catch (error) {
  console.error('Error proxying document:', error);
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

const sanitizedUrl = sutraUrl.replace(/[^\w\-\:\/\.\?\=\&\%]/g, '');

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
const safeUrl = encodeURIComponent(documentUrl);
const decodedForPython = decodeURIComponent(safeUrl);

console.log(`Processing document on demand: ${safeUrl}`);

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
exec(`python3 ${tempFileName}`, { timeout: 30000 }, (error, stdout, stderr) => {
  // Clean up the temp file
  try {
    fs.unlinkSync(tempFileName);
  } catch (err) {
    console.error(`Error removing temp file: ${err}`);
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

    // Log the raw output for debugging
    console.log("Raw Python output:", stdout);

    // Clean the output - find the first { and last } to extract valid JSON
    let jsonStr = stdout.trim();
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }

    // Try parsing the cleaned JSON
    const result = JSON.parse(jsonStr);
    console.log(`Successfully processed document: ${documentUrl}`);

    // **CHANGE: Send the PDF file instead of the JSON result**
    if (result && result.downloaded && result.filepath) {
      const filePath = result.filepath;

      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        fs.createReadStream(filePath).pipe(res);
      } else {
        console.error(`PDF file not found: ${filePath}`);
        res.status(404).json({ success: false, error: 'PDF file not found.' });
      }
    } else {
      console.error('PDF processing failed or filepath missing.');
      res.status(500).json({ success: false, error: 'PDF processing failed.' });
    }
  } catch (parseError) {
    console.error(`JSON parse error: ${parseError}`);
    console.error(`Raw Python output: ${stdout}`);
      
      // Try to extract the JSON manually as a fallback
      try {
          // The rawOutput seems to contain valid JSON, let's extract it with a regex
          const jsonMatch = stdout.match(/{[\s\S]*}/);
          if (jsonMatch) {
              const extractedJson = JSON.parse(jsonMatch[0]);
              console.log("Successfully extracted JSON from output.");
              return res.json(extractedJson);
          }
      } catch (extractError) {
          console.error("Failed to extract JSON: ", extractError);
      }
      
      return res.status(500).json({ 
          success: false, 
          error: 'Failed to parse document processor output.', 
          rawOutput: stdout.substring(0, 1000)
      });
  }
});
});

//Radicado Endpoint
app.post('/api/bills-by-introduction-date', async (req, res) => {
  let { date } = req.body; // Expected format can be MM/DD/YYYY or YYYY-MM-DD
  
  if (!date) {
    return res.status(400).json({ success: false, error: 'Date is required.' });
  }
  
  try {
    // Convert date to YYYY-MM-DD format if it's in MM/DD/YYYY format
    if (date.includes('/')) {
      const parts = date.split('/');
      date = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    
    console.log(`Searching for bills introduced on ${date}`);
    
    // Execute the Python script with the date parameter
    const { exec } = require('child_process');
    exec(`python3 date_search_scraper.py "${date}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Exec error: ${error}`);
        console.error(`Stderr: ${stderr}`);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to scrape search results.', 
          details: stderr 
        });
      }

      try {
        // Parse the results
        const searchResults = JSON.parse(stdout);
        
        res.json(searchResults);
      } catch (parseError) {
        console.error(`JSON parse error: ${parseError}`);
        console.error(`Raw Python output: ${stdout}`);
        res.status(500).json({ 
          success: false, 
          error: 'Failed to parse search results.', 
          rawOutput: stdout.substring(0, 1000) // Limit output size
        });
      }
    });
  } catch (error) {
    console.error('Error processing search request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process search request.' 
    });
  }
});

// DOC to DOCX Conversion Endpoint
const execPromise = util.promisify(exec); // Promisify exec for async/await

app.get('/api/convert-doc-to-docx', async (req, res) => {
  const docUrl = req.query.docUrl;

  if (!docUrl) {
      return res.status(400).json({ error: 'docUrl parameter is required' });
  }

  console.log(`Converting DOC to DOCX for URL: ${docUrl}`);

  try {
      const response = await axios.get(docUrl, {
          responseType: 'arraybuffer' // Get binary data for DOC file
      });

      if (response.status !== 200) {
          throw new Error(`Failed to download DOC file, status: ${response.status}`);
      }

      const docBuffer = Buffer.from(response.data);
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
      }
      const inputDocPath = path.join(tempDir, `input_${Date.now()}.doc`);
      const outputDocxPath = path.join(tempDir, `output_${Date.now()}.docx`);

      fs.writeFileSync(inputDocPath, docBuffer);

      console.log(`Executing LibreOffice conversion: soffice --headless --convert-to docx ${inputDocPath} --outdir ${tempDir}`);
      await execPromise(`soffice --headless --convert-to docx ${inputDocPath} --outdir ${tempDir}`);
      console.log('DOC to DOCX conversion completed');

      if (!fs.existsSync(outputDocxPath)) {
          throw new Error('Conversion failed, DOCX file not created');
      }

      const docxBuffer = fs.readFileSync(outputDocxPath);

      // Set appropriate headers for DOCX file
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      // Send the DOCX file as a download (or inline, adjust Content-Disposition as needed)
      // res.setHeader('Content-Disposition', 'attachment; filename=converted.docx'); // For download
      res.setHeader('Content-Disposition', 'inline; filename=converted.docx'); // For inline display if possible
      res.setHeader('Cache-Control', 'no-cache');
      res.send(docxBuffer);

      // Clean up temporary files
      fs.unlinkSync(inputDocPath);
      fs.unlinkSync(outputDocxPath);
      console.log('Temporary files cleaned up');

  } catch (error) {
      console.error('Error converting DOC to DOCX:', error);
      return res.status(500).json({
          error: 'Failed to convert DOC to DOCX',
          details: error.message
      });
  } finally {
      // Optional: Cleanup temp directory if needed more aggressively in production
      // Example: fs.readdirSync(tempDir).forEach(file => fs.unlinkSync(path.join(tempDir, file)));
  }
});

app.get('/api/download-converted-docx/:filename', (req, res) => {
  // You might need a separate endpoint to serve the converted DOCX if you save it persistently.
  // For now, the /api/convert-doc-to-docx directly returns the file.
  // If you need to serve it later, implement this endpoint similar to /api/serve-document.
  res.status(404).json({ error: 'Not implemented yet. DOCX is returned directly by /api/convert-doc-to-docx' });
});

app.get('/api/serve-document/:filename', (req, res) => {
const { filename } = req.params;

// Sanitize filename to prevent directory traversal attacks
const sanitizedFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, '');

// Construct the full file path
const filePath = path.join(__dirname, 'scraped_data', sanitizedFilename);

console.log(`Serving document from path: ${filePath}`);

// Check if file exists
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  return res.status(404).json({ error: 'File not found' });
}

// Determine content type based on extension
const ext = path.extname(filePath).toLowerCase();
let contentType = 'application/octet-stream'; // Default

if (ext === '.pdf') {
  contentType = 'application/pdf';
} else if (ext === '.docx') {
  contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
} else if (ext === '.doc') {
  contentType = 'application/msword';
}

// Set headers
res.setHeader('Content-Type', contentType);
res.setHeader('Content-Disposition', `inline; filename="${sanitizedFilename}"`);

// Stream the file
const fileStream = fs.createReadStream(filePath);
fileStream.pipe(res);

// Handle errors
fileStream.on('error', (err) => {
  console.error(`Error streaming file: ${err.message}`);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Error serving file' });
  }
});
});

app.listen(port, () => {
  console.log(`Bill Tracker server listening at http://localhost:${port}`);
});