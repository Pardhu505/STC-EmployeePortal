import time
import asyncio
import re
import json
import os
from fastapi import APIRouter, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime
from typing import List, Set, Dict, Any, Tuple
from datetime import datetime, timedelta
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FACEBOOK_COOKIES_FILE = os.path.join(BASE_DIR, "facebook_storage_state.json")
MONGO_URL = "mongodb+srv://poori420:5imYVGkw7F0cE5K2@cluster0.53oeybd.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URL)
fb_db = client['facebook_db']
fb_collection = fb_db['daily_data']

@router.get("/data")
async def get_facebook_data(post_type: str = Query(None)):
    try:
        data = await fb_collection.find_one({}, sort=[("run_date", -1)])
        
        if not data:
            return {"run_date": None, "pages": []}
        
        if "_id" in data:
            del data["_id"]
        
        if post_type:
            for page in data.get("pages", []):
                if "posts" in page:
                    page["posts"] = [
                        p for p in page["posts"] 
                        if p.get("type", "").lower() == post_type.lower()
                    ]
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data from DB: {str(e)}")

TARGET_PAGES = [
    "https://www.facebook.com/Appolitics.Official/",
    "https://www.facebook.com/bankuseenuu",
    "https://www.facebook.com/profile.php?id=100093444206800",
    "https://www.facebook.com/profile.php?id=100092200324811&mbextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100087471274626",
    # "https://www.facebook.com/chalachusamle",
    # "https://www.facebook.com/comedypfrofessor",
    # "https://www.facebook.com/Comedytrigger3",
    # "https://www.facebook.com/Degreestudentzikkadaa/",
    # "https://www.facebook.com/doubledoseA2Z",
    # "https://www.facebook.com/EpicPoliticalComments",
    # "https://www.facebook.com/fasakme",
    # "https://www.facebook.com/FUNtasticTelugu",
    # "https://www.facebook.com/share/1DAxQgPccY/",
    # "https://www.facebook.com/share/18pX2qumts/",
    # "https://www.facebook.com/share/1ARZqt9KQT/",
    # "https://www.facebook.com/share/166frghErf/",
    # "https://www.facebook.com/profile.php?id=61572380413251",
    # "https://www.facebook.com/PointBlankTvTelugu",
    # "https://www.facebook.com/share/14daUrANNb/",
    # "https://www.facebook.com/share/1AWelJ8j68D/?mbextid=wwXlfr",
    # "https://www.facebook.com/PointBlankTvDigital",
    # "https://www.facebook.com/ApNextCM/",
    # "https://www.facebook.com/areychari",
    # "https://www.facebook.com/profile.php?id=100087598966166",
    # "https://www.facebook.com/BalayyaPunch/"
]

# Caption container (same as in your smart-stop code)
CAPTION_XPATH = (
    "//div[contains(@class,'xdj266r') and contains(@class,'x14z9mp') "
    "and contains(@class,'xat24cr') and contains(@class,'x1lziwak') "
    "and contains(@class,'x1vvkbs') and contains(@class,'x126k92a')]"
)

# Likes span class inside the same post area
LIKES_REL_XPATH = "xpath=.//span[contains(@class,'x135b78x')]"

# Comments / shares span class (same for both, order differs)
COMMENTS_SHARES_REL_XPATH = (
    "xpath=.//span[contains(@class,'xdj266r') and contains(@class,'x14z9mp') "
    "and contains(@class,'xat24cr') and contains(@class,'x1lziwak') "
    "and contains(@class,'xexx8yu') and contains(@class,'xyri2b') "
    "and contains(@class,'x18d9i69') and contains(@class,'x1c1uobl') "
    "and contains(@class,'x1hl2dhg') and contains(@class,'x16tdsg8') "
    "and contains(@class,'x1vvkbs') and contains(@class,'xkrqix3') "
    "and contains(@class,'x1sur9pj')]"
)

