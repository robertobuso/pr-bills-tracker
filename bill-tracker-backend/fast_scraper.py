#!/usr/bin/env python3
"""
Fast Bill Scraper - Optimized for <2 second response time
This script scrapes essential bill information without downloading documents
or using Selenium for a much faster response.
"""

import requests
from bs4 import BeautifulSoup
import json
import re
import os
import logging
import sys
import time
from urllib.parse import urlparse

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.FileHandler("fast_scraper.log"), logging.StreamHandler(sys.stderr)]
)
logger = logging.getLogger(__name__)

def fast_scrape(url, output_dir="scraped_data"):
    """
    Performs a lightweight scrape focused on speed - gets only essential data
    without downloading any documents or using Selenium.
    
    Returns structured data within 2 seconds or less.
    """
    start_time = time.time()
    logger.info(f"FAST SCRAPE: Starting rapid scrape of {url}")
    
    # Initialize result data structure
    data = {
        "measure_number": None,
        "title": None,
        "status": None,
        "filing_date": None,
        "authors": [],
        "origin_chamber": None,
        "current_chamber": None,
        "topic": None,
        "other_data": {},
        "eventos": [],
        "comisiones": []
    }
    
    try:
        # Use requests with a short timeout instead of Selenium
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        }
        
        # Use a very short timeout to ensure fast response
        response = requests.get(url, headers=headers, timeout=1.5)
        
        if response.status_code != 200:
            logger.error(f"Failed to fetch page: {response.status_code}")
            return {
                "error": f"HTTP error: {response.status_code}",
                "eventos": []  # Return empty eventos for graceful fallback
            }
            
        html_content = response.text
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Extract critical bill information
        # Extract measure number from heading
        header = soup.find('h1', class_=lambda c: c and "text-2xl" in c)
        if header:
            data["measure_number"] = header.get_text(strip=True)
            
        # Extract filing date
        filing_date_elem = soup.find('span', string=lambda s: s and "Fecha de Radicación" in s)
        if filing_date_elem:
            date_span = filing_date_elem.find_next('span', class_=lambda c: c and "text-xs" in c)
            if date_span:
                data["filing_date"] = date_span.get_text(strip=True)
        
        # Extract title
        title_elem = soup.find('span', string=lambda s: s and "Título" in s)
        if title_elem:
            title_span = title_elem.find_next('span', class_="text-balance")
            if title_span:
                data["title"] = title_span.get_text(strip=True)
        
        # Extract authors (simplified)
        authors_div = soup.find(lambda tag: tag.name == 'div' and tag.get_text(strip=True) == 'Autores')
        if authors_div:
            author_spans = authors_div.find_next('div').find_all('span')
            for span in author_spans:
                if span.get_text(strip=True) and not any(kw in span.get_text().lower() for kw in ["autor", "fecha"]):
                    data["authors"].append(span.get_text(strip=True))
                    
        # Extract events efficiently (limit processing time)
        # This is the most important part for the timeline view
        event_items = soup.find_all('li', class_=lambda c: c and "relative flex justify-between" in c)
        logger.info(f"Found {len(event_items)} event items")
        
        # Process only a limited number of events if there are too many
        # to ensure we stay within the time budget
        MAX_EVENTS_INITIAL = 15  # Limit initial processing 
        for i, event_item in enumerate(event_items[:MAX_EVENTS_INITIAL]):
            # Extract event title/type
            event_title_elem = event_item.find('span', class_="text-sutra-primary")
            if not event_title_elem:
                continue
                
            event_title = event_title_elem.get_text(strip=True)
            
            # Initialize event data with lightweight metadata only
            event_data = {
                "descripcion": event_title,
                "fecha": None,
                "documents": [],  # Start with empty documents, will load on-demand later
                "tipo": "tramite"  # Default type
            }
            
            # Extract date - critical for timeline
            date_elem = event_item.find('span', string=lambda s: s and "Fecha:" in s)
            if date_elem:
                date_parent = date_elem.parent
                event_data["fecha"] = date_parent.get_text(strip=True).replace("Fecha:", "").strip()
            
            # Extract commission information (lightweight)
            all_paragraphs = event_item.find_all('p', class_="mt-1 flex text-xs leading-5 text-gray-500")
            for p in all_paragraphs:
                if p.find('span', string=lambda s: s and "Fecha:" in s) or p.find('a'):
                    continue
                
                commission_text = p.get_text(strip=True)
                if commission_text and "Comisión" in commission_text:
                    event_data["comision"] = commission_text
                    break
                    
            # For document links, only collect URLs and descriptions - NO DOWNLOADING
            # This is critical for speed
            doc_links = event_item.find_all('a', href=True)
            for link in doc_links:
                doc_url = link['href']
                # Skip User-Manual files
                if "User-Manual" in doc_url:
                    continue
                    
                # Make sure URL is absolute
                if not doc_url.startswith("http"):
                    doc_url = "https://sutra.oslpr.org" + doc_url
                    
                # Get description but keep it minimal
                doc_desc_elem = link.find('span', class_=lambda c: c and "text-sutra-secondary" in c)
                doc_desc = doc_desc_elem.get_text(strip=True) if doc_desc_elem else "Document"
                
                # Store only URL and description - no file downloading
                event_data["documents"].append({
                    "link_url": doc_url,
                    "description": doc_desc,
                    "downloaded": False,  # Mark as not downloaded
                    "text_extracted": False
                })
            
            # Determine if this is a vote event and collect basic vote data
            if "Votación" in event_title or "Aprobado" in event_title:
                event_data["tipo"] = "votacion"
                
                # Try to extract vote counts if they exist
                vote_counts = {}
                vote_elements = event_item.find_all('span', string=lambda s: s and any(x in s for x in ["Votos a favor", "Votos en contra", "Votos abstenidos", "Votos ausentes"]))
                
                for vote_elem in vote_elements:
                    vote_type = vote_elem.get_text(strip=True).rstrip(":")
                    vote_value_elem = vote_elem.parent
                    if vote_value_elem:
                        try:
                            vote_text = vote_value_elem.get_text(strip=True).replace(vote_type, "").strip()
                            vote_counts[vote_type] = int(vote_text) if vote_text.isdigit() else vote_text
                        except:
                            pass
                
                event_data["votes"] = vote_counts if vote_counts else None
                event_data["camara"] = "Senado" if "Senado" in event_title else "Cámara"
                
            # Add event to the eventos array
            data["eventos"].append(event_data)
            
        # Check remaining time budget
        elapsed_time = time.time() - start_time
        logger.info(f"Processed {len(data['eventos'])} events in {elapsed_time:.2f} seconds")
        
        # If we still have time, try to process more events
        if elapsed_time < 1.0 and len(event_items) > MAX_EVENTS_INITIAL:
            remaining_events = event_items[MAX_EVENTS_INITIAL:]
            logger.info(f"Processing {len(remaining_events)} additional events with remaining time")
            
            # Process as many as we can in the remaining time
            for event_item in remaining_events:
                # Check time after each event to ensure we don't exceed budget
                if time.time() - start_time > 1.8:  # Stop if we're getting close to 2 seconds
                    logger.info("Time budget nearly exceeded, stopping event processing")
                    break
                    
                # Same extraction logic as above but simplified even further for speed
                event_title_elem = event_item.find('span', class_="text-sutra-primary")
                if not event_title_elem:
                    continue
                    
                event_title = event_title_elem.get_text(strip=True)
                event_data = {
                    "descripcion": event_title,
                    "fecha": None,
                    "documents": [],
                    "tipo": "votacion" if "Votación" in event_title or "Aprobado" in event_title else "tramite"
                }
                
                # Extract only critical date information
                date_elem = event_item.find('span', string=lambda s: s and "Fecha:" in s)
                if date_elem and date_elem.parent:
                    event_data["fecha"] = date_elem.parent.get_text(strip=True).replace("Fecha:", "").strip()
                
                # Add placeholder for document count instead of full document data
                doc_links = event_item.find_all('a', href=True)
                doc_count = len([link for link in doc_links if any(ext in link['href'].lower() 
                                                               for ext in ['.pdf', '.doc', '.docx'])])
                if doc_count > 0:
                    event_data["document_count"] = doc_count
                    
                data["eventos"].append(event_data)
        
        # Sort eventos by fecha (date) with most recent first - critical for timeline view
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                # Simple date parsing for speed
                parts = date_str.split('/')
                if len(parts) == 3:
                    month, day, year = parts
                    # Return as YYYY-MM-DD for easy sorting
                    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
                return None
            except:
                return None
                
        # Sort eventos with date parsing
        data["eventos"].sort(key=lambda x: parse_date(x.get("fecha")) or "0000-00-00", reverse=True)
                
        # Add timing info
        total_time = time.time() - start_time
        logger.info(f"FAST SCRAPE: Completed in {total_time:.2f} seconds")
        data["scrape_time"] = total_time
        
        # Return the data
        return data
        
    except requests.exceptions.Timeout:
        logger.error("Request timed out - returning partial data")
        return {
            "error": "Request timed out",
            "measure_number": data.get("measure_number"),
            "title": data.get("title"),
            "eventos": data.get("eventos", []),
            "scrape_time": time.time() - start_time
        }
    except Exception as e:
        logger.error(f"Error in fast scrape: {str(e)}")
        return {
            "error": f"Error: {str(e)}",
            "eventos": [],
            "scrape_time": time.time() - start_time
        }

