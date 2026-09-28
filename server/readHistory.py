import sqlite3
import shutil
import tempfile
import sys
import json
import os
from datetime import datetime, timedelta

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Missing arguments"}))
        sys.exit(1)

    history_path = sys.argv[1]
    try:
        keywords = json.loads(sys.argv[2])
    except Exception as e:
        print(json.dumps({"error": f"Invalid keywords JSON: {str(e)}"}))
        sys.exit(1)

    if not os.path.exists(history_path):
        print(json.dumps({"error": f"History file not found at: {history_path}"}))
        sys.exit(1)

    # Copy database to a temp file to avoid locks if Chrome is open
    temp_dir = tempfile.gettempdir()
    temp_db_path = os.path.join(temp_dir, "hubai_history_temp")
    try:
        shutil.copyfile(history_path, temp_db_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to copy history file: {str(e)}"}))
        sys.exit(1)

    results = []
    try:
        conn = sqlite3.connect(temp_db_path)
        cursor = conn.cursor()
        
        # Chrome Webkit Epoch is 1601-01-01. last_visit_time is in microseconds.
        cursor.execute("SELECT url, title, last_visit_time FROM urls ORDER BY last_visit_time DESC LIMIT 1000")
        rows = cursor.fetchall()
        
        for url, title, last_visit_time in rows:
            if not url:
                continue
                
            url_lower = url.lower()
            title_lower = (title or "").lower()
            matched = False
            for kw in keywords:
                if kw.lower() in url_lower or kw.lower() in title_lower:
                    matched = True
                    break
            
            if matched:
                try:
                    # Convert Webkit timestamp (microseconds since 1601) to ISO 8601
                    seconds_since_1601 = last_visit_time / 1000000.0
                    visit_dt = datetime(1601, 1, 1) + timedelta(seconds=seconds_since_1601)
                    # Convert UTC/Local safely depending on timezone setup, but ISO format is universally parsable
                    iso_time = visit_dt.isoformat() + "Z"
                except Exception:
                    iso_time = datetime.utcnow().isoformat() + "Z"
                    
                results.append({
                    "url": url,
                    "title": title or "",
                    "timestamp": iso_time
                })
        
        conn.close()
    except Exception as e:
        print(json.dumps({"error": f"Database read error: {str(e)}"}))
        return
    finally:
        if os.path.exists(temp_db_path):
            try:
                os.remove(temp_db_path)
            except Exception:
                pass

    print(json.dumps({"success": True, "history": results[:50]}))

if __name__ == "__main__":
    main()
