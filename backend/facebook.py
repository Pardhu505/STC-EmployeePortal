import time
import re
import json
import os
from fastapi import APIRouter, HTTPException
from datetime import datetime
from typing import List, Set, Dict, Any, Tuple
from datetime import datetime, timedelta
import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import (
    StaleElementReferenceException,
    NoSuchElementException,
)
from webdriver_manager.chrome import ChromeDriverManager

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@router.get("/data")
async def get_facebook_data():
    file_path = os.path.join(BASE_DIR, "facebook_daily_scrape.json")
    
    if not os.path.exists(file_path):
        return {"run_date": None, "pages": []}
    
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading data: {str(e)}")

TARGET_PAGES = [
   
"https://www.facebook.com/aitheylite",
    "https://www.facebook.com/profile.php?id=100087598966166",
    "https://www.facebook.com/profile.php?id=61552148637634&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=61551491161052",
    "https://www.facebook.com/areychari",
    "https://www.facebook.com/profile.php?id=100093149143470&mibextid=ZbWKwL",
    "https://www.facebook.com/bankuseenuu",
    "https://www.facebook.com/profile.php?id=100093444206800",
    "https://www.facebook.com/profile.php?id=100092200324811&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100087471274626",
    "https://www.facebook.com/chalachusamle",
    "https://www.facebook.com/comedyprofessor",
    "https://www.facebook.com/Comedytrigger3",
    "https://www.facebook.com/doubledoseA2Z",
    "https://www.facebook.com/EpicPoliticalComments",
    "https://www.facebook.com/FUNtasticTelugu",
    "https://www.facebook.com/share/18pX2qumtS/",
    "https://www.facebook.com/share/1ARZqt9KQT/",
    "https://www.facebook.com/share/166frghErf/",
    "https://www.facebook.com/PointBlankTvTelugu",
    "https://www.facebook.com/share/14daUrANNb/",
    "https://www.facebook.com/share/1AWeJ8j68D/?mibextid=wwXIfr",
    "https://www.facebook.com/Rangulestha",
    "https://www.facebook.com/JustFuSuCK",
    "https://www.facebook.com/FactsAboutAP/",
    "https://www.facebook.com/share/17XSN77r76/",
    "https://www.facebook.com/share/1CJanactYH/",
    "https://www.facebook.com/share/162gydG7uD/",
    "https://www.facebook.com/share/1FcHUUNgrw/",
    "https://www.facebook.com/share/1B7ugKDqU8/",
    "https://www.facebook.com/profile.php?id=61550710666399",
    "https://www.facebook.com/kangedmemes2",
    "https://www.facebook.com/kathavereuntadii",
    "https://www.facebook.com/LeoEntertainmentWeb",
    "https://www.facebook.com/TheLeoNews?mibextid=ZbWKwL",
    "https://www.facebook.com/ChaitanyaRathamOfficial",
    "https://www.facebook.com/LeoTodayOfficial",
    "https://www.facebook.com/profile.php?id=61580398942752",
    "https://www.facebook.com/profile.php?id=100064424573600",
    "https://www.facebook.com/ManalniEvadraAapedhii",
    "https://www.facebook.com/share/1A95FbwcNX/",
    "https://www.facebook.com/memesbandi999/",
    "https://www.facebook.com/MSRajuSCCell",
    "https://www.facebook.com/voiceoftdpofficial",
    "https://www.facebook.com/profile.php?id=61552750902412",
    "https://www.facebook.com/welovecbn",
    "https://www.facebook.com/share/1HAzBHjBV5/",
    "https://www.facebook.com/share/1DkGbQfeSS/",
    "https://www.facebook.com/WeSupportTeluguDesamParty",
    "https://www.facebook.com/profile.php?id=61567720447863&mibextid=ZbWKwL",
    "https://www.facebook.com/TeluguRaithu/",
    "https://www.facebook.com/yegned",
    "https://www.facebook.com/LokeshYuvagalam/",
    "https://www.facebook.com/nenerajumanthri",
    "https://www.facebook.com/nikuavasaramaabey",
    "https://www.facebook.com/SouthAfricaTDP",
    "https://www.facebook.com/profile.php?id=61551878800930&mibextid=ZbWKwL",
    "https://www.facebook.com/tdp.ncbn.official",
    "https://www.facebook.com/naralokesh",
    "https://www.facebook.com/OhYesAre/",
    "https://www.facebook.com/ookokaaka",
    "https://www.facebook.com/ooramasspillodu",
    "https://www.facebook.com/OpenTalkNews",
    "https://www.facebook.com/TDPat175/",
    "https://www.facebook.com/profile.php?id=61551768155831&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=61574773191593",
    "https://www.facebook.com/profile.php?id=100093281586656",
    "https://www.facebook.com/pjofap",
    "https://www.facebook.com/PopcornMediaChannel",
    "https://www.facebook.com/PowerTeluguTV",
    "https://www.facebook.com/AnnaNTRofficial/",
    "https://www.facebook.com/PsychoPovaliCycleRavali",
    "https://www.facebook.com/RocketTeluguNews",
    "https://www.facebook.com/TdpActivist",
    "https://www.facebook.com/ThinkAndhraOfficial",
    "https://www.facebook.com/profile.php?id=61552336340974",
    "https://www.facebook.com/profile.php?id=100093684980473&mibextid=ZbWKwL",
    "https://www.facebook.com/share/15bTELAPnf/?mibextid=qi2Omg",
    "https://www.facebook.com/TDP.Official",
    "https://www.facebook.com/profile.php?id=61551807453215",
    "https://www.facebook.com/AndhraPradeshCM",
    "https://www.facebook.com/FactCheckAPGov",
    "https://www.facebook.com/FactCheckTDP",
    "https://www.facebook.com/TDPSpeakers/",
    "https://www.facebook.com/share/1EeP7trWT3/",
    "https://www.facebook.com/bittuumemes?mibextid=ZbWKwL",
    "https://www.facebook.com/TELUGUYUVATHABULLETS",
    "https://www.facebook.com/profile.php?id=61550684757054&sk=reels_tab",
    "https://www.facebook.com/gvkofficialteam",
    "https://www.facebook.com/TeluguDesamPoliticalWing",
    "https://www.facebook.com/TeluguMahila",
    "https://www.facebook.com/TrendNaralokesh/",
    "https://www.facebook.com/profile.php?id=61569656604420",
    "https://www.facebook.com/share/16S4wpEzU4/",
    "https://www.facebook.com/CycleSena/",
    "https://www.facebook.com/abbakamalhassanfb/",
    "https://www.facebook.com/TeluguYuvathaOfficial",
    "https://www.facebook.com/share/1EiE86yXgx/",
    "https://www.facebook.com/Thaggedheley",
    "https://www.facebook.com/profile.php?id=61551884772071",
    "https://www.facebook.com/TilluTrolls",
    "https://www.facebook.com/APTNSFOfficial/",
    "https://www.facebook.com/APTNTUC/",
    "https://www.facebook.com/TomBhayyaaaa",
    "https://www.facebook.com/TSNVAPOfficial/",
    "https://www.facebook.com/profile.php?id=61552951264552",
    "https://www.facebook.com/profile.php?id=61574092443194",
    "https://www.facebook.com/SudhakarTalksOfficial",
    "https://m.facebook.com/myfirstvoteforcbn2024",
    "https://www.facebook.com/profile.php?id=61554497507268",
    "https://www.facebook.com/gvkofficialteam/",
    "https://www.facebook.com/share/19p4nMfnKn/",
    "https://www.facebook.com/share/18Hqjn1QoS/",
    "https://www.facebook.com/BuluguMayam6093",
    "https://www.facebook.com/VoteForTDP2024",
    "https://www.facebook.com/profile.php?id=61553130779803",
    "https://www.facebook.com/trendcbnofficial",
    "https://www.facebook.com/share/1aNAhsvoYG/",
    "https://www.facebook.com/share/1GkRV4cawh/",
    "https://www.facebook.com/IamwithLokeshpoliticalpage",
    "https://www.facebook.com/Poyammosam",
    "https://www.facebook.com/share/r8LZcHTAD2YL1ZJY/?mibextid=qi2Omg",
    "https://www.facebook.com/VanaraMedia",
    "https://www.facebook.com/share/12EcVi2a6nv/",
    "https://www.facebook.com/share/15fc83sk3h/",
    "https://www.facebook.com/gajaalagaru?mibextid=ZbWKwL",
    "https://www.facebook.com/share/15kBX9QAUz/",
    "https://www.facebook.com/share/12CHLbKpnoV/",
    "https://www.facebook.com/share/19Q2HQxHZX/",
    "https://www.facebook.com/share/15sgZ9W8AP/",
    "https://www.facebook.com/share/1Bacur8pBj/",
    "https://www.facebook.com/share/19xZzZ81km/",
    "https://www.facebook.com/share/1EEoaJEF4N/",
    "https://www.facebook.com/share/CGnR4mLwkXeUiZZE/?mibextid=qi2Omg",
    "https://www.facebook.com/share/1A2Fon15dT/",
    "https://www.facebook.com/share/1XASLG3FMP/",
    "https://www.facebook.com/share/188UuG8XZ5/",
    "https://www.facebook.com/share/zoDSm5DUX6xmt5ZN/?mibextid=qi2Omg",
    "https://www.facebook.com/share/nH5Ad6JpDRZTtFUW/?mibextid=qi2Omg",
    "https://www.facebook.com/share/18nGVv7t6u/",
    "https://www.facebook.com/tdp4ever",
    "https://www.facebook.com/share/1P7h8ERtnD/",
    "https://www.facebook.com/share/15CKvz9Qsq/",
    "https://www.facebook.com/share/1C5yDrFYab/",
    "https://www.facebook.com/share/1FPJNZy4CR/",
    "https://www.facebook.com/share/16Kfsn3vko/",
    "https://www.facebook.com/share/1S473vpEoX/",
    "https://www.facebook.com/share/1CeGSheGH8/",
    "https://www.facebook.com/yellowsingam9",
    "https://www.facebook.com/share/19RDUKyhH8/",
    "https://www.facebook.com/share/1C3VXpaskB/",
    "https://www.facebook.com/profile.php?id=100070663426301",
    "https://www.facebook.com/share/16od5vuTms/",
    "https://www.facebook.com/share/1FopqmcQpY/",
    "https://www.facebook.com/share/169fFgvvDA/",
    "https://www.facebook.com/share/1BEQY8s6VC/",
    "https://www.facebook.com/share/16efbXAQF5/",
    "https://www.facebook.com/share/16ALhGT1Xc/",
    "https://www.facebook.com/share/1JK7Dn1uGf/",
    "https://www.facebook.com/share/16zG8Q8CAd/",
    "https://www.facebook.com/share/1CEvy7GeAx/",
    "https://www.facebook.com/share/15C9oDe1FeS/",
    "https://www.facebook.com/share/19XUzhPSVs/",
    "https://www.facebook.com/share/16YZXgwGiE/",
    "https://www.facebook.com/share/1AR9Z6WVdR/",
    "https://www.facebook.com/share/19Xds82RaM/",
    "https://www.facebook.com/share/19ZkpJZt1o/",
    "https://www.facebook.com/share/1CHckASFcj/",
    "https://www.facebook.com/share/14Dqash1HGx/",
    "https://www.facebook.com/profile.php?id=61576957785533&mibextid=ZbWKwL",
    "https://www.facebook.com/share/19T6PgMExk/",
    "https://www.facebook.com/profile.php?id=100091563015024",
    "https://www.facebook.com/jayahoooo",
    "https://www.facebook.com/share/1JAiHnHo95/",
    "https://www.facebook.com/share/16svmWScxi/",
    "https://www.facebook.com/share/16vUsnXCrN/",
    "https://www.facebook.com/share/14H8GRccC1m/",
    "https://www.facebook.com/ApTalks1/",
    "https://www.facebook.com/profile.php?id=61564990930962",
    "https://www.facebook.com/share/1FmMiaYRXn/",
    "https://www.facebook.com/share/167zVyZyh2/",
    "https://www.facebook.com/share/179dVGHBde/",
    "https://www.facebook.com/share/1G4REpHMbd/",
    "https://www.facebook.com/share/1CcWZnZfeU/",
    "https://www.facebook.com/share/16SuSxaM7a/",
    "https://www.facebook.com/share/171mDQaVcL/",
    "https://www.facebook.com/share/1AaQEMwtNq/",
    "https://www.facebook.com/share/18n3buz37n/",
    "https://www.facebook.com/share/1GdHj4Rqaa/",
    "https://www.facebook.com/share/1DM5b8n4um/",
    "https://www.facebook.com/SyeRaaTelugoda/",
    "https://www.facebook.com/teamyellowtdp",
    "https://www.facebook.com/voiceofappublic",
    "https://www.facebook.com/punchpadudi",
    "https://www.facebook.com/MosapoyaBro/",
    "https://www.facebook.com/Okeokkadubabu",
    "https://www.facebook.com/share/16qJeMw9dV/",
    "https://www.facebook.com/NarayanaforNellore?mibextid=LQQJ4d",
    "https://www.facebook.com/metanewslive",
    "https://www.facebook.com/ActuallyMBA",
    "https://www.facebook.com/cbnforkuppam/",
    "https://www.facebook.com/KodiKathiKamal",
    "https://www.facebook.com/profile.php?id=61569648056841",
    "https://www.facebook.com/dalapathiln",
    "https://www.facebook.com/DeccanfilmOfficial",
    "https://www.facebook.com/comichuttrolls/",
    "https://www.facebook.com/bokkagaruikkada/",
    "https://www.facebook.com/Awaragaru/",
    "https://www.facebook.com/JournalistReportOfficial",
    "https://www.facebook.com/profile.php?id=61561716085775",
    "https://www.facebook.com/funclovita",
    "https://www.facebook.com/buildupbabai?mibextid=JRoKGi",
    "https://www.facebook.com/profile.php?id=61561744613111",
    "https://www.facebook.com/RunRajaRun999",
    "https://www.facebook.com/profile.php?id=61561176855325&mibextid=JRoKGi",
    "https://www.facebook.com/AndhraChoice",
    "https://www.facebook.com/share/hTkQST1sSN3bkozc/?mibextid=qi2Omg",
    "https://www.facebook.com/profile.php?id=61567149161572",
    "https://www.facebook.com/AaveshamRajaFb/",
    "https://www.facebook.com/Itheyokk/",
    "https://www.facebook.com/ustaadtrolls/",
    "https://www.facebook.com/share/1EKCEcAUEK/",
    "https://www.facebook.com/share/19cobDaKGU/",
    "https://www.facebook.com/RedChipBoss?mibextid=ZbWKwL",
    "https://www.facebook.com/jspyuvashakthi",
    "https://www.facebook.com/WildWolfDigitalOfficial",
    "https://www.facebook.com/Palakonda.TDPOfficial",
    "https://www.facebook.com/kurupam.TDPOfficial",
    "https://www.facebook.com/Parvathipuram.TDPOfficial",
    "https://www.facebook.com/Salur.TDPOfficial",
    "https://www.facebook.com/ArakuValley.TDPOfficial",
    "https://www.facebook.com/Rampachodavaram.TDPofficial",
    "https://www.facebook.com/Ichchapuram.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Palasa.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Pathapatnam.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Srikakulam.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Narasannapeta.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Etcherla.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Rajam.TDPOfficial?mibextid=JRoKGi",
    "https://www.facebook.com/Bobbili.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Cheepurupalli.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Gajapathinagaram.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Nellimarla.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Vizianagaram.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Srungavarapukota.TDPOfficial/",
    "https://www.facebook.com/Bheemili.TDPOfficial/",
    "https://www.facebook.com/visakhapatnameast.TDPOfficial",
    "https://www.facebook.com/Visakhapatnamsouth.TDPOfficial/",
    "https://www.facebook.com/VisakhapatnamNorth.TDPOfficial/",
    "https://www.facebook.com/Visakhapatnamwest.TDPOfficial/",
    "https://www.facebook.com/Gajuwaka.TDPOfficial/",
    "https://www.facebook.com/Chodavaram.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Madugula.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Anakapalle.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/TDPOfficial.Pendurthi?mibextid=ZbWKwL",
    "https://www.facebook.com/Elamanchili.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Payakaraopet.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/Narsipatnam.TDPOfficial?mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095090242050&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095500351415&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095284182214&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095416235356&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095365868195&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095409575664&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095284932199&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095391726643&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095518920367&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095032135216&mibextid=kFxxJD",
    "https://www.facebook.com/profile.php?id=100095158068805&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=61562449882425&mibextid=ZbWKwL",
    "https://www.facebook.com/share/U4DtqH3NbnWTXNRt/?mibextid=qi2Omg",
    "https://www.facebook.com/share/WEq3Y7QmC5VJ5dfk/?mibextid=qi2Omg",
    "https://www.facebook.com/share/uRFxe9D24jWHYbcE/?mibextid=qi2Omg",
    "https://www.facebook.com/profile.php?id=100095433604225&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095342589022&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095395656372&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095486850465&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095323600156&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095395416414&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095254693700&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095349098929&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095504281196&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095495881623&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100094939736837&mibextid=ZbWKwL",
    "https://www.facebook.com/TeluguDesamPartyKaikaluru?mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095427093377&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=61562651533275&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095272871384&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095132448503&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095055322760&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095095760332&mibextid=kFxxJD",
    "https://www.facebook.com/profile.php?id=100095274161089&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095387194919",
    "https://www.facebook.com/profile.php?id=100095119518754",
    "https://www.facebook.com/profile.php?id=61562262248663",
    "https://www.facebook.com/profile.php?id=100095118228896",
    "https://www.facebook.com/profile.php?id=100094888377146",
    "https://www.facebook.com/profile.php?id=100095214374463&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095074731601&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095050762773&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095109049974&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095027273899&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095372316217&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095375316042&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095302869764&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095018455118&mibextid=JRoKGi",
    "https://www.facebook.com/TDPOfficialMacherla?mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095363797183&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095281121473&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095483823178&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095052236080&mibextid=JRoKGi",
    "https://www.facebook.com/profile.php?id=100094999377979&mibextid=kFxxJD",
    "https://www.facebook.com/profile.php?id=100095185729502&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095019206205&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095472214710&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095339260518",
    "https://www.facebook.com/profile.php?id=100095115292034",
    "https://www.facebook.com/profile.php?id=100095123421485",
    "https://www.facebook.com/profile.php?id=100095043535440",
    "https://www.facebook.com/profile.php?id=100095419296448",
    "https://www.facebook.com/profile.php?id=100095325610015&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095417285222&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095242784295&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095492191776&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095376428144&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095215696109&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095483582657&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=61563106616591",
    "https://www.facebook.com/profile.php?id=100095171718705&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095330021019&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095473263592&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095412365860&mibextid=ZbWKwL",
    "https://www.facebook.com/TeluguDesamPartyNagari1?mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095450283696&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095433395093&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095042546983&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095391727238&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095217615692&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095088654079&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095365480173&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095173669935&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095547660854&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095359720442&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095507072801&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095325882407&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095086463733",
    "https://www.facebook.com/profile.php?id=100095313672484",
    "https://www.facebook.com/profile.php?id=100095308693189",
    "https://www.facebook.com/profile.php?id=100095162480539",
    "https://www.facebook.com/profile.php?id=100095444406115",
    "https://www.facebook.com/profile.php?id=100095055596280",
    "https://www.facebook.com/profile.php?id=100095278784559",
    "https://www.facebook.com/profile.php?id=100095156989441&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095440384723&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095489162363&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095331220351&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095341180839&mibextid=ZbWKwL",
    "https://www.facebook.com/TeluguDesamParty.Adoni?mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095411857157&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095365179958&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095128882218&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095029587652&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095180599417&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095370969694&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095211498118&mibextid=ZbWKwL",
    "https://www.facebook.com/profile.php?id=100095428446864&mibextid=ZbWKwL",
    "https://www.facebook.com/PublicVoxx",
    "https://www.facebook.com/share/15BAEMLgJz/",
    "https://www.facebook.com/share/1CALTbshji/",
    "https://www.facebook.com/SudhakarTalksOfficial/",
    "https://www.facebook.com/profile.php?id=61555840981151",
    "https://www.facebook.com/AnalystSudhakar/",
    "https://www.facebook.com/profile.php?id=100090713492693",
    "https://www.facebook.com/NeeYammaMogud",
    "https://www.facebook.com/profile.php?id=61554839288799",
    "https://www.facebook.com/andhra.telugudesam.9/",
    "https://www.facebook.com/profile.php?id=61555247990955",
    "https://www.facebook.com/profile.php?id=61552663554190",
    "https://www.facebook.com/profile.php?id=100094479363030",
    "https://www.facebook.com/TeluguYuvathaOfficial/",
    "https://www.facebook.com/TeluguMahila/",
    "https://www.facebook.com/TeluguRaithu/grid",
    "https://www.facebook.com/APTNTUC/grid",
    "https://www.facebook.com/APTNSFOfficial/grid",
    "https://www.facebook.com/TSNVAPOfficial",
    "https://www.facebook.com/PsychoPovaliCycleRavali/",
    "https://www.facebook.com/profile.php?id=61565082892261",
    "https://www.facebook.com/profile.php?id=61556164857180",
    "https://www.facebook.com/profile.php?id=61555257352589",
    "https://www.facebook.com/profile.php?id=61554663467797",
    "https://www.facebook.com/profile.php?id=61555898077959",
    "https://www.facebook.com/profile.php?id=61554829089806",
    "https://www.facebook.com/profile.php?id=61558325709767",
    "https://www.facebook.com/profile.php?id=61572974516041",
    "https://www.facebook.com/profile.php?id=61568488483742",
    "https://www.facebook.com/profile.php?id=100094517341494",
    "https://www.facebook.com/profile.php?id=61555310780968",
    "https://www.facebook.com/profile.php?id=61555185295864",
    "https://www.facebook.com/profile.php?id=61554869319176",
    "https://www.facebook.com/TDPSuperSix",
    "https://www.facebook.com/profile.php?id=61555304631206",
    "https://www.facebook.com/profile.php?id=61555313870157",
    "https://www.facebook.com/profile.php?id=61557411546010",
    "https://www.facebook.com/profile.php?id=61556569931659",
    "https://www.facebook.com/profile.php?id=61557245651873",
    "https://www.facebook.com/profile.php?id=61556001333206",
    "https://www.facebook.com/profile.php?id=61557212623170",
    "https://www.facebook.com/profile.php?id=61552576241323",
    "https://www.facebook.com/profile.php?id=61554780260062",
    "https://www.facebook.com/profile.php?id=61554712864529",
    "https://www.facebook.com/profile.php?id=61556194356724",
    "https://www.facebook.com/profile.php?id=61573516616671",
    "https://www.facebook.com/NRITDPCellCentralOffice/",
    "https://www.facebook.com/share/14DXyJcBVtm/",
    "https://www.facebook.com/SreenivasC14/",
    "https://www.facebook.com/123Nellore",
    "https://www.facebook.com/N3LOCAL",
    "https://www.facebook.com/Nelloredigitalnetwork",
    "https://www.facebook.com/ndnnews.in",
    "https://www.facebook.com/NdnnewsOnline",
    "https://www.facebook.com/itsRajaneethi",
    "https://www.facebook.com/RajeshMahasena",
    "https://www.facebook.com/News25TeluguOfficial",
    "https://www.facebook.com/JoinYuvaGalam/",
    "https://www.facebook.com/Cinemaculture/reels/",
    "https://www.facebook.com/ybranttv",
    "https://www.facebook.com/e3talkies",
    "https://www.facebook.com/VoteforTDP",
    "https://www.facebook.com/PoliticalHunt",
    "https://www.facebook.com/telugite",
    "https://www.facebook.com/TeluguLeader",
    "https://www.facebook.com/Public365",
    "https://www.facebook.com/SaveCapitalAmaravati",
    "https://www.facebook.com/katurisreekanth",
    "https://www.facebook.com/YOYOVIDEOS",
    "https://www.facebook.com/RedTvEntertainment",
    "https://www.facebook.com/pointoutnews.y?mibextid=ZbWKwL",
    "https://www.facebook.com/EagleandhraOfficial",
    "https://www.facebook.com/Anakapalle360"
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
    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=opts)