# Followers (strong inside link that has /followers/ in href)
FOLLOWERS_STRONG_XPATH = "//a[contains(@href, '/followers/')]/strong"


# ---------- SETUP ----------

async def save_cookies(context):
    """Saves browser state (cookies/local storage) to a file."""
    try:
        await context.storage_state(path=FACEBOOK_COOKIES_FILE)
        print("[INFO] Cookies/State saved for future sessions.")
    except Exception as e:
        print(f"[WARNING] Could not save cookies: {e}")

async def load_cookies(context, page) -> bool:
    """
    In Playwright, we usually pass storage_state at context creation.
    If we want to check if it worked:
    """
    if not os.path.exists(FACEBOOK_COOKIES_FILE):
        return False
    
    try:
        # Since context is already created with storage_state if file existed,
        # we just check login status.
        print("[INFO] Checking login status...")
        await page.goto("https://www.facebook.com")
        await asyncio.sleep(5) # Wait for load

        # Check if login was successful by looking for an element that shouldn't be on the login page
        try:
            await page.wait_for_selector("//div[@aria-label='Your profile']", timeout=5000)
            print("[INFO] Cookie login successful.")
            return True
        except Exception:
            print("[WARNING] Cookie login failed or expired.")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to load cookies/check login: {e}")
        return False

async def fb_manual_login(page, context):
    await page.goto("https://www.facebook.com/login")
    print("\n[MANUAL LOGIN REQUIRED]")
    print("1. Log in to Facebook in the opened browser.")
    print("2. Solve any 'I'm not a robot' / captcha / 2FA.")
    print("3. Make sure your feed/home is visible.")
    # Blocking input is fine here as it's the setup phase
    # await asyncio.to_thread(input, "\nWhen you are fully logged in, press ENTER here to continue... (DO NOT CLOSE THE BROWSER)\n")
    print("Manual login is not supported in headless server environments.")
    await save_cookies(context)


async def safe_inner_text(locator) -> str:
    """Return innerText safely, or empty string on error."""
    try:
        return (await locator.inner_text() or "").strip()
    except Exception:
        return ""


# ---------- NUMERIC EXTRACTOR ----------

def extract_like_number(raw: str) -> str:
    """
    Extract number like '123', '1.2K', '12,345' from the raw text.
    Returns '' if nothing numeric is found.
    """
    if not raw:
        return ""
    raw = raw.replace("\u00a0", " ").strip()
    m = re.search(r"([\d.,]+[KMB]?)", raw, re.IGNORECASE)
    if not m:
        return ""
    return m.group(1).upper()


def parse_fb_number(num_str: str) -> int:
    if not num_str:
        return 0
    s = str(num_str).upper().replace(',', '').strip()
    try:
        if 'K' in s:
            return int(float(s.replace('K', '')) * 1000)
        elif 'M' in s:
            return int(float(s.replace('M', '')) * 1000000)
        return int(float(s))
    except ValueError:
        return 0

# ---------- FOLLOWER COUNT ----------

async def get_follower_count(page) -> str:
    """
    Read follower count from the page header.
    Uses FOLLOWERS_STRONG_XPATH and same numeric extractor.
    """
    try:
        el = page.locator(FOLLOWERS_STRONG_XPATH).first
        txt = await safe_inner_text(el)
        num = extract_like_number(txt)
        return num or txt
    except Exception:
        return ""


# ---------- LIKES + COMMENTS/SHARES ----------

async def find_likes_for_caption_el(page, cap_locator) -> Tuple[str, Any]:
    """
    Starting from a caption <div>, walk up ancestors
    to find a container that has a likes span span[class*='x135b78x'].

    Returns:
        (likes_str, container_element or None)
    """
    current = cap_locator
    for _ in range(10):  # climb up at most 10 levels
        try:
            like_spans = await current.locator(LIKES_REL_XPATH).all()
        except Exception:
            return "0", None

        for sp in like_spans:
            txt = await safe_inner_text(sp)
            num = extract_like_number(txt)
            if num:
                return num, current  # return the container too

        # go one level up
        try:
            current = current.locator("xpath=..")
        except Exception:
            break

    return "0", None


