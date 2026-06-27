import json
import os
import re
import sqlite3
import tempfile
import zipfile

topics = [
  {
    "category": "Getting Started",
    "items": [
      {"title": "Welcome & Motivation", "path": "README.md", "anchor": "motivation"},
      {"title": "Study Guide", "path": "README.md", "anchor": "study-guide"},
      {"title": "Interview Approach", "path": "README.md", "anchor": "how-to-approach-a-system-design-interview-question"}
    ]
  },
  {
    "category": "System Design Topics",
    "items": [
      {"title": "Performance vs Scalability", "path": "README.md", "anchor": "performance-vs-scalability"},
      {"title": "Latency vs Throughput", "path": "README.md", "anchor": "latency-vs-throughput"},
      {"title": "Availability vs Consistency", "path": "README.md", "anchor": "availability-vs-consistency"},
      {"title": "Consistency Patterns", "path": "README.md", "anchor": "consistency-patterns"},
      {"title": "Availability Patterns", "path": "README.md", "anchor": "availability-patterns"},
      {"title": "Domain Name System (DNS)", "path": "README.md", "anchor": "domain-name-system"},
      {"title": "Content Delivery Network (CDN)", "path": "README.md", "anchor": "content-delivery-network"},
      {"title": "Load Balancer", "path": "README.md", "anchor": "load-balancer"},
      {"title": "Reverse Proxy (Web Server)", "path": "README.md", "anchor": "reverse-proxy-web-server"},
      {"title": "Application Layer", "path": "README.md", "anchor": "application-layer"},
      {"title": "Database", "path": "README.md", "anchor": "database"},
      {"title": "Cache", "path": "README.md", "anchor": "cache"},
      {"title": "Asynchronism", "path": "README.md", "anchor": "asynchronism"},
      {"title": "Communication", "path": "README.md", "anchor": "communication"},
      {"title": "Security", "path": "README.md", "anchor": "security"},
      {"title": "Appendix", "path": "README.md", "anchor": "appendix"}
    ]
  },
  {
    "category": "System Design Exercises",
    "items": [
      {"title": "Design Pastebin", "path": "solutions/system_design/pastebin/README.md"},
      {"title": "Design Twitter", "path": "solutions/system_design/twitter/README.md"},
      {"title": "Design Web Crawler", "path": "solutions/system_design/web_crawler/README.md"},
      {"title": "Design Mint", "path": "solutions/system_design/mint/README.md"},
      {"title": "Design Social Network Graph", "path": "solutions/system_design/social_graph/README.md"},
      {"title": "Design Key-Value Cache", "path": "solutions/system_design/query_cache/README.md"},
      {"title": "Design Sales Rank", "path": "solutions/system_design/sales_rank/README.md"},
      {"title": "Design Scaling AWS", "path": "solutions/system_design/scaling_aws/README.md"}
    ]
  },
  {
    "category": "Object-Oriented Design Exercises",
    "items": [
      {"title": "Design a Hash Map", "path": "solutions/object_oriented_design/hash_table/hash_map.ipynb"},
      {"title": "Design a LRU Cache", "path": "solutions/object_oriented_design/lru_cache/lru_cache.ipynb"},
      {"title": "Design a Call Center", "path": "solutions/object_oriented_design/call_center/call_center.ipynb"},
      {"title": "Design a Deck of Cards", "path": "solutions/object_oriented_design/deck_of_cards/deck_of_cards.ipynb"},
      {"title": "Design a Parking Lot", "path": "solutions/object_oriented_design/parking_lot/parking_lot.ipynb"},
      {"title": "Design a Chat Server", "path": "solutions/object_oriented_design/online_chat/online_chat.ipynb"}
    ]
  }
]

def clean_html(text):
    # Remove inline style and class attributes
    text = re.sub(r'style="[^"]*"', '', text)
    text = re.sub(r"style='[^']*'", '', text)
    text = re.sub(r'class="[^"]*"', '', text)
    # Simplify multiple line breaks
    text = re.sub(r'(<br\s*/?>\s*){2,}', '<br>', text)
    return text.strip()

def extract_anki_cards(apkg_path):
    cards = []
    if not os.path.exists(apkg_path):
        print(f"Warning: Anki deck file not found: {apkg_path}")
        return cards
        
    try:
        with zipfile.ZipFile(apkg_path, 'r') as z:
            temp_dir = tempfile.mkdtemp()
            z.extract('collection.anki2', temp_dir)
            db_path = os.path.join(temp_dir, 'collection.anki2')
            
            conn = sqlite3.connect(db_path)
            c = conn.cursor()
            c.execute('SELECT flds FROM notes')
            for row in c.fetchall():
                parts = row[0].split('\x1f')
                if len(parts) >= 2:
                    q = clean_html(parts[0])
                    a = clean_html(parts[1])
                    if q and a:
                        cards.append({
                            "question": q,
                            "answer": a
                        })
            conn.close()
    except Exception as e:
        print(f"Error extracting cards from {apkg_path}: {e}")
        
    return cards

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    viewer_dir = os.path.join(root_dir, 'viewer')
    
    # 1. Enrich topics list with associated python files (.py) in the same folders
    print("Enriching topics with associated python files...")
    for group in topics:
        for item in group['items']:
            item_path = os.path.join(root_dir, item['path'])
            folder = os.path.dirname(item_path)
            
            if os.path.exists(folder) and os.path.isdir(folder) and folder != root_dir:
                code_files = []
                for file in os.listdir(folder):
                    if file.endswith('.py') and file != '__init__.py':
                        rel_code_path = os.path.relpath(os.path.join(folder, file), root_dir)
                        code_files.append({
                            "name": file,
                            "path": rel_code_path
                        })
                if code_files:
                    item['code_files'] = code_files
                    print(f"  Found code files for {item['title']}: {[f['name'] for f in code_files]}")

    # Write enriched topics.json
    output_topics_path = os.path.join(viewer_dir, 'topics.json')
    with open(output_topics_path, 'w', encoding='utf-8') as f:
        json.dump(topics, f, indent=2, ensure_ascii=False)
    print(f"Generated topics.json at {output_topics_path}")
    
    # 2. Extract flashcards from Anki decks
    flashcards_output = {"decks": []}
    flashcards_dir = os.path.join(root_dir, 'resources', 'flash_cards')
    
    if os.path.exists(flashcards_dir):
        print("Extracting flashcards from Anki packages...")
        for file in os.listdir(flashcards_dir):
            if file.endswith('.apkg'):
                deck_name = os.path.splitext(file)[0]
                apkg_path = os.path.join(flashcards_dir, file)
                print(f"  Processing deck: {deck_name}...")
                cards = extract_anki_cards(apkg_path)
                if cards:
                    flashcards_output["decks"].append({
                        "name": deck_name,
                        "cards": cards
                    })
                    print(f"    Extracted {len(cards)} cards.")
    
    output_fc_path = os.path.join(viewer_dir, 'flashcards.json')
    with open(output_fc_path, 'w', encoding='utf-8') as f:
        json.dump(flashcards_output, f, indent=2, ensure_ascii=False)
    print(f"Generated flashcards.json at {output_fc_path}")

if __name__ == '__main__':
    main()
