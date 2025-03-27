#!/usr/bin/env python3
"""
SUTRA Date Search Scraper - Extracts bills filed on a specific date
"""

import requests
from bs4 import BeautifulSoup
import json
import sys
import re
import logging
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("date_search_scraper.log"), logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

def scrape_bills_by_date(date_str):
    """
    Scrapes bills introduced on a specific date from SUTRA.
    
    Args:
        date_str: Date string in YYYY-MM-DD format
    
    Returns:
        Dictionary with scraped bill data
    """
    
    # Validate the date format
    try:
        # Parse the date to validate format
        target_date = datetime.strptime(date_str, '%Y-%m-%d')
        
        # Get the day before for desde_date
        day_before = target_date - timedelta(days=1)
        
        # Format dates for URL
        desde_date = day_before.strftime('%Y-%m-%d')
        hasta_date = target_date.strftime('%Y-%m-%d')
        
        # Get current year for cuatrienio_id - usually a 4-year legislative term
        current_year = datetime.now().year
        cuatrienio_id = current_year
        
    except ValueError:
        logger.error(f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD")
        return {
            "success": False,
            "error": f"Invalid date format: {date_str}. Expected format: YYYY-MM-DD",
            "bills": []
        }
    
    # Base URL for search
    base_url = f"https://sutra.oslpr.org/medidas?cuatrienio_id={cuatrienio_id}&fecha_radicacion_desde={desde_date}&fecha_radicacion_hasta={hasta_date}"
    
    logger.info(f"Searching for bills introduced on {date_str}")
    logger.info(f"Date range: from {desde_date} to {hasta_date}")
    logger.info(f"Base URL: {base_url}")
    
    all_bills = []
    
    try:
        # Set up headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        
        # Start with page 1
        current_page = 1
        has_more_pages = True
        
        # Process pages until we've gone through all of them
        while has_more_pages:
            # Construct URL with page parameter if needed
            page_url = f"{base_url}&page={current_page}" if current_page > 1 else base_url
            
            logger.info(f"Scraping page {current_page}: {page_url}")
            
            # Make the request
            response = requests.get(page_url, headers=headers, timeout=30)
            response.raise_for_status()  # Raise exception for HTTP errors
            
            # Parse the HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find all bill items on the page
            bill_items = soup.find_all('li', class_=lambda c: c and 'relative border border-zinc-400' in c)
            
            logger.info(f"Found {len(bill_items)} bill items on page {current_page}")
            
            # If no bills found on this page, we've reached the end
            if len(bill_items) == 0:
                has_more_pages = False
                logger.info(f"No more bills found on page {current_page}")
                break
                
            # Process bills on this page
            for item in bill_items:
                bill_data = {}
                
                # Extract bill number/identifier
                bill_number_elem = item.find('h1', class_=lambda c: c and 'text-2xl' in c)
                if bill_number_elem:
                    # Find the "Medida:" text
                    medida_span = bill_number_elem.find('span', class_='font-bold')
                    if medida_span and "Medida:" in medida_span.get_text():
                        # Get the text content and clean it
                        bill_measure = bill_number_elem.get_text(strip=True)
                        bill_data['measure_number'] = bill_measure.replace("Medida:", "").strip()
                
                # Extract filing date
                filing_date_elem = item.find('strong', string=lambda s: s and 'Radicada:' in s)
                if filing_date_elem and filing_date_elem.parent:
                    filing_date = filing_date_elem.parent.get_text(strip=True)
                    bill_data['filing_date'] = filing_date.replace("Radicada:", "").strip()
                    
                    # Validate this bill was actually filed on our target date
                    try:
                        # Sometimes the date formats can be different, handle both MM/DD/YYYY and YYYY-MM-DD
                        if '/' in bill_data['filing_date']:
                            filing_date_obj = datetime.strptime(bill_data['filing_date'], '%m/%d/%Y')
                        else:
                            filing_date_obj = datetime.strptime(bill_data['filing_date'], '%Y-%m-%d')
                            
                        # Skip this bill if it wasn't filed on our target date
                        if filing_date_obj.date() != target_date.date():
                            logger.warning(f"Bill {bill_data.get('measure_number', 'unknown')} has filing date {bill_data['filing_date']} which doesn't match target date {date_str}")
                            continue
                    except ValueError:
                        # If we can't parse the date, include it anyway
                        logger.warning(f"Couldn't parse filing date: {bill_data['filing_date']}")
                
                # Extract authors
                authors_elem = item.find('strong', string=lambda s: s and 'Autor(es):' in s)
                if authors_elem and authors_elem.parent:
                    authors_span = authors_elem.parent.find('span', class_='text-xs')
                    if authors_span:
                        bill_data['authors'] = authors_span.get_text(strip=True)
                
                # Extract title
                title_elem = item.find('strong', string=lambda s: s and 'Título:' in s)
                if title_elem and title_elem.parent:
                    title_text = title_elem.parent.get_text(strip=True)
                    bill_data['title'] = title_text.replace("Título:", "").strip()
                
                # Extract URL
                link_elem = item.parent if item.name == 'li' else item
                if link_elem.name == 'a' and link_elem.has_attr('href'):
                    bill_url = link_elem['href']
                    if not bill_url.startswith('http'):
                        bill_url = f"https://sutra.oslpr.org{bill_url}"
                    bill_data['url'] = bill_url
                    
                    # Extract bill ID from URL
                    bill_id_match = re.search(r'medidas/(\d+)', bill_url)
                    if bill_id_match:
                        bill_data['id'] = bill_id_match.group(1)
                
                # Extract status
                status_elem = item.find('span', class_='text-xs font-bold text-white')
                if status_elem:
                    bill_data['status'] = status_elem.get_text(strip=True)
                
                if bill_data and bill_data.get('measure_number'):  # Only add if we have at least a measure number
                    all_bills.append(bill_data)
            
            # Check if there's a "next page" link
            next_page_link = soup.find('a', attrs={'aria-label': 'Página Siguiente'})
            if not next_page_link or 'disabled' in next_page_link.get('class', []):
                has_more_pages = False
                logger.info(f"No next page link found, stopping at page {current_page}")
            else:
                current_page += 1
                logger.info(f"Moving to page {current_page}")
                
                # # Add a small delay between pages to be respectful
                # time.sleep(1)
        
        logger.info(f"Total bills collected: {len(all_bills)}")
        
        result = {
            "success": True,
            "bills": all_bills,
            "count": len(all_bills),
            "search_date": date_str,
            "search_url": base_url,
            "pages_processed": current_page
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error scraping search results: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "bills": all_bills,  # Return any bills we managed to scrape before the error
            "count": len(all_bills)
        }
     
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Date parameter is required (YYYY-MM-DD)"}))
        sys.exit(1)
        
    date_param = sys.argv[1]
    result = scrape_bills_by_date(date_param)
    
    # Output JSON result for the Node.js server to parse
    print(json.dumps(result))