async def get_comments_shares_from_container(page, container) -> Tuple[str, str]:
    """
    Extract comments and shares numbers from container:
      - find all spans with comments/shares class
      - comments = 1st numeric
      - shares   = 2nd numeric
    """
    comments = "0"
    shares = "0"
    nums: List[str] = []

    if container is None:
        return comments, shares

    try:
        cs_spans = await container.locator(COMMENTS_SHARES_REL_XPATH).all()
    except Exception:
        cs_spans = []

    for sp in cs_spans:
        txt = await safe_inner_text(sp)
        n = extract_like_number(txt)
        if n:
            nums.append(n)

    if len(nums) >= 1:
        comments = nums[0]
    if len(nums) >= 2:
        shares = nums[1]

    return comments, shares


# ---------- POST URL (using ancestor search) ----------

def parse_and_format_date(date_string: str) -> str:
    """
    Parses various Facebook date formats (relative and absolute)
    and returns a date string in 'DD/MM/YYYY' format.
    """
    if not date_string:
        return ""

    now = datetime.now()
    date_string_lower = date_string.lower().strip()

    # 1. Handle relative times and "Today"
    if 'now' in date_string_lower:
        return now.strftime('%d/%m/%Y')
        
    if 'today' in date_string_lower:
        return now.strftime('%d/%m/%Y')

    if 'yesterday' in date_string_lower:
        return (now - timedelta(days=1)).strftime('%d/%m/%Y')

    # Handle minutes (e.g., "12m", "12 mins")
    match_m = re.search(r'(\d+)\s*(?:m|min|mins|minute|minutes)\b', date_string_lower)
    if match_m:
        return (now - timedelta(minutes=int(match_m.group(1)))).strftime('%d/%m/%Y')

    # Handle hours (e.g., "2h", "2 hrs")
    match_h = re.search(r'(\d+)\s*(?:h|hr|hrs|hour|hours)\b', date_string_lower)
    if match_h:
        return (now - timedelta(hours=int(match_h.group(1)))).strftime('%d/%m/%Y')

    match_d = re.search(r'(\d+)\s*(?:d|day|days)\b', date_string_lower)
    if match_d:
        days_ago = int(match_d.group(1))
        return (now - timedelta(days=days_ago)).strftime('%d/%m/%Y')

    match_w = re.search(r'(\d+)\s*(?:w|week|weeks)\b', date_string_lower)
    if match_w:
        weeks_ago = int(match_w.group(1))
        return (now - timedelta(weeks=weeks_ago)).strftime('%d/%m/%Y')

    # 2. Handle absolute dates (from aria-label or older posts)
    try:
        # Clean the string for parsing
        cleaned_date_string = re.sub(r'\s+at\s+\d{1,2}:\d{2}.*', '', date_string, flags=re.IGNORECASE)
        cleaned_date_string = re.sub(r'^\w+,\s*', '', cleaned_date_string)

        formats_to_try = [
            '%d %B %Y', '%B %d, %Y', '%d %B', '%B %d',
        ]

        for fmt in formats_to_try:
            try:
                dt_obj = datetime.strptime(cleaned_date_string.strip(), fmt)
                if '%Y' not in fmt:
                    dt_obj = dt_obj.replace(year=now.year)
                    if dt_obj > now: # If date is in the future, it must be from last year
                        dt_obj = dt_obj.replace(year=now.year - 1)
                return dt_obj.strftime('%d/%m/%Y')
            except ValueError:
                continue
    except Exception:
        pass

    # If we couldn't parse it and it doesn't look like a standard date string, return empty
    # This prevents returning garbage like hashtags or button text
    if re.search(r'\d', date_string) or any(k in date_string_lower for k in ['just now', 'yesterday']):
        return date_string
    return ""

