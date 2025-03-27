import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import EventosView from './components/EventosView';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import ArticleIcon from '@mui/icons-material/Article';
import TimelineIcon from '@mui/icons-material/Timeline';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EventIcon from '@mui/icons-material/Event';
import RefreshIcon from '@mui/icons-material/Refresh';

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
  const initialRenderRef = useRef(true);
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
  const [hasSearched, setHasSearched] = useState(false);
  const [introDateDialogOpen, setIntroDateDialogOpen] = useState(false);
  const [selectedIntroDate, setSelectedIntroDate] = useState(null);
  const [introDateLoading, setIntroDateLoading] = useState(false);

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
        // Log search state for debugging
        console.log('Search state:', { searchTerm, hasSearched });
        
        let url = `${BASE_URL}/bills?jurisdiction=ocd-jurisdiction%2Fcountry%3Aus%2Fterritory%3Apr%2Fgovernment&sort=latest_action_desc&include=sponsorships&include=abstracts&include=other_titles&include=other_identifiers&include=actions&include=sources&include=documents&include=versions&include=votes&include=related_bills&page=${page}&per_page=10&apikey=${API_KEY}`;
        
        // IMPORTANT: Add search parameter - using q instead of query
        if (searchTerm) {
          url += `&q=${encodeURIComponent(searchTerm)}`;
          console.log(`Adding search parameter q=${encodeURIComponent(searchTerm)}`);
        }
        
        // Add filters
        if (filters.classification) {
          url += `&classification=${encodeURIComponent(filters.classification)}`;
        }
        
        console.log('FINAL URL:', url);
        const requestId = Math.random().toString(36).substring(7);
        console.log(`[${requestId}] Making API request to OpenStates:`, url);
    
        const response = await axios.get(url);
        console.log(`[${requestId}] Received API response with ${response.data.results.length} bills`);
    
        setBills(response.data.results);
        
        // Calculate total pages
        const totalItems = response.data.pagination.total_items;
        const perPage = response.data.pagination.per_page;
        setTotalPages(Math.ceil(totalItems / perPage));
      } catch (err) {
        console.error('Error fetching bills:', err);
        setError({
          severity: 'error',
          message: 'Failed to load bills. Please try again later.'
        });
      } finally {
        setLoading(false);
      }
    }, [page, searchTerm, filters.classification]); // Note: hasSearched is not needed in dependencies if we use searchTerm directly

    useEffect(() => {
      // Handle first render
      if (initialRenderRef.current) {
        console.log('INITIAL RENDER - Performing initial fetch');
        initialRenderRef.current = false;
        
        // Do initial fetch
        const initialFetch = async () => {
          try {
            console.log('Performing initial data fetch...');
            setLoading(true);
            
            const initialUrl = `${BASE_URL}/bills?jurisdiction=ocd-jurisdiction%2Fcountry%3Aus%2Fterritory%3Apr%2Fgovernment&sort=latest_action_desc&include=sponsorships&include=abstracts&include=other_titles&include=other_identifiers&include=actions&include=sources&include=documents&include=versions&include=votes&include=related_bills&page=1&per_page=10&apikey=${API_KEY}`;
            
            const response = await axios.get(initialUrl);
            console.log(`Initial fetch successful, got ${response.data.results.length} bills`);
            
            setBills(response.data.results);
            setTotalPages(Math.ceil(response.data.pagination.total_items / response.data.pagination.per_page));
            setLoading(false);
          } catch (error) {
            console.error('Initial fetch failed:', error);
            setError({
              severity: 'error',
              message: 'Failed to load initial data. Please refresh the page.'
            });
            setLoading(false);
          }
        };
        
        initialFetch();
        return;
      }
      
      // IMPORTANT: Only fetch when page or filters change
      // NOT when searchTerm changes
      console.log('Page or filter changed - fetching new data');
      if (page > 1 || filters.classification) {
        fetchBills();
      }
      
    }, [page, filters.classification]); // Specifically remove searchTerm from dependencies
  
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

  const handleOpen = async (billId) => {
    console.log("handleOpen called with billId:", billId);
    setLoading(true);
    setError(null);

    try {
      // Use our updated fetchBillDetailsWithScraper that returns initial data quickly
      const billWithInitialData = await fetchBillDetailsWithScraper(billId);
      
      // Set the bill with initial data to show the modal immediately
      setSelectedBill(billWithInitialData);
      setOpen(true);
      
      // Note: The rest of the data will load in the background and update
      // the state automatically via the loadSutraData function.
      
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

   // Handle URL parameters
   useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const billId = queryParams.get('billId');
    
    if (billId) {
      handleOpen(billId);
    }
  }, [handleOpen]);  // Empty dependency array ensures this only runs once on mount

  const handleDocumentLoad = async (documentUrl) => {
    return handleDocumentLoadParent(documentUrl); // Simply call the parent handler
  };

  const handleDocumentLoadParent = async (documentUrl) => {
    try {
      console.log(`Parent document load handler called for: ${documentUrl}`);
      
      // If document is already downloaded, just return it
      if (selectedBill?.eventos) {
        // Check if this document is already loaded in any evento
        for (const evento of selectedBill.eventos) {
          if (evento.documents) {
            const existingDoc = evento.documents.find(doc =>
              doc.link_url === documentUrl && doc.downloaded);

            if (existingDoc) {
              console.log(`Document already downloaded: ${documentUrl}`);
              return existingDoc;
            }
          }
        }
      }

      // Document not loaded, fetch it now
      console.log(`Loading document on demand: ${documentUrl}`);

      // Call our document loading function
      const result = await loadDocumentOnDemand(documentUrl);
      
      // Ensure the downloaded flag is set
      result.downloaded = !result.error;
      
      // Update the document in all eventos where it appears
      if (!result.error) {
        console.log(`Document loaded successfully:`, result);
        
        const updatedBill = { ...selectedBill };
        let updatedAnyDocument = false;

        if (updatedBill.eventos) {
          updatedBill.eventos = updatedBill.eventos.map(evento => {
            if (!evento.documents) return evento;

            const updatedDocuments = evento.documents.map(doc => {
              if (doc.link_url === documentUrl) {
                updatedAnyDocument = true;
                // Merge the result with the existing document
                return { ...doc, ...result };
              }
              return doc;
            });

            return { ...evento, documents: updatedDocuments };
          });
        }

        if (updatedAnyDocument) {
          console.log(`Updated bill documents in state`);
          setSelectedBill(updatedBill);
        }
      } else {
        console.error(`Error loading document:`, result.error);
      }

      return result;
    } catch (error) {
      console.error(`Error in document load parent handler: ${error.message}`);
      return {
        link_url: documentUrl,
        error: error.message || 'Failed to load document',
        downloaded: false
      };
    }
  }; 

  const handleClose = () => {
    setOpen(false);
    setTabValue(0); // Reset to All Bills tab when modal closes
  };

  const fetchBillDetailsWithScraper = async (billId) => {
    try {
      console.log(`Fetching detailed information for bill ID: ${billId}`);
      
      // Step 1: Get basic bill data from the OpenStates API
      const detailsURL = `${BASE_URL}/bills/${billId}?include=sponsorships&include=abstracts&include=other_titles&include=other_identifiers&include=actions&include=sources&include=documents&include=versions&include=votes&include=related_bills&apikey=${API_KEY}`;
      console.log(`Requesting OpenStates API: ${detailsURL}`);
      
      const response = await axios.get(detailsURL);
      const openStatesBill = response.data;
      
      // Preprocess the bill data with rich date metadata
      const processedBill = {
        ...openStatesBill,
        processedDates: {
          latest: extractBestDate(openStatesBill, 'latest'),
          created: extractBestDate(openStatesBill, 'created'),
          passage: extractBestDate(openStatesBill, 'passage')
        },
        loading: {
          timeline: true, // Set timeline to loading state initially
          documents: true // Set documents to loading state initially
        }
      };
      
      // Sort actions array by date for timeline consistency
      if (processedBill.actions && Array.isArray(processedBill.actions)) {
        processedBill.actions = sortActionsByDate(processedBill.actions);
      }
      
      // Create a fallback eventos array from actions
      processedBill.eventos = processedBill.actions && processedBill.actions.length > 0 
        ? processedBill.actions.map(action => ({
            descripcion: action.description,
            fecha: action.date,
            tipo: 'tramite',
            comision: action.organization ? action.organization.name : null,
            documents: []
          }))
        : [];
      
      // Step 2: Find SUTRA URL from the sources array
      let sutraUrl = null;
      if (openStatesBill.sources && Array.isArray(openStatesBill.sources)) {
        console.log(`Bill has ${openStatesBill.sources.length} source URLs to check`);
        
        // Look for URLs containing 'sutra' in the sources array
        for (const source of openStatesBill.sources) {
          if (source.url && typeof source.url === 'string' && 
              (source.url.toLowerCase().includes('sutra') || 
              source.url.toLowerCase().includes('oslpr'))) {
            sutraUrl = source.url;
            console.log(`Found SUTRA URL: ${sutraUrl}`);
            break;
          }
        }
      }
      
      // If we couldn't find a SUTRA URL, return the basic data
      if (!sutraUrl) {
        console.warn(`No SUTRA URL found for bill ${billId}. Using only OpenStates data.`);
        processedBill.loading.timeline = false;
        processedBill.loading.documents = false;
        return processedBill;
      }
      
      // Step 3: Start loading the bill data and immediately return the basic data
      // Note: We'll continue loading in the background
      loadSutraData(sutraUrl, processedBill); // Runs in background
      
      // Return the basic bill with loading indicators
      return processedBill;
    } catch (error) {
      console.error('Error in fetchBillDetailsWithScraper:', error);
      throw error;
    }
  };

  // New function to load SUTRA data in the background and update the state when complete
  const loadSutraData = async (sutraUrl, processedBill) => {
    try {
      console.log(`Calling fast scraper endpoint with URL: ${sutraUrl}`);
      
      // Get the backend URL - handle both development and production
      const backendUrl = process.env.NODE_ENV === 'production' 
        ? '/api/fast-bill-info'  // In production, use relative URL
        : 'http://localhost:3001/api/fast-bill-info';  // In development
      
      // Call the fast scraper endpoint
      const scraperResponse = await axios.post(backendUrl, {
        sutraUrl: sutraUrl
      }, {
        timeout: 5000 // 5 second timeout for fast scraper
      });
      
      // Check if scraper response was successful
      if (scraperResponse.data && scraperResponse.data.success !== false) {
        console.log(`Fast scraper successful in ${scraperResponse.data.scrape_time} seconds`);
        
        // Update the bill data with the scraper results
        const updatedBill = {
          ...processedBill,
          eventos: scraperResponse.data.eventos || processedBill.eventos,
          comisiones: scraperResponse.data.comisiones || processedBill.comisiones || [],
          measure_number: scraperResponse.data.measure_number || processedBill.measure_number,
          title: scraperResponse.data.title || processedBill.title,
          filing_date: scraperResponse.data.filing_date || processedBill.filing_date,
          authors: scraperResponse.data.authors || processedBill.authors,
          loading: {
            ...processedBill.loading,
            timeline: false // Mark timeline as loaded
          }
        };
        
        // Update the selectedBill state with the new data
        setSelectedBill(updatedBill);
        
        console.log(`Updated bill data with ${updatedBill.eventos?.length || 0} eventos`);
        return updatedBill;
      } else {
        // If scraper failed but returned a response, log the error
        if (scraperResponse.data && scraperResponse.data.error) {
          console.error(`Scraper error: ${scraperResponse.data.error}`);
        } else {
          console.error(`Scraper failed with unknown error`);
        }
        
        // Mark loading as complete even though it failed
        const updatedBill = {
          ...processedBill,
          loading: {
            ...processedBill.loading,
            timeline: false,
            documents: false
          }
        };
        
        setSelectedBill(updatedBill);
        return updatedBill;
      }
    } catch (error) {
      console.error('Error calling fast scraper:', error);
      
      // Mark loading as complete even though it failed
      const updatedBill = {
        ...processedBill,
        loading: {
          ...processedBill.loading,
          timeline: false,
          documents: false
        },
        error: {
          timeline: true,
          message: error.message || 'Failed to load additional bill data'
        }
      };
      
      setSelectedBill(updatedBill);
      return updatedBill;
    }
  };

  const loadDocumentOnDemand = async (documentUrl) => {
    try {
      console.log(`Loading document on demand: ${documentUrl}`);
      
      // Get the file extension
      const fileExt = documentUrl.split('.').pop().toLowerCase();
      
      // Handle Word documents (DOC and DOCX) using Google Docs Viewer
      if (fileExt === 'doc' || fileExt === 'docx') {
        console.log(`${fileExt.toUpperCase()} file detected, using Google Docs Viewer`);
        
        // For Word documents, use Google Docs Viewer
        const googleDocsViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(documentUrl)}&embedded=true`;
        
        return {
          link_url: documentUrl,
          viewer_url: googleDocsViewerUrl,
          description: documentUrl.split('/').pop(),
          downloaded: true,
          fileType: fileExt,
          error: null
        };
      }
      
      // For PDFs and other file types, use the proxy approach (which works well)
      const backendUrl = process.env.NODE_ENV === 'production' 
        ? '/api/proxy-document'
        : 'http://localhost:3001/api/proxy-document';
      
      const proxyUrl = `${backendUrl}?url=${encodeURIComponent(documentUrl)}`;
      
      console.log(`Document will be loaded via proxy: ${proxyUrl}`);
      
      return {
        link_url: documentUrl,
        proxy_url: proxyUrl,
        description: documentUrl.split('/').pop(),
        downloaded: true,
        fileType: fileExt,
        error: null
      };
    } catch (error) {
      console.error(`Error preparing document URL: ${error.message}`);
      return {
        link_url: documentUrl,
        error: error.message || 'Failed to load document',
        downloaded: false
      };
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
    const newValue = event.target.value;
    console.log('Search input changed to:', newValue);
    setSearchTerm(newValue);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    console.log('Search form submitted with term:', searchTerm);
    setPage(1); // Reset to first page
    
    // Use setTimeout to ensure state is updated before fetchBills
    setTimeout(() => {
      fetchBills(); // This will use the current searchTerm
    }, 0);
  };

  const clearSearch = () => {
    console.log('Clearing search');
    setSearchTerm('');
    setPage(1);
    
    // Use setTimeout to ensure searchTerm is cleared before fetching
    setTimeout(() => {
      fetchBills(); // Will fetch without search term
    }, 0);
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
    const yesterday = new Date(today.getTime() - (24 * 60 * 60 * 1000));
    
    return bills.reduce((groups, bill) => {
      // Extract the best date for this bill with rich metadata
      const { date: dateObj, source, description } = extractBestDate(bill, 'latest');
      
      let dateStr = 'No Date Available';
      
      if (dateObj && isValid(dateObj)) {
        // Normalize dates to midnight for comparison
        const dateMidnight = new Date(dateObj);
        dateMidnight.setHours(0, 0, 0, 0);
        
        // Today's date at midnight
        const todayMidnight = new Date(today);
        todayMidnight.setHours(0, 0, 0, 0);
        
        // Yesterday's date at midnight
        const yesterdayMidnight = new Date(yesterday);
        yesterdayMidnight.setHours(0, 0, 0, 0);
        
        // Compare dates using time values for precise equality
        if (dateMidnight.getTime() === todayMidnight.getTime()) {
          dateStr = 'Today';
        } else if (dateMidnight.getTime() === yesterdayMidnight.getTime()) {
          dateStr = 'Yesterday';
        } else {
          // For older dates, format by date
          dateStr = formatBillDate(dateObj);
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
        key={bill.id} // Make sure this key is unique
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
                  {/* Display measure_number if available, otherwise fall back to identifier */}
                  {bill.measure_number || bill.identifier}
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
                    label={bill.status || statusChip.label} 
                    color={statusChip.color} 
                    size="small" 
                    sx={{ fontWeight: 'bold' }}
                  />
                </Box>
              </Box>
              
              <Typography variant="h6" component="h3" gutterBottom>
                {/* Use title from SUTRA if available, otherwise fall back to OpenStates title */}
                {truncateTitle(bill.title)}
              </Typography>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary" paragraph>
                {bill.authors ? 
                  `Authors: ${bill.authors}` : 
                  (bill.abstracts && bill.abstracts.length > 0 ? 
                    bill.abstracts[0].abstract.substring(0, 200) + 
                    (bill.abstracts[0].abstract.length > 200 ? '...' : '') : 
                    'No abstract available')}
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
                      {bill.filing_date || (latestActionDate.date 
                        ? formatBillDate(latestActionDate.date) 
                        : 'Date not available')}
                    </Typography>
                    {timeAgo && !bill.filing_date && (
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
                  {bill.status || bill.latest_action_description || 'Radicado'}
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

  const searchBillsByIntroDate = async () => {
    if (!selectedIntroDate) return;
    
    try {
      setIntroDateLoading(true);
      
      // Format date to YYYY-MM-DD for the API
      const formattedDate = selectedIntroDate.toISOString().split('T')[0];
      
      const backendUrl = process.env.NODE_ENV === 'production'
        ? '/api/bills-by-introduction-date'
        : 'http://localhost:3001/api/bills-by-introduction-date';
      
      const response = await axios.post(backendUrl, { date: formattedDate });
      
      if (response.data.success) {
        // Update the displayed bills
        setBills(response.data.bills);
        setIntroDateDialogOpen(false);
        
        // Show success message
        setError({
          severity: 'success',
          message: `Found ${response.data.count} bills introduced on ${formattedDate}`
        });
      } else {
        throw new Error(response.data.error || 'Unknown error');
      }
    } catch (err) {
      setError({
        severity: 'error',
        message: `Error searching for bills: ${err.message}`
      });
    } finally {
      setIntroDateLoading(false);
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
              
              <Box component="form" onSubmit={handleSearchSubmit} sx={{ flexGrow: 1, mx: 2, display: 'flex' }}>
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
                    endAdornment: searchTerm ? (
                      <InputAdornment position="end">
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            clearSearch();
                          }}
                          edge="end"
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  }}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary"
                  disabled={loading || !searchTerm}
                  sx={{ ml: 1 }}
                >
                  {loading ? <CircularProgress size={20} /> : "Search"}
                </Button>
              </Box>
              {searchTerm && hasSearched && !loading && (
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {bills.length > 0 
                      ? `Found ${bills.length} results for "${searchTerm}"`
                      : `No results found for "${searchTerm}"`}
                  </Typography>
                </Box>
              )}
              {hasSearched && (
                <Box sx={{ my: 2 }}>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      setSearchTerm('');
                      setHasSearched(false);
                      setPage(1);
                      fetchBills();
                    }}
                  >
                    Clear Search
                  </Button>
                </Box>
              )}
            </Box>
            
            <Tooltip title="Find Bills by Introduction Date">
              <IconButton 
                color="inherit" 
                onClick={() => setIntroDateDialogOpen(true)}
                sx={{ ml: 1 }}
              >
                <EventIcon />
              </IconButton>
            </Tooltip>

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

              {tabValue === 1 && selectedBill && (
                  <EventosView 
                    eventos={selectedBill.eventos} 
                    isLoading={selectedBill.loading?.timeline}
                    onDocumentLoad={handleDocumentLoadParent} // Use the new parent handler
                  />
                )}
              
              {tabValue === 2 && (
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

      {/* Introduction Date Dialog */}
      <Dialog
        open={introDateDialogOpen}
        onClose={() => setIntroDateDialogOpen(false)}
        aria-labelledby="intro-date-dialog-title"
      >
        <DialogTitle id="intro-date-dialog-title">Find Bills by Introduction Date</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Select a date to find bills that were introduced ("Radicado") on that day.
          </DialogContentText>
          <Box sx={{ mt: 3 }}>
            <TextField
              id="intro-date"
              label="Introduction Date"
              type="date"
              fullWidth
              value={selectedIntroDate ? selectedIntroDate.toISOString().split('T')[0] : ''}
              onChange={(e) => {
                const dateValue = e.target.value;
                if (dateValue) {
                  setSelectedIntroDate(new Date(dateValue));
                } else {
                  setSelectedIntroDate(null);
                }
              }}
              InputLabelProps={{
                shrink: true,
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIntroDateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={searchBillsByIntroDate} 
            disabled={!selectedIntroDate || introDateLoading}
            color="primary"
            variant="contained"
            startIcon={introDateLoading ? <CircularProgress size={20} /> : <SearchIcon />}
          >
            {introDateLoading ? 'Searching...' : 'Search'}
          </Button>
        </DialogActions>
      </Dialog>

    </ThemeProvider>
  );
}

export default App;