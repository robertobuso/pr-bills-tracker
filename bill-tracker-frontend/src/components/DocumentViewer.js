import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { renderAsync } from 'docx-preview';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  IconButton,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  InputLabel
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// Set worker source for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const DocumentViewer = ({ document }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef(null);
    const [documentData, setDocumentData] = useState(null);
    const [retryCount, setRetryCount] = useState(0);

    // Determine document type from URL
    const getDocumentType = (url) => {
    if (!url) return 'unknown';
    const extension = url.split('.').pop().toLowerCase();

    if (extension === 'pdf') return 'pdf';
    if (extension === 'docx') return 'docx';
    if (extension === 'doc') return 'doc';
    if (['ppt', 'pptx'].includes(extension)) return 'powerpoint';
    if (['xls', 'xlsx'].includes(extension)) return 'excel';

    return 'unknown';
    };

    const getProxyUrl = (url) => {
        return process.env.NODE_ENV === 'production'
          ? `/api/proxy-document?url=${encodeURIComponent(url)}`
          : `http://localhost:3001/api/proxy-document?url=${encodeURIComponent(url)}`;
      };

    const documentType = getDocumentType(document.link_url);

    // Handle PDF document loading
    const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
    };

    // Handle PDF document loading errors
    const onDocumentLoadError = (error) => {
        console.error('Error loading PDF:', error);
        setError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
        setLoading(false);
    };

    // Handle document navigation
    const goToPrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
    const goToNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

    // Handle zoom
    const zoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
    const zoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

    // Handle fullscreen
    const toggleFullscreen = () => {
    if (!isFullscreen) {
        if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
        document.exitFullscreen();
        }
    }
    setIsFullscreen(!isFullscreen);
    };

    useEffect(() => {
        if (!document.link_url) {
          setError('No document URL provided');
          setLoading(false);
          return;
        }
      
        // Reset state when document changes
        setLoading(true);
        setError(null);
        setNumPages(null);
        setPageNumber(1);
        setDocumentData(null);
      
        // For DOCX files, pre-load them using the proxy
        if (documentType === 'docx' || documentType === 'doc') {
          const loadDocx = async () => {
            try {
              setLoading(true);
              
              // Create proxy URL for the document
              const proxyUrl = getProxyUrl(document.link_url);
              
              console.log(`Loading document: ${document.link_url} via proxy: ${proxyUrl}`);
              
              // Add timeout to prevent hanging
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
              
              const response = await fetch(proxyUrl, { 
                signal: controller.signal,
                headers: {
                  'Cache-Control': 'no-cache',
                  'Pragma': 'no-cache'
                }
              });
              
              clearTimeout(timeoutId); // Clear the timeout
              
              if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
              }
              
              const blob = await response.blob();
              
              if (containerRef.current) {
                try {
                  await renderAsync(blob, containerRef.current, null, {
                    className: 'docx-viewer'
                  });
                  setLoading(false);
                } catch (renderError) {
                  console.error('Error rendering DOCX:', renderError);
                  throw new Error(`Failed to render document: ${renderError.message}`);
                }
              }
            } catch (err) {
              // Handle AbortController timeout
              if (err.name === 'AbortError') {
                console.error('Request timed out loading DOCX');
                setError('Request timed out. The document may be too large or the server is not responding.');
              } else {
                console.error('Error loading DOCX:', err);
                setError(`Failed to load document: ${err.message}`);
              }
              setLoading(false);
            }
          };
          
          loadDocx();
        } else if (documentType === 'pdf') {
          // For PDFs, use the proxy URL with react-pdf
          const proxyUrl = getProxyUrl(document.link_url);
          console.log(`Loading PDF: ${document.link_url} via proxy: ${proxyUrl}`);
          setDocumentData(proxyUrl); // Store the proxy URL to use in the Document component
        } else {
          // Unsupported document types
          setError(`Document type ${documentType} is not supported for preview. Please download to view.`);
          setLoading(false);
        }
      }, [document.link_url, documentType, retryCount]);
      
      
    // Prepare the document display based on type
    const renderDocument = () => {
        // First check if document URL is valid
        if (!document.link_url || typeof document.link_url !== 'string') {
            return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" color="error" gutterBottom>
                Invalid Document URL
                </Typography>
                <Typography paragraph>
                The document URL is missing or invalid.
                </Typography>
            </Box>
            );
        }
        
        if (loading) {
            return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
            );
        }

        if (error) {
            return (
            <Box sx={{ p: 2, bgcolor: 'error.light', borderRadius: 1, textAlign: 'center' }}>
                <Typography color="error" paragraph>{error}</Typography>
                <Button 
                href={document.link_url} 
                target="_blank" 
                variant="contained" 
                sx={{ mt: 2, mr: 2 }}
                startIcon={<DownloadIcon />}
                >
                Download Document
                </Button>
                <Button 
                variant="outlined" 
                sx={{ mt: 2 }}
                onClick={() => setRetryCount(prev => prev + 1)}
                >
                Retry Loading
                </Button>
            </Box>
            );
        }

        switch (documentType) {
            case 'pdf':
                return (
                <Box sx={{ overflow: 'auto' }}>
                    <Document
                    file={documentData}                  
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                        <CircularProgress />
                        </Box>
                    }
                    options={{
                        cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.4.120/cmaps/',
                        cMapPacked: true,
                        withCredentials: false,
                        disableStream: true,
                        disableAutoFetch: true,
                    }}
                    >
                    {!error && (
                        <Page 
                        pageNumber={pageNumber} 
                        scale={zoom}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        error={
                            <Typography color="error" align="center">
                            Failed to load page.
                            </Typography>
                        }
                        />
                    )}
                    </Document>
                </Box>
                );
        
            case 'docx':
            return (
                <Box>
                {loading && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                        Loading document...
                    </Typography>
                    <Button 
                        href={document.link_url} 
                        target="_blank" 
                        variant="outlined" 
                        sx={{ mt: 2 }}
                        startIcon={<DownloadIcon />}
                    >
                        Download Original
                    </Button>
                    </Box>
                )}
                
                {error && (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="body1" color="error" gutterBottom>
                        {error}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        Document preview is unavailable. Please download the document directly.
                    </Typography>
                    <Button 
                        href={document.link_url} 
                        target="_blank" 
                        variant="contained" 
                        color="primary"
                        startIcon={<DownloadIcon />}
                    >
                        Download Document
                    </Button>
                    </Box>
                )}
                
                {!loading && !error && (
                    <Box ref={containerRef} sx={{ width: '100%', minHeight: '500px' }} />
                )}
                </Box>
            );
        }
        };

        return (
        <Paper 
            elevation={3} 
            sx={{ 
            p: 2, 
            mb: 3, 
            borderRadius: 2,
            overflow: 'hidden'
            }}
            ref={containerRef}
        >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
                {document.description || 'Document'}
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1 }}>
                {documentType === 'pdf' && numPages > 0 && (
                <>
                    <Tooltip title="Zoom Out">
                    <IconButton onClick={zoomOut} size="small">
                        <ZoomOutIcon />
                    </IconButton>
                    </Tooltip>
                    
                    <Typography sx={{ display: 'flex', alignItems: 'center', mx: 1 }}>
                    {Math.round(zoom * 100)}%
                    </Typography>
                    
                    <Tooltip title="Zoom In">
                    <IconButton onClick={zoomIn} size="small">
                        <ZoomInIcon />
                    </IconButton>
                    </Tooltip>
                </>
                )}
                
                <Tooltip title="Fullscreen">
                <IconButton onClick={toggleFullscreen} size="small">
                    <FullscreenIcon />
                </IconButton>
                </Tooltip>
                
                <Tooltip title="Download Original">
                <IconButton 
                    component="a" 
                    href={document.link_url} 
                    target="_blank" 
                    size="small"
                >
                    <DownloadIcon />
                </IconButton>
                </Tooltip>
            </Box>
            </Box>
            
            {renderDocument()}
            
            {documentType === 'pdf' && numPages > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
                <Tooltip title="Previous Page">
                <IconButton onClick={goToPrevPage} disabled={pageNumber <= 1}>
                    <ChevronLeftIcon />
                </IconButton>
                </Tooltip>
                
                <Box sx={{ mx: 2, display: 'flex', alignItems: 'center' }}>
                <Typography>
                    Page {pageNumber} of {numPages}
                </Typography>
                
                <FormControl variant="outlined" size="small" sx={{ ml: 2, minWidth: 120 }}>
                    <InputLabel id="page-select-label">Go to</InputLabel>
                    <Select
                    labelId="page-select-label"
                    value={pageNumber}
                    onChange={(e) => setPageNumber(Number(e.target.value))}
                    label="Go to"
                    >
                    {[...Array(numPages).keys()].map(i => (
                        <MenuItem key={i + 1} value={i + 1}>
                        Page {i + 1}
                        </MenuItem>
                    ))}
                    </Select>
                </FormControl>
                </Box>
                
                <Tooltip title="Next Page">
                <IconButton onClick={goToNextPage} disabled={pageNumber >= numPages}>
                    <ChevronRightIcon />
                </IconButton>
                </Tooltip>
            </Box>
            )}
        </Paper>
        );
    };

export default DocumentViewer;