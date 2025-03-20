import React from 'react';
import {
  Typography,
  Paper,
  Box,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Link,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import EventIcon from '@mui/icons-material/Event';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LinkIcon from '@mui/icons-material/Link';
import BusinessIcon from '@mui/icons-material/Business';

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

const EventosView = ({ eventos }) => {
  if (!eventos || eventos.length === 0) {
    return (
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Eventos
        </Typography>
        <Typography variant="body1">
          No hay eventos registrados para esta medida.
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

  return (
    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
      <Typography variant="h6" gutterBottom>
        Eventos
      </Typography>
      
      <List sx={{ width: '100%' }}>
        {sortedEventos.map((evento, index) => (
          <React.Fragment key={index}>
            {index > 0 && <Divider sx={{ my: 2 }} />}
            <ListItem 
              alignItems="flex-start" 
              sx={{ 
                p: 2, 
                borderRadius: 1,
                backgroundColor: index % 2 === 0 ? 'rgba(0, 0, 0, 0.03)' : 'transparent' 
              }}
            >
              <Grid container spacing={2}>
                {/* Icon based on event type */}
                <Grid item xs={12} sm={1}>
                  {evento.tipo === 'votacion' ? (
                    <HowToVoteIcon color="primary" sx={{ fontSize: 28 }} />
                  ) : (
                    <EventIcon color="primary" sx={{ fontSize: 28 }} />
                  )}
                </Grid>
                
                {/* Event description and details */}
                <Grid item xs={12} sm={11}>
                  <Typography variant="subtitle1" component="div" gutterBottom fontWeight="bold">
                    {evento.descripcion}
                  </Typography>
                  
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                    {/* Date */}
                    <Chip 
                      icon={<EventIcon />} 
                      label={formatDate(evento.fecha)} 
                      size="small" 
                      variant="outlined"
                    />
                    
                    {/* Chamber (if available) */}
                    {evento.camara && (
                      <Chip 
                        icon={<AccountBalanceIcon />} 
                        label={evento.camara} 
                        size="small" 
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    
                    {/* Commission (if available) */}
                    {evento.comision && (
                      <Chip 
                        icon={<BusinessIcon />} 
                        label={evento.comision} 
                        size="small" 
                        variant="outlined"
                        color="secondary"
                      />
                    )}
                  </Box>
                  
                  {/* Votes (if available) */}
                  {evento.votes && (
                    <Box sx={{ mt: 2, mb: 2 }}>
                      <Typography variant="subtitle2" component="div">
                        Resultado de la Votación:
                      </Typography>
                      <Grid container spacing={1} sx={{ mt: 1 }}>
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
                  
                  {/* Documents (if available) */}
                  {evento.documents && evento.documents.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" component="div">
                        Documentos:
                      </Typography>
                      <List dense>
                        {evento.documents.map((doc, docIndex) => (
                          <ListItem key={docIndex} sx={{ py: 0.5 }}>
                            <ListItemIcon sx={{ minWidth: 36 }}>
                              <InsertDriveFileIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={
                                <Link 
                                  href={doc.link_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  underline="hover"
                                  sx={{ display: 'flex', alignItems: 'center' }}
                                >
                                  {doc.description}
                                  <Tooltip title="Abrir documento">
                                    <IconButton size="small" sx={{ ml: 1 }}>
                                      <LinkIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Link>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </ListItem>
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default EventosView;