async def get_post_details_for_caption_el(page, cap_locator) -> Tuple[str, str]:
    """
    Starting from the caption element, walk up ancestors.
    On each ancestor, find <a> with /posts/, /videos/, /photos/, or /reel/ in href.

    Prefer URLs that DO NOT contain 'comment_id=' or 'reply_comment_id='
    (to avoid comment permalinks). If no clean URL found, fall back to
    the first candidate. Returns (url, date_text).
    """
    current = cap_locator
    for _ in range(12):  # climb up a bit more
        try:
            links = await current.locator("a").all()
        except Exception:
            links = []

        candidates: List[Tuple[str, str]] = []
        for a in links:
            try:
                href = await a.get_attribute("href") or ""
                txt = await safe_inner_text(a)
                aria = await a.get_attribute("aria-label")
            except Exception:
                continue

            href = href.strip()
            if not href:
                continue

            # Only consider post-like URLs
            if any(p in href for p in ("/posts/", "/videos/", "/photos/", "/reel/", "/watch", "/share/", "/status/", "permalink.php", "story.php")):
                # Make absolute if relative
                if href.startswith("/"):
                    href = "https://www.facebook.com" + href
                candidates.append((href, aria if aria else txt))

        if candidates:
            # prefer ones without comment_id / reply_comment_id
            primary = [
                (h, t) for (h, t) in candidates
                if "comment_id=" not in h and "reply_comment_id=" not in h
            ]
            
            search_pool = primary if primary else candidates
            
            # Prioritize candidates that look like timestamps
            for h, t in search_pool:
                t_lower = t.lower()
                # Must be short, not a hashtag, and contain date-like info
                if len(t) < 50 and not t.startswith('#') and (any(x in t_lower for x in ['yesterday', 'just now', 'mins', 'hrs', 'at', 'am', 'pm']) or re.search(r'\d', t)):
                    return h, t
            
            # Fallback: pick first non-hashtag link if available
            for h, t in search_pool:
                if not t.startswith('#') and len(t) < 50:
                    return h, t

            if search_pool:
                return search_pool[0]

        # go one level up
        try:
            current = current.locator("xpath=..")
        except Exception:
            break

    return "", ""


async def get_metrics_for_caption_el(page, cap_locator) -> Tuple[str, str, str, str, str, str, str]:
    """
    Full pipeline for metrics of a single caption element:
      - likes: using ancestor-walk logic
      - comments & shares: from the same container (if found)
      - url & date: from timestamp/post link, walking up from caption
      - views: from container (or parent)
      - post_type: inferred from URL/DOM
    """
    likes, container = await find_likes_for_caption_el(page, cap_locator)
    url, date_text = await get_post_details_for_caption_el(page, cap_locator)
    comments, shares = await get_comments_shares_from_container(page, container)
    
    views = "0"
    if container:
        views = await get_views_from_container(page, container)

    # If views not found, try walking up ancestors (up to 3 levels)
    if parse_fb_number(views) == 0:
        current = container if container else cap_locator
        for _ in range(5):
            try:
                current = current.locator("xpath=..")
                v = await get_views_from_container(page, current)
                if parse_fb_number(v) > 0:
                    views = v
                    break
            except Exception:
                break

    # Determine Post Type
    post_type = "Post"
    u_lower = url.lower()

    if "/reel/" in u_lower:
        post_type = "Reel"
    elif "/videos/" in u_lower:
        post_type = "Video"
    elif "/photos/" in u_lower:
        post_type = "Photo"
    elif parse_fb_number(views) > 0:
        post_type = "Video"
    elif url:
        # Fallback: if it has a post URL but isn't a video/reel, it's likely a photo on these pages
        post_type = "Photo"

    return likes, comments, shares, url, date_text, views, post_type


