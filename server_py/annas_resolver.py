import re
import urllib.parse
from typing import List, Dict, Optional, Tuple, Generator
from curl_cffi import requests
from bs4 import BeautifulSoup

LIBGEN_MIRRORS = [
    "https://libgen.li",
    "https://libgen.is",
    "https://libgen.rs",
    "https://libgen.st",
    "https://libgen.vg"
]

ANNAS_MIRRORS = [
    "https://annas-archive.is",
    "https://annas-archive.pk",
    "https://annas-archive.gl"
]

def clean_book_title(raw_title: str) -> str:
    """Clean dirty title text scraped from mirrors."""
    if not raw_title:
        return ""
    # Remove metadata badges like 'bf 4296393' or 'br 12345' or ISBNs
    cleaned = re.sub(r'(?:bf|br|id|bl)\s*\d+', '', raw_title, flags=re.IGNORECASE)
    cleaned = re.sub(r'\b\d{10,13}\b', '', cleaned)
    cleaned = cleaned.replace('\r', ' ').replace('\n', ' ').replace('\t', ' ')
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

def resolve_candidate_md5s(title: Optional[str] = None, slug_or_id: Optional[str] = None) -> List[str]:
    """Find candidate MD5s for any book title or slug from LibGen mirrors."""
    queries = []
    if title:
        clean = clean_book_title(title)
        clean = re.sub(r'\(.*?\)|\[.*?\]', '', clean).strip()
        if clean:
            queries.append(clean)
            words = [w for w in clean.split() if len(w) > 2]
            if len(words) > 1:
                queries.append(" ".join(words[:3]))
    if slug_or_id:
        clean_slug = re.sub(r'^(?:anna_)?\d+-', '', slug_or_id).replace('-', ' ').strip()
        if clean_slug and clean_slug not in queries:
            queries.append(clean_slug)

    found_md5s = []
    for q in queries:
        try:
            encoded_q = urllib.parse.quote_plus(q)
            for mirror in LIBGEN_MIRRORS[:2]:
                try:
                    url = f"{mirror}/index.php?req={encoded_q}&columns%5B%5D=t&columns%5B%5D=a&columns%5B%5D=i&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w&topics%5B%5D=l&topics%5B%5D=c&topics%5B%5D=f&topics%5B%5D=a&topics%5B%5D=m&topics%5B%5D=r&topics%5B%5D=s"
                    resp = requests.get(url, impersonate="chrome120", timeout=5, verify=False)
                    if resp.status_code == 200:
                        soup = BeautifulSoup(resp.text, 'html.parser')
                        table = soup.find('table', {'id': 'tablelibgen'}) or soup.find('table')
                        if table:
                            for a in table.find_all('a', href=True):
                                match = re.search(r'md5[=/]([a-f0-9]{32})', a['href'], re.I)
                                if match:
                                    m_val = match.group(1).lower()
                                    if m_val not in found_md5s:
                                        found_md5s.append(m_val)
                    if found_md5s:
                        break
                except Exception:
                    pass
            if found_md5s:
                break
        except Exception:
            pass

    return found_md5s

