import time
import re
import json
import os
from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import List, Set, Dict, Any, Tuple
from datetime import datetime, timedelta
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.service import Service
from selenium.webdriver.edge.options import Options
from selenium.common.exceptions import (
    StaleElementReferenceException,
    NoSuchElementException,
    WebDriverException,
)
from webdriver_manager.microsoft import EdgeChromiumDriverManager

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FACEBOOK_COOKIES_FILE = os.path.join(BASE_DIR, "facebook_cookies.json")

@router.get("/data")
async def get_facebook_data(post_type: str = Query(None)):
    file_path = os.path.join(BASE_DIR, "facebook_daily_scrape.json")
    
    if not os.path.exists(file_path):
        return {"run_date": None, "pages": []}
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        if post_type:
            for page in data.get("pages", []):
                if "posts" in page:
                    page["posts"] = [
                        p for p in page["posts"] 
                        if p.get("type", "").lower() == post_type.lower()
                    ]
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data: {str(e)}")

TARGET_PAGES = [
    "https://www.facebook.com/Appolitics.Official/",
    "https://www.facebook.com/bankuseenuu",
    "https://www.facebook.com/profile.php?id=100093444206800",
    "https://www.facebook.com/profile.php?id=100092200324811&mbextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100087471274626",
    "https://www.facebook.com/chalachusamle",
    "https://www.facebook.com/comedypfrofessor",
    "https://www.facebook.com/Comedytrigger3",
    "https://www.facebook.com/Degreestudentzikkadaa/",
    "https://www.facebook.com/doubledoseA2Z",
    "https://www.facebook.com/EpicPoliticalComments",
    "https://www.facebook.com/fasakme",
    "https://www.facebook.com/FUNtasticTelugu",
    "https://www.facebook.com/share/1DAxQgPccY/",
    "https://www.facebook.com/share/18pX2qumts/",
    "https://www.facebook.com/share/1ARZqt9KQT/",
    "https://www.facebook.com/share/166frghErf/",
    "https://www.facebook.com/profile.php?id=61572380413251",
    "https://www.facebook.com/PointBlankTvTelugu",
    "https://www.facebook.com/share/14daUrANNb/",
    "https://www.facebook.com/share/1AWelJ8j68D/?mbextid=wwXlfr",
    "https://www.facebook.com/PointBlankTvDigital",
    "https://www.facebook.com/ApNextCM/",
    "https://www.facebook.com/areychari",
    "https://www.facebook.com/profile.php?id=100087598966166",
    "https://www.facebook.com/BalayyaPunch/"
]

# Caption container (same as in your smart-stop code)
CAPTION_XPATH = (
    "//div[contains(@class,'xdj266r') and contains(@class,'x14z9mp') "
    "and contains(@class,'xat24cr') and contains(@class,'x1lziwak') "
    "and contains(@class,'x1vvkbs') and contains(@class,'x126k92a')]"
)

# Likes span class inside the same post area
LIKES_REL_XPATH = ".//span[contains(@class,'x135b78x')]"

