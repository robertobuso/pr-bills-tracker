import React, { useState, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import mammoth from 'mammoth';
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
  InputLabel,
  Alert
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RefreshIcon from '@mui/icons-material/Refresh';

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
    const [useDirectUrl, setUseDirectUrl] = useState(false);
    const [useIframeInstead, setUseIframeInstead] = useState(true); // Set to true by default
    const [htmlContent, setHtmlContent] = useState('');
    const [googleViewerFailed, setGoogleViewerFailed] = useState(false);

    console.log("[DocumentViewer] Initializing with document:", document);
    
    // Validate document prop - must be done after hook declarations
    const isValidDocument = document && typeof document === 'object' && document.link_url;
    
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
        if (!url) return '';
        const encodedUrl = encodeURIComponent(url);
        
        return process.env.NODE_ENV === 'production'
          ? `/api/proxy-document?url=${encodedUrl}`
          : `http://localhost:3001/api/proxy-document?url=${encodedUrl}`;
    };

    const documentType = isValidDocument ? getDocumentType(document.link_url) : 'unknown';

    // Handle PDF document loading
    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setLoading(false);
        setError(null);
    };

    // Handle PDF document loading errors
    const onDocumentLoadError = (error) => {
        console.error('Error loading PDF:', error);
        setError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
        setLoading(false);
        
        // If proxy fails, try the direct URL as a fallback
        if (!useDirectUrl) {
            console.log('Trying direct URL as fallback...');
            setUseDirectUrl(true);
        }
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

    const getDirectFileUrl = () => {
        if (document && document.filepath) {
            // Extract the filename from filepath
            const filename = document.filepath.split('/').pop();
            return process.env.NODE_ENV === 'production'
                ? `/api/serve-document/${filename}`
                : `http://localhost:3001/api/serve-document/${filename}`;
        }
        return null;
    };

    const handleRetry = () => {
        // Reset states
        setLoading(true);
        setError(null);
        setDocumentData(null);
        setUseDirectUrl(false);
        setUseIframeInstead(true); // Always use iframe for reliability
        setRetryCount(prev => prev + 1);
    };

    // Function to manually fetch document data with fetch API for better error handling
    const fetchDocumentWithFetch = async (url) => {
        try {
            setLoading(true);
            console.log(`Fetching document with fetch from URL: ${url}`);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                credentials: 'omit'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            console.log(`Response received with content type: ${contentType}`);
            
            // Use arrayBuffer instead of blob for more reliable binary data handling
            const arrayBuffer = await response.arrayBuffer();
            
            // Check if we received data
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('Received empty response');
            }
            
            console.log(`Fetched document successfully, size: ${arrayBuffer.byteLength} bytes`);
            
            // Convert arrayBuffer to blob with proper content type
            const blob = new Blob([arrayBuffer], { type: contentType || 'application/pdf' });
            return blob;
        } catch (error) {
            console.error(`Fetch error:`, error);
            throw error;
        }
    }; 

    // Helper function to render PDF in an iframe
    const renderPdfWithIframe = () => {
        const directFileUrl = getDirectFileUrl();
        // Use proxy URL if no direct file URL available
        const iframeUrl = directFileUrl || getProxyUrl(document.link_url);

        console.log("[renderPdfWithIframe] Function called. Iframe URL:", iframeUrl);

        return (
            <Box sx={{ width: '100%', height: '600px', position: 'relative' }}>
                <iframe
                    src={iframeUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        overflow: 'hidden'
                    }}
                    title="PDF Document"
                    onLoad={() => console.log('[renderPdfWithIframe] Iframe loaded successfully')}
                    onError={(e) => console.error('[renderPdfWithIframe] Iframe loading error:', e)}
                />
            </Box>
        );
    };
    
    useEffect(() => {
        // Only proceed if we have a valid document
        if (!isValidDocument) {
          setLoading(false);
          setError('Invalid document data');
          return;
        }
        
        // Add a request tracking flag to prevent duplicate requests
        let isCurrentRequest = true;
        
        const documentUrl = document.link_url;
        const requestKey = `${documentUrl}-${useDirectUrl}-${retryCount}`;
        console.log(`Loading document with key: ${requestKey}`);
      
        // Skip processing for Word documents - they will be handled directly
        if (documentType === 'doc' || documentType === 'docx') {
          console.log(`${documentType.toUpperCase()} file detected, skipping normal document processing`);
          setLoading(false);
          return;
        }
        
        // Handle PDF and other documents normally
        // For the actual URL to use in requests
        const urlToUse = useDirectUrl ? documentUrl : getProxyUrl(documentUrl);
        
        // Skip if we're already loading this exact document with the same parameters
        if (loading && containerRef.current?.requestKey === requestKey) {
          console.log('Skipping duplicate document load request');
          return;
        }
        
        // Store the current request key
        if (containerRef.current) {
          containerRef.current.requestKey = requestKey;
        }
        
        // Reset state when document changes
        setLoading(true);
        setError(null);
        setNumPages(null);
        setPageNumber(1);
        setDocumentData(null);
        
        // For iframe viewing of PDFs, we don't need to fetch the data initially
        if (useIframeInstead && documentType === 'pdf') {
          setLoading(false);
          return;
        }
        
        // For PDF files, directly fetch the data
        if (documentType === 'pdf') {
          console.log(`Loading PDF: ${documentUrl} via ${useDirectUrl ? 'direct URL' : 'proxy'}: ${urlToUse}`);
          
          // Use Fetch to manually retrieve the PDF
          fetchDocumentWithFetch(urlToUse)
            .then(blob => {
              if (!isCurrentRequest) return;
              
              // Create a URL directly from the blob
              const blobUrl = URL.createObjectURL(blob);
              console.log("Created blob URL for PDF:", blobUrl);
              
              // Set document data to the blob URL
              setDocumentData(blobUrl);
              setLoading(false);
            })
            .catch(err => {
              if (!isCurrentRequest) return;
              
              console.error('Error fetching PDF:', err);
              setError(`Failed to load document: ${err.message}`);
              setLoading(false);
              
              // If proxy fails, try direct URL as fallback (if not already tried)
              if (!useDirectUrl) {
                console.log('Trying direct URL as fallback...');
                setUseDirectUrl(true);
              }
            });
        } else {
          // Unsupported document types
          setError(`Document type ${documentType} is not supported for preview. Please download to view.`);
          setLoading(false);
        }
        
        return () => {
          // Mark this request as abandoned if the component unmounts or the effect re-runs
          isCurrentRequest = false;
        };
      }, [document, documentType, retryCount, useDirectUrl, useIframeInstead, isValidDocument, loading]);      

    // If the document is invalid, show an error
    if (!isValidDocument) {
        return (
            <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                <Typography variant="h6" color="error">Invalid Document</Typography>
                <Typography variant="body1">
                    The document could not be displayed because invalid data was provided.
                </Typography>
            </Paper>
        );
    }
    
    // Prepare the document display based on type
    const renderDocument = () => {
        console.log("[renderDocument] Function called. Document type:", documentType);
        
        if (loading) {
            return (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                        Loading document{useDirectUrl ? ' (direct URL)' : ' (via proxy)'}...
                    </Typography>
                </Box>
            );
        }

        if (error) {
            return (
                <Box sx={{ p: 3, textAlign: 'center' }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                    
                    {useDirectUrl ? (
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            Both proxy and direct access failed. The document may be protected or inaccessible.
                        </Typography>
                    ) : (
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            Proxy access failed. Retry to attempt direct access.
                        </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Button 
                            href={document.link_url} 
                            target="_blank" 
                            variant="contained" 
                            color="primary"
                            startIcon={<DownloadIcon />}
                        >
                            Download Document
                        </Button>
                        
                        <Button 
                            variant="outlined" 
                            startIcon={<RefreshIcon />}
                            onClick={handleRetry}
                        >
                            Retry Loading
                        </Button>
                        
                        {documentType === 'pdf' && (
                            <Button 
                                variant="outlined"
                                onClick={() => setUseIframeInstead(true)}
                            >
                                Try Iframe Viewer
                            </Button>
                        )}
                    </Box>
                </Box>
            );
        }

        switch (documentType) {
            case 'pdf':
                // Use iframe approach for all PDF rendering (most reliable)
                const directFileUrl = getDirectFileUrl();
                // Use proxy URL if no direct file URL available
                const pdfUrl = directFileUrl || getProxyUrl(document.link_url);
                
                console.log(`[PDF Renderer] Using URL: ${pdfUrl} for document:`, document);
                
                return (
                    <Box sx={{ width: '100%', height: '600px', position: 'relative' }}>
                        <iframe
                            src={pdfUrl}
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                overflow: 'hidden'
                            }}
                            title={document.description || "PDF Document"}
                            onLoad={() => console.log('[PDF Renderer] iframe loaded successfully')}
                            onError={(e) => console.error('[PDF Renderer] iframe load error:', e)}
                        />
                    </Box>
                );
        
            case 'docx': // DOCX rendering using Google Docs Viewer
            case 'doc':  // DOC rendering also using Google Docs Viewer
                const docType = documentType.toUpperCase();
                console.log(`Rendering ${docType} file with viewer options`);
                
                // Check if we have a viewer URL from the document processing
                const viewerUrl = document.viewer_url || 
                    `https://docs.google.com/viewer?url=${encodeURIComponent(document.link_url)}&embedded=true`;
                
                // If Google Viewer failed or we explicitly want to skip it, show the fallback
                if (googleViewerFailed) {
                    return (
                        <Box sx={{ 
                            width: '100%', 
                            p: 4, 
                            backgroundColor: '#f5f5f5', 
                            borderRadius: 2,
                            textAlign: 'center'
                        }}>
                            <Typography variant="h6" gutterBottom>
                                {docType} File Preview
                            </Typography>
                            
                            <Typography variant="body1" paragraph>
                                This document cannot be previewed directly in the browser.
                            </Typography>
                            
                            <Typography variant="body2" paragraph color="text.secondary">
                                Microsoft Word documents may require special software to view properly.
                            </Typography>
                            
                            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                                <Button 
                                    variant="contained" 
                                    startIcon={<DownloadIcon />}
                                    href={document.link_url} 
                                    target="_blank"
                                >
                                    Download Document
                                </Button>
                                
                                <Button 
                                    variant="outlined"
                                    onClick={() => setGoogleViewerFailed(false)}
                                >
                                    Try Google Viewer Again
                                </Button>
                            </Box>
                        </Box>
                    );
                }
                
                return (
                    <Box sx={{ width: '100%', height: '650px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                {docType} preview powered by Google Docs Viewer
                            </Typography>
                            
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button 
                                    variant="text" 
                                    size="small"
                                    onClick={() => setGoogleViewerFailed(true)}
                                >
                                    Can't view?
                                </Button>
                                
                                <Button 
                                    variant="outlined" 
                                    size="small"
                                    href={document.link_url} 
                                    target="_blank"
                                    startIcon={<DownloadIcon />}
                                >
                                    Download
                                </Button>
                            </Box>
                        </Box>
                        
                        <Paper 
                            elevation={1} 
                            sx={{ 
                                flexGrow: 1, 
                                overflow: 'hidden', 
                                display: 'flex', 
                                flexDirection: 'column',
                                border: '1px solid #e0e0e0',
                                borderRadius: '4px'
                            }}
                        >
                            <iframe
                                src={viewerUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title={document.description || `${docType} Document`}
                                onLoad={() => console.log(`[${docType} Viewer] Google Docs iframe loaded successfully`)}
                                onError={(e) => {
                                    console.error(`[${docType} Viewer] Google Docs iframe error:`, e);
                                    setGoogleViewerFailed(true);
                                }}
                            />
                        </Paper>
                    </Box>
                );
        
            default:
                return (
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography variant="body1" paragraph>
                            Preview not available for this document type ({documentType}).
                        </Typography>
                        <Button 
                            href={document.link_url} 
                            target="_blank" 
                            variant="contained" 
                            startIcon={<DownloadIcon />}
                        >
                            Download Document
                        </Button>
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
                    {documentType === 'pdf' && numPages > 0 && !useIframeInstead && (
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
                    
                    <Tooltip title="Retry Loading">
                        <IconButton 
                            onClick={handleRetry}
                            size="small"
                        >
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {console.log("[DocumentViewer] Rendering renderDocument result")}
            {renderDocument()}
            
            {documentType === 'pdf' && numPages > 0 && !useIframeInstead && (
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