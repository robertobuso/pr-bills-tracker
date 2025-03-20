from selenium import webdriver
from selenium.webdriver.chrome.service import Service as ChromeService
from webdriver_manager.chrome import ChromeDriverManager
import time

# Basic setup without complex options
options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")

# Setup driver with explicit waiting
try:
    print("Installing ChromeDriver...")
    driver_path = ChromeDriverManager().install()
    print(f"ChromeDriver installed at: {driver_path}")
    
    print("Creating ChromeService...")
    service = ChromeService(executable_path=driver_path)
    
    print("Initializing Chrome WebDriver...")
    driver = webdriver.Chrome(service=service, options=options)
    
    print("Setting page load timeout...")
    driver.set_page_load_timeout(180)
    
    url = "https://sutra.oslpr.org/medidas/153567"
    print(f"Loading URL: {url}")
    driver.get(url)
    
    # Give it some time to load
    print("Waiting for page to load...")
    time.sleep(10)
    
    print("Getting page source...")
    page_source = driver.page_source
    print(f"Page source length: {len(page_source)}")
    
    print("Closing driver...")
    driver.quit()
    
except Exception as e:
    print(f"ERROR: {e}")
    try:
        driver.save_screenshot("debug_screenshot.png")
        print("Screenshot saved")
    except:
        print("Could not save screenshot")
    
    try:
        driver.quit()
    except:
        print("Could not quit driver")