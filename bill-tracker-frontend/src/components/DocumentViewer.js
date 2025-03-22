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
    const [useIframeInstead, setUseIframeInstead] = useState(false);

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
        if (document.filepath) {
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
        setUseIframeInstead(false);
        setRetryCount(prev => prev + 1);
    };

    // Function to manually fetch document data with fetch API for better error handling
    const fetchDocumentWithFetch = async (url) => {
        try {
            setLoading(true);
            console.log(`Fetching document with fetch from: ${url}`);
            
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

    const getFileUrl = () => {
        if (document.filepath) {
          const filename = document.filepath.split('/').pop();
          return process.env.NODE_ENV === 'production'
            ? `/api/serve-document/${filename}`
            : `http://localhost:3001/api/serve-document/${filename}`;
        }
        return null;
      };

    // Helper function to render PDF in an iframe
    const renderPdfWithIframe = () => {
        const directFileUrl = getDirectFileUrl();
        const iframeUrl = directFileUrl || getProxyUrl(document.link_url);

        console.log("[renderPdfWithIframe] Function called. Iframe URL:", iframeUrl); // Log iframe URL

        const iframeJSX = ( // Store JSX in a variable
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

        console.log("[renderPdfWithIframe] Returning JSX:", iframeJSX); // Log returned JSX
        return iframeJSX; // Return the JSX variable
    };
    
    useEffect(() => {
        // Add a request tracking flag to prevent duplicate requests
        let isCurrentRequest = true;
        
        if (!document.link_url) {
            setError('No document URL provided');
            setLoading(false);
            return;
        }
        
        // Track previous URL to prevent unnecessary reloads
        const requestKey = `${document.link_url}-${useDirectUrl}-${retryCount}`;
        console.log(`Loading document with key: ${requestKey}`);
        
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
        
        // For iframe viewing, we don't need to fetch the data
        if (useIframeInstead && documentType === 'pdf') {
            setLoading(false);
            return;
        }
        
        // Choose URL based on current strategy (proxy or direct)
        const urlToUse = useDirectUrl ? document.link_url : getProxyUrl(document.link_url);
        
        // For PDF files, directly fetch the data
        if (documentType === 'pdf') {
            console.log(`Loading PDF: ${document.link_url} via ${useDirectUrl ? 'direct URL' : 'proxy'}: ${urlToUse}`);
            
            // Use Fetch to manually retrieve the PDF
            fetchDocumentWithFetch(urlToUse)
                .then(blob => {
                    if (!isCurrentRequest) return; // Avoid state updates if request is no longer relevant
                    
                    // Convert blob to data URL for react-pdf
                    const reader = new FileReader();
                    reader.onload = () => {
                        if (!isCurrentRequest) return;
                        const dataUrl = reader.result;
                        setDocumentData(dataUrl);
                        setLoading(false);
                    };
                    reader.onerror = () => {
                        if (!isCurrentRequest) return;
                        setError('Failed to process the document data');
                        setLoading(false);
                    };
                    reader.readAsDataURL(blob);
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
        } 
        // For DOCX files, similar approach
        else if (documentType === 'docx' || documentType === 'doc') {
            const loadDocx = async () => {
                try {
                    if (!isCurrentRequest) return;
                    
                    setLoading(true);
                    console.log(`Loading DOCX: ${document.link_url} via ${useDirectUrl ? 'direct URL' : 'proxy'}: ${urlToUse}`);
                    
                    const blob = await fetchDocumentWithFetch(urlToUse);
                    
                    if (!isCurrentRequest) return;
                    
                    if (containerRef.current) {
                        try {
                            await renderAsync(blob, containerRef.current, null, {
                                className: 'docx-viewer'
                            });
                            if (!isCurrentRequest) return;
                            setLoading(false);
                        } catch (renderError) {
                            if (!isCurrentRequest) return;
                            console.error('Error rendering DOCX:', renderError);
                            throw new Error(`Failed to render document: ${renderError.message}`);
                        }
                    }
                } catch (err) {
                    if (!isCurrentRequest) return;
                    
                    console.error('Error loading DOCX:', err);
                    setError(`Failed to load document: ${err.message}`);
                    setLoading(false);
                    
                    // Try direct URL if proxy failed
                    if (!useDirectUrl) {
                        console.log('Trying direct URL as fallback...');
                        setUseDirectUrl(true);
                    }
                }
            };
            
            loadDocx();
        } else {
            // Unsupported document types
            setError(`Document type ${documentType} is not supported for preview. Please download to view.`);
            setLoading(false);
        }
        
        return () => {
            // Mark this request as abandoned if the component unmounts or the effect re-runs
            isCurrentRequest = false;
        };
    }, [document.link_url, documentType, retryCount, useDirectUrl, useIframeInstead]);
    
    // Prepare the document display based on type
    const renderDocument = () => {
        console.log("[renderDocument] Function called. Document type:", documentType);
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
            // First check if we have a direct file URL (most reliable)
            const directFileUrl = getDirectFileUrl();
            
            // If we have a direct file URL, use a simple iframe approach
            if (directFileUrl) {
                return (
                <Box sx={{ width: '100%', height: '600px', position: 'relative' }}>
                    <iframe
                    src={directFileUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        overflow: 'hidden'
                    }}
                    title={document.description || "PDF Document"}
                    />
                </Box>
                );
            }
            
            // If user clicked to use iframe instead (for proxy approach)
            if (useIframeInstead) {
                return renderPdfWithIframe();
            }
            
            return (
                <Box sx={{ overflow: 'auto' }}>
                    {documentData ? (
                        // First try with object tag (most compatible)
                        <Box sx={{ width: '100%', height: '600px', position: 'relative' }}>
                            <object
                                data={URL.createObjectURL(documentData)}
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                style={{ border: 'none' }}
                            >
                                {/* Fallback to react-pdf if object tag fails */}
                                <Document
                                    file={documentData}                  
                                    onLoadSuccess={onDocumentLoadSuccess}
                                    onLoadError={(error) => {
                                        console.error('Error in react-pdf:', error);
                                        // If react-pdf fails, suggest using iframe
                                        setError(`PDF viewer error: ${error.message}. Try the iframe viewer instead.`);
                                    }}
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
                                </Document>
                            </object>
                        </Box>
                    ) : (
                        <Box sx={{ p: 4, textAlign: 'center' }}>
                            <Typography color="error">
                                No document data available.
                            </Typography>
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                                <Button 
                                    variant="outlined" 
                                    onClick={handleRetry}
                                    startIcon={<RefreshIcon />}
                                >
                                    Retry
                                </Button>
                                <Button 
                                    variant="outlined"
                                    onClick={() => setUseIframeInstead(true)}
                                >
                                    Try Iframe Viewer
                                </Button>
                                <Button 
                                    href={document.link_url} 
                                    target="_blank"
                                    variant="contained" 
                                    startIcon={<DownloadIcon />}
                                >
                                    Download PDF
                                </Button>
                            </Box>
                        </Box>
                    )}
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

            case 'doc':
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