def search_libgen(query: str, format_filter: str = "epub", lang_filter: str = "all") -> List[Dict]:
    """Search Libgen and Anna's Archive backend mirrors with browser TLS impersonation."""
    if not query or not query.strip():
        return []

    clean_q = query.strip()
    encoded_q = urllib.parse.quote_plus(clean_q)
    results = []
    seen_md5s = set()

    # 1. Search LibGen mirrors first (always has verified MD5s)
    for mirror in LIBGEN_MIRRORS:
        try:
            url = (
                f"{mirror}/index.php?req={encoded_q}"
                f"&columns%5B%5D=t&columns%5B%5D=a"
                f"&objects%5B%5D=f&objects%5B%5D=e&objects%5B%5D=s&objects%5B%5D=a&objects%5B%5D=p&objects%5B%5D=w"
                f"&topics%5B%5D=l&topics%5B%5D=c&topics%5B%5D=f&topics%5B%5D=a&topics%5B%5D=m&topics%5B%5D=r&topics%5B%5D=s"
            )
            resp = requests.get(url, impersonate="chrome120", timeout=6, verify=False)
            if resp.status_code != 200 or "<table" not in resp.text:
                continue

            soup = BeautifulSoup(resp.text, "html.parser")
            table = soup.find("table", {"id": "tablelibgen"}) or soup.find("table")
            if not table:
                continue

            rows = table.find_all("tr")
            for r in rows[1:]:
                tds = r.find_all("td")
                if len(tds) < 8:
                    continue

                raw_title = tds[0].get_text(strip=True)
                title = clean_book_title(raw_title)
                author = tds[1].get_text(strip=True) or "Autor Desconhecido"
                publisher = tds[2].get_text(strip=True) or "Domínio Público / Independente"
                year = tds[3].get_text(strip=True)
                lang = (tds[4].get_text(strip=True) or "pt").lower()
                size = tds[6].get_text(strip=True) or "2.0 MB"
                ext = (tds[7].get_text(strip=True) or "epub").lower()

                # Filter format if specified
                if format_filter != "all" and ext != format_filter.lower():
                    continue

                is_portuguese = "portuguese" in lang or "português" in lang or lang == "pt"
                # Filter language if requested
                if lang_filter == "pt" and not is_portuguese:
                    continue

                # Extract MD5
                md5 = None
                for a in r.find_all("a", href=True):
                    href = a["href"]
                    md5_match = re.search(r"md5[=/]([a-f0-9]{32})", href, re.IGNORECASE)
                    if md5_match:
                        md5 = md5_match.group(1).lower()
                        break

                if not md5 or md5 in seen_md5s:
                    continue

                seen_md5s.add(md5)
                lang_code = "pt" if is_portuguese else ("en" if "english" in lang or lang == "en" else "other")

                score = 80
                if is_portuguese:
                    score += 50
                if ext == "epub":
                    score += 30

                results.append({
                    "id": f"anna_{md5}",
                    "md5": md5,
                    "title": title or clean_q,
                    "author": author,
                    "publisher": publisher,
                    "year": int(year) if year and year.isdigit() else None,
                    "language": lang_code,
                    "format": ext,
                    "size": size,
                    "cover": f"https://covers.openlibrary.org/b/id/{abs(hash(title)) % 10000000}-M.jpg",
                    "badge": f"{ext.upper()} • {size}",
                    "source": "Anna's Archive (LibGen)",
                    "sourceId": "annas",
                    "score": score,
                    "downloadUrl": f"/api/download?id=anna_{md5}&title={urllib.parse.quote(title)}",
                    "fallbackMd5s": [md5]
                })

            if len(results) > 0:
                break
        except Exception as e:
            print(f"[Python Resolver] Error querying mirror {mirror}: {e}")

    # 2. Search Anna's Archive directly if results are few
    if len(results) < 5:
        for mirror in ANNAS_MIRRORS:
            try:
                anna_url = f"{mirror}/search?q={encoded_q}&ext={format_filter}&lang={lang_filter}"
                resp = requests.get(anna_url, impersonate="chrome120", timeout=6, verify=False)
                if resp.status_code == 200:
                    soup = BeautifulSoup(resp.text, "html.parser")
                    book_links = soup.find_all("a", href=lambda h: h and "/books/" in h)
                    for a in book_links:
                        img = a.find("img")
                        img_src = img["src"] if img and "src" in img.attrs else None
                        text = a.get_text(separator=" | ", strip=True)
                        parts = [p.strip() for p in text.split("|") if p.strip()]
                        if not parts:
                            continue
                        
                        b_title = clean_book_title(parts[0])
                        b_author = parts[1] if len(parts) > 1 else "Autor Desconhecido"
                        book_id_match = re.search(r'/books/([a-zA-Z0-9\-_]+)', a["href"])
                        raw_slug = book_id_match.group(1) if book_id_match else ""

                        # If we can resolve candidate MD5 for this title, attach it
                        candidate_md5s = resolve_candidate_md5s(b_title, raw_slug)
                        primary_md5 = candidate_md5s[0] if candidate_md5s else None
                        final_id = f"anna_{primary_md5}" if primary_md5 else f"anna_{raw_slug}"

                        if not any(r["title"].lower() == b_title.lower() for r in results):
                            results.append({
                                "id": final_id,
                                "md5": primary_md5,
                                "title": b_title,
                                "author": b_author,
                                "publisher": "Anna's Archive",
                                "year": None,
                                "language": "pt" if lang_filter == "pt" else "all",
                                "format": format_filter,
                                "size": "2.5 MB",
                                "cover": img_src or f"https://covers.openlibrary.org/b/id/{abs(hash(b_title)) % 10000000}-M.jpg",
                                "badge": f"{format_filter.upper()} • 2.5 MB",
                                "source": "Anna's Archive",
                                "sourceId": "annas",
                                "score": 90,
                                "downloadUrl": f"/api/download?title={urllib.parse.quote(b_title)}&id={final_id}",
                                "fallbackMd5s": candidate_md5s
                            })
                    if len(results) > 0:
                        break
            except Exception as e:
                print(f"[Python Resolver] Error querying Anna mirror {mirror}: {e}")

    results.sort(key=lambda x: x.get("score", 0), reverse=True)
    return results

