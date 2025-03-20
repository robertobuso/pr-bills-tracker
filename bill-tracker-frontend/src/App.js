import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  extractBestDate,
  formatBillDate,
  getTimeAgo,
  sortActionsByDate,
  DateDisplay
} from './dateUtils';
import { parseISO, isValid } from 'date-fns';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Modal,
  Box,
  List,
  ListItem,
  Link,
  Grid,
  TextField,
  Button,
  Paper,
  Divider,
  AppBar,
  Toolbar,
  IconButton,
  Chip,
  CircularProgress,
  Drawer,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Avatar,
  InputAdornment,
  Badge,
  Pagination,
  Skeleton,
  CssBaseline,
  createTheme,
  ThemeProvider,
  Tooltip,
  Alert
} from '@mui/material';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import ArticleIcon from '@mui/icons-material/Article';
import TimelineIcon from '@mui/icons-material/Timeline';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

// Email Feature
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import MailIcon from '@mui/icons-material/Mail';
import { format as dateFormat } from 'date-fns'; 

const API_KEY = 'afb43156-6854-44cf-8730-795c8c172990';
const BASE_URL = 'https://v3.openstates.org';

function App() {
  const [bills, setBills] = useState([]);
  const [selectedBill, setSelectedBill] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState({
    severity: 'error',
    message: null
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    classification: '',
    status: '',
    dateRange: 'all',
  });
  const [tabValue, setTabValue] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [bookmarkedBills, setBookmarkedBills] = useState([]);
  const [recentlyViewedBills, setRecentlyViewedBills] = useState([]);
  const [activeView, setActiveView] = useState('cards');

  //Email Feature
  const [selectedDate, setSelectedDate] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailPreviewDialogOpen, setEmailPreviewDialogOpen] = useState(false);
  const [emailContent, setEmailContent] = useState({
    subject: '',
    body: '',
    recipientEmail: 'pbusogarcia@gmail.com',
    billIds: []
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState(null);

  // Create a theme based on dark mode preference
  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1976d2',
      },
      secondary: {
        main: '#dc004e',
      },
      background: {
        default: darkMode ? '#121212' : '#f5f5f5',
        paper: darkMode ? '#1e1e1e' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 500,
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: darkMode 
              ? '0 8px 16px rgba(0, 0, 0, 0.5)'
              : '0 6px 12px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: darkMode 
                ? '0 12px 20px rgba(0, 0, 0, 0.6)'
                : '0 10px 18px rgba(0, 0, 0, 0.15)',
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            fontWeight: 500,
          },
        },
      },
    },
  });

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${BASE_URL}/bills?jurisdiction=ocd-jurisdiction%2Fcountry%3Aus%2Fterritory%3Apr%2Fgovernment&sort=latest_action_desc&include=sponsorships&include=abstracts&include=other_titles&include=other_identifiers&include=actions&include=sources&include=documents&include=versions&include=votes&include=related_bills&page=${page}&per_page=10&apikey=${API_KEY}`;
      
      // Add search query if present
      if (searchTerm) {
        url += `&query=${encodeURIComponent(searchTerm)}`;
      }
      
      // Add filters
      if (filters.classification) {
        url += `&classification=${encodeURIComponent(filters.classification)}`;
      }
      
      const response = await axios.get(url);
      setBills(response.data.results);
      
      // Calculate total pages
      const totalItems = response.data.pagination.total_items;
      const perPage = response.data.pagination.per_page;
      setTotalPages(Math.ceil(totalItems / perPage));
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError('Failed to load bills. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filters]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);
  
  useEffect(() => {
    // Load bookmarked bills from localStorage on component mount
    const savedBookmarks = localStorage.getItem('bookmarkedBills');
    if (savedBookmarks) {
      setBookmarkedBills(JSON.parse(savedBookmarks));
    }
    
    // Load recently viewed bills from localStorage
    const savedRecentlyViewed = localStorage.getItem('recentlyViewedBills');
    if (savedRecentlyViewed) {
      setRecentlyViewedBills(JSON.parse(savedRecentlyViewed));
    }
  }, []);

  // Handle URL parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const billId = queryParams.get('billId');
    
    if (billId) {
      handleOpen(billId);
    }
  }, []);  // Empty dependency array ensures this only runs once on mount

  const handleOpen = async (billId) => {
    setLoading(true);
    try {
      const detailsURL = `${BASE_URL}/bills/${billId}?include=sponsorships&include=abstracts&include=other_titles&include=other_identifiers&include=actions&include=sources&include=documents&include=versions&include=votes&include=related_bills&apikey=${API_KEY}`;
      const response = await axios.get(detailsURL);
      setSelectedBill(response.data);
      setOpen(true);

      // Remove the billId parameter from URL without page refresh
      if (window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('billId');
        window.history.replaceState({}, document.title, url.toString());
      }
      
      // Preprocess the bill data to extract and validate dates
      const billWithDates = {
        ...response.data,
        // Extract key dates with rich metadata
        processedDates: {
          latest: extractBestDate(response.data, 'latest'),
          created: extractBestDate(response.data, 'created'),
          passage: extractBestDate(response.data, 'passage')
        }
      };
      
      // Sort actions array by date for timeline consistency
      if (billWithDates.actions && Array.isArray(billWithDates.actions)) {
        billWithDates.actions = sortActionsByDate(billWithDates.actions);
      }
      
      setSelectedBill(billWithDates);
      setOpen(true);
      
      // Add to recently viewed bills
      const updatedRecentlyViewed = [billId, ...recentlyViewedBills.filter(id => id !== billId)].slice(0, 10);
      setRecentlyViewedBills(updatedRecentlyViewed);
      localStorage.setItem('recentlyViewedBills', JSON.stringify(updatedRecentlyViewed));
    } catch (err) {
      console.error('Error fetching bill details:', err);
      setError({
        severity: 'error',
        message: 'Failed to load bill details. Please try again later.'
      });
    } finally {
      setLoading(false);
    }
  };  

  const handleClose = () => {
    setOpen(false);
    setTabValue(0); // Reset to All Bills tab when modal closes
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      
      // Check if date is valid (not NaN)
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date string: ${dateString}`);
        return 'Invalid Date';
      }
      
      // Check for obviously wrong years (like 8019)
      const year = date.getFullYear();
      if (year > 2100 || year < 1900) {
        // This might be a year parsing error - attempt to fix
        console.warn(`Suspicious year (${year}) in date: ${dateString}`);
        
        // Try to extract and fix the date manually
        const dateParts = dateString.split(/[^0-9]/);
        if (dateParts.length >= 3) {
          // Attempt to create a corrected date
          const correctedYear = dateParts[0].length === 4 ? dateParts[0] : `20${dateParts[0].slice(-2)}`;
          const correctedDate = new Date(`${correctedYear}-${dateParts[1]}-${dateParts[2]}`);
          if (!isNaN(correctedDate.getTime())) {
            return correctedDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          }
        }
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

  const truncateTitle = (title) => {
    if (!title) return 'No Title';
    const words = title.split(' ');
    if (words.length > 15) {
      return words.slice(0, 15).join(' ') + '...';
    }
    return title;
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    setPage(1); // Reset to first page on new search
    fetchBills();
  };

  const handleFilterChange = (event) => {
    setFilters({
      ...filters,
      [event.target.name]: event.target.value,
    });
  };

  const applyFilters = () => {
    setPage(1); // Reset to first page on filter change
    fetchBills();
    setFilterDrawerOpen(false);
  };

  const resetFilters = () => {
    setFilters({
      classification: '',
      status: '',
      dateRange: 'all',
    });
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleBookmark = (billId) => {
    let newBookmarkedBills;
    if (bookmarkedBills.includes(billId)) {
      newBookmarkedBills = bookmarkedBills.filter(id => id !== billId);
    } else {
      newBookmarkedBills = [...bookmarkedBills, billId];
    }
    setBookmarkedBills(newBookmarkedBills);
    localStorage.setItem('bookmarkedBills', JSON.stringify(newBookmarkedBills));
  };

  const isBookmarked = (billId) => {
    return bookmarkedBills.includes(billId);
  };

  const handleExport = (bill) => {
    const billData = JSON.stringify(bill, null, 2);
    const blob = new Blob([billData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bill-${bill.identifier}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getStatusChipProps = (bill) => {
    // Determine bill status based on actions
    if (!bill.actions || bill.actions.length === 0) {
      return { label: 'Unknown', color: 'default' };
    }
    
    const latestAction = bill.actions[0].description.toLowerCase();
    
    if (latestAction.includes('signed') || latestAction.includes('enacted') || latestAction.includes('approved')) {
      return { label: 'Enacted', color: 'success' };
    } else if (latestAction.includes('vetoed')) {
      return { label: 'Vetoed', color: 'error' };
    } else if (latestAction.includes('passed')) {
      return { label: 'Passed', color: 'info' };
    } else if (latestAction.includes('introduced') || latestAction.includes('filed')) {
      return { label: 'Introduced', color: 'primary' };
    } else if (latestAction.includes('committee')) {
      return { label: 'In Committee', color: 'warning' };
    } else {
      return { label: 'Active', color: 'default' };
    }
  };

  const groupBillsByDate = (bills) => {
    if (!bills || !Array.isArray(bills)) return {};
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return bills.reduce((groups, bill) => {
      // Extract the best date for this bill with rich metadata
      const { date: dateObj, source, description } = extractBestDate(bill, 'latest');
      
      let dateStr = 'No Date Available';
      
      if (dateObj && isValid(dateObj)) {
        // Format the date for display
        dateStr = formatBillDate(dateObj);
        
        // Categorize very recent dates as "Today" or "Yesterday"
        const billDate = new Date(dateObj);
        billDate.setHours(0, 0, 0, 0);
        
        if (billDate.getTime() === today.getTime()) {
          dateStr = 'Today';
        } else {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (billDate.getTime() === yesterday.getTime()) {
            dateStr = 'Yesterday';
          }
        }
      }
      
      // Add metadata for sorting and display
      const billWithMeta = {
        ...bill,
        priority: getActionPriority(bill.latest_action_description),
        dateObj: dateObj,  // Store the actual date object for sorting
        dateSource: source, // Track where we got the date from
        dateDescription: description // Additional context if available
      };
      
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      
      groups[dateStr].push(billWithMeta);
      return groups;
    }, {});
  };  
    
  const getActionPriority = (actionDescription) => {
    if (!actionDescription) return 0;
    
    const lowerDesc = actionDescription.toLowerCase();
    
    // Highest priority - bills that have been voted on or passed
    if (lowerDesc.includes('votación') || 
        lowerDesc.includes('aprobado') || 
        lowerDesc.includes('passed') ||
        lowerDesc.includes('enacted')) {
      return 3;
    }
    
    // Medium priority - bills in active consideration
    if (lowerDesc.includes('lectura') || 
        lowerDesc.includes('calendario') ||
        lowerDesc.includes('informe')) {
      return 2;
    }
    
    // Lower priority - routine procedural actions
    if (lowerDesc.includes('referido') || 
        lowerDesc.includes('comisión')) {
      return 1;
    }
    
    return 0;
  };

  const renderBillCard = (bill) => {
    const statusChip = getStatusChipProps(bill);
    const isHighlighted = bill.highlight;
    
    // Extract the best available date for display
    const latestActionDate = extractBestDate(bill, 'latest');
    const timeAgo = latestActionDate.date ? getTimeAgo(latestActionDate.date) : '';
    
    return (
      <Card
        key={bill.id}
        onClick={() => handleOpen(bill.id)}
        sx={{
          mb: 3,
          cursor: 'pointer',
          position: 'relative',
          overflow: 'visible',
          borderLeft: isHighlighted ? '4px solid' : 'none',
          borderColor: isHighlighted ? 'secondary.main' : 'transparent',
          boxShadow: isHighlighted ? (theme) => 
            darkMode 
              ? '0 8px 20px rgba(255, 99, 71, 0.4)' 
              : '0 8px 20px rgba(255, 99, 71, 0.2)' 
            : undefined,
        }}
      >
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            toggleBookmark(bill.id);
          }}
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 2,
            color: isBookmarked(bill.id) ? 'primary.main' : 'text.disabled',
          }}
        >
          {isBookmarked(bill.id) ? <BookmarkIcon /> : <BookmarkBorderIcon />}
        </IconButton>
  
        <CardContent sx={{ pt: 4, pb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}>
              <Box display="flex" alignItems="center" mb={1}>
                <ArticleIcon sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  {bill.identifier}
                </Typography>
                <Box ml="auto" display="flex" alignItems="center">
                  {isHighlighted && (
                    <Chip 
                      label="Important" 
                      color="secondary" 
                      size="small"
                      sx={{ 
                        fontWeight: 'bold',
                        mr: 1 
                      }}
                    />
                  )}
                  <Chip 
                    label={statusChip.label} 
                    color={statusChip.color} 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              </Box>
              
              <Typography variant="h6" component="h3" gutterBottom>
                {truncateTitle(bill.title)}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" paragraph>
                {bill.abstracts && bill.abstracts.length > 0 ? (
                  bill.abstracts[0].abstract.substring(0, 200) + 
                  (bill.abstracts[0].abstract.length > 200 ? '...' : '')
                ) : 'No abstract available'}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>
            
            <Grid item xs={6}>
              <Box display="flex" alignItems="center">
                <CalendarTodayIcon sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                <Tooltip 
                  title={latestActionDate.source === 'not_found' 
                    ? 'Date information not available' 
                    : `Date source: ${latestActionDate.source}`}
                >
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {latestActionDate.date 
                        ? formatBillDate(latestActionDate.date) 
                        : 'Date not available'}
                    </Typography>
                    {timeAgo && (
                      <Typography 
                        variant="caption" 
                        color="text.secondary" 
                        sx={{ display: 'block', fontStyle: 'italic' }}
                      >
                        {timeAgo}
                      </Typography>
                    )}
                  </Box>
                </Tooltip>
              </Box>
            </Grid>
            
            <Grid item xs={6}>
              <Box display="flex" alignItems="center" justifyContent="flex-end">
                <Typography 
                  variant="body2" 
                  color={isHighlighted ? 'secondary.main' : 'text.secondary'}
                  sx={{ fontWeight: isHighlighted ? 'bold' : 'normal' }}
                >
                  {bill.latest_action_description || 'No action'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    );
  };  

  const renderBillInformation = (bill) => {
    // Extract the best dates for different bill events
    const creationDate = bill.processedDates?.created || extractBestDate(bill, 'created');
    const passageDate = bill.processedDates?.passage || extractBestDate(bill, 'passage');
    const latestActionDate = bill.processedDates?.latest || extractBestDate(bill, 'latest');
    
    return (
      <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Bill Information
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Identifier:</strong> {bill.identifier}
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Jurisdiction:</strong> {bill.jurisdiction?.name || 'N/A'}
        </Typography>
        
        {/* Creation Date with reliability indicator */}
        <Typography variant="body1" component="div" paragraph sx={{ display: 'flex', alignItems: 'center' }}>
          <strong>Introduced:</strong> 
          <Box sx={{ ml: 1 }}>
            <DateDisplay 
              date={creationDate} 
              fallback="Date not available" 
              showReliabilityIndicator={true} 
            />
            {creationDate.description && (
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                {creationDate.description}
              </Typography>
            )}
          </Box>
        </Typography>
        
        {/* Passage Date with reliability indicator */}
        <Typography variant="body1" component="div" paragraph sx={{ display: 'flex', alignItems: 'center' }}>
          <strong>Latest Passage:</strong>
          <Box sx={{ ml: 1 }}>
            <DateDisplay 
              date={passageDate} 
              fallback="No passage date" 
              showReliabilityIndicator={true} 
            />
            {passageDate.description && (
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', mt: 0.5 }}>
                {passageDate.description}
              </Typography>
            )}
          </Box>
        </Typography>
        
        <Typography variant="body1" paragraph>
          <strong>From Organization:</strong> {(bill.from_organization?.name) || 'N/A'}
          {bill.from_organization?.classification && 
            ` (${bill.from_organization.classification})`}
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>Classification:</strong> {bill.classification || 'N/A'}
        </Typography>
      </Paper>
    );
  };

  // Generate email summary based on selected date
  const handleGenerateEmailSummary = async () => {
    if (!selectedDate) return;
    
    setEmailLoading(true);
    setEmailError(null);
    
    try {
      console.log("=== EMAIL SUMMARY DEBUG ===");
      console.log("Selected date:", selectedDate);
      
      // Format selected date for display
      const formattedDate = dateFormat(selectedDate, 'MMMM d, yyyy');
      console.log("Formatted date for display:", formattedDate);
      
      const subject = `Summary of Bills - ${formattedDate}`;
      
      // Normalize selected date to midnight for comparison
      const selectedMidnight = new Date(selectedDate);
      selectedMidnight.setHours(0, 0, 0, 0);
      console.log("Selected date at midnight:", selectedMidnight, selectedMidnight.toISOString());
      
      // Fetch bills if not already loaded
      let billsToProcess = bills;
      console.log("Currently loaded bills count:", bills.length);
      
      if (billsToProcess.length === 0) {
        console.log("No bills loaded, fetching from API...");
        try {
          const apiUrl = `${BASE_URL}/bills?jurisdiction=ocd-jurisdiction%2Fcountry%3Aus%2Fterritory%3Apr%2Fgovernment&include=actions&apikey=${API_KEY}`;
          console.log("API request URL:", apiUrl);
          
          const response = await axios.get(apiUrl);
          console.log("API response status:", response.status);
          console.log("API response pagination:", response.data.pagination);
          console.log("API response bills count:", response.data.results.length);
          
          billsToProcess = response.data.results;
        } catch (error) {
          console.error('Error fetching bills for email summary:', error);
          console.log("API request failed with error:", error.message);
          if (error.response) {
            console.log("Error response data:", error.response.data);
            console.log("Error response status:", error.response.status);
          }
          
          setEmailError('Failed to fetch bills. Please try again later.');
          setEmailLoading(false);
          return;
        }
      }
      
      console.log("=== Bills to process:", billsToProcess.length, "===");
      
      // Log how bills are grouped in the main view
      console.log("=== Checking how bills are grouped in the main view ===");
      const groupedBills = groupBillsByDate(billsToProcess);
      console.log("Date groups in main view:", Object.keys(groupedBills));
      for (const [dateStr, dateBills] of Object.entries(groupedBills)) {
        console.log(`Group "${dateStr}": ${dateBills.length} bills`);
        
        // Log the first few bills in this group
        const sampleBills = dateBills.slice(0, 3);
        console.log("Sample bills in this group:", 
          sampleBills.map(bill => ({
            id: bill.id,
            identifier: bill.identifier,
            dateObj: bill.dateObj ? bill.dateObj.toISOString() : null,
            dateSource: bill.dateSource
          }))
        );
      }
      
      // Check if the formatted date exists as a group
      console.log(`Looking for bills in group "${formattedDate}"`);
      const matchingBills = groupedBills[formattedDate] || [];
      console.log(`Found ${matchingBills.length} bills in "${formattedDate}" group`);
      
      // If no exact match, try looking for bills with the same day
      let relevantBills = [];
      
      if (matchingBills.length > 0) {
        console.log("Using exact matching bills from the group");
        relevantBills = matchingBills.map(bill => ({
          bill,
          actionsOnDate: bill.actions && bill.actions.length > 0 ? 
            bill.actions.slice(0, 1) : 
            [{
              description: bill.latest_action_description || 'No specific action details available',
              date: bill.dateObj,
              organization: bill.from_organization
            }]
        }));
      } else {
        console.log("No exact matches, trying date object comparison");
        // Track bills we check
        const checkedBills = [];
        
        for (const bill of billsToProcess) {
          const { date: billDate, source: dateSource } = extractBestDate(bill, 'latest');
          
          const billCheck = {
            id: bill.id,
            identifier: bill.identifier,
            billDate: billDate ? billDate.toISOString() : null,
            dateSource,
            matches: false,
            reason: ""
          };
          
          if (!billDate || !isValid(billDate)) {
            billCheck.reason = "No valid date";
            checkedBills.push(billCheck);
            continue;
          }
          
          // Try comparing date objects directly
          const billMidnight = new Date(billDate);
          billMidnight.setHours(0, 0, 0, 0);
          billCheck.billDateMidnight = billMidnight.toISOString();
          
          // Check date equality in multiple ways
          const yearMatch = billMidnight.getFullYear() === selectedMidnight.getFullYear();
          const monthMatch = billMidnight.getMonth() === selectedMidnight.getMonth();
          const dayMatch = billMidnight.getDate() === selectedMidnight.getDate();
          const dateStringMatch = billMidnight.toDateString() === selectedMidnight.toDateString();
          const timeMatch = billMidnight.getTime() === selectedMidnight.getTime();
          
          billCheck.dateComparison = {
            yearMatch,
            monthMatch,
            dayMatch,
            dateStringMatch,
            timeMatch
          };
          
          // Standard way - year, month, day comparison
          if (yearMatch && monthMatch && dayMatch) {
            billCheck.matches = true;
            billCheck.reason = "Date components match";
            
            const actionsOnDate = bill.actions ? bill.actions.slice(0, 1) : [];
            
            relevantBills.push({
              bill,
              actionsOnDate: actionsOnDate.length > 0 ? actionsOnDate : [{
                description: bill.latest_action_description || 'No specific action details available',
                date: billDate,
                organization: bill.from_organization
              }]
            });
          } else {
            billCheck.reason = "Date components don't match";
          }
          
          checkedBills.push(billCheck);
        }
        
        console.log("Bills checked for date match:", checkedBills);
        console.log("Found relevant bills through direct date comparison:", relevantBills.length);
      }
      
      console.log("=== Final relevant bills ===");
      console.log("Count:", relevantBills.length);
      if (relevantBills.length > 0) {
        console.log("Bill identifiers:", relevantBills.map(rb => rb.bill.identifier));
      }
      
      // Generate HTML content for email
      let emailBody = `
        <h2>Puerto Rico Bills Summary for ${formattedDate}</h2>
        <p>The following bills had activity on this date:</p>
      `;
      
      if (relevantBills.length === 0) {
        emailBody += '<p><strong>No bills had activity on this date.</strong></p>';
      } else {
        // The base URL for linking to bills
        const baseUrl = window.location.origin + window.location.pathname;
        
        emailBody += '<div style="margin-top: 20px;">';
        
        relevantBills.forEach(({ bill, actionsOnDate }) => {
          // Link to open the bill details in the app
          const billLink = `${baseUrl}?billId=${bill.id}`;
          
          emailBody += `
            <div style="margin-bottom: 25px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9;">
              <h3 style="margin-top: 0; color: #1976d2;">${bill.identifier}: ${bill.title || 'No Title'}</h3>
              
              <p><strong>Classification:</strong> ${bill.classification || 'N/A'}</p>
              <p><strong>From Organization:</strong> ${bill.from_organization?.name || 'N/A'}
                ${bill.from_organization?.classification ? ` (${bill.from_organization.classification})` : ''}
              </p>
              
              <p><strong>Abstract:</strong> ${
                bill.abstracts && bill.abstracts.length > 0 
                  ? bill.abstracts[0].abstract.substring(0, 200) + 
                    (bill.abstracts[0].abstract.length > 200 ? '...' : '')
                  : 'No abstract available'
              }</p>
              
              <h4 style="margin-bottom: 10px; color: #555;">Actions on ${formattedDate}:</h4>
              <ul style="margin-top: 5px; padding-left: 20px;">
                ${actionsOnDate.map(action => `
                  <li style="margin-bottom: 5px;">
                    ${action.description || 'No description'} 
                    ${action.organization ? `(${action.organization.name})` : ''}
                  </li>
                `).join('')}
              </ul>
              
              <p style="margin-top: 15px;">
                <a href="${billLink}" style="color: #1976d2; text-decoration: none; font-weight: bold;">
                  View Bill Details →
                </a>
              </p>
            </div>
          `;
        });
        
        emailBody += '</div>';
      }
      
      // Set email content state
      setEmailContent({
        subject,
        body: emailBody,
        recipientEmail: 'pbusogarcia@gmail.com',
        billIds: relevantBills.map(rb => rb.bill.id)
      });
      
      console.log("=== Email generation complete ===");
      
      // Close date selection dialog and open preview
      setEmailDialogOpen(false);
      setEmailPreviewDialogOpen(true);
    } catch (error) {
      console.error('Error generating email summary:', error);
      setEmailError('Failed to generate email summary. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  // Handler to send the email
  const handleSendEmail = async () => {
    setEmailLoading(true);
    setEmailError(null);
    
    try {
      // In a production app, you would typically send this to your backend
      // which would handle the actual email sending
      
      // For this POC, we'll simulate sending with a timeout
      // and then show a success message
      
      // For an actual implementation, you would use something like:
      // await axios.post('/api/send-email', emailContent);
      
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call
      
      // Show success message
      setEmailPreviewDialogOpen(false);
      
      // Display success alert
      setError({
        severity: 'success',
        message: `Email sent successfully to ${emailContent.recipientEmail}!`
      });
      
      // Clear selected date
      setSelectedDate(null);
    } catch (error) {
      console.error('Error sending email:', error);
      setEmailError('Failed to send email. Please try again later.');
    } finally {
      setEmailLoading(false);
    }
  };

  const renderActionTimeline = (bill) => {
    // Sort actions by date
    const sortedActions = sortActionsByDate(bill.actions || []);
    
    return (
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" gutterBottom>
          Action Timeline
        </Typography>
        
        {sortedActions.length === 0 ? (
          <Typography variant="body1">No actions recorded for this bill</Typography>
        ) : (
          <Box sx={{ position: 'relative', ml: 2, pt: 1, pb: 1 }}>
            {/* Vertical timeline line */}
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                bgcolor: 'primary.main',
                ml: -10,
              }}
            />
            
            {sortedActions.map((action, index) => {
              // Parse and validate the date
              const actionDate = action.date ? parseISO(action.date) : null;
              const isValidActionDate = actionDate && isValid(actionDate);
              
              return (
                <Box 
                  key={index}
                  sx={{ 
                    mb: 3, 
                    pb: 3, 
                    position: 'relative',
                    borderBottom: index < sortedActions.length - 1 ? 1 : 0,
                    borderColor: 'divider'
                  }}
                >
                  {/* Timeline node */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: -10,
                      top: 10,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      border: '2px solid',
                      borderColor: 'background.paper',
                      ml: -10,
                    }}
                  />
                  
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                    {isValidActionDate 
                      ? formatBillDate(actionDate)
                      : 'Date not available'}
                  </Typography>
                  
                  <Typography variant="body1" sx={{ mt: 1 }}>
                    {action.description || 'No description provided'}
                  </Typography>
                  {action.organization && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {action.organization.name || "Unknown organization"}
                    </Typography>
                  )}
                  
                  {isValidActionDate && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary', fontStyle: 'italic' }}>
                      {getTimeAgo(actionDate)}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
        
        {/* Add a legend for the timeline */}
        <Box mt={3} pt={2} borderTop={1} borderColor="divider">
          <Typography variant="subtitle2" gutterBottom>
            Time Zone Information
          </Typography>
          <Typography variant="body2" color="text.secondary">
            All dates are displayed in your local time zone. The original data is recorded in Puerto Rico time (AST, UTC-4).
          </Typography>
        </Box>
      </Paper>
    );
  };

  const renderSkeletons = () => {
    return Array(5).fill().map((_, i) => (
      <Card key={i} sx={{ mb: 3 }}>
        <CardContent>
          <Skeleton animation="wave" height={30} width="30%" sx={{ mb: 1 }} />
          <Skeleton animation="wave" height={40} width="90%" sx={{ mb: 2 }} />
          <Skeleton animation="wave" height={20} sx={{ mb: 1 }} />
          <Skeleton animation="wave" height={20} sx={{ mb: 1 }} />
          <Skeleton animation="wave" height={20} width="80%" sx={{ mb: 1 }} />
          <Divider sx={{ my: 2 }} />
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Skeleton animation="wave" height={24} width="70%" />
            </Grid>
            <Grid item xs={6}>
              <Skeleton animation="wave" height={24} width="70%" sx={{ ml: 'auto' }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    ));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <AppBar position="sticky" elevation={0} color="default">
          <Toolbar>
            <Box display="flex" alignItems="center" flexGrow={1}>
              <Typography variant="h6" component="div" sx={{ flexGrow: 0, display: 'flex', alignItems: 'center', mr: 2 }}>
                <ArticleIcon sx={{ mr: 1 }} />
                Tío Pepe Bills Tracker
              </Typography>
              
              <Box component="form" onSubmit={handleSearchSubmit} sx={{ flexGrow: 1, mx: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search bills..."
                  variant="outlined"
                  fullWidth
                  value={searchTerm}
                  onChange={handleSearchChange}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                    endAdornment: searchTerm && (
                      <InputAdornment position="end">
                        <IconButton 
                          size="small" 
                          onClick={() => setSearchTerm('')}
                          edge="end"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>
            
            <Tooltip title="Filter">
              <IconButton 
                color="inherit" 
                onClick={() => setFilterDrawerOpen(true)}
                sx={{ mr: 1 }}
              >
                <Badge 
                  color="secondary" 
                  variant="dot" 
                  invisible={!filters.classification && !filters.status && filters.dateRange === 'all'}
                >
                  <FilterListIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            
            <Tooltip title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}>
              <IconButton color="inherit" onClick={toggleDarkMode}>
                {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Generate Email Summary">
              <IconButton 
                color="inherit" 
                onClick={() => setEmailDialogOpen(true)}
                sx={{ ml: 1 }}
              >
                <MailIcon />
              </IconButton>
            </Tooltip>
          </Toolbar>
          
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            centered
            sx={{ 
              bgcolor: 'background.paper',
              '& .MuiTab-root': {
                minWidth: 120,
                fontWeight: 500,
              },
            }}
          >
            <Tab label="All Bills" />
            <Tab label="Bookmarked" />
            <Tab label="Recently Viewed" />
          </Tabs>
        </AppBar>

        <Container maxWidth="md" sx={{ flexGrow: 1, py: 4 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h4" component="h1">
              {tabValue === 0 ? 'Tío Pepes Magical Bills App' : 
               tabValue === 1 ? 'Bookmarked Bills' : 'Recently Viewed'}
            </Typography>
            
            <Box>
              <Button
                variant={activeView === 'cards' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setActiveView('cards')}
                sx={{ mr: 1 }}
              >
                Cards
              </Button>
              <Button
                variant={activeView === 'compact' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setActiveView('compact')}
              >
                Compact
              </Button>
            </Box>
          </Box>

          {error && error.message && (
            <Alert severity={error.severity || "error"} sx={{ mb: 3 }}>
              {error.message}
            </Alert>
          )}

          {loading && renderSkeletons()}

          {!loading && bills.length === 0 && (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No bills found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your search or filters
              </Typography>
            </Paper>
          )}

          {!loading && tabValue === 0 && (
            <>
              {/* Group bills by date and sort by priority within each date */}
              {Object.entries(groupBillsByDate(bills))
                // Sort date groups by date (newest first)
                .sort(([dateStrA, billsA], [dateStrB, billsB]) => {
                  // Handle "No Date" special case
                  if (dateStrA === 'No Date') return 1;
                  if (dateStrB === 'No Date') return -1;
                  
                  // Sort by the first bill's dateObj in each group
                  const dateA = billsA[0].dateObj;
                  const dateB = billsB[0].dateObj;
                  
                  // Both dates are valid
                  if (dateA && dateB) {
                    return dateB - dateA; // Newest first
                  }
                  
                  // Neither date is valid, sort by string
                  return dateStrB.localeCompare(dateStrA);
                })
                .map(([dateStr, dateBills]) => {
                  // Sort bills within each date group by priority (highest first)
                  const sortedBills = dateBills.sort((a, b) => b.priority - a.priority);
                  
                  return (
                    <Box key={dateStr} sx={{ mb: 4 }}>
                      <Paper 
                        elevation={0} 
                        sx={{ 
                          p: 2, 
                          mb: 2, 
                          bgcolor: 'background.default',
                          borderLeft: '4px solid',
                          borderColor: 'primary.main'
                        }}
                      >
                        <Typography variant="h6" color="text.secondary">
                          {dateStr}
                        </Typography>
                      </Paper>
                      
                      {sortedBills.map(bill => {
                        // Show priority actions with a highlight
                        const isPriorityAction = bill.priority > 1;
                        
                        return renderBillCard({
                          ...bill,
                          highlight: isPriorityAction
                        });
                      })}
                    </Box>
                  );
                })
              }
            </>
          )}
          
          {!loading && tabValue === 1 && (
            bookmarkedBills.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No bookmarked bills
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click the bookmark icon on any bill to save it here
                </Typography>
              </Paper>
            ) : (
              bills
                .filter(bill => bookmarkedBills.includes(bill.id))
                .map(renderBillCard)
            )
          )}
          
          {!loading && tabValue === 2 && (
            recentlyViewedBills.length === 0 ? (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No recently viewed bills
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Bills you view will appear here
                </Typography>
              </Paper>
            ) : (
              bills
                .filter(bill => recentlyViewedBills.includes(bill.id))
                .map(renderBillCard)
            )
          )}

          {bills.length > 0 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination 
                count={totalPages} 
                page={page} 
                onChange={(e, value) => setPage(value)}
                color="primary"
                shape="rounded"
                size="large"
              />
            </Box>
          )}
        </Container>
      </Box>

      {/* Bill Details Modal */}
      <Modal 
        open={open} 
        onClose={handleClose}
        aria-labelledby="bill-details-modal"
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: 1200,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            maxHeight: '90vh',
            overflowY: 'auto',
            p: 0,
          }}
        >
          {loading && (
            <Box p={4} textAlign="center">
              <CircularProgress />
            </Box>
          )}
          
        {!loading && selectedBill && (
          <>
            <AppBar position="sticky" sx={{ position: 'relative' }}>
              {/* AppBar content remains the same */}
            </AppBar>
            
            <Box p={4}>
              <Typography
                variant="h5"
                component="h2"
                gutterBottom
                sx={{ lineHeight: 1.4, mb: 3 }}
              >
                {selectedBill.title}
              </Typography>

              <Box mb={4}>
                <Grid container spacing={2}>
                  <Grid item>
                    <Chip 
                      label={getStatusChipProps(selectedBill).label} 
                      color={getStatusChipProps(selectedBill).color}
                      sx={{ fontWeight: 'bold' }}
                    />
                  </Grid>
                  {selectedBill.classification && (
                    <Grid item>
                      <Chip 
                        label={selectedBill.classification} 
                        variant="outlined"
                      />
                    </Grid>
                  )}
                  {selectedBill.subject && selectedBill.subject.length > 0 && (
                    <Grid item>
                      <Chip 
                        label={selectedBill.subject[0]} 
                        variant="outlined"
                        color="secondary"
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>

              <Tabs
                value={tabValue}
                onChange={handleTabChange}
                aria-label="bill details tabs"
                sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
              >
                <Tab label="Overview" icon={<DescriptionIcon />} iconPosition="start" />
                <Tab label="Timeline" icon={<TimelineIcon />} iconPosition="start" />
                <Tab label="Documents" icon={<ArticleIcon />} iconPosition="start" />
                <Tab label="Sponsors" icon={<PeopleIcon />} iconPosition="start" />
              </Tabs>

              {tabValue === 0 && (
                <Grid container spacing={4}>
                  <Grid item xs={12} md={6}>
                    {/* Replace the existing bill information section with our new component */}
                    {renderBillInformation(selectedBill)}

                    {/* Keep the Abstract section as is */}
                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Abstract
                      </Typography>
                      <Typography variant="body1">
                        {(selectedBill.abstracts && selectedBill.abstracts.length > 0) 
                          ? selectedBill.abstracts[0].abstract 
                          : 'No abstract available'}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Paper elevation={1} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Latest Action
                      </Typography>
                      {selectedBill.actions && selectedBill.actions.length > 0 ? (
                        <>
                          <Typography variant="body1" paragraph>
                            <strong>Date:</strong> {
                              formatBillDate(
                                selectedBill.actions[0].date, 
                                { convertToLocalTimezone: true }
                              )
                            }
                          </Typography>
                          <Typography variant="body1" paragraph>
                            <strong>Description:</strong> {selectedBill.actions[0].description}
                          </Typography>
                          <Typography variant="body1">
                            <strong>Organization:</strong> {selectedBill.actions[0].organization?.name || 'N/A'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body1">No actions recorded</Typography>
                      )}
                    </Paper>

                    <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                      <Typography variant="h6" gutterBottom>
                        Sources
                      </Typography>
                      <List dense>
                        {selectedBill.sources && selectedBill.sources.map((source, index) => (
                          <ListItem key={index} disablePadding sx={{ py: 1 }}>
                            <Link 
                              href={source.url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              underline="hover"
                            >
                              Source {index + 1}
                            </Link>
                          </ListItem>
                        ))}
                        {(!selectedBill.sources || selectedBill.sources.length === 0) && (
                          <ListItem disablePadding>
                            <Typography variant="body1">No sources available</Typography>
                          </ListItem>
                        )}
                      </List>
                    </Paper>
                  </Grid>
                </Grid>
              )}

                {tabValue === 1 && (
                  <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Action Timeline
                    </Typography>
                    <Box sx={{ position: 'relative', ml: 2, pt: 1, pb: 1 }}>
                      {/* Vertical timeline line */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          bgcolor: 'primary.main',
                          ml: -10,
                        }}
                      />
                      
                      {selectedBill.actions && selectedBill.actions.map((action, index) => (
                        <Box 
                          key={index}
                          sx={{ 
                            mb: 3, 
                            pb: 3, 
                            position: 'relative',
                            borderBottom: index < selectedBill.actions.length - 1 ? 1 : 0,
                            borderColor: 'divider'
                          }}
                        >
                          {/* Timeline node */}
                          <Box
                            sx={{
                              position: 'absolute',
                              left: -10,
                              top: 10,
                              width: 16,
                              height: 16,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              border: '2px solid',
                              borderColor: 'background.paper',
                              ml: -10,
                            }}
                          />
                          
                          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                            {formatDate(action.date)}
                          </Typography>
                          <Typography variant="body1" sx={{ mt: 1 }}>
                            {action.description}
                          </Typography>
                          {action.organization && (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                              {action.organization.name || "Unknown organization"}
                            </Typography>
                          )}
                        </Box>
                      ))}
                      
                      {(!selectedBill.actions || selectedBill.actions.length === 0) && (
                        <Typography variant="body1">No actions recorded for this bill</Typography>
                      )}
                    </Box>
                  </Paper>
                )}
                
                {tabValue === 2 && (
                  <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Bill Documents & Versions
                    </Typography>
                    
                    <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                      Versions
                    </Typography>
                    <List>
                      {selectedBill.versions && selectedBill.versions.map((version, index) => (
                        <ListItem 
                          key={index}
                          sx={{ 
                            p: 2, 
                            mb: 2, 
                            borderRadius: 1, 
                            bgcolor: 'background.default'
                          }}
                        >
                          <Grid container spacing={2} alignItems="center">
                            <Grid item>
                              <Avatar sx={{ bgcolor: 'primary.main' }}>
                                <DescriptionIcon />
                              </Avatar>
                            </Grid>
                            <Grid item xs>
                              <Typography variant="subtitle2">
                                {version.note || `Version ${index + 1}`}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(version.date)}
                              </Typography>
                            </Grid>
                            <Grid item>
                              <Button 
                                variant="outlined" 
                                size="small" 
                                component="a" 
                                href={version.url} 
                                target="_blank"
                                startIcon={<DownloadIcon />}
                              >
                                View
                              </Button>
                            </Grid>
                          </Grid>
                        </ListItem>
                      ))}
                      {(!selectedBill.versions || selectedBill.versions.length === 0) && (
                        <ListItem>
                          <Typography variant="body1">No versions available</Typography>
                        </ListItem>
                      )}
                    </List>
                    
                    <Typography variant="subtitle1" gutterBottom sx={{ mt: 4 }}>
                      Other Documents
                    </Typography>
                    <List>
                      {selectedBill.documents && selectedBill.documents.map((doc, index) => (
                        <ListItem 
                          key={index}
                          sx={{ 
                            p: 2, 
                            mb: 2, 
                            borderRadius: 1, 
                            bgcolor: 'background.default'
                          }}
                        >
                          <Grid container spacing={2} alignItems="center">
                            <Grid item>
                              <Avatar sx={{ bgcolor: 'secondary.main' }}>
                                <ArticleIcon />
                              </Avatar>
                            </Grid>
                            <Grid item xs>
                              <Typography variant="subtitle2">
                                {doc.note || `Document ${index + 1}`}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(doc.date)}
                              </Typography>
                            </Grid>
                            <Grid item>
                              <Button 
                                variant="outlined" 
                                size="small" 
                                component="a" 
                                href={doc.url} 
                                target="_blank"
                                startIcon={<DownloadIcon />}
                              >
                                View
                              </Button>
                            </Grid>
                          </Grid>
                        </ListItem>
                      ))}
                      {(!selectedBill.documents || selectedBill.documents.length === 0) && (
                        <ListItem>
                          <Typography variant="body1">No documents available</Typography>
                        </ListItem>
                      )}
                    </List>
                  </Paper>
                )}
                
                {tabValue === 3 && (
                  <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Bill Sponsors
                    </Typography>
                    <Grid container spacing={3}>
                      {selectedBill.sponsorships && selectedBill.sponsorships.map((sponsor, index) => (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Paper 
                            elevation={0} 
                            sx={{ 
                              p: 2, 
                              borderRadius: 2, 
                              bgcolor: 'background.default',
                              height: '100%'
                            }}
                          >
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                height: '100%'
                              }}
                            >
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  mb: 2 
                                }}
                              >
                                <Avatar
                                  sx={{
                                    bgcolor: 'primary.main',
                                    width: 40,
                                    height: 40,
                                    mr: 2,
                                  }}
                                >
                                  {sponsor.name && sponsor.name.charAt(0)}
                                </Avatar>
                                <Box>
                                  <Typography variant="subtitle1">
                                    {sponsor.name}
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    {sponsor.classification || 'Sponsor'}
                                  </Typography>
                                </Box>
                              </Box>
                              
                              {sponsor.primary && (
                                <Chip 
                                  label="Primary Sponsor" 
                                  color="primary" 
                                  size="small" 
                                  sx={{ alignSelf: 'flex-start', mb: 1 }}
                                />
                              )}
                              
                              {sponsor.entity_type && (
                                <Typography variant="body2" color="text.secondary">
                                  <strong>Type:</strong> {sponsor.entity_type}
                                </Typography>
                              )}
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                      {(!selectedBill.sponsorships || selectedBill.sponsorships.length === 0) && (
                        <Grid item xs={12}>
                          <Typography variant="body1">No sponsor information available</Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                )}
              </Box>
            </>
          )}
        </Box>
      </Modal>

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
      >
        <Box sx={{ width: 320, p: 3 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6">Filter Bills</Typography>
            <IconButton onClick={() => setFilterDrawerOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>Classification</InputLabel>
              <Select
                name="classification"
                value={filters.classification}
                onChange={handleFilterChange}
                label="Classification"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="bill">Bill</MenuItem>
                <MenuItem value="resolution">Resolution</MenuItem>
                <MenuItem value="concurrent resolution">Concurrent Resolution</MenuItem>
                <MenuItem value="joint resolution">Joint Resolution</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth variant="outlined" sx={{ mb: 3 }}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="passed">Passed</MenuItem>
                <MenuItem value="enacted">Enacted</MenuItem>
                <MenuItem value="vetoed">Vetoed</MenuItem>
                <MenuItem value="introduced">Introduced</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl fullWidth variant="outlined">
              <InputLabel>Date Range</InputLabel>
              <Select
                name="dateRange"
                value={filters.dateRange}
                onChange={handleFilterChange}
                label="Date Range"
              >
                <MenuItem value="all">All Time</MenuItem>
                <MenuItem value="week">Past Week</MenuItem>
                <MenuItem value="month">Past Month</MenuItem>
                <MenuItem value="year">Past Year</MenuItem>
              </Select>
            </FormControl>
          </Box>
          
          <Box display="flex" justifyContent="space-between">
            <Button 
              variant="outlined" 
              onClick={resetFilters}
            >
              Reset
            </Button>
            <Button 
              variant="contained" 
              onClick={applyFilters}
              color="primary"
            >
              Apply Filters
            </Button>
          </Box>
        </Box>
      </Drawer>

      {/* Email Date Selection Dialog */}
      <Dialog
        open={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        aria-labelledby="email-dialog-title"
      >
        <DialogTitle id="email-dialog-title">Select Date for Bill Summary</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select a date to generate a summary of bills with actions on that date.
          </DialogContentText>
          <Box sx={{ mt: 3 }}>
            <TextField
              id="date"
              label="Date"
              type="date"
              fullWidth
              value={selectedDate ? selectedDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const dateValue = e.target.value;
                if (dateValue) {
                  setSelectedDate(new Date(dateValue));
                } else {
                  setSelectedDate(null);
                }
              }}
              InputLabelProps={{
                shrink: true,
              }}
              inputProps={{
                max: new Date().toISOString().split('T')[0] // Disables future dates
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleGenerateEmailSummary} 
            disabled={!selectedDate}
            color="primary"
            variant="contained"
          >
            Generate Summary
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog
        open={emailPreviewDialogOpen}
        onClose={() => setEmailPreviewDialogOpen(false)}
        aria-labelledby="email-preview-dialog-title"
        maxWidth="md"
        fullWidth
      >
        <DialogTitle id="email-preview-dialog-title">Email Preview</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                <strong>To:</strong> {emailContent.recipientEmail}
              </Typography>
              <Typography variant="subtitle1" gutterBottom>
                <strong>Subject:</strong> {emailContent.subject}
              </Typography>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Typography variant="subtitle1" gutterBottom>
              <strong>Email Body:</strong>
            </Typography>
            
            {emailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
                <CircularProgress />
              </Box>
            ) : emailError ? (
              <Alert severity="error" sx={{ mt: 2 }}>
                {emailError}
              </Alert>
            ) : (
              <Paper 
                sx={{ 
                  p: 3, 
                  maxHeight: '400px', 
                  overflow: 'auto', 
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.300'
                }}
              >
                <div dangerouslySetInnerHTML={{ __html: emailContent.body }} />
              </Paper>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailPreviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSendEmail} 
            color="primary"
            variant="contained"
            disabled={emailLoading}
          >
            Send Email
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
}

export default App;