def fb_manual_login(driver):
    driver.get("https://www.facebook.com/login")
    print("\n[MANUAL LOGIN REQUIRED]")
    print("1. Log in to Facebook in the opened browser.")
    print("2. Solve any 'I'm not a robot' / captcha / 2FA.")
    print("3. Make sure your feed/home is visible.")
    input("\nWhen you are fully logged in, press ENTER here to continue...\n")


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


def get_metrics_for_caption_el(driver, cap_el) -> Tuple[str, str, str, str, str]:
    """
    Full pipeline for metrics of a single caption element:
      - likes: using ancestor-walk logic
      - comments & shares: from the same container (if found)
      - url & date: from timestamp/post link, walking up from caption
    """
    likes, container = find_likes_for_caption_el(driver, cap_el)
    url, date_text = get_post_details_for_caption_el(driver, cap_el)
    comments, shares = get_comments_shares_from_container(driver, container)
    
    return likes, comments, shares, url, date_text


def get_views_from_container(driver, container) -> str:
    """
    Scans container text for 'X views' or 'X plays' pattern.
    """
    if container is None:
        return "0"
    try:
        txt = safe_inner_text(driver, container)
        m = re.search(r"([\d.,]+[KMB]?)\s*(?:views|plays)", txt, re.IGNORECASE)
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
            if txt and not txt.startswith('#') and "See more" not in txt:
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
        likes, comments, shares, url, date_text, views = get_metrics_for_caption_el(driver, el)
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
            f"  [+] New caption: {text[:80]!r} | "
            f"Date: {formatted_date} | Likes: {likes} | Comments: {comments} | Shares: {shares} | URL: {url}"
        )

    return added


# ---------- MAIN ----------

def main():
    print("=== Scrape ALL captions + likes + comments + shares + followers + URL (smart-stop) ===\n")

    driver = create_driver()

    try:
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