async def get_views_from_container(page, container) -> str:
    """
    Scans container text for 'X views' or 'X plays' pattern.
    """
    if container is None:
        return "0"

    # 1. Try regex on the whole container text
    try:
        txt = await safe_inner_text(container)
        m = re.search(r"([\d.,]+[KMB]?)\s*(?:views?|plays?)", txt, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    except Exception:
        pass

    # 2. Try finding specific elements with 'views' or 'plays' text inside the container
    try:
        # Use '.' to check text content of the element and its descendants
        candidates = await container.locator("xpath=.//span[contains(., 'views') or contains(., 'plays') or contains(., 'Views') or contains(., 'Plays')]").all()
        for cand in candidates:
            txt = await safe_inner_text(cand)
            m = re.search(r"([\d.,]+[KMB]?)\s*(?:views?|plays?)", txt, re.IGNORECASE)
            if m:
                return m.group(1).upper()
    except Exception:
        pass

    return "0"

async def extract_mentions(page, el) -> List[str]:
    """
    Extract text from <a> tags inside the caption element, excluding hashtags.
    """
    mentions = []
    try:
        links = await el.locator("a").all()
        for link in links:
            txt = await safe_inner_text(link)
            # Exclude hashtags and 'See more'
            if txt and not txt.startswith('#') and "See more" not in txt and "See Translation" not in txt:
                mentions.append(txt)
    except Exception:
        pass
    return list(set(mentions))

# ---------- PER-SCROLL COLLECTION (SMART-STOP CAPTION LOGIC + METRICS) ----------

async def collect_captions_step(
    page,
    seen: Set[str],
    posts: List[Dict[str, Any]],
) -> int:
    """
    One step: read all caption-class elements currently in DOM
    and add NEW non-empty caption + likes + comments + shares + url
    to the 'posts' list.
    Deduplicate by caption text.

    Returns: how many *new* captions were added this step.
    """
    try:
        elements = await page.locator(CAPTION_XPATH).all()
    except Exception:
        print("[STEP] No caption elements found this step.")
        return 0

    print(f"[STEP] Found {len(elements)} caption-class elements this step")

    added = 0

    for el in elements:
        # Attempt to click 'See more' to expand caption
        try:
            see_more = el.locator("xpath=.//div[text()='See more']")
            if await see_more.is_visible():
                await see_more.click()
                await asyncio.sleep(0.5)
        except Exception:
            pass

        # 1) Caption text (same pattern as your smart-stop code)
        text = await safe_inner_text(el)

        # If still empty, try a child span[@dir='auto']
        if not text:
            try:
                span = el.locator("xpath=.//span[@dir='auto']").first
                text = await safe_inner_text(span)
            except Exception:
                text = ""

        text = (text or "").strip()
        if not text:
            continue

        # Dedup by caption text
        if text in seen:
            continue

        # 2) Likes + Comments + Shares + URL + Date
        likes, comments, shares, url, date_text, views, post_type = await get_metrics_for_caption_el(page, el)
        formatted_date = parse_and_format_date(date_text)

        mentions = await extract_mentions(page, el)
        
        likes_val = parse_fb_number(likes)
        comments_val = parse_fb_number(comments)
        shares_val = parse_fb_number(shares)
        views_val = parse_fb_number(views)
        engagement = likes_val + comments_val + shares_val

        seen.add(text)
        posts.append(
            {
                "caption": text,
                "type": post_type,
                "date": formatted_date,
                "likes": likes_val,
                "comments": comments_val,
                "shares": shares_val,
                "views": views_val,
                "url": url,
                "mentions": mentions,
                "engagement": engagement
            }
        )
        added += 1
        print(
            f"  [+] New caption: {text[:80]!r} | Type: {post_type} | "
            f"Date: {formatted_date} | Likes: {likes} | Comments: {comments} | Shares: {shares} | Views: {views} | URL: {url}"
        )

    return added


# ---------- MAIN ----------

async def process_page(context, page_url, semaphore):
    async with semaphore:
        page_data = None
        print(f"\n[STEP] Processing page: {page_url}")
        page = await context.new_page()
        
        # Optimization: Block images and media to speed up loading
        await page.route("**/*", lambda route: route.abort() 
            if route.request.resource_type in ["image", "media"] 
            else route.continue_())

        try:
            await page.goto(page_url, wait_until="domcontentloaded")
            await asyncio.sleep(4)
            
            followers = await get_follower_count(page)
            if followers:
                print(f"[INFO] Followers count: {followers} -> {parse_fb_number(followers)}")
            else:
                print("[INFO] Could not read followers count.")
            followers_val = parse_fb_number(followers)
            
            seen_texts: Set[str] = set()
            posts_ordered: List[Dict[str, Any]] = []
            
            print("[STEP] Initial capture before scrolling...")
            await collect_captions_step(page, seen_texts, posts_ordered)
            
            max_scrolls = 100
            no_new_limit = 5
            no_new_in_row = 0
            
            last_height = await page.evaluate("document.body.scrollHeight")
            
            for i in range(max_scrolls):
                await page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
                await asyncio.sleep(1.5) # Reduced sleep time for speed
                
                new_captions = await collect_captions_step(page, seen_texts, posts_ordered)
                
                if new_captions == 0:
                    no_new_in_row += 1
                else:
                    no_new_in_row = 0
                
                new_height = await page.evaluate("document.body.scrollHeight")
                if new_height == last_height:
                    if no_new_in_row >= 2:
                        break
                last_height = new_height
                
                if no_new_in_row >= no_new_limit:
                    break
            
            page_data = {
                "page_url": page_url,
                "followers": followers_val,
                "total_posts": len(posts_ordered),
                "scraped_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "posts": [
                    {
                        "caption": p["caption"],
                        "type": p["type"],
                        "date": p["date"],
                        "likes": p["likes"],
                        "comments": p["comments"],
                        "shares": p["shares"],
                        "post_url": p["url"],
                        "views": p.get("views", 0),
                        "mentions": p["mentions"],
                        "engagement": p["engagement"]
                    }
                    for p in posts_ordered
                ],
                "status": "Active"
            }
            
        except Exception as e:
            print(f"[ERROR] Error processing {page_url}: {e}")
        finally:
            await page.close()
        return page_data

