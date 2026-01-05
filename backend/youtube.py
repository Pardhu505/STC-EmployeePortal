import json
import os
import time
import random
from datetime import datetime, date, timedelta
from typing import List, Dict, Any
from collections import defaultdict
import concurrent.futures

from fastapi import APIRouter, Query, BackgroundTasks

try:
    import yt_dlp
except ImportError:
    yt_dlp = None

# ==============================
# CONFIG & PATHS
# ==============================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEOS_FILE = os.path.join(BASE_DIR, "youtube_data_raw.json")
META_FILE = os.path.join(BASE_DIR, "youtube_meta.json")

CHANNEL_URLS = [
    "https://www.youtube.com/@teamlokesh4698", "https://www.youtube.com/c/AmaravatiVoice",
    "https://www.youtube.com/@wefor_CBN", "https://www.youtube.com/@CBNFORPEOPLE",
    "https://www.youtube.com/@TDPPunch", "https://www.youtube.com/c/CBNFORTHEBETTERNATION",
    "https://www.youtube.com/@dalapathiln", "https://www.youtube.com/@idhicorrect",
    "https://www.youtube.com/@Okeokkadu_cbn", "https://www.youtube.com/@WildWolfTelugu",
    "https://www.youtube.com/c/LNFORYUVA", "https://www.youtube.com/@Maheshmedia",
    "https://www.youtube.com/@massmama3679", "https://www.youtube.com/@meowmeowpilli7",
    "https://www.youtube.com/@OpenTalkTeam", "https://www.youtube.com/@tdpwhatsappstatus4135",
    "https://www.youtube.com/c/TheLeoNews", "https://www.youtube.com/c/WeSupportTDP",
    "https://www.youtube.com/@PopcornMediaofficial", "https://www.youtube.com/@RocketTeluguNews",
    "https://www.youtube.com/@TakeOneMedia99", "https://www.youtube.com/c/TDPActivist",
    "https://www.youtube.com/@ThinkAndhra", "https://www.youtube.com/@ThinkTollywood",
    "https://www.youtube.com/@TDP_YOUTH_WARRIORS", "https://www.youtube.com/@tdp_students",
    "https://www.youtube.com/@andhraism-q7i", "https://www.youtube.com/@tdpat175",
    "https://www.youtube.com/c/VoiceofTDP9", "https://www.youtube.com/@peopleopinion2024",
    "https://www.youtube.com/@FusuCk", "https://www.youtube.com/@tdpyuva675",
    "https://www.youtube.com/@bigbosscbn2059", "https://www.youtube.com/@pinkomedia",
    "https://www.youtube.com/@balayyapunch", "https://www.youtube.com/@WildWolfDigi",
    "https://www.youtube.com/@JaiiTdp", "https://www.youtube.com/@vanaramedia_official",
    "https://www.youtube.com/@vanara_politics", "https://www.youtube.com/@vanara_media",
    "https://www.youtube.com/@GangTdp", "https://www.youtube.com/@sharechey_mawa",
    "https://www.youtube.com/@AbbaKamalHassanYT", "https://www.youtube.com/@AlladistaTrolls-N",
    "https://www.youtube.com/@wearetdp", "https://www.youtube.com/@MemeRaPushpa",
    "https://www.youtube.com/@MemesBandi", "https://www.youtube.com/@sarcasticsadhana",
    "https://www.youtube.com/@SuperSubbuOfficial", "https://www.youtube.com/@IamwithNCBN",
    "https://www.youtube.com/@thaggedheley9", "https://www.youtube.com/@myfirstvoteforcbn",
    "https://www.youtube.com/@Janagalam", "https://www.youtube.com/@TDPforpeople",
    "https://www.youtube.com/@leoentertainmentchannel", "https://www.youtube.com/@taja3046",
    "https://www.youtube.com/@apnextcm-jo2ee", "https://www.youtube.com/@jananadi-2024",
    "https://www.youtube.com/@tdpcommunity.official", "https://www.youtube.com/@appolitics_2024",
    "https://www.youtube.com/channel/UC8VZtBNbrLgrazQF-SrfODA", "https://www.youtube.com/@nayapolitics.Official",
    "https://www.youtube.com/@peoplemedia-en9fy", "https://www.youtube.com/@yuvagalamofficial",
    "https://www.youtube.com/@cbnfollower9999", "https://www.youtube.com/@tdpkutumbam9731",
    "https://www.youtube.com/@CbnTheLegend2024", "https://www.youtube.com/@tdptrends.official",
    "https://www.youtube.com/@tdpat_175", "https://www.youtube.com/@poweroftdp.official",
    "https://www.youtube.com/@votefortdp2024", "https://www.youtube.com/@Telugu_Sena",
    "https://www.youtube.com/@news24.telugu", "https://www.youtube.com/@thinkandvote.",
    "https://www.youtube.com/@TeluguSena.Officia", "https://www.youtube.com/@TeluguSena2024",
    "https://www.youtube.com/@TeamTdp-xd6yf", "https://www.youtube.com/@ChaitanyaRadhamTdp",
    "https://www.youtube.com/@TDPYOUTH963", "https://www.youtube.com/@yuvasena_tdp",
    "https://www.youtube.com/@tillu_trolls", "https://www.youtube.com/@PointBlankTelugu",
    "https://www.youtube.com/@PointBlankTvDigital", "https://www.youtube.com/@PillaluRaMeeru3",
    "https://www.youtube.com/@imwithlokesh", "https://www.youtube.com/@localpolitics-z8d",
    "https://www.youtube.com/@vamsikgottipati", "https://www.youtube.com/@publicvision-n5n",
    "https://www.youtube.com/channel/UCGueOBvBu3N3CuSZDB1jrJg", "https://www.youtube.com/@politicalikon",
    "https://www.youtube.com/@crazykanna0", "https://www.youtube.com/channel/UCX0xQCu0wNNPvka6edHNRew",
    "https://www.youtube.com/@publicpulse-ap", "https://www.youtube.com/@ap_talks..0",
    "https://www.youtube.com/@BANKUSEENU", "https://www.youtube.com/@jaitelugudesam2029",
    "https://www.youtube.com/@letstalk-telugu", "https://www.youtube.com/@tdpera",
    "https://www.youtube.com/@sivazee", "https://www.youtube.com/channel/UCJCsh1Th4Rze_orin4gzkRg",
    "https://www.youtube.com/channel/UC3MpAScuECXdkBp0Oks2ouA", "https://www.youtube.com/@tdpstatus",
    "https://www.youtube.com/@Jagan730FakePromises", "https://www.youtube.com/@We_For_CBN",
    "https://www.youtube.com/@lokeshforpeople.29", "https://www.youtube.com/@teluguvaradhi.official",
    "https://www.youtube.com/@RMSNEWS7", "https://www.youtube.com/@TDP_LOINS",
    "https://www.youtube.com/@appolitics.official", "https://www.youtube.com/@WildWolfFocus",
    "https://www.youtube.com/@WildWolfVijayawada", "https://www.youtube.com/@WildWolfTVBhumi",
    "https://www.youtube.com/@WildWolfTVHealth", "https://www.youtube.com/@WildWolfLife",
    "https://www.youtube.com/@WildWolfTrending", "https://www.youtube.com/@SaaguNela",
    "https://www.youtube.com/@AndhrulaAtmagouravam", "https://www.youtube.com/@YesVCan",
    "https://www.youtube.com/@Ap_Poitical_Pulse", "https://www.youtube.com/@seemaraja557",
    "https://www.youtube.com/@SeemaRaja2.O", "https://www.youtube.com/@SEEMARAJASHORTVIDEOS",
    "https://www.youtube.com/@Team_CBN", "https://www.youtube.com/@itscbnmark",
    "https://www.youtube.com/@LeoTodayNews", "https://www.youtube.com/@LeoBuzz",
    "https://www.youtube.com/@LeoTelangana", "https://www.youtube.com/@chaitanyaratham1",
    "https://www.youtube.com/@Raitunestham", "https://www.youtube.com/@journalistvali",
    "https://www.youtube.com/@Tdpyuvashakthi", "https://www.youtube.com/@TrendNaraLokesh",
    "https://www.youtube.com/@CycleSena", "https://www.youtube.com/@TrendCBN",
    "https://www.youtube.com/@tdpsena", "https://www.youtube.com/@RISEOFTDP",
    "https://www.youtube.com/@metanewstelugu", "https://www.youtube.com/@MetaPlustelugu",
    "https://www.youtube.com/c/NaraChandrababuNaiduofficial", "https://www.youtube.com/@naralokeshofficial",
    "https://www.youtube.com/c/TeluguDesamPartyOfficial", "https://www.youtube.com/@andhrachoice",
    "https://www.youtube.com/@TeamYellowtdp", "https://www.youtube.com/@SyeRaaTelugoda",
    "https://www.youtube.com/@tdpdalam", "https://www.youtube.com/@ElevenKids6093",
    "https://www.youtube.com/@justicechowdharyyy", "https://www.youtube.com/@voiceofandhrapradesh",
    "https://www.youtube.com/@journalistreport", "https://www.youtube.com/@JanaChaithanyam",
    "https://www.youtube.com/@DrPonguruNarayanaOfficial", "https://www.youtube.com/@UstaadTrolls",
    "https://www.youtube.com/@Andhrula_Galam", "https://www.youtube.com/@tdpfanboy",
    "https://www.youtube.com/@AaveshamRaja", "https://www.youtube.com/@ItheyOk",
    "https://www.youtube.com/@JspYuvashakthi", "https://www.youtube.com/@LetsTalkAP",
    "https://www.youtube.com/@PunchPaduddi", "https://www.youtube.com/@aphatesjagan",
    "https://www.youtube.com/@PowerTeluguTVChannel", "https://www.youtube.com/@FactsAboutAP",
    "https://www.youtube.com/@AnnaNTROfficial", "https://www.youtube.com/@TDPSpeakers",
    "https://www.youtube.com/@Apvoiceofficial", "https://www.youtube.com/@tdpfangirl",
    "https://www.youtube.com/@anthanthamatrame", "https://www.youtube.com/@Santhubabuyellapu7569",
    "https://www.youtube.com/@PoliticalMoji2.0", "https://www.youtube.com/@TheTrendyNewsOfficial",
    "https://www.youtube.com/@TeluguVaradhi-2024", "https://www.youtube.com/@tdppalakondaofficial",
    "https://www.youtube.com/@tdpkurupamofficial", "https://www.youtube.com/@TdpParvathipuram.official",
    "https://www.youtube.com/@Tdpsalurofficial", "https://www.youtube.com/@Tdparakuvalleyofficial",
    "https://www.youtube.com/@tdppaderuOfficial", "https://www.youtube.com/@tdprampachodavaramofficial",
    "https://www.youtube.com/@TDPlchchapuramOfficial", "https://www.youtube.com/@Tdppalasaofficial",
    "https://www.youtube.com/@Tdptekkaliofficial", "https://www.youtube.com/@Tdppathapatnam.official",
    "https://www.youtube.com/@TdpSrikakulamofficial", "https://www.youtube.com/@TdpAmadalavalasaofficial",
    "https://www.youtube.com/@TdpNarasannapetaofficial", "https://www.youtube.com/@tdpetcherlaofficial",
    "https://www.youtube.com/@tdprajamofficial", "https://www.youtube.com/@tdpbobbiliofficial",
    "https://www.youtube.com/@tdpcheepurupalliofficial", "https://www.youtube.com/@tdpgajapathinagaram.official",
    "https://www.youtube.com/@tdpnellimarla-ue9vf", "https://www.youtube.com/@tdpvizianagaram1982",
    "https://www.youtube.com/@TDPChodavaramOfficial", "https://www.youtube.com/@TDPMadugulaOfficial",
    "https://www.youtube.com/@TDPAnakapalleofficial", "https://www.youtube.com/@TDPPendurthiofficial",
    "https://www.youtube.com/@TDPYelamanchiliofficial", "https://www.youtube.com/@TDPPayakaraopetaofficial",
    "https://www.youtube.com/@TdpNarsipatnamofficial", "https://www.youtube.com/@Tdp.Badvel",
    "https://www.youtube.com/@Tdp.Kadapa", "https://www.youtube.com/@TdpPulivendla142",
    "https://www.youtube.com/@tdpkamalapuramac", "https://www.youtube.com/@tdpjammalamaduguac",
    "https://www.youtube.com/@TDP.Proddatur", "https://www.youtube.com/@tdp.mydukur",
    "https://www.youtube.com/@TDP__Nandikotkur", "https://www.youtube.com/@Tdp.panyam",
    "https://www.youtube.com/@Tdp.Nandyal", "https://www.youtube.com/@Tdp.Banaganapalle",
    "https://www.youtube.com/@tdp.kurnool", "https://www.youtube.com/@tdppattikonda",
    "https://www.youtube.com/@tdp.kodumur", "https://www.youtube.com/@tdpyemmiganur-i5g",
    "https://www.youtube.com/@tdpmantralayam", "https://www.youtube.com/@tdpadoniofficial",
    "https://www.youtube.com/@tdpalur", "https://www.youtube.com/@singanamalatdp",
    "https://www.youtube.com/@kalyandurgtdp", "https://www.youtube.com/@rayadurgtdp",
    "https://www.youtube.com/@Tdp.Tadpatri", "https://www.youtube.com/@TdpUravakonda",
    "https://www.youtube.com/@tdpanantapururban", "https://www.youtube.com/@TDPGUNTAKAL",
    "https://www.youtube.com/@SudhakarTalks", "https://www.youtube.com/@MMTT_2024",
    "https://www.youtube.com/@pillajagannadham-420", "https://www.youtube.com/channel/UCQqnLaxZp51oeIk7085KdSQ",
    "https://www.youtube.com/@tdp_connects", "https://www.youtube.com/@telugupatriot-kn",
    "https://www.youtube.com/@marolokam7", "https://www.youtube.com/@surthanistudio",
    "https://www.youtube.com/@kiraakrp", "https://www.youtube.com/@wallposter_official",
    "https://www.youtube.com/@isa001", "https://www.youtube.com/@tdptrends",
    "https://www.youtube.com/channel/UCW1B5hR0huuIUKQsw1HbAlA", "https://www.youtube.com/channel/UC9nuBez-ClebU7zktWPaXpg",
    "https://www.youtube.com/channel/UCFauz0-tMi0XANULkPsxm0w", "https://www.youtube.com/@vanara_telugu",
    "https://www.youtube.com/@vanarabhakti", "https://www.youtube.com/@vanara_shorts",
    "https://www.youtube.com/@kavya_reports", "https://www.youtube.com/channel/UCLGo-ZxGLnFMWFeUvUs04bg",
    "https://www.youtube.com/@PublicVox-m8b", "https://www.youtube.com/@TeluguTrending",
    "https://www.youtube.com/@bharathimedia", "https://www.youtube.com/@BharathiTVTelugu",
    "https://www.youtube.com/@TeluguSamajam", "https://www.youtube.com/@politicaltrolls",
    "https://studio.youtube.com/channel/UCrF-x3Wfdr3wYrcYA0eoNqg", "https://studio.youtube.com/channel/UCaSMGWNV-PU70xq8W5w5BZw",
    "https://www.youtube.com/@TeluguYuvathaOfficial", "https://www.youtube.com/@TeluguMahilaOfficial",
    "https://www.youtube.com/@TeluguRaithuOfficial", "https://www.youtube.com/@APTNTUCOfficial",
    "https://www.youtube.com/@APTNSFOfficial", "https://www.youtube.com/@HelloAPByeByeYCP_",
    "https://www.youtube.com/channel/UCMxY_NpHsPuoA6fphA84U7w", "https://www.youtube.com/channel/UCd4h_MoOoEGF4TTsF2KXjEw",
    "https://www.youtube.com/channel/UC6EyS-RlziC3C_nIQX6IXAA", "https://www.youtube.com/channel/UCVgZ1ku8MeDQQnM4kfjaqJQ",
    "https://www.youtube.com/channel/UC5MOlwPyGbeeCoarq1EkSJQ", "https://www.youtube.com/channel/UCxuaTMzPXw0RwGxQeCZNN5A",
    "https://www.youtube.com/channel/UCWSsi4xeyYoJ2L9tA7glJQg", "https://www.youtube.com/@CBNUpdats-c5g",
    "https://www.youtube.com/@SudhakarShorts007", "https://www.youtube.com/@AnalystSudhakar",
    "https://www.youtube.com/@DynamicAndhra", "https://www.youtube.com/@CBNFORTHEBETTERFUTURE",
    "https://www.youtube.com/@NaraLokeshUpdates", "https://www.youtube.com/@s5politicsnewstelugu",
    "https://www.youtube.com/@TrendsetterTelugu", "https://www.youtube.com/@rajaktalks9",
    "https://www.youtube.com/@rvmc893", "https://www.youtube.com/@DailyLooksOfficial",
    "https://www.youtube.com/@sreenitv", "https://www.youtube.com/@MSRTV",
    "https://www.youtube.com/@pointoutnewsexclusive", "https://www.youtube.com/@POINTOUTNEWSTELUGU",
    "https://www.youtube.com/@Bestnewstelugu", "https://www.youtube.com/@janavahini-po6eu",
    "https://www.youtube.com/@cinemapower79", "https://www.youtube.com/@PrajaAdda",
    "https://www.youtube.com/@ManaChaitanyam-fl2fc", "https://www.youtube.com/@AADYATVTELUGU",
    "https://www.youtube.com/@aadyatalks", "https://www.youtube.com/@AADYAplus",
    "https://www.youtube.com/@ManaTelugu", "https://www.youtube.com/@MANAVELUGUtelugu",
    "https://www.youtube.com/@RedTvNews", "https://www.youtube.com/@redtvtelugu6943",
    "https://www.youtube.com/@FirstTelugu7164", "https://www.youtube.com/@FirstTelugudigital",
    "https://www.youtube.com/@manaandhraofficial", "https://www.youtube.com/@JoinYuvaGalam",
    "https://www.youtube.com/@cbnagain4576", "https://www.youtube.com/@IKMRNews",
    "https://www.youtube.com/@Ra_Kadili_Ra", "https://www.youtube.com/channel/UCTiP2rQ6K_eFovNU-w268uA",
    "https://www.youtube.com/@itdprayachoti", "https://www.youtube.com/@itdp..prajakshetram694",
    "https://www.youtube.com/@awcnews", "https://www.youtube.com/@SahithiTv2",
    "https://www.youtube.com/@TeluguCinemaBrother", "https://www.youtube.com/@AlwaysFilmy",
    "https://www.youtube.com/@FridayCulture", "https://www.youtube.com/@AvighnaForYou",
    "https://www.youtube.com/@cinemaculture2783", "https://www.youtube.com/@SimhapuriMedia",
    "https://www.youtube.com/@AlwaysPoliticalAdda", "https://www.youtube.com/@AvighnaTv",
    "https://www.youtube.com/c/Newsmarg", "https://www.youtube.com/channel/UCkndCpVT0EbSRQLv_8XUV7w",
    "https://www.youtube.com/channel/UCOCARzQmhZ1Mea8O3LVSAWA", "https://www.youtube.com/c/SahithiMedia",
    "https://www.youtube.com/@nbkculture3202", "https://www.youtube.com/c/AroundTelugu",
    "https://www.youtube.com/@GullyPolitics", "https://www.youtube.com/channel/UC1zWLJeefjDLIydXoaOPR7A",
    "https://www.youtube.com/@SunrayMedia", "https://www.youtube.com/@TollyHungama",
    "https://www.youtube.com/@trendingpoliticsnews", "https://www.youtube.com/@PrajaDarbarTV",
    "https://www.youtube.com/@politicaltrendingtv8080", "https://www.youtube.com/@politicalbuzztv1203",
    "https://www.youtube.com/@YbrantTV", "https://www.youtube.com/@TeluguPoliticalTrending",
    "https://www.youtube.com/@Movieblends", "https://www.youtube.com/@andhralifetv938",
    "https://www.youtube.com/@mixedcinemaculture", "https://www.youtube.com/@tollyfilms7037",
    "https://www.youtube.com/@nrijanasena", "https://www.youtube.com/@TeluguFilmyYT",
    "https://www.youtube.com/@FilmyHook", "https://www.youtube.com/@TajaFilmy",
    "https://www.youtube.com/@megaculture7378", "https://www.youtube.com/@APPrajaVaradhi-lf2bp",
    "https://www.youtube.com/@poweroftdp", "https://www.youtube.com/@Mana_Times",
    "https://www.youtube.com/@NavyandhraLive", "https://www.youtube.com/@Mana_Circle",
    "https://www.youtube.com/@Mixed-Channel", "https://www.youtube.com/@manacinematalks",
    "https://www.youtube.com/@JANAVARADHI", "https://www.youtube.com/@Mana_Politics_Live",
    "https://www.youtube.com/@Mana_Balam", "https://www.youtube.com/@123Nellore",
    "https://www.youtube.com/@ntimesnews", "https://www.youtube.com/@channel9hd",
    "https://www.youtube.com/@NDNNewsLive", "https://www.youtube.com/@TV24Studio",
    "https://www.youtube.com/@KavyasMedia", "https://www.youtube.com/@harshaguntupallivlogs5373",
    "https://www.youtube.com/@Kasalaahmed", "https://www.youtube.com/@pjnewsworld",
    "https://www.youtube.com/@ettelugunews", "https://www.youtube.com/@NationalistHub",
    "https://www.youtube.com/@NHTV24X7", "https://www.youtube.com/@GharshanaMedia",
    "https://www.youtube.com/@GharshanaMediaBvr", "https://www.youtube.com/@News25Channel",
    "https://www.youtube.com/@TeluguTodayOfficial", "https://www.youtube.com/@SasiMedia",
    "https://www.youtube.com/@AndhraVoice", "https://www.youtube.com/@lokeshpadayatra",
    "https://www.youtube.com/@GaganaMedia", "https://www.youtube.com/@RajaneethiLive",
    "https://www.youtube.com/@ChetanaMedia", "https://www.youtube.com/@MAHASENA-Rajesh",
    "https://www.youtube.com/@varahinews", "https://www.youtube.com/@Filmylookslive",
    "https://www.youtube.com/@jaganfailedCM", "https://www.youtube.com/@telugudaily",
    "https://www.youtube.com/@WallPost", "https://www.youtube.com/@KiranTV2022",
    "https://www.youtube.com/@KiranTVNews", "https://www.youtube.com/@LifeAndhraOfficial",
    "https://www.youtube.com/@BadudeBadudus", "https://www.youtube.com/@politicalmojitelugu",
    "https://www.youtube.com/@TdpFighters", "https://www.youtube.com/@apneedscbn8558",
    "https://www.youtube.com/@ITDPNALLARI", "https://www.youtube.com/@nijamAnna",
    "https://www.youtube.com/@DHONEITDPSUBBAREDDYANNAYUVASEN", "https://www.youtube.com/@aadhyamedia388",
    "https://www.youtube.com/@AvighnaMedia", "https://www.youtube.com/@TeluguStates",
    "https://www.youtube.com/@AvighnaPolitical", "https://www.youtube.com/channel/UCKU3y2fHgCUBqE6n9fCbNrg",
    "https://www.youtube.com/@Vocal_of_Local", "https://www.youtube.com/@TEAM_LN",
    "https://www.youtube.com/@YuvaSena2024", "https://www.youtube.com/@Santhubabu2.0-rd7dp",
    "https://www.youtube.com/@KirikiriTvchannel", "https://www.youtube.com/@BhavishyathukuGuarantee",
    "https://www.youtube.com/@byebyejaganbyebyejagan", "https://www.youtube.com/@prajavedika3640",
    "https://www.youtube.com/@psychopovalicycleravali", "https://www.youtube.com/@YuvaGalamln"
]

