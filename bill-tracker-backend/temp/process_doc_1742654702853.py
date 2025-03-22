
import sys
sys.path.append('.')
from fast_scraper import on_demand_document_processor
import json
import urllib3
import urllib.parse

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# URL needs to be raw - we'll decode it in Python
url = """https://sutra.oslpr.org/SutraFilesGen/153856/ps0348-25.doc"""

# Process just this document
result = on_demand_document_processor(url, "scraped_data")

# Print the result as JSON
print(json.dumps(result))