async def main_async():
    print("=== Scrape ALL captions + likes + comments + shares + followers + URL (smart-stop) ===\n")

    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=True, args=["--start-maximized", "--disable-notifications"])
        
        # Create context with storage state if available
        context_args = {"viewport": None} # Disable viewport to allow maximize
        if os.path.exists(FACEBOOK_COOKIES_FILE):
            context_args["storage_state"] = FACEBOOK_COOKIES_FILE
            
        context = await browser.new_context(**context_args)
        
        try:
            # Try to log in with cookies first
            page = await context.new_page()
            if not await load_cookies(context, page):
                await fb_manual_login(page, context)
            await page.close()
            
            # Process pages concurrently with a limit
            semaphore = asyncio.Semaphore(5)
            tasks = [process_page(context, url, semaphore) for url in TARGET_PAGES]
            results = await asyncio.gather(*tasks)
            
            all_pages_data = []
            for p_data in results:
                if p_data: all_pages_data.append(p_data)
            
            current_date = datetime.now().strftime("%Y-%m-%d")
            json_data = {
                "run_date": current_date,
                "pages": all_pages_data
            }
            
            await fb_collection.update_one(
                {"run_date": current_date},
                {"$set": json_data},
                upsert=True
            )
            print(f"\n[INFO] Saved data to MongoDB for date: {current_date}")
                
        finally:
            # input("\nPress ENTER to close browser...")
            await browser.close()

def main():
    asyncio.run(main_async())


if __name__ == "__main__":
    main()