def get_ydl_opts(playlistend=None):
    return {
        "quiet": True,
        "no_warnings": True,
        "ignoreerrors": True,
        "skip_download": True,
        "sleep_interval": 2,
        "max_sleep_interval": 5,
        "playlistend": playlistend,
        "extract_flat": False,
    }

def scrape_channels(filter_date_str=None):
    """
    Scrapes channels.
    If filter_date_str (YYYY-MM-DD) is provided, stops scraping a channel
    when a video older than that date is encountered.
    """
    if not yt_dlp:
        print("Error: yt-dlp not installed. Please run: pip install yt-dlp")
        return {}

    results = {}
    # If incremental, we only need to check the first few videos usually
    playlist_limit = 20 if filter_date_str else None
    ydl_opts = get_ydl_opts(playlistend=playlist_limit)

    def process_channel(url):
        try:
            # Add /videos to ensure we get the video tab
            video_url = url.rstrip("/") + "/videos"
            print(f"Scraping {video_url}...")
            
            # Create a fresh ydl instance for each thread to avoid conflicts
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
            
            if not info:
                return None

            channel_id = info.get("channel_id") or info.get("id")
            channel_title = info.get("channel") or info.get("uploader")
            handle = url.split("/")[-1].replace("@", "")

            if not channel_id:
                return None

            channel_data = {
                "channel_id": channel_id,
                "channel_handle": handle,
                "channel_title": channel_title,
                "videos": {}
            }

            entries = info.get("entries", [])
            if not entries:
                return channel_id, channel_data

            for entry in entries:
                if not entry:
                    continue

                # upload_date is usually YYYYMMDD
                upload_date_raw = entry.get("upload_date")
                if not upload_date_raw:
                    continue

                # Convert to YYYY-MM-DD
                try:
                    pub_date = datetime.strptime(upload_date_raw, "%Y%m%d").strftime("%Y-%m-%d")
                except ValueError:
                    continue

                # Incremental check
                if filter_date_str:
                    if pub_date < filter_date_str:
                        # Found an older video, stop processing this channel
                        break

                vid = entry.get("id")
                if not vid:
                    continue

                thumb = entry.get("thumbnail")
                if not thumb:
                    thumb = f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"

                channel_data["videos"][vid] = {
                    "video_id": vid,
                    "title": entry.get("title"),
                    "published_at": pub_date,
                    "views": entry.get("view_count", 0),
                    "likes": entry.get("like_count", 0),
                    "comments": entry.get("comment_count", 0),
                    "thumbnail": thumb,
                    "subscriberCount": entry.get("channel_follower_count") or entry.get("subscriber_count") or 0
                }
            return channel_id, channel_data

        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None

    # Use ThreadPoolExecutor for concurrency
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_url = {executor.submit(process_channel, url): url for url in CHANNEL_URLS}
        for future in concurrent.futures.as_completed(future_to_url):
            url = future_to_url[future]
            try:
                data = future.result()
                if data:
                    cid, cdata = data
                    results[cid] = cdata
            except Exception as exc:
                print(f'{url} generated an exception: {exc}')

    return results

