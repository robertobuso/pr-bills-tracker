// Import date-fns for better date handling
import { parseISO, format, isValid, compareDesc, isFuture, isAfter } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import {
  Typography,
  Box,
  Tooltip,
} from '@mui/material';

// Constants
const PUERTO_RICO_TIMEZONE = 'America/Puerto_Rico'; // AST (UTC-4)

/**
 * Extracts the most reliable date from a bill
 * Uses a cascading approach to find the best available date
 * @param {Object} bill - Bill object from API
 * @param {string} type - Type of date to extract ('latest', 'created', etc.)
 * @returns {Object} - { date: Date object or null, source: string describing where date came from }
 */
const extractBestDate = (bill, type = 'latest') => {
  if (!bill) return { date: null, source: 'no_bill' };

  // For latest action date, try multiple sources in order of reliability
  if (type === 'latest') {
    // 1. First check the actions array (most reliable source)
    if (bill.actions && bill.actions.length > 0) {
      // Sort actions by date descending to ensure we get the latest
      const sortedActions = [...bill.actions].sort((a, b) => {
        const dateA = a.date ? parseISO(a.date) : null;
        const dateB = b.date ? parseISO(b.date) : null;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        return compareDesc(dateA, dateB);
      });
      
      const latestAction = sortedActions[0];
      if (latestAction && latestAction.date) {
        const date = parseISO(latestAction.date);
        if (isValid(date) && !isFuture(date)) {
          return { 
            date, 
            source: 'actions_array',
            description: latestAction.description
          };
        }
      }
    }
    
    // 2. Try latest_action_date directly
    if (bill.latest_action_date) {
      const date = parseISO(bill.latest_action_date);
      if (isValid(date) && !isFuture(date)) {
        return { 
          date, 
          source: 'latest_action_date',
          description: bill.latest_action_description
        };
      }
    }
    
    // 3. Fall back to updated_at
    if (bill.updated_at) {
      const date = parseISO(bill.updated_at);
      if (isValid(date) && !isFuture(date)) {
        return { 
          date, 
          source: 'updated_at' 
        };
      }
    }
    
    // 4. Last resort: created_at
    if (bill.created_at) {
      const date = parseISO(bill.created_at);
      if (isValid(date)) {
        return { 
          date, 
          source: 'created_at' 
        };
      }
    }
  } else if (type === 'created') {
    // For bill creation/introduction date
    
    // 1. First try to find introduction action in the actions array
    if (bill.actions && bill.actions.length > 0) {
      const introductionAction = bill.actions.find(action => {
        const desc = action.description ? action.description.toLowerCase() : '';
        return desc.includes('introduced') || desc.includes('filed') || desc.includes('presentada');
      });
      
      if (introductionAction && introductionAction.date) {
        const date = parseISO(introductionAction.date);
        if (isValid(date)) {
          return { 
            date, 
            source: 'introduction_action',
            description: introductionAction.description 
          };
        }
      }
      
      // If no specific introduction action, try the earliest action
      const sortedActions = [...bill.actions].sort((a, b) => {
        const dateA = a.date ? parseISO(a.date) : null;
        const dateB = b.date ? parseISO(b.date) : null;
        
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        
        // Ascending order for earliest action
        return isAfter(dateA, dateB) ? 1 : -1;
      });
      
      const earliestAction = sortedActions[0];
      if (earliestAction && earliestAction.date) {
        const date = parseISO(earliestAction.date);
        if (isValid(date)) {
          return { 
            date, 
            source: 'earliest_action',
            description: earliestAction.description 
          };
        }
      }
    }
    
    // 2. Try created_at
    if (bill.created_at) {
      const date = parseISO(bill.created_at);
      if (isValid(date)) {
        return { 
          date, 
          source: 'created_at' 
        };
      }
    }
  } else if (type === 'passage') {
    // For latest passage date
    
    // 1. First try to find passage action in the actions array
    if (bill.actions && bill.actions.length > 0) {
      const passageAction = bill.actions.find(action => {
        const desc = action.description ? action.description.toLowerCase() : '';
        return desc.includes('passed') || desc.includes('approved') || 
               desc.includes('aprobado') || desc.includes('votación') || 
               desc.includes('enacted') || desc.includes('signed');
      });
      
      if (passageAction && passageAction.date) {
        const date = parseISO(passageAction.date);
        if (isValid(date)) {
          return { 
            date, 
            source: 'passage_action',
            description: passageAction.description
          };
        }
      }
    }
    
    // 2. Try latest_passage_date
    if (bill.latest_passage_date) {
      const date = parseISO(bill.latest_passage_date);
      if (isValid(date) && !isFuture(date)) {
        return { 
          date, 
          source: 'latest_passage_date'
        };
      }
    }
  }
  
  // No valid date found
  return { date: null, source: 'not_found' };
};

/**
 * Format a date in a user-friendly way with appropriate fallbacks
 * @param {Date|string} date - Date object or string to format
 * @param {Object} options - Additional options
 * @returns {string} - Formatted date string or fallback message
 */
