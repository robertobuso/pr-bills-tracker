import requests
from bs4 import BeautifulSoup
import os
import time
import random
import docx
from pdfminer.high_level import extract_text

def download_and_extract_sutra_docs(sutra_url, output_dir="poc_downloads"):
    """Downloads DOCX and PDF documents, extracts their text."""

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    try:
        response = requests.get(sutra_url)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find the div containing the unordered list (ul) of events
        documents_div = soup.find('div', class_='max-w-full mx-auto justify-center items-center')

        if documents_div is None:
            print(f"No documents div found on {sutra_url}")
            return

        # Find the unordered list (ul) within that div
        documents_list = documents_div.find('ul')

        if documents_list is None:
            print(f"No documents list (ul) found on {sutra_url}")
            return

        # In the download_and_extract_sutra_docs function, update the file extension check:
        doc_links = []
        for a_tag in documents_list.find_all('a', href=True):
            link = a_tag['href']
            # Add .doc and .txt to the file extensions we check for
            if link.lower().endswith(('.docx', '.pdf', '.doc', '.txt')):
                if not link.startswith('http'):
                    link = "https://sutra.oslpr.org" + link
                doc_links.append(link)

        # Download and process each document
        for doc_link in doc_links:
            try:
                doc_response = requests.get(doc_link, stream=True)
                doc_response.raise_for_status()

                filename = os.path.basename(doc_link)
                filepath = os.path.join(output_dir, filename)

                with open(filepath, 'wb') as f:
                    for chunk in doc_response.iter_content(chunk_size=8192):
                        f.write(chunk)
                print(f"Downloaded: {filename}")

                # Extract text based on file type
                if filename.lower().endswith('.docx'):
                    extracted_text = extract_text_from_docx(filepath)
                elif filename.lower().endswith('.pdf'):
                    extracted_text = extract_text_from_pdf(filepath)
                elif filename.lower().endswith('.doc'):
                    extracted_text = extract_text_from_doc(filepath)
                elif filename.lower().endswith('.txt'):
                    # For text files, just read the content directly
                    with open(filepath, 'r', encoding='utf-8', errors='replace') as txt_file:
                        extracted_text = txt_file.read()
                else:
                    extracted_text = ""
                    results["errors"].append(f"Warning: Unknown file type for {filename}")

                if extracted_text:
                     text_filepath = os.path.join(output_dir, filename + ".txt")
                     with open(text_filepath, 'w', encoding='utf-8') as tf:
                        tf.write(extracted_text)
                     print(f"Extracted text saved to: {text_filepath}")

                time.sleep(random.uniform(1, 3))  # Respectful delay

            except requests.exceptions.RequestException as e:
                print(f"Error downloading {doc_link}: {e}")
            except OSError as e:
                print(f"Error saving or processing {doc_link}: {e}")
            except Exception as e:
                print(f"An unexpected error occurred processing {doc_link}: {e}")


    except requests.exceptions.RequestException as e:
        print(f"Error fetching {sutra_url}: {e}")


def extract_text_from_docx(docx_path):
    """Extracts text from a .docx file."""
    try:
        doc = docx.Document(docx_path)
        full_text = []
        for paragraph in doc.paragraphs:
            full_text.append(paragraph.text)
        return '\n'.join(full_text)
    except Exception as e:
        print(f"Error reading docx {docx_path}: {e}")
        return ""
    
def extract_text_from_doc(doc_path):
    """Extracts text from a .doc file using textract."""
    try:
        import textract
        text = textract.process(doc_path).decode('utf-8')
        return text
    except ImportError:
        # Fallback if textract is not installed
        return "Note: This is a legacy .doc file. Full text extraction requires additional tools."
    except Exception as e:
        print(f"Error extracting text from {doc_path}: {e}")
        return ""


def extract_text_from_pdf(pdf_path):
    """Extracts text from a PDF file."""
    try:
        text = extract_text(pdf_path)
        return text
    except Exception as e:
        print(f"Error extracting text from {pdf_path}: {e}")
        return ""

# --- Main Execution ---
import sys
import json

if __name__ == "__main__":
    # Check if URL is provided as argument
    if len(sys.argv) > 1:
        sutra_url = sys.argv[1]
        
        # Initialize results dictionary
        results = {
            "success": False,
            "files": [],
            "errors": []
        }
        
        # Create the download directory
        output_dir = "poc_downloads"
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        try:
            # Add this output directory to results
            results["download_dir"] = os.path.abspath(output_dir)
            
            response = requests.get(sutra_url)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')
            documents_div = soup.find('div', class_='max-w-full mx-auto justify-center items-center')

            if documents_div is None:
                results["errors"].append(f"No documents div found on {sutra_url}")
            else:
                documents_list = documents_div.find('ul')
                if documents_list is None:
                    results["errors"].append(f"No documents list (ul) found on {sutra_url}")
                else:
                    # Look for document links
                    doc_links = []
                    for a_tag in documents_list.find_all('a', href=True):
                        link = a_tag['href']
                        if link.lower().endswith(('.docx', '.pdf', '.doc', '.txt')):
                            if not link.startswith('http'):
                                link = "https://sutra.oslpr.org" + link
                            doc_links.append(link)
                    
                    # Download and process each document
                    for doc_link in doc_links:
                        try:
                            doc_response = requests.get(doc_link, stream=True)
                            doc_response.raise_for_status()

                            filename = os.path.basename(doc_link)
                            filepath = os.path.join(output_dir, filename)

                            with open(filepath, 'wb') as f:
                                for chunk in doc_response.iter_content(chunk_size=8192):
                                    f.write(chunk)
                            
                            # Add file to results
                            results["files"].append(os.path.abspath(filepath))

                            # Extract text based on file type
                            if filename.lower().endswith('.docx'):
                                extracted_text = extract_text_from_docx(filepath)
                            elif filename.lower().endswith('.pdf'):
                                extracted_text = extract_text_from_pdf(filepath)
                            elif filename.lower().endswith('.doc'):
                                extracted_text = extract_text_from_doc(filepath)
                            elif filename.lower().endswith('.txt'):
                                with open(filepath, 'r', encoding='utf-8', errors='replace') as txt_file:
                                    extracted_text = txt_file.read()
                            else:
                                extracted_text = ""
                                results["errors"].append(f"Warning: Unknown file type for {filename}")

                            if extracted_text:
                                text_filepath = os.path.join(output_dir, filename + ".txt")
                                with open(text_filepath, 'w', encoding='utf-8') as tf:
                                    tf.write(extracted_text)
                                # Add text file to results
                                results["files"].append(os.path.abspath(text_filepath))

                            time.sleep(random.uniform(1, 3))  # Respectful delay

                        except requests.exceptions.RequestException as e:
                            results["errors"].append(f"Error downloading {doc_link}: {str(e)}")
                        except OSError as e:
                            results["errors"].append(f"Error saving or processing {doc_link}: {str(e)}")
                        except Exception as e:
                            results["errors"].append(f"An unexpected error occurred processing {doc_link}: {str(e)}")
            
            results["success"] = True if results["files"] else False
            
        except requests.exceptions.RequestException as e:
            results["errors"].append(f"Error fetching {sutra_url}: {str(e)}")
        
        # Print the results as JSON
        print(json.dumps(results))
    else:
        print(json.dumps({"success": False, "error": "No URL provided"}))
