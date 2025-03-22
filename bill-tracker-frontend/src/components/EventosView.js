import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box,
  Grid,
  Chip,
  Card,
  CardContent,
  CardActions,
  Divider,
  Collapse,
  Button,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Skeleton
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import BusinessIcon from '@mui/icons-material/Business';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DocumentViewer from './DocumentViewer';

// Format date function from your existing code
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error(`Error formatting date: ${dateString}`, error);
    return 'Date Error';
  }
};

const EventosView = ({ eventos, isLoading, onDocumentLoad }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expandedEvents, setExpandedEvents] = useState({});
  const [documentStates, setDocumentStates] = useState({}); // Track document loading states
  
  // Initialize document loading states
  useEffect(() => {
    if (eventos && eventos.length > 0) {
      const initialDocumentStates = {};
      
      eventos.forEach((evento, eventoIndex) => {
        if (evento.documents && evento.documents.length > 0) {
          evento.documents.forEach((doc, docIndex) => {
            const docKey = `${eventoIndex}-${docIndex}`;
            initialDocumentStates[docKey] = {
              loading: false,
              loaded: !!doc.downloaded,
              error: doc.error || null
            };
          });
        }
      });
      
      setDocumentStates(initialDocumentStates);
    }
  }, [eventos]);

  if (isLoading) {
    // Show skeleton loaders during loading
    return (
      <Box sx={{ position: 'relative' }}>
        <Typography variant="h6" gutterBottom sx={{ mb: 4 }}>
          Bill Timeline
        </Typography>
        
        {/* Skeleton loaders for events */}
        {Array(5).fill().map((_, index) => (
          <Box key={index} sx={{ mb: 4 }}>
            <Skeleton variant="rectangular" width="100%" height={120} sx={{ borderRadius: 2 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (!eventos || eventos.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Timeline
        </Typography>
        <Typography variant="body1">
          No events are recorded for this bill.
        </Typography>
      </Paper>
    );
  }

  // Sort eventos by date (newest first)
  const sortedEventos = [...eventos].sort((a, b) => {
    // Handle missing dates
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    
    // Compare dates
    const dateA = new Date(a.fecha);
    const dateB = new Date(b.fecha);
    
    // Handle invalid dates
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    
    return dateB - dateA; // Newest first
  });

  const toggleEventExpansion = (index) => {
    setExpandedEvents(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  
  // Handle document download/loading on demand
  const handleDocumentLoad = async (eventoIndex, docIndex, documentUrl) => {
    const docKey = `${eventoIndex}-${docIndex}`;
    
    // Set loading state
    setDocumentStates(prev => ({
      ...prev,
      [docKey]: { ...prev[docKey], loading: true, error: null }
    }));
    
    try {
      // Call the parent's document loading function
      const result = await onDocumentLoad(documentUrl);
      
      // Update document states based on result
      setDocumentStates(prev => ({
        ...prev,
        [docKey]: { 
          loading: false, 
          loaded: !result.error, 
          error: result.error || null
        }
      }));
      
      // Also update the document in the eventos array
      if (!result.error) {
        const updatedEventos = [...sortedEventos];
        updatedEventos[eventoIndex].documents[docIndex] = {
          ...updatedEventos[eventoIndex].documents[docIndex],
          ...result
        };
        
        // We would need to update the parent state here, but we'll rely on the 
        // parent component having already updated its state in onDocumentLoad
      }
      
      return result;
    } catch (error) {
      // Handle error
      setDocumentStates(prev => ({
        ...prev,
        [docKey]: { 
          loading: false, 
          loaded: false, 
          error: error.message || 'Failed to load document'
        }
      }));
      
      console.error('Error loading document:', error);
      return null;
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 4 }}>
        Bill Timeline
      </Typography>
      
      {/* Vertical timeline line */}
      {!isMobile && (
        <Box
          sx={{
            position: 'absolute',
            left: '120px',
            top: 60,
            bottom: 20,
            width: 3,
            bgcolor: theme.palette.primary.main,
            opacity: 0.7,
            zIndex: 0,
          }}
        />
      )}
      
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column',
        gap: 4, 
        position: 'relative', 
        pl: isMobile ? 0 : '150px'
      }}>
        {sortedEventos.map((evento, index) => {
          const isExpanded = !!expandedEvents[index];
          const hasDocuments = evento.documents && evento.documents.length > 0;
          
          return (
            <Box 
              key={index}
              sx={{ 
                position: 'relative',
                zIndex: 1
              }}
            >
              {/* Timeline node (circle) */}
              {!isMobile && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: -35,
                    top: 20,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    bgcolor: evento.tipo === 'votacion' ? theme.palette.secondary.main : theme.palette.primary.main,
                    boxShadow: 2,
                    border: '3px solid',
                    borderColor: theme.palette.background.paper,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff'
                  }}
                >
                  {evento.tipo === 'votacion' ? (
                    <HowToVoteIcon sx={{ fontSize: 12 }} />
                  ) : (
                    <EventIcon sx={{ fontSize: 12 }} />
                  )}
                </Box>
              )}

              {/* Date label */}
              {!isMobile && (
                <Typography
                  variant="subtitle2"
                  sx={{
                    position: 'absolute',
                    left: -140,
                    top: 16,
                    width: 90,
                    textAlign: 'right',
                    fontWeight: 'bold',
                    fontSize: '0.85rem',
                    color: theme.palette.text.secondary
                  }}
                >
                  {formatDate(evento.fecha)}
                </Typography>
              )}
              
              <Card 
                sx={{ 
                  width: '100%',
                  boxShadow: theme.shadows[3],
                  borderLeft: '4px solid',
                  borderColor: evento.tipo === 'votacion' ? theme.palette.secondary.main : theme.palette.primary.main,
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: theme.shadows[6],
                  }
                }}
              >
                <CardContent sx={{ pb: hasDocuments ? 1 : 2 }}>
                  {/* Mobile date display */}
                  {isMobile && (
                    <Chip 
                      icon={<EventIcon />} 
                      label={formatDate(evento.fecha)} 
                      size="small" 
                      sx={{ mb: 2 }}
                      variant="outlined"
                    />
                  )}
                  
                  <Typography 
                    variant="h6" 
                    component="h3" 
                    gutterBottom
                    sx={{ 
                      color: evento.tipo === 'votacion' ? theme.palette.secondary.main : theme.palette.primary.main,
                      fontWeight: 'bold',
                      fontSize: '1.1rem'
                    }}
                  >
                    {evento.descripcion}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                    {/* Event type chip */}
                    <Chip 
                      label={evento.tipo === 'votacion' ? 'Vote' : 'Procedure'} 
                      size="small" 
                      color={evento.tipo === 'votacion' ? 'secondary' : 'primary'}
                    />
                    
                    {/* Chamber (if available) */}
                    {evento.camara && (
                      <Chip 
                        icon={<AccountBalanceIcon />} 
                        label={evento.camara} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                    
                    {/* Commission (if available) */}
                    {evento.comision && (
                      <Chip 
                        icon={<BusinessIcon />} 
                        label={evento.comision} 
                        size="small" 
                        variant="outlined"
                      />
                    )}
                  </Box>
                  
                  {/* Votes display (if available) */}
                  {evento.votes && (
                    <Box sx={{ mt: 3, mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Vote Results:
                      </Typography>
                      <Grid container spacing={1}>
                        {Object.entries(evento.votes).map(([key, value]) => (
                          <Grid item key={key}>
                            <Chip 
                              label={`${key}: ${value}`}
                              size="small" 
                              color={
                                key.includes('favor') ? 'success' : 
                                key.includes('contra') ? 'error' : 
                                key.includes('abstenidos') ? 'warning' : 
                                'default'
                              }
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  )}
                </CardContent>
                
                {/* Display documents if any - with lazy loading */}
                {hasDocuments && (
                  <>
                    <CardActions sx={{ justifyContent: 'space-between', px: 2 }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Documents ({evento.documents.length})
                      </Typography>
                      <Button
                        size="small"
                        onClick={() => toggleEventExpansion(index)}
                        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      >
                        {isExpanded ? 'Hide' : 'View'}
                      </Button>
                    </CardActions>
                    
                    <Collapse in={isExpanded}>
                      <Box sx={{ px: 2, pb: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        {evento.documents.map((doc, docIndex) => {
                          const docKey = `${index}-${docIndex}`;
                          const docState = documentStates[docKey] || { loading: false, loaded: !!doc.downloaded, error: null };
                          
                          return (
                            <Box key={docIndex} sx={{ mb: 3 }}>
                              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                                <DescriptionIcon sx={{ mr: 1, fontSize: '1rem' }} />
                                {doc.description || `Document ${docIndex + 1}`}
                              </Typography>
                              
                              {docState.loading ? (
                                <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 1 }}>
                                  <CircularProgress size={24} sx={{ mb: 1 }} />
                                  <Typography variant="body2" color="text.secondary">
                                    Loading document...
                                  </Typography>
                                </Box>
                              ) : docState.error ? (
                                <Paper sx={{ p: 3, bgcolor: 'error.light', color: 'error.main', borderRadius: 1 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <ErrorOutlineIcon sx={{ mr: 1 }} />
                                    <Typography variant="body2" fontWeight="bold">
                                      Error loading document
                                    </Typography>
                                  </Box>
                                  <Typography variant="body2" sx={{ mb: 2 }}>
                                    {docState.error || 'Failed to load document'}
                                  </Typography>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Button 
                                      variant="outlined" 
                                      size="small"
                                      href={doc.link_url} 
                                      target="_blank"
                                      startIcon={<CloudDownloadIcon />}
                                    >
                                      Download
                                    </Button>
                                    <Button
                                      variant="contained"
                                      size="small"
                                      onClick={() => handleDocumentLoad(index, docIndex, doc.link_url)}
                                    >
                                      Retry
                                    </Button>
                                  </Box>
                                </Paper>
                              ) : docState.loaded ? (
                                <Paper sx={{ p: 2, bgcolor: 'background.paper' }}>
                                  <DocumentViewer
                                    document={doc}
                                    compact={true}
                                    onError={(error) => {
                                      console.error(`Error displaying document: ${error}`);
                                      setDocumentStates(prev => ({
                                        ...prev,
                                        [docKey]: { ...prev[docKey], error }
                                      }));
                                    }}
                                  />
                                </Paper>
                              ) : (
                                <Paper 
                                  sx={{ 
                                    p: 3, 
                                    bgcolor: 'background.paper', 
                                    borderRadius: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      bgcolor: 'action.hover'
                                    }
                                  }}
                                  onClick={() => handleDocumentLoad(index, docIndex, doc.link_url)}
                                >
                                  <CloudDownloadIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                                  <Typography variant="subtitle2" align="center" gutterBottom>
                                    Click to load document
                                  </Typography>
                                  <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 1 }}>
                                    {doc.link_url.split('/').pop()}
                                  </Typography>
                                  <Button 
                                    variant="contained" 
                                    size="small"
                                    startIcon={<CloudDownloadIcon />}
                                  >
                                    Load Document
                                  </Button>
                                </Paper>
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    </Collapse>
                  </>
                )}
              </Card>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default EventosView;