def load_data():
    if not os.path.exists(VIDEOS_FILE):
        return {}
    try:
        with open(VIDEOS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {}

def save_data(data):
    with open(VIDEOS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def get_last_run_date():
    """Reads the last incremental scrape date from the meta file."""
    if os.path.exists(META_FILE):
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                meta = json.load(f)
                return meta.get("last_incremental_date")
        except (json.JSONDecodeError, IOError):
            return None
    return None

def update_meta(full_scrape=False):
    meta = {}
    if os.path.exists(META_FILE):
        try:
            with open(META_FILE, "r", encoding="utf-8") as f:
                meta = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    if full_scrape:
        meta["full_scrape_done"] = True

    meta["last_incremental_date"] = date.today().isoformat()

    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)


router = APIRouter()

# ==============================
# DASHBOARD BUILDER
# ==============================

def do_full_scrape():
    """Performs a full scrape of all channels."""
    print("Starting Full Scrape...")
    data = scrape_channels(filter_date_str=None)
    save_data(data)
    update_meta(full_scrape=True)
    print("Full Scrape Completed.")
    print(f"[{datetime.now()}] Full Scrape Completed.")

def do_incremental_scrape():
    """Performs an incremental scrape to get new videos."""
    print("Starting Incremental Scrape...")

    last_run_date_str = get_last_run_date()
    # Scrape videos from the last 3 days to be safe, or from 2 days before the last run date.
    if last_run_date_str:
        filter_date = (datetime.strptime(last_run_date_str, "%Y-%m-%d").date() - timedelta(days=2)).isoformat()
    else:
        filter_date = (date.today() - timedelta(days=3)).isoformat()

    print(f"Scraping new videos since {filter_date}...")
    new_data = scrape_channels(filter_date_str=filter_date)

    if not new_data:
        print("No new videos found.")
        print(f"[{datetime.now()}] No new videos found.")
        update_meta(full_scrape=False)
        return

    current_data = load_data()

    # Merge new data into current data
    for channel_id, channel_content in new_data.items():
        if channel_id not in current_data:
            current_data[channel_id] = channel_content
        else:
            # Update channel metadata and videos
            current_data[channel_id]['channel_title'] = channel_content.get('channel_title', current_data[channel_id].get('channel_title'))
            current_data[channel_id]['channel_handle'] = channel_content.get('channel_handle', current_data[channel_id].get('channel_handle'))
            if "videos" in channel_content:
                current_data[channel_id].setdefault("videos", {}).update(channel_content["videos"])

    save_data(current_data)
    update_meta(full_scrape=False)
    print("Incremental Scrape Completed.")
    print(f"[{datetime.now()}] Incremental Scrape Completed.")

def build_dashboard(data: Dict[str, Any], start_date: str = None, end_date: str = None) -> Dict[str, Any]:
    summary = defaultdict(int)
    channels = {}
    videos = []
    seen_ids = set()

    # Parse date strings to datetime objects for comparison
    start_dt = datetime.strptime(start_date, "%Y-%m-%d") if start_date else None
    end_dt = datetime.strptime(end_date, "%Y-%m-%d") if end_date else None

    def process_video_item(v, c_id, c_handle):
        # Normalize fields
        vid = v.get("video_id") or v.get("id")
        # YouTube video IDs are 11 characters. This filters out channel IDs etc.
        if not vid or len(vid) != 11:
            return
        if vid in seen_ids:
            return
        seen_ids.add(vid)

        title = v.get("video_title") or v.get("title")
        
        # Date handling
        date_str = v.get("upload_date") or v.get("published_at")
        # Convert YYYYMMDD to YYYY-MM-DD if necessary
        if date_str and len(date_str) == 8 and date_str.isdigit():
             date_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]}"
        
        # Filtering
        if start_dt or end_dt:
            if not date_str: return
            try:
                v_dt = datetime.strptime(date_str, "%Y-%m-%d")
                if start_dt and v_dt < start_dt: return
                if end_dt and v_dt > end_dt: return
            except ValueError:
                return

        # Metrics
        try:
            views = int(str(v.get("viewCount") or v.get("views") or 0).replace(',', ''))
        except (ValueError, TypeError):
            views = 0
        try:
            likes = int(str(v.get("likeCount") or v.get("likes") or 0).replace(',', ''))
        except (ValueError, TypeError):
            likes = 0
        try:
            comments = int(str(v.get("commentCount") or v.get("comments") or 0).replace(',', ''))
        except (ValueError, TypeError):
            comments = 0
        subs = int(v.get("subscriberCount") or v.get("subscribers") or 0)
        thumb = v.get("thumbnail")
        if not thumb:
            thumb = f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"

        summary["totalVideos"] += 1
        summary["totalViews"] += views
        summary["totalLikes"] += likes
        summary["totalComments"] += comments

        if c_id and c_id not in channels:
            channels[c_id] = {"id": c_id, "handle": c_handle}

        video_obj = {
            "id": vid,
            "title": title,
            "channel": c_handle,
            "channel_id": c_id,
            "views": views,
            "likes": likes,
            "comments": comments,
            "thumbnail": thumb,
            "subscribers": subs,
            "upload_date": date_str
        }
        videos.append(video_obj)

    # Check data structure
    if "raw_videos" in data and isinstance(data["raw_videos"], list):
        # Flat list format
        for v in data["raw_videos"]:
            cid = v.get("channel_id")
            chandle = v.get("channel_handle")
            process_video_item(v, cid, chandle)
    else:
        # Nested format: {channel_id: {videos: {vid: {...}}}}
        for channel_id, channel_data in data.items():
            if not isinstance(channel_data, dict): continue
            handle = channel_data.get("channel_handle", "")
            for v in channel_data.get("videos", {}).values():
                process_video_item(v, channel_id, handle)

    # 🔥 BREAK CHANNEL GROUPING (MANDATORY FOR GLOBAL SORT)
    random.shuffle(videos)

    top_by_views = sorted(videos, key=lambda x: x["views"], reverse=True)[:10]
    top_by_likes = sorted(videos, key=lambda x: x["likes"], reverse=True)[:10]
    top_by_comments = sorted(videos, key=lambda x: x["comments"], reverse=True)[:10]

    # Populate latestUploads with all videos (by views)
    latest_uploads = []
    for v in videos:
        latest_uploads.append({
            "channel_handle": v["channel"],
            "channel_id": v.get("channel_id"),
            "video_id": v["id"],
            "video_title": v["title"],
            "video_url": f"https://www.youtube.com/watch?v={v['id']}",
            "viewCount": v["views"],
            "likeCount": v["likes"],
            "commentCount": v["comments"],
            "thumbnail": v.get("thumbnail"),
            "subscribers": v.get("subscribers")
        })

    return {
        "summary": {
            "channelsCount": len(channels),
            "totalVideos": summary["totalVideos"],
            "totalViews": summary["totalViews"],
            "totalLikes": summary["totalLikes"],
            "totalComments": summary["totalComments"]
        },
        "channels": list(channels.values()),
        "trending": videos,
        "topVideos": {
            "byViews": top_by_views,
            "byLikes": top_by_likes,
            "byComments": top_by_comments
        },
        "latestUploads": latest_uploads
    }


# ==============================
# API ENDPOINT
# ==============================

@router.get("/youtube-data")
async def get_dashboard(start_date: str = Query(None), end_date: str = Query(None)):
    # Load data directly from JSON file on every request (fast enough for JSON)
    data = load_data()
    return build_dashboard(data, start_date, end_date)

@router.post("/run-full-scrape")
async def run_full_scrape(background_tasks: BackgroundTasks):
    """Triggers a full scrape of all channels in the background."""
    background_tasks.add_task(do_full_scrape)
    return {"message": "Full scrape started in the background. It may take a long time to complete."}

@router.post("/run-incremental-scrape")
async def run_incremental_scrape(background_tasks: BackgroundTasks):
    """Triggers an incremental scrape for new videos in the background."""
    background_tasks.add_task(do_incremental_scrape)
    return {"message": "Incremental scrape started in the background."}