def resolve_download_stream(
    md5: Optional[str] = None,
    title: Optional[str] = None,
    slug_or_id: Optional[str] = None,
    range_header: Optional[str] = None
) -> Tuple[int, Dict, Optional[Generator]]:
    """
    Resolves direct EPUB binary download for an MD5 or resolves MD5 automatically from title/slug.
    Returns (status_code, headers, stream_generator).
    """
    candidate_md5s = []
    if md5 and len(md5.strip()) == 32:
        candidate_md5s.append(md5.strip().lower())

    # Resolve additional candidate MD5s by title or slug if needed
    auto_md5s = resolve_candidate_md5s(title=title, slug_or_id=slug_or_id)
    for m in auto_md5s:
        if m not in candidate_md5s:
            candidate_md5s.append(m)

    print(f"[Python Stream] Candidate MD5s to try: {candidate_md5s} (title='{title}', slug='{slug_or_id}')")

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    })

    for candidate_md5 in candidate_md5s:
        for mirror in LIBGEN_MIRRORS[:3]:
            try:
                ads_url = f"{mirror}/ads.php?md5={candidate_md5}"
                print(f"[Python Stream] Handshake at {ads_url}")
                resp = session.get(ads_url, impersonate="chrome120", timeout=8, verify=False)
                if resp.status_code != 200:
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                get_links = [a["href"] for a in soup.find_all("a", href=True) if "get.php" in a["href"]]
                if not get_links:
                    continue

                direct_link = get_links[0]
                if not direct_link.startswith("http"):
                    direct_url = mirror.rstrip("/") + "/" + direct_link.lstrip("/")
                else:
                    direct_url = direct_link

                print(f"[Python Stream] Fetching binary from {direct_url}")
                req_headers = {"Referer": ads_url}
                if range_header:
                    req_headers["Range"] = range_header

                dl_resp = session.get(
                    direct_url,
                    impersonate="chrome120",
                    headers=req_headers,
                    timeout=25,
                    verify=False,
                    stream=True
                )

                if dl_resp.status_code in [200, 206]:
                    content_type = dl_resp.headers.get("content-type", "application/epub+zip")
                    if "html" in content_type.lower() or "json" in content_type.lower():
                        continue

                    response_headers = {
                        "Content-Type": content_type,
                        "Accept-Ranges": "bytes",
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Methods": "GET, OPTIONS",
                        "Access-Control-Allow-Headers": "*",
                        "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
                    }

                    if "content-length" in dl_resp.headers:
                        response_headers["Content-Length"] = dl_resp.headers["content-length"]
                    if "content-range" in dl_resp.headers:
                        response_headers["Content-Range"] = dl_resp.headers["content-range"]

                    def iterfile():
                        for chunk in dl_resp.iter_content(chunk_size=16384):
                            if chunk:
                                yield chunk

                    return dl_resp.status_code, response_headers, iterfile()

            except Exception as e:
                print(f"[Python Stream] Error with mirror {mirror} for md5 {candidate_md5}: {e}")

    return 502, {"Content-Type": "application/json"}, None
