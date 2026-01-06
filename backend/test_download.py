
import requests
import sys

# Change base URL if needed
BASE_URL = "http://localhost:8000/api/v1/data"

def test_download(data_id):
    print(f"Testing download for ID: {data_id}")
    try:
        url = f"{BASE_URL}/{data_id}/download"
        print(f"GET {url}")
        
        # Don't download content, just check headers/status
        resp = requests.get(url, stream=True)
        
        if resp.status_code == 200:
            print("✅ Download successful (200 OK)")
            print("Headers:", resp.headers)
        else:
            print(f"❌ Download failed ({resp.status_code})")
            print("Response:", resp.text)
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_download.py <data_id>")
        # Default to a dummy ID if none provided, or try to list and pick one
        print("Attempting to list data to find an ID...")
        try:
            r = requests.get(f"{BASE_URL}/list")
            data = r.json()
            if data['success'] and data['data']:
                first_id = data['data'][0]['id']
                print(f"Found ID: {first_id}")
                test_download(first_id)
            else:
                print("No data found to test.")
        except:
            pass
    else:
        test_download(sys.argv[1])