const formatBillDate = (date, options = {}) => {
  const {
    fallbackText = 'Not available',
    format: formatStr = 'MMMM d, yyyy',
    includeTime = false,
    convertToLocalTimezone = false
  } = options;
  
  if (!date) return fallbackText;
  
  try {
    let dateObj;
    
    // Convert string to Date if needed
    if (typeof date === 'string') {
      dateObj = parseISO(date);
    } else if (date instanceof Date) {
      dateObj = date;
    } else {
      return fallbackText;
    }
    
    // Validate date
    if (!isValid(dateObj)) {
      console.warn(`Invalid date: ${date}`);
      return fallbackText;
    }
    
    // Handle timezone conversion if requested
    if (convertToLocalTimezone) {
      // Get the user's timezone
      const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      
      // First convert to Puerto Rico time zone, then format in user's timezone
      return formatInTimeZone(dateObj, userTimeZone, 
        includeTime ? `${formatStr} 'at' h:mm a` : formatStr
      );
    }
    
    // Format the date
    const formattedDate = format(
      dateObj, 
      includeTime ? `${formatStr} 'at' h:mm a` : formatStr
    );
    
    return formattedDate;
  } catch (error) {
    console.error(`Error formatting date: ${date}`, error);
    return fallbackText;
  }
};

/**
 * Get a human-readable time ago string (e.g., "2 days ago")
 * @param {Date} date - Date to format
 * @returns {string} - Formatted string or fallback
 */
const getTimeAgo = (date) => {
  if (!date || !isValid(date)) return '';
  
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }
  
  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  }
  
  // Less than a day
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  }
  
  // Less than a week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }
  
  // Less than a month
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  }
  
  // Less than a year
  if (diffInSeconds < 31536000) {
    const months = Math.floor(diffInSeconds / 2592000);
    return `${months} month${months !== 1 ? 's' : ''} ago`;
  }
  
  // More than a year
  const years = Math.floor(diffInSeconds / 31536000);
  return `${years} year${years !== 1 ? 's' : ''} ago`;
};

/**
 * Sort actions by date (newest first) with proper error handling
 * @param {Array} actions - Array of action objects
 * @returns {Array} - Sorted array of actions
 */
const sortActionsByDate = (actions) => {
  if (!actions || !Array.isArray(actions)) return [];
  
  return [...actions].sort((a, b) => {
    const dateA = a.date ? parseISO(a.date) : null;
    const dateB = b.date ? parseISO(b.date) : null;
    
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    
    return compareDesc(dateA, dateB);
  });
};

/**
 * Group bills by relative dates with improved error handling
 * @param {Array} bills - Array of bill objects
 * @returns {Object} - Bills grouped by date categories
 */
const groupBillsByRelativeDate = (bills) => {
  if (!bills || !Array.isArray(bills)) return {};
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const lastWeekStart = new Date(today);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const lastMonthStart = new Date(today);
  lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
  
  return bills.reduce((groups, bill) => {
    // Extract the best date for grouping
    const { date: dateObj, source } = extractBestDate(bill, 'latest');
    
    let groupKey = 'No Date';
    
    if (dateObj && isValid(dateObj)) {
      // Create the date at midnight for comparison
      const dateAtMidnight = new Date(dateObj);
      dateAtMidnight.setHours(0, 0, 0, 0);
      
      // Determine the appropriate group
      if (isSameDay(dateAtMidnight, today)) {
        groupKey = 'Today';
      } else if (isSameDay(dateAtMidnight, yesterday)) {
        groupKey = 'Yesterday';
      } else if (isAfter(dateAtMidnight, lastWeekStart)) {
        groupKey = 'This Week';
      } else if (isAfter(dateAtMidnight, lastMonthStart)) {
        groupKey = 'This Month';
      } else {
        // Format by month and year for older dates
        groupKey = format(dateObj, 'MMMM yyyy');
      }
    }
    
    // Create the group if it doesn't exist
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    
    // Add the bill to the group with source metadata
    groups[groupKey].push({
      ...bill,
      dateMeta: {
        dateObj,
        source,
        formattedDate: dateObj ? formatBillDate(dateObj) : 'Not available',
        timeAgo: dateObj ? getTimeAgo(dateObj) : ''
      }
    });
    
    return groups;
  }, {});
};

/**
 * Check if two dates are the same day
 * @param {Date} dateA - First date
 * @param {Date} dateB - Second date
 * @returns {boolean} - Whether dates are the same day
 */
const isSameDay = (dateA, dateB) => {
  return dateA.getFullYear() === dateB.getFullYear() &&
         dateA.getMonth() === dateB.getMonth() &&
         dateA.getDate() === dateB.getDate();
};

// Display component for dates with appropriate styling based on reliability
const DateDisplay = ({ date, fallback = 'Not available', showReliabilityIndicator = false }) => {
  if (!date || !date.date) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        {fallback}
      </Typography>
    );
  }
  
  // Determine reliability based on source
  let reliability = 'high';
  if (date.source === 'created_at' || date.source === 'updated_at') {
    reliability = 'medium';
  } else if (date.source === 'not_found' || !date.date) {
    reliability = 'low';
  }
  
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {formatBillDate(date.date)}
      </Typography>
      
      {showReliabilityIndicator && (
        <Tooltip title={`Source: ${date.source}`}>
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              ml: 1,
              bgcolor: 
                reliability === 'high' ? 'success.main' :
                reliability === 'medium' ? 'warning.main' : 'error.main'
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export {
  extractBestDate,
  formatBillDate,
  getTimeAgo,
  sortActionsByDate,
  groupBillsByRelativeDate,
  DateDisplay
};