def on_demand_document_processor(doc_url, output_dir="scraped_data"):
    """
    Process a single document on-demand when a user wants to view it.
    """
    try:
        # Use the URL as-is without sanitization
        # Generate a safe filename from the URL
        import hashlib
        
        # Create a safe filename based on the URL hash + original extension
        url_hash = hashlib.md5(doc_url.encode()).hexdigest()
        extension = os.path.splitext(doc_url)[1]
        if not extension:
            extension = '.bin'  # Default extension if none found
        safe_filename = f"{url_hash}{extension}"
        
        filepath = os.path.join(output_dir, safe_filename)
        
        # Create directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            
        # Check if file already exists
        if os.path.exists(filepath):
            return {
                "link_url": doc_url,
                "description": os.path.basename(doc_url),
                "filepath": filepath,
                "downloaded": True,
                "text_extracted": False
            }
            
        # Download the file
        logger.info(f"Downloading document on demand: {doc_url}")
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        })
        
        # Use a longer timeout for larger documents
        response = session.get(doc_url, stream=True, timeout=30, verify=False)
        response.raise_for_status()
        
        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                
        logger.info(f"Successfully downloaded document to {filepath}")
        
        return {
            "link_url": doc_url,
            "description": os.path.basename(doc_url),
            "filepath": filepath,
            "downloaded": True,
            "text_extracted": False
        }
    except Exception as e:
        logger.error(f"Error processing document {doc_url}: {str(e)}")
        return {
            "link_url": doc_url,
            "error": str(e),
            "downloaded": False
        }
    
# Main entry point for the Node.js server to call
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No URL provided"}))
        sys.exit(1)
        
    url = sys.argv[1]
    output_dir = "scraped_data"
    
    # Create output directory if it doesn't exist
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Run the fast scraper
    result = fast_scrape(url, output_dir)
    
    # Print the result as JSON for the Node.js server to parse
    print(json.dumps(result))