# Comments / shares span class (same for both, order differs)
COMMENTS_SHARES_REL_XPATH = (
    ".//span[contains(@class,'xdj266r') and contains(@class,'x14z9mp') "
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

def create_driver():
    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-notifications")
    try:
        service = Service(EdgeChromiumDriverManager().install())
        return webdriver.Edge(service=service, options=opts)
    except Exception as e:
        print(f"\n[WARNING] Failed to initialize Edge Driver via manager: {e}")
        print("Attempting fallback to system/Selenium Manager...")
        try:
            return webdriver.Edge(options=opts)
        except Exception as e2:
            print(f"\n[CRITICAL] Failed to initialize Edge Driver: {e2}")
            print("Please check your internet connection or ensure 'msedgedriver' is in your PATH.")
            if __name__ == "__main__":
                raise SystemExit(1)
            raise HTTPException(status_code=500, detail=f"Driver initialization failed: {e2}")


def save_cookies(driver):
    """Saves browser cookies to a file."""
    try:
        with open(FACEBOOK_COOKIES_FILE, 'w') as f:
            json.dump(driver.get_cookies(), f, indent=2)
        print("[INFO] Cookies saved for future sessions.")
    except Exception as e:
        print(f"[WARNING] Could not save cookies: {e}")

def load_cookies(driver) -> bool:
    """Loads cookies from a file and attempts to log in."""
    if not os.path.exists(FACEBOOK_COOKIES_FILE):
        return False
    
    try:
        with open(FACEBOOK_COOKIES_FILE, 'r') as f:
            cookies = json.load(f)
        
        # Go to the domain first to set cookies
        driver.get("https://www.facebook.com")
        time.sleep(2)

        for cookie in cookies:
            if 'expiry' in cookie:
                cookie['expiry'] = int(cookie['expiry'])
            driver.add_cookie(cookie)
        
        print("[INFO] Cookies loaded. Refreshing page to log in...")
        driver.refresh()
        time.sleep(5)

        # Check if login was successful by looking for an element that shouldn't be on the login page
        try:
            driver.find_element(By.XPATH, "//div[@aria-label='Your profile']")
            print("[INFO] Cookie login successful.")
            return True
        except NoSuchElementException:
            print("[WARNING] Cookie login failed. Manual login required.")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to load cookies: {e}")
        return False

def fb_manual_login(driver):
    driver.get("https://www.facebook.com/login")
    print("\n[MANUAL LOGIN REQUIRED]")
    print("1. Log in to Facebook in the opened browser.")
    print("2. Solve any 'I'm not a robot' / captcha / 2FA.")
    print("3. Make sure your feed/home is visible.")
    input("\nWhen you are fully logged in, press ENTER here to continue... (DO NOT CLOSE THE BROWSER)\n")
    save_cookies(driver)


def safe_inner_text(driver, el) -> str:
    """Return innerText safely, or empty string on stale."""
    try:
        txt = driver.execute_script("return arguments[0].innerText;", el)
        return (txt or "").strip()
    except StaleElementReferenceException:
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

def get_follower_count(driver) -> str:
    """
    Read follower count from the page header.
    Uses FOLLOWERS_STRONG_XPATH and same numeric extractor.
    """
    try:
        el = driver.find_element(By.XPATH, FOLLOWERS_STRONG_XPATH)
        txt = safe_inner_text(driver, el)
        num = extract_like_number(txt)
        return num or txt
    except Exception:
        return ""


# ---------- LIKES + COMMENTS/SHARES ----------

def find_likes_for_caption_el(driver, cap_el) -> Tuple[str, Any]:
    """
    Starting from a caption <div>, walk up ancestors
    to find a container that has a likes span span[class*='x135b78x'].

    Returns:
        (likes_str, container_element or None)
    """
    current = cap_el
    for _ in range(10):  # climb up at most 10 levels
        try:
            like_spans = current.find_elements(By.XPATH, LIKES_REL_XPATH)
        except StaleElementReferenceException:
            return "0", None

        for sp in like_spans:
            try:
                txt = safe_inner_text(driver, sp)
            except StaleElementReferenceException:
                continue

            num = extract_like_number(txt)
            if num:
                return num, current  # return the container too

        # go one level up
        try:
            current = current.find_element(By.XPATH, "./..")
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return "0", None


def get_comments_shares_from_container(driver, container) -> Tuple[str, str]:
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
        cs_spans = container.find_elements(By.XPATH, COMMENTS_SHARES_REL_XPATH)
    except StaleElementReferenceException:
        cs_spans = []

    for sp in cs_spans:
        txt = safe_inner_text(driver, sp)
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

    # 1. Handle relative times first (most common for recent posts)
    # "Just now", "5m", "2h" -> all mean today
    if 'now' in date_string_lower or re.search(r'^\d+\s*m$', date_string_lower) or re.search(r'^\d+\s*h$', date_string_lower):
        return now.strftime('%d/%m/%Y')

    if 'yesterday' in date_string_lower:
        return (now - timedelta(days=1)).strftime('%d/%m/%Y')

    match_d = re.search(r'^(\d+)\s*d$', date_string_lower)
    if match_d:
        days_ago = int(match_d.group(1))
        return (now - timedelta(days=days_ago)).strftime('%d/%m/%Y')

    match_w = re.search(r'^(\d+)\s*w$', date_string_lower)
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

    return date_string

def get_post_details_for_caption_el(driver, cap_el) -> Tuple[str, str]:
    """
    Starting from the caption element, walk up ancestors.
    On each ancestor, find <a> with /posts/, /videos/, /photos/, or /reel/ in href.

    Prefer URLs that DO NOT contain 'comment_id=' or 'reply_comment_id='
    (to avoid comment permalinks). If no clean URL found, fall back to
    the first candidate. Returns (url, date_text).
    """
    current = cap_el
    for _ in range(12):  # climb up a bit more
        try:
            links = current.find_elements(By.TAG_NAME, "a")
        except StaleElementReferenceException:
            links = []

        candidates: List[Tuple[str, str]] = []
        for a in links:
            try:
                href = a.get_attribute("href") or ""
                txt = safe_inner_text(driver, a)
                aria = a.get_attribute("aria-label")
            except StaleElementReferenceException:
                continue

            href = href.strip()
            if not href:
                continue

            # Only consider post-like URLs
            if any(p in href for p in ("/posts/", "/videos/", "/photos/", "/reel/")):
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
            if primary:
                return primary[0]
            # no clean one, fallback to first candidate (comment permalink)
            return candidates[0]

        # go one level up
        try:
            current = current.find_element(By.XPATH, "./..")
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return "", ""


def get_metrics_for_caption_el(driver, cap_el) -> Tuple[str, str, str, str, str, str, str]:
    """
    Full pipeline for metrics of a single caption element:
      - likes: using ancestor-walk logic
      - comments & shares: from the same container (if found)
      - url & date: from timestamp/post link, walking up from caption
      - views: from container (or parent)
      - post_type: inferred from URL/DOM
    """
    likes, container = find_likes_for_caption_el(driver, cap_el)
    url, date_text = get_post_details_for_caption_el(driver, cap_el)
    comments, shares = get_comments_shares_from_container(driver, container)
    
    views = "0"
    if container:
        views = get_views_from_container(driver, container)

    # If views not found, try walking up ancestors (up to 3 levels)
    if parse_fb_number(views) == 0:
        current = container if container else cap_el
        for _ in range(5):
            try:
                current = current.find_element(By.XPATH, "./..")
                v = get_views_from_container(driver, current)
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


def get_views_from_container(driver, container) -> str:
    """
    Scans container text for 'X views' or 'X plays' pattern.
    """
    if container is None:
        return "0"

    # 1. Try regex on the whole container text
    try:
        txt = safe_inner_text(driver, container)
        m = re.search(r"([\d.,]+[KMB]?)\s*(?:views?|plays?)", txt, re.IGNORECASE)
        if m:
            return m.group(1).upper()
    except Exception:
        pass

    # 2. Try finding specific elements with 'views' or 'plays' text inside the container
    try:
        # Use '.' to check text content of the element and its descendants
        candidates = container.find_elements(By.XPATH, ".//span[contains(., 'views') or contains(., 'plays') or contains(., 'Views') or contains(., 'Plays')]")
        for cand in candidates:
            txt = safe_inner_text(driver, cand)
            m = re.search(r"([\d.,]+[KMB]?)\s*(?:views?|plays?)", txt, re.IGNORECASE)
            if m:
                return m.group(1).upper()
    except Exception:
        pass

    return "0"

def extract_mentions(driver, el) -> List[str]:
    """
    Extract text from <a> tags inside the caption element, excluding hashtags.
    """
    mentions = []
    try:
        links = el.find_elements(By.TAG_NAME, "a")
        for link in links:
            txt = safe_inner_text(driver, link)
            # Exclude hashtags and 'See more'
            if txt and not txt.startswith('#') and "See more" not in txt and "See Translation" not in txt:
                mentions.append(txt)
    except Exception:
        pass
    return list(set(mentions))

# ---------- PER-SCROLL COLLECTION (SMART-STOP CAPTION LOGIC + METRICS) ----------

def collect_captions_step(
    driver,
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
        elements = driver.find_elements(By.XPATH, CAPTION_XPATH)
    except Exception:
        print("[STEP] No caption elements found this step.")
        return 0

    print(f"[STEP] Found {len(elements)} caption-class elements this step")

    added = 0

    for el in elements:
        # Attempt to click 'See more' to expand caption
        try:
            see_more = el.find_element(By.XPATH, ".//div[text()='See more']")
            if see_more.is_displayed():
                driver.execute_script("arguments[0].click();", see_more)
                time.sleep(0.5)
        except Exception:
            pass

        # 1) Caption text (same pattern as your smart-stop code)
        text = safe_inner_text(driver, el)

        # If still empty, try a child span[@dir='auto']
        if not text:
            try:
                span = el.find_element(By.XPATH, ".//span[@dir='auto']")
                text = safe_inner_text(driver, span)
            except Exception:
                text = ""

        text = (text or "").strip()
        if not text:
            continue

        # Dedup by caption text
        if text in seen:
            continue

        # 2) Likes + Comments + Shares + URL + Date
        likes, comments, shares, url, date_text, views, post_type = get_metrics_for_caption_el(driver, el)
        formatted_date = parse_and_format_date(date_text)

        mentions = extract_mentions(driver, el)
        
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

def main():
    print("=== Scrape ALL captions + likes + comments + shares + followers + URL (smart-stop) ===\n")

    driver = create_driver()

    try:
        # Try to log in with cookies first
        if not load_cookies(driver):
            fb_manual_login(driver)

        all_pages_data = []
        all_posts_flat = []

        for page_url in TARGET_PAGES:
            print(f"\n[STEP] Processing page: {page_url}")
            try:
                driver.get(page_url)
                time.sleep(8)

                # -------- Followers (once) --------
                followers = get_follower_count(driver)
                if followers:
                    print(f"[INFO] Followers count: {followers} -> {parse_fb_number(followers)}")
                else:
                    print("[INFO] Could not read followers count.")
                followers_val = parse_fb_number(followers)

                seen_texts: Set[str] = set()
                posts_ordered: List[Dict[str, Any]] = []

                # Initial capture before scrolling
                print("[STEP] Initial capture before scrolling...")
                collect_captions_step(driver, seen_texts, posts_ordered)

                # Smart scroll control
                max_scrolls = 100
                no_new_limit = 5
                no_new_in_row = 0

                last_height = driver.execute_script("return document.body.scrollHeight")

                for i in range(max_scrolls):
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(3)

                    new_captions = collect_captions_step(driver, seen_texts, posts_ordered)

                    if new_captions == 0:
                        no_new_in_row += 1
                    else:
                        no_new_in_row = 0

                    new_height = driver.execute_script("return document.body.scrollHeight")

                    if new_height == last_height:
                        if no_new_in_row >= 2:
                            break
                    last_height = new_height

                    if no_new_in_row >= no_new_limit:
                        break

                # Add to all_pages_data
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
                all_pages_data.append(page_data)

                # Add to flat list
                for p in posts_ordered:
                    p_flat = p.copy()
                    p_flat['page_url'] = page_url
                    p_flat['followers'] = followers_val
                    p_flat['mentions'] = ", ".join(p['mentions'])
                    all_posts_flat.append(p_flat)

            except WebDriverException as e:
                if "invalid session id" in str(e).lower():
                    print(f"\n[CRITICAL] Browser session is invalid (browser closed?). Stopping script.")
                    break
                print(f"[ERROR] WebDriver error processing {page_url}: {e}")
            except Exception as e:
                print(f"[ERROR] Error processing {page_url}: {e}")
                continue

        # ---------- SAVE TO JSON ----------
        json_output_file = "facebook_daily_scrape.json"
        json_data = {
            "run_date": datetime.now().strftime("%Y-%m-%d"),
            "pages": all_pages_data
        }
        with open(json_output_file, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
        print(f"\n[INFO] Saved JSON file: {json_output_file}")

        # ---------- SAVE TO EXCEL ----------
        if all_posts_flat:
            df = pd.DataFrame(all_posts_flat)
            output_file = "fb_multi_page_scrape.xlsx"
            df.to_excel(output_file, index=False)
            print(f"\n[INFO] Saved Excel file: {output_file}")
        else:
            print("\n[INFO] No posts collected, Excel not created.")

    finally:
        input("\nPress ENTER to close browser...")
        driver.quit()


if __name__ == "__main__":
    main()
