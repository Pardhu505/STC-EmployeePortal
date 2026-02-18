import time
import re
import asyncio
import pickle
import os
import shutil
import subprocess
import base64
from typing import List, Set, Dict, Any, Tuple
import math
import concurrent.futures
import zipfile
import sys
import urllib3
import uvicorn
from datetime import datetime, timedelta
import random
from collections import defaultdict

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    StaleElementReferenceException,
    NoSuchElementException,
    TimeoutException,
)
from fastapi import APIRouter, FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
# from database import stc_db
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient

# Suppress InsecureRequestWarning logs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


TARGET_PAGES = [
   
 
    "https://www.facebook.com/VoteforTDP",
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


    
    # localend 

    # "https://www.facebook.com/welovecbn",
    # "https://www.facebook.com/share/1HAzBHjBV5/",
    # "https://www.facebook.com/share/1DkGbQfeSS/",
    # "https://www.facebook.com/WeSupportTeluguDesamParty",
    # "https://www.facebook.com/profile.php?id=61567720447863&mibextid=ZbWKwL",
    # "https://www.facebook.com/TeluguRaithu/",
    # "https://www.facebook.com/yegned",
    # "https://www.facebook.com/LokeshYuvagalam/",
    # "https://www.facebook.com/nenerajumanthri",
    # "https://www.facebook.com/nikuavasaramaabey",
    # "https://www.facebook.com/SouthAfricaTDP",
    # "https://www.facebook.com/profile.php?id=61551878800930&mibextid=ZbWKwL",
    # "https://www.facebook.com/tdp.ncbn.official",

#ec2strt

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
    # "https://www.facebook.com/ThinkAndhraOfficial",
    # "https://www.facebook.com/profile.php?id=61552336340974",
    # "https://www.facebook.com/profile.php?id=100093684980473&mibextid=ZbWKwL",
    # "https://www.facebook.com/share/15bTELAPnf/?mibextid=qi2Omg",
    # "https://www.facebook.com/TDP.Official",
    # "https://www.facebook.com/profile.php?id=61551807453215",
    # "https://www.facebook.com/AndhraPradeshCM",
    # "https://www.facebook.com/FactCheckAPGov",
    # "https://www.facebook.com/FactCheckTDP",
    # "https://www.facebook.com/TDPSpeakers/",
    # "https://www.facebook.com/share/1EeP7trWT3/",
    # "https://www.facebook.com/bittuumemes?mibextid=ZbWKwL",
    # "https://www.facebook.com/TELUGUYUVATHABULLETS",
    # "https://www.facebook.com/profile.php?id=61550684757054&sk=reels_tab",
    # "https://www.facebook.com/gvkofficialteam",
    # "https://www.facebook.com/TeluguDesamPoliticalWing",
    # "https://www.facebook.com/TeluguMahila",
    # "https://www.facebook.com/TrendNaralokesh/",
    # "https://www.facebook.com/profile.php?id=61569656604420",
    # "https://www.facebook.com/share/16S4wpEzU4/",
    # "https://www.facebook.com/CycleSena/",
    # "https://www.facebook.com/abbakamalhassanfb/",
    # "https://www.facebook.com/TeluguYuvathaOfficial",
    # "https://www.facebook.com/share/1EiE86yXgx/",
    # "https://www.facebook.com/Thaggedheley",
    # "https://www.facebook.com/profile.php?id=61551884772071",
    # "https://www.facebook.com/TilluTrolls",
    # "https://www.facebook.com/APTNSFOfficial/",
    # "https://www.facebook.com/APTNTUC/",
    # "https://www.facebook.com/TomBhayyaaaa",
    # "https://www.facebook.com/TSNVAPOfficial/",
    # "https://www.facebook.com/profile.php?id=61552951264552",
    # "https://www.facebook.com/profile.php?id=61574092443194",
    # "https://www.facebook.com/SudhakarTalksOfficial",
    # "https://m.facebook.com/myfirstvoteforcbn2024",
    # "https://www.facebook.com/profile.php?id=61554497507268",
    # "https://www.facebook.com/gvkofficialteam/",
    # "https://www.facebook.com/share/19p4nMfnKn/",
    # "https://www.facebook.com/share/18Hqjn1QoS/",
    # "https://www.facebook.com/BuluguMayam6093",
    # "https://www.facebook.com/VoteForTDP2024",    
    # "https://www.facebook.com/profile.php?id=61553130779803",
    # "https://www.facebook.com/trendcbnofficial",
    # "https://www.facebook.com/share/1aNAhsvoYG/",
    # "https://www.facebook.com/share/1GkRV4cawh/",
    # "https://www.facebook.com/IamwithLokeshpoliticalpage",
    # "https://www.facebook.com/Poyammosam",
    # "https://www.facebook.com/share/r8LZcHTAD2YL1ZJY/?mibextid=qi2Omg",
    # "https://www.facebook.com/VanaraMedia",
    # "https://www.facebook.com/share/12EcVi2a6nv/",
    # "https://www.facebook.com/share/15fc83sk3h/",
    # "https://www.facebook.com/gajaalagaru?mibextid=ZbWKwL",
    # "https://www.facebook.com/share/15kBX9QAUz/",
    # "https://www.facebook.com/share/12CHLbKpnoV/",
    # "https://www.facebook.com/share/19Q2HQxHZX/",
    # "https://www.facebook.com/share/15sgZ9W8AP/",
    # "https://www.facebook.com/share/1Bacur8pBj/",
    # "https://www.facebook.com/share/19xZzZ81km/",
    # "https://www.facebook.com/share/1EEoaJEF4N/",
    # "https://www.facebook.com/share/CGnR4mLwkXeUiZZE/?mibextid=qi2Omg",
    # "https://www.facebook.com/share/1A2Fon15dT/",
    # "https://www.facebook.com/share/1XASLG3FMP/",
    # "https://www.facebook.com/share/188UuG8XZ5/",
    # "https://www.facebook.com/share/zoDSm5DUX6xmt5ZN/?mibextid=qi2Omg",
    # "https://www.facebook.com/share/nH5Ad6JpDRZTtFUW/?mibextid=qi2Omg",
    # "https://www.facebook.com/share/18nGVv7t6u/",
    # "https://www.facebook.com/tdp4ever",
    # "https://www.facebook.com/share/1P7h8ERtnD/",
    # "https://www.facebook.com/share/15CKvz9Qsq/",
    # "https://www.facebook.com/share/1C5yDrFYab/",
    # "https://www.facebook.com/share/1FPJNZy4CR/",
    # "https://www.facebook.com/share/16Kfsn3vko/",
    # "https://www.facebook.com/share/1S473vpEoX/",
    # "https://www.facebook.com/share/1CeGSheGH8/",
    # "https://www.facebook.com/yellowsingam9",
    # "https://www.facebook.com/share/19RDUKyhH8/",
    # "https://www.facebook.com/share/1C3VXpaskB/",
    # "https://www.facebook.com/profile.php?id=100070663426301",
    # "https://www.facebook.com/share/16od5vuTms/",
    # "https://www.facebook.com/share/1FopqmcQpY/",
    # "https://www.facebook.com/share/169fFgvvDA/",
    # "https://www.facebook.com/share/1BEQY8s6VC/",
    # "https://www.facebook.com/share/16efbXAQF5/",
    # "https://www.facebook.com/share/16ALhGT1Xc/",
    # "https://www.facebook.com/share/1JK7Dn1uGf/",
    # "https://www.facebook.com/share/16zG8Q8CAd/",
    # "https://www.facebook.com/share/1CEvy7GeAx/",
    # "https://www.facebook.com/share/15C9oDe1FeS/",
    # "https://www.facebook.com/share/19XUzhPSVs/",
    # "https://www.facebook.com/share/16YZXgwGiE/",
    # "https://www.facebook.com/share/1AR9Z6WVdR/",
    # "https://www.facebook.com/share/19Xds82RaM/",
    # "https://www.facebook.com/share/19ZkpJZt1o/",
    # "https://www.facebook.com/share/1CHckASFcj/",
    # "https://www.facebook.com/share/14Dqash1HGx/",
    # "https://www.facebook.com/profile.php?id=61576957785533&mibextid=ZbWKwL",
    # "https://www.facebook.com/share/19T6PgMExk/",
    # "https://www.facebook.com/profile.php?id=100091563015024",
    # "https://www.facebook.com/jayahoooo",
    # "https://www.facebook.com/share/1JAiHnHo95/",
    # "https://www.facebook.com/share/16svmWScxi/",
    # "https://www.facebook.com/share/16vUsnXCrN/",
    # "https://www.facebook.com/share/14H8GRccC1m/",
    # "https://www.facebook.com/ApTalks1/",
    # "https://www.facebook.com/profile.php?id=61564990930962",
    # "https://www.facebook.com/share/1FmMiaYRXn/",
    # "https://www.facebook.com/share/167zVyZyh2/",
    # "https://www.facebook.com/share/179dVGHBde/",
    # "https://www.facebook.com/share/1G4REpHMbd/",
    # "https://www.facebook.com/share/1CcWZnZfeU/",
    # "https://www.facebook.com/share/16SuSxaM7a/",
    # "https://www.facebook.com/share/171mDQaVcL/",
    # "https://www.facebook.com/share/1AaQEMwtNq/",
    # "https://www.facebook.com/share/18n3buz37n/",
    # "https://www.facebook.com/share/1GdHj4Rqaa/",
    # "https://www.facebook.com/share/1DM5b8n4um/",
    # "https://www.facebook.com/SyeRaaTelugoda/",
    # "https://www.facebook.com/teamyellowtdp",
    # "https://www.facebook.com/voiceofappublic",
    # "https://www.facebook.com/punchpadudi",
    # "https://www.facebook.com/MosapoyaBro/",
    # "https://www.facebook.com/Okeokkadubabu",
    # "https://www.facebook.com/share/16qJeMw9dV/",
    # "https://www.facebook.com/NarayanaforNellore?mibextid=LQQJ4d",
    # "https://www.facebook.com/metanewslive",
    # "https://www.facebook.com/ActuallyMBA",
    # "https://www.facebook.com/cbnforkuppam/",
    # "https://www.facebook.com/KodiKathiKamal",
    # "https://www.facebook.com/profile.php?id=61569648056841",
    # "https://www.facebook.com/dalapathiln",
    # "https://www.facebook.com/DeccanfilmOfficial",
    # "https://www.facebook.com/comichuttrolls/",
    # "https://www.facebook.com/bokkagaruikkada/",
    # "https://www.facebook.com/Awaragaru/",
    # "https://www.facebook.com/JournalistReportOfficial",
    # "https://www.facebook.com/profile.php?id=61561716085775",
    # "https://www.facebook.com/funclovita",
    # "https://www.facebook.com/buildupbabai?mibextid=JRoKGi",
    # "https://www.facebook.com/profile.php?id=61561744613111",
    # "https://www.facebook.com/RunRajaRun999",
    # "https://www.facebook.com/profile.php?id=61561176855325&mibextid=JRoKGi",
    # "https://www.facebook.com/AndhraChoice",
    # "https://www.facebook.com/share/hTkQST1sSN3bkozc/?mibextid=qi2Omg",
    # "https://www.facebook.com/profile.php?id=61567149161572",
    # "https://www.facebook.com/AaveshamRajaFb/",
    # "https://www.facebook.com/Itheyokk/",
    # "https://www.facebook.com/ustaadtrolls/",
    # "https://www.facebook.com/share/1EKCEcAUEK/",
    # "https://www.facebook.com/share/19cobDaKGU/",
    # "https://www.facebook.com/RedChipBoss?mibextid=ZbWKwL",
    # "https://www.facebook.com/jspyuvashakthi",
    # "https://www.facebook.com/WildWolfDigitalOfficial",
    # "https://www.facebook.com/Palakonda.TDPOfficial",
    # "https://www.facebook.com/kurupam.TDPOfficial",
    # "https://www.facebook.com/Parvathipuram.TDPOfficial",
    # "https://www.facebook.com/Salur.TDPOfficial",
    # "https://www.facebook.com/ArakuValley.TDPOfficial",
    # "https://www.facebook.com/Rampachodavaram.TDPofficial",
    # "https://www.facebook.com/Ichchapuram.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Palasa.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Pathapatnam.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Srikakulam.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Narasannapeta.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Etcherla.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Rajam.TDPOfficial?mibextid=JRoKGi",
    # "https://www.facebook.com/Bobbili.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Cheepurupalli.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Gajapathinagaram.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Nellimarla.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Vizianagaram.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Srungavarapukota.TDPOfficial/",
    # "https://www.facebook.com/Bheemili.TDPOfficial/",
    # "https://www.facebook.com/visakhapatnameast.TDPOfficial",
    # "https://www.facebook.com/Visakhapatnamsouth.TDPOfficial/",
    # "https://www.facebook.com/VisakhapatnamNorth.TDPOfficial/",
    # "https://www.facebook.com/Visakhapatnamwest.TDPOfficial/",
    # "https://www.facebook.com/Gajuwaka.TDPOfficial/",
    # "https://www.facebook.com/Chodavaram.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Madugula.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Anakapalle.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/TDPOfficial.Pendurthi?mibextid=ZbWKwL",
    # "https://www.facebook.com/Elamanchili.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Payakaraopet.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/Narsipatnam.TDPOfficial?mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095090242050&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095500351415&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095284182214&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095416235356&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095365868195&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095409575664&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095284932199&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095391726643&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095518920367&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095032135216&mibextid=kFxxJD",
    # "https://www.facebook.com/profile.php?id=100095158068805&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=61562449882425&mibextid=ZbWKwL",
    # "https://www.facebook.com/share/U4DtqH3NbnWTXNRt/?mibextid=qi2Omg",
    # "https://www.facebook.com/share/WEq3Y7QmC5VJ5dfk/?mibextid=qi2Omg",
    # "https://www.facebook.com/share/uRFxe9D24jWHYbcE/?mibextid=qi2Omg",
    # "https://www.facebook.com/profile.php?id=100095433604225&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095342589022&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095395656372&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095486850465&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095323600156&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095395416414&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095254693700&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095349098929&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095504281196&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095495881623&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100094939736837&mibextid=ZbWKwL",
    # "https://www.facebook.com/TeluguDesamPartyKaikaluru?mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095427093377&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=61562651533275&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095272871384&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095132448503&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095055322760&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095095760332&mibextid=kFxxJD",
    # "https://www.facebook.com/profile.php?id=100095274161089&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095387194919",
    # "https://www.facebook.com/profile.php?id=100095119518754",
    # "https://www.facebook.com/profile.php?id=61562262248663",
    # "https://www.facebook.com/profile.php?id=100095118228896",
    # "https://www.facebook.com/profile.php?id=100094888377146",
    # "https://www.facebook.com/profile.php?id=100095214374463&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095074731601&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095050762773&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095109049974&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095027273899&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095372316217&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095375316042&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095302869764&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095018455118&mibextid=JRoKGi",
    # "https://www.facebook.com/TDPOfficialMacherla?mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095363797183&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095281121473&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095483823178&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095052236080&mibextid=JRoKGi",
    # "https://www.facebook.com/profile.php?id=100094999377979&mibextid=kFxxJD",
    # "https://www.facebook.com/profile.php?id=100095185729502&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095019206205&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095472214710&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095339260518",
    # "https://www.facebook.com/profile.php?id=100095115292034",
    # "https://www.facebook.com/profile.php?id=100095123421485",
    # "https://www.facebook.com/profile.php?id=100095043535440",
    # "https://www.facebook.com/profile.php?id=100095419296448",
    # "https://www.facebook.com/profile.php?id=100095325610015&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095417285222&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095242784295&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095492191776&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095376428144&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095215696109&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095483582657&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=61563106616591",
    # "https://www.facebook.com/profile.php?id=100095171718705&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095330021019&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095473263592&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095412365860&mibextid=ZbWKwL",
    # "https://www.facebook.com/TeluguDesamPartyNagari1?mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095450283696&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095433395093&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095042546983&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095391727238&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095217615692&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095088654079&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095365480173&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095173669935&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095547660854&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095359720442&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095507072801&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095325882407&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095086463733",
    # "https://www.facebook.com/profile.php?id=100095313672484",
    # "https://www.facebook.com/profile.php?id=100095308693189",
    # "https://www.facebook.com/profile.php?id=100095162480539",
    # "https://www.facebook.com/profile.php?id=100095444406115",
    # "https://www.facebook.com/profile.php?id=100095055596280",
    # "https://www.facebook.com/profile.php?id=100095278784559",
    # "https://www.facebook.com/profile.php?id=100095156989441&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095440384723&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095489162363&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095331220351&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095341180839&mibextid=ZbWKwL",
    # "https://www.facebook.com/TeluguDesamParty.Adoni?mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095411857157&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095365179958&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095128882218&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095029587652&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095180599417&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095370969694&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095211498118&mibextid=ZbWKwL",
    # "https://www.facebook.com/profile.php?id=100095428446864&mibextid=ZbWKwL",
    # "https://www.facebook.com/PublicVoxx",
    # "https://www.facebook.com/share/15BAEMLgJz/",
    # "https://www.facebook.com/share/1CALTbshji/",
    # "https://www.facebook.com/SudhakarTalksOfficial/",
    # "https://www.facebook.com/profile.php?id=61555840981151",
    # "https://www.facebook.com/AnalystSudhakar/",
    # "https://www.facebook.com/profile.php?id=100090713492693",
    # "https://www.facebook.com/NeeYammaMogud",
    # "https://www.facebook.com/profile.php?id=61554839288799",
    # "https://www.facebook.com/andhra.telugudesam.9/",
    # "https://www.facebook.com/profile.php?id=61555247990955",
    # "https://www.facebook.com/profile.php?id=61552663554190",
    # "https://www.facebook.com/profile.php?id=100094479363030",
    # "https://www.facebook.com/TeluguYuvathaOfficial/",
    # "https://www.facebook.com/TeluguMahila/",
    # "https://www.facebook.com/TeluguRaithu/grid",
    # "https://www.facebook.com/APTNTUC/grid",
    # "https://www.facebook.com/APTNSFOfficial/grid",
    # "https://www.facebook.com/TSNVAPOfficial",
    # "https://www.facebook.com/PsychoPovaliCycleRavali/",
    # "https://www.facebook.com/profile.php?id=61565082892261",
    # "https://www.facebook.com/profile.php?id=61556164857180",
    # "https://www.facebook.com/profile.php?id=61555257352589",
    # "https://www.facebook.com/profile.php?id=61554663467797",
    # "https://www.facebook.com/profile.php?id=61555898077959",
    # "https://www.facebook.com/profile.php?id=61554829089806",
    # "https://www.facebook.com/profile.php?id=61558325709767",
    # "https://www.facebook.com/profile.php?id=61572974516041",
    # "https://www.facebook.com/profile.php?id=61568488483742",
    # "https://www.facebook.com/profile.php?id=100094517341494",
    # "https://www.facebook.com/profile.php?id=61555310780968",
    # "https://www.facebook.com/profile.php?id=61555185295864",
    # "https://www.facebook.com/profile.php?id=61554869319176",
    # "https://www.facebook.com/TDPSuperSix",
    # "https://www.facebook.com/profile.php?id=61555304631206",
    # "https://www.facebook.com/profile.php?id=61555313870157",
    # "https://www.facebook.com/profile.php?id=61557411546010",
    # "https://www.facebook.com/profile.php?id=61556569931659",
    # "https://www.facebook.com/profile.php?id=61557245651873",
    # "https://www.facebook.com/profile.php?id=61556001333206",
    # "https://www.facebook.com/profile.php?id=61557212623170",
    # "https://www.facebook.com/profile.php?id=61552576241323",
    # "https://www.facebook.com/profile.php?id=61554780260062",
    # "https://www.facebook.com/profile.php?id=61554712864529",
    # "https://www.facebook.com/profile.php?id=61556194356724",
    # "https://www.facebook.com/profile.php?id=61573516616671",
    # "https://www.facebook.com/NRITDPCellCentralOffice/",
    # "https://www.facebook.com/share/14DXyJcBVtm/",
    # "https://www.facebook.com/SreenivasC14/",
    # "https://www.facebook.com/123Nellore",
    # "https://www.facebook.com/N3LOCAL",
    # "https://www.facebook.com/Nelloredigitalnetwork",
    # "https://www.facebook.com/ndnnews.in",
    # "https://www.facebook.com/NdnnewsOnline",
    # "https://www.facebook.com/itsRajaneethi",
    
    # "https://www.facebook.com/RajeshMahasena",
    # "https://www.facebook.com/News25TeluguOfficial",
    # "https://www.facebook.com/JoinYuvaGalam/",
    # "https://www.facebook.com/Cinemaculture/reels/",
    # "https://www.facebook.com/ybranttv",
    # "https://www.facebook.com/e3talkies",
    
    # "https://www.facebook.com/PoliticalHunt",
    # "https://www.facebook.com/telugite",
    # "https://www.facebook.com/TeluguLeader",
    # "https://www.facebook.com/Public365",
    # "https://www.facebook.com/SaveCapitalAmaravati",
    # "https://www.facebook.com/katurisreekanth",
    # "https://www.facebook.com/YOYOVIDEOS",
    # "https://www.facebook.com/RedTvEntertainment",
    # "https://www.facebook.com/pointoutnews.y?mibextid=ZbWKwL",
    # "https://www.facebook.com/EagleandhraOfficial",
    # "https://www.facebook.com/Anakapalle360"
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

router = APIRouter()

SCRAPE_RUNNING = False

COOKIES_FILE = "cookies_fb.pkl"

FB_MONGO_URL = "mongodb+srv://akhilamerugu:root@facebook.yfeqh22.mongodb.net/"


# ---------- SETUP ----------

def clean_facebook_url(url: str) -> str:
    if not url:
        return ""
    return url.split("?")[0]

def create_driver():
    opts = Options()
    opts.add_argument("--start-maximized")
    opts.add_argument("--disable-notifications")
    opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1920,3000")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--disable-extensions")
    opts.add_argument("--disable-infobars")
    opts.add_argument("--disable-dev-tools")
    opts.add_argument("--disable-software-rasterizer")
    opts.page_load_strategy = 'eager'
    opts.add_argument("--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.96 Safari/537.36")
    opts.add_argument("--blink-settings=imagesEnabled=false")
    
    # Anti-detection features to prevent Facebook from invalidating cookies
    opts.add_argument("--disable-blink-features=AutomationControlled")
    opts.add_experimental_option("excludeSwitches", ["enable-automation"])
    opts.add_experimental_option("useAutomationExtension", False)
    
    # Force English language to ensure metrics scraping works (e.g. "Comments", "Shares")
    opts.add_argument("--lang=en-US")
    opts.add_experimental_option("prefs", {
        "intl.accept_languages": "en-US", 
        "profile.managed_default_content_settings.images": 2,
        "profile.managed_default_content_settings.media_stream": 2,
        "profile.managed_default_content_settings.cookies": 1,
    })

    # Check for Chrome binary location in env vars (common in Render/Heroku buildpacks)
    chrome_bin = os.environ.get("GOOGLE_CHROME_BIN") or os.environ.get("CHROME_BIN")
    if chrome_bin:
        opts.binary_location = chrome_bin

    driver = webdriver.Chrome(options=opts)
    driver.set_page_load_timeout(500)
    driver.set_script_timeout(500)
    return driver


def fb_manual_login(driver):
    print("[INFO] Loading Facebook base page...")
    driver.get("https://www.facebook.com/")
    time.sleep(3)

    if not os.path.exists(COOKIES_FILE):
        print(f"[CRITICAL] Cookies file '{COOKIES_FILE}' not found.")
        return False

    print(f"[INFO] Injecting cookies from {COOKIES_FILE}...")
    try:
        with open(COOKIES_FILE, "rb") as f:
            cookies = pickle.load(f)
    except Exception as e:
        print(f"[CRITICAL] Failed to load cookie file: {e}")
        return False

    # Debug: Check file contents
    file_keys = [c.get('name') for c in cookies]
    if 'c_user' not in file_keys:
        print(f"[CRITICAL] Invalid cookie file: 'c_user' is missing. Found: {file_keys}")
        return False

    driver.delete_all_cookies()

    for cookie in cookies:
        # 1. Handle Expiry (convert to int if present, don't delete unless invalid)
        if 'expiry' in cookie:
            try:
                cookie['expiry'] = int(cookie['expiry'])
            except:
                del cookie['expiry']

        # 2. Handle SameSite (Selenium strictly requires specific values or None)
        if 'sameSite' in cookie:
            if cookie['sameSite'] not in ["Strict", "Lax", "None"]:
                del cookie['sameSite']
        
        # Ensure domain is correct for main cookies prevents domain mismatch errors
        # (This is aggressive but often needed if cookies were saved from .www.facebook.com etc)
        cookie['domain'] = ".facebook.com"

        try:
            driver.add_cookie(cookie)
        except Exception as e:
            # Only warn if it's a critical auth cookie
            if cookie.get('name') in ['c_user', 'xs']:
                print(f"[WARN] Critical cookie rejected: {cookie.get('name')} - {e}")

    # Check immediately
    post_inject_keys = [c['name'] for c in driver.get_cookies()]
    if 'c_user' not in post_inject_keys:
        print("[CRITICAL] Browser rejected c_user cookie immediately.")
        # If rejected, maybe the file is bad, but we won't overwrite it yet.
        return False

    print("[INFO] Reloading page with cookies...")
    driver.get("https://www.facebook.com/")
    time.sleep(4)

    print("[INFO] Refreshing page again to ensure session stability...")
    driver.refresh()
    time.sleep(4)

    # 🔥 FINAL CHECK
    final_keys = [c['name'] for c in driver.get_cookies()]

    if "c_user" not in final_keys:
        print("[CRITICAL] Facebook login NOT detected (c_user missing after refresh). Session likely invalidated.")
        return False

    print("[SUCCESS] Facebook login verified via c_user cookie.")
    
    # [CRITICAL CHANGE]: Do NOT overwrite the master 'cookies_fb.pkl' with session cookies.
    # The session cookies from the driver might lack the long-term 'expiry' of the original file.
    # We treat 'cookies_fb.pkl' as a read-only Master Key.
    
    return True


def safe_inner_text(driver, el) -> str:
    """Return innerText safely, or empty string on stale."""
    try:
        txt = driver.execute_script("return arguments[0].innerText;", el)
        return (txt or "").strip()
    except StaleElementReferenceException:
        return ""


# ---------- NUMERIC EXTRACTOR ----------

def parse_count(text) -> int:
    """
    Parse '1.2K', '12,345', '1M' into int.
    Also handles newlines or random text like 'views'.
    """
    if not text:
        return 0
    text = str(text).upper().replace(",", "").replace("\n", " ").strip()
    
    # Extract the first numeric part with suffix if present
    # Matches: 1.2K, 5M, 100, 10.5
    match = re.search(r"(\d+(\.\d+)?)(\s*[KMB]?)", text)
    if not match:
        return 0
    
    val_str = match.group(1)
    suffix = match.group(3).strip()
    
    try:
        val = float(val_str)
    except ValueError:
        return 0

    multiplier = 1
    if suffix == "K":
        multiplier = 1000
    elif suffix == "M":
        multiplier = 1000000
    elif suffix == "B":
        multiplier = 1000000000
        
    return int(val * multiplier)


# Followers (strong inside link that has /followers/ in href)
FOLLOWERS_STRONG_XPATH = "//a[contains(@href, '/followers/')]/strong"

# ---------- FOLLOWER COUNT ----------

def get_follower_count(driver) -> int:
    """
    Read follower count from the page header.
    Uses FOLLOWERS_STRONG_XPATH and same numeric extractor.
    """
    try:
        el = driver.find_element(By.XPATH, FOLLOWERS_STRONG_XPATH)
        txt = safe_inner_text(driver, el)
        return parse_count(txt)
    except Exception:
        return 0


# ---------- LIKES + COMMENTS/SHARES ----------

def find_likes_for_caption_el(driver, cap_el) -> Tuple[int, Any]:
    """
    Starting from a caption <div>, walk up ancestors
    to find a container that has a likes span span[class*='x135b78x'].

    Returns:
        (likes_int, container_element or None)
    """
    current = cap_el
    for _ in range(10):  # climb up at most 10 levels
        try:
            like_spans = current.find_elements(By.XPATH, LIKES_REL_XPATH)
        except StaleElementReferenceException:
            return 0, None

        for sp in like_spans:
            try:
                txt = safe_inner_text(driver, sp)
            except StaleElementReferenceException:
                continue

            num = parse_count(txt)
            if num > 0:
                return num, current  # return the container too

        # go one level up
        try:
            current = current.find_element(By.XPATH, "./..")
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return 0, None


def get_comments_shares_from_container(driver, container) -> Tuple[int, int]:
    """
    Extract comments and shares numbers from container:
      - find all spans with comments/shares class
      - comments = 1st numeric
      - shares   = 2nd numeric
    """
    comments = 0
    shares = 0
    nums: List[int] = []

    if container is None:
        return comments, shares

    try:
        cs_spans = container.find_elements(By.XPATH, COMMENTS_SHARES_REL_XPATH)
    except StaleElementReferenceException:
        cs_spans = []

    for sp in cs_spans:
        txt = safe_inner_text(driver, sp)
        n = parse_count(txt)
        if n > 0:
            nums.append(n)

    if len(nums) >= 1:
        comments = nums[0]
    if len(nums) >= 2:
        shares = nums[1]

    return comments, shares


# ---------- POST URL (using ancestor search) ----------

def get_post_details_from_ancestors(driver, cap_el) -> Tuple[str, str]:
    """
    Starting from the caption element, walk up ancestors.
    On each ancestor, find <a> with /posts/, /videos/, or /photos/ in href.
    Also extract the date from that anchor (data-utime) or embedded JSON in the ancestor HTML.

    Prefer URLs that DO NOT contain 'comment_id=' or 'reply_comment_id='
    (to avoid comment permalinks). If no clean URL found, fall back to
    the first candidate.
    """
    current = cap_el
    found_date = ""
    
    for _ in range(15):  # climb up a bit more
        # 1. Try regex on the container HTML (User suggestion for exact timestamp)
        if not found_date:
            try:
                # 1a. Check data-ft attribute directly (common for FB posts)
                data_ft = current.get_attribute("data-ft")
                if data_ft:
                    match = re.search(r'"publish_time"\s*:\s*(\d+)', data_ft)
                    if not match:
                        match = re.search(r'"creation_time"\s*:\s*(\d+)', data_ft)
                    if match:
                        timestamp = int(match.group(1))
                        if timestamp > 10000000000: timestamp = timestamp / 1000
                        found_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')

                # 1b. Check outerHTML
                if not found_date:
                    html = current.get_attribute('outerHTML')
                    # Try multiple regex patterns for robustness
                    patterns = [
                        r'data-utime\s*=\s*["\'](\d+)["\']',
                        r'data-timestamp\s*=\s*["\'](\d+)["\']',
                        r'"publish_time"\s*:\s*["\']?(\d+)["\']?',
                        r'"creation_time"\s*:\s*["\']?(\d+)["\']?',
                        r'publish_time&quot;\s*:\s*&quot;?(\d+)&quot;?',
                        r'creation_time&quot;\s*:\s*&quot;?(\d+)&quot;?',
                        r'publish_time\\"\s*:\s*\\"?(\d+)\\"?',
                        r'creation_time\\"\s*:\s*\\"?(\d+)\\"?',
                        r'publish_time\s*:\s*(\d+)',
                        r'creation_time\s*:\s*(\d+)',
                    ]
                    
                    match = None
                    for pat in patterns:
                        match = re.search(pat, html, re.IGNORECASE)
                        if match:
                            break
                    
                    if match:
                        timestamp = int(match.group(1))
                        # Handle milliseconds if present
                        if timestamp > 10000000000:
                            timestamp = timestamp / 1000
                        found_date = datetime.fromtimestamp(timestamp).strftime('%Y-%m-%d %H:%M:%S')
            except Exception:
                pass

        try:
            links = current.find_elements(
                By.XPATH,
                ".//a[contains(@href, '/posts/') or contains(@href, '/reel/') or contains(@href, '/videos/') or contains(@href, '/photos/') or contains(@href, '/watch')]"
            )
        except StaleElementReferenceException:
            links = []

        candidates: List[str] = [] 
        
        for a in links:
            try:
                href = a.get_attribute("href") or ""
            except StaleElementReferenceException:
                continue

            href = href.strip()
            if not href:
                continue

            # Make absolute if relative
            if href.startswith("/"):
                href = "https://www.facebook.com" + href
            
            if "/hashtag/" in href:
                continue

            clean_url = clean_facebook_url(href)
            
            candidates.append(clean_url)

            # If we still don't have a date, try to get it from this anchor
            if not found_date:
                try:
                    # 1. Try aria-label
                    aria_label = a.get_attribute("aria-label")
                    if aria_label and len(aria_label) > 1 and not aria_label.strip().startswith("#"):
                        found_date = aria_label
                    
                    # 2. Try inner text
                    if not found_date:
                        text = safe_inner_text(driver, a)
                        if text and len(text) > 1 and not text.strip().startswith("#"):
                            found_date = text
                    
                    # 3. Try finding <abbr> inside
                    if not found_date:
                        try:
                            abbr = a.find_element(By.TAG_NAME, "abbr")
                            utime = abbr.get_attribute("data-utime")
                            if utime:
                                found_date = datetime.fromtimestamp(int(utime)).strftime('%Y-%m-%d %H:%M:%S')
                        except:
                            pass
                except:
                    pass

        # Fallback: Look for <abbr> in the entire container if date not found yet
        if not found_date:
            try:
                abbrs = current.find_elements(By.TAG_NAME, "abbr")
                for abbr in abbrs:
                    utime = abbr.get_attribute("data-utime")
                    if utime:
                        found_date = datetime.fromtimestamp(int(utime)).strftime('%Y-%m-%d %H:%M:%S')
                        break
            except:
                pass

        if candidates:
            selected_url = candidates[0]
            # Priority 1: Clean URL
            for url in candidates:
                if "comment_id=" not in url and "reply_comment_id=" not in url:
                    selected_url = url
                    break
            
            return selected_url, found_date

        # go one level up
        try:
            current = current.find_element(By.XPATH, "./..")
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return "", found_date


def get_post_type(url: str) -> str:
    if not url:
        return "Post"
    if "/reel/" in url:
        return "Reel"
    if "/videos/" in url or "/watch" in url:
        return "Video"
    return "Post"


def get_video_views(driver, container) -> int:
    """
    Extract views for Reels/Videos.
    Checks aria-labels and visible text.
    """
    if not container:
        return 0
    
    def _extract_views_from_node(node):
        # 1. Check visible text in the container (e.g. "1.2M views")
        try:
            text = safe_inner_text(driver, node)
            return parse_count(text)
        except Exception:
            pass

        # 2. Check aria-labels (often in the video player or link)
        try:
            elements = node.find_elements(By.XPATH, ".//*[@aria-label]")
            elements.insert(0, node)
            
            for el in elements:
                try:
                    aria = el.get_attribute("aria-label")
                    if aria:
                        val = parse_count(aria)
                        if val > 0:
                            return val
                except StaleElementReferenceException:
                    continue
        except Exception:
            pass
        return 0

    # 1. Try current container
    v = _extract_views_from_node(container)
    if v > 0:
        return v

    # 2. Walk up ancestors (up to 3 levels) to find video player if it's a sibling
    current = container
    for _ in range(3):
        try:
            parent = current.find_element(By.XPATH, "./..")
            v = _extract_views_from_node(parent)
            if v > 0:
                return v
            current = parent
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return 0


# ---------- DATE PARSER ----------

def parse_facebook_date(date_str: str) -> str:
    """
    Convert Facebook relative/short dates (2w, 13m, Yesterday) to YYYY-MM-DD HH:MM:SS.
    """
    if not date_str:
        return ""
    
    # If already formatted (YYYY-MM-DD HH:MM:SS)
    if re.match(r"^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$", date_str):
        return date_str

    # Current time
    now = datetime.now()
    s = date_str.replace("\u00a0", " ").strip()
    s = re.sub(r'\s+', ' ', s)

    # 1. "Just now"
    if re.search(r"Just\s*now", s, re.IGNORECASE):
        return now.strftime("%Y-%m-%d %H:%M:%S")

    # 2. "Today"
    if re.search(r"^Today", s, re.IGNORECASE):
        return now.strftime("%Y-%m-%d %H:%M:%S")

    # 3. "Yesterday"
    if re.search(r"^Yesterday", s, re.IGNORECASE):
        return (now - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")

    # 4. Relative times (mins, hrs, days)
    
    # Minutes
    m_min = re.search(r"(\d+)\s*(m|min|mins|minute|minutes)\b", s, re.IGNORECASE)
    if m_min:
        val = int(m_min.group(1))
        return (now - timedelta(minutes=val)).strftime("%Y-%m-%d %H:%M:%S")

    # Hours
    m_hour = re.search(r"(\d+)\s*(h|hr|hrs|hour|hours)\b", s, re.IGNORECASE)
    if m_hour:
        val = int(m_hour.group(1))
        return (now - timedelta(hours=val)).strftime("%Y-%m-%d %H:%M:%S")

    # Days
    m_day = re.search(r"(\d+)\s*(d|day|days)\b", s, re.IGNORECASE)
    if m_day:
        val = int(m_day.group(1))
        return (now - timedelta(days=val)).strftime("%Y-%m-%d %H:%M:%S")

    # Weeks
    m_week = re.search(r"(\d+)\s*(w|wk|weeks|week)\b", s, re.IGNORECASE)
    if m_week:
        val = int(m_week.group(1))
        return (now - timedelta(weeks=val)).strftime("%Y-%m-%d %H:%M:%S")

    # Years (relative)
    m_year = re.search(r"(\d+)\s*(y|yr|years|year)\b", s, re.IGNORECASE)
    if m_year:
        val = int(m_year.group(1))
        return (now - timedelta(days=val*365)).strftime("%Y-%m-%d %H:%M:%S")

    # 5. Explicit dates
    clean_date = re.sub(r"^[A-Za-z]+,\s*", "", s)
    formats = ["%d %B %Y at %H:%M", "%B %d, %Y at %H:%M %p", "%d %B at %H:%M", "%B %d at %H:%M %p", "%d %B %Y", "%B %d, %Y", "%d %b %Y", "%b %d, %Y"]
    for fmt in formats:
        try:
            dt = datetime.strptime(clean_date, fmt)
            if dt.year == 1900: dt = dt.replace(year=now.year)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except ValueError: continue

    return s

def get_metrics_for_caption_el(driver, cap_el) -> Dict[str, Any]:
    """
    Full pipeline for metrics of a single caption element:
      - likes, comments, shares: extracted from the post container (role='article')
      - url: from timestamp/post link, walking up from caption
      - type: inferred from URL
      - views: extracted only for Reels/Videos
    """
    likes, container = find_likes_for_caption_el(driver, cap_el)
    comments, shares = get_comments_shares_from_container(driver, container)

    url, date = get_post_details_from_ancestors(driver, cap_el)
    date = parse_facebook_date(date)
    
    post_type = get_post_type(url)
    
    # Try to get views regardless of type, to catch videos identified as Posts
    views = get_video_views(driver, container)
    
    # If we found views but type is Post, it's likely a Video
    if views and post_type == "Post":
        post_type = "Video"
        
    return {
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "url": url,
        "date": date,
        "type": post_type,
        "views": views
    }


# ---------- PER-SCROLL COLLECTION (SMART-STOP CAPTION LOGIC + METRICS) ----------

def collect_captions_step(
    driver,
    seen: Set[str],
    posts: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    One step: read all caption-class elements currently in DOM
    and add NEW non-empty caption + likes + comments + shares + url
    to the 'posts' list.
    Deduplicate by caption text.

    Returns: list of *new* captions added this step.
    """
    # OPTIMIZATION: Use JS to find elements that haven't been scraped yet
    find_script = """
    var xpath = arguments[0];
    var result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var newElements = [];
    for (var i = 0; i < result.snapshotLength; i++) {
        var el = result.snapshotItem(i);
        if (!el.getAttribute('data-stc-scraped')) {
            newElements.push(el);
        }
    }
    return newElements;
    """
    try:
        elements = driver.execute_script(find_script, CAPTION_XPATH)
    except Exception:
        print("[STEP] No caption elements found this step.")
        return []

    if not elements:
        return []

    print(f"[STEP] Found {len(elements)} NEW caption-class elements this step")

    new_posts = []

    for el in elements:
        try:
            # Mark as scraped immediately
            driver.execute_script("arguments[0].setAttribute('data-stc-scraped', 'true');", el)

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

            # 2) Likes + Comments + Shares + URL
            metrics = get_metrics_for_caption_el(driver, el)
            
            # Deduplicate by URL (primary) or Text (fallback)
            unique_id = metrics.get("url") or text
            if not unique_id or unique_id in seen:
                continue

            seen.add(unique_id)
            post_data = {
                "caption": text,
                "likes": metrics["likes"],
                "comments": metrics["comments"],
                "shares": metrics["shares"],
                "url": metrics["url"],
                "date": metrics["date"],
                "type": metrics["type"],
                "views": metrics["views"]
            }
            posts.append(post_data)
            new_posts.append(post_data)
            
            print(
                f"  [+] New caption: {text[:80]!r} | Type: {metrics['type']} | "
                f"Date: {metrics['date']} | "
                f"Views: {metrics['views']} | Likes: {metrics['likes']} | "
                f"Comments: {metrics['comments']} | Shares: {metrics['shares']} | "
                f"URL: {metrics['url']}"
            )
        except Exception:
            continue

    return new_posts


def seek_checkpoint_step(driver, checkpoint: Dict[str, Any]) -> bool:
    """
    Scans visible caption elements to find the checkpoint (last scraped post).
    Marks elements as scraped to skip them.
    Returns True if checkpoint is found.
    """
    find_script = """
    var xpath = arguments[0];
    var result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    var newElements = [];
    for (var i = 0; i < result.snapshotLength; i++) {
        var el = result.snapshotItem(i);
        if (!el.getAttribute('data-stc-scraped')) {
            newElements.push(el);
        }
    }
    return newElements;
    """
    try:
        elements = driver.execute_script(find_script, CAPTION_XPATH)
    except Exception:
        return False

    if not elements:
        return False

    target_url = checkpoint.get("url")
    target_caption = checkpoint.get("caption")
    target_date = checkpoint.get("date")

    for el in elements:
        try:
            # Mark as scraped so we don't process again
            driver.execute_script("arguments[0].setAttribute('data-stc-scraped', 'true');", el)
            
            # Check match
            url, date_str = get_post_details_from_ancestors(driver, el)
            
            # 1. URL match (Strongest)
            if target_url and url and url == target_url:
                return True
                
            # 2. Caption + Date match (Fallback)
            # (Simplified: if URL didn't match, we assume it's not the one, or we could check caption/date if URL is missing)
            # For now, relying on URL is safest if available.
        except Exception:
            continue
    
    return False

# ---------- MAIN ----------

def scrape_single_page(driver, page_url, daily_data_col) -> List[Dict[str, Any]]:
    print(f"\n[STEP] Processing page: {page_url}")
    posts_ordered = []

    # Extract handle/ID from page_url
    handle = page_url.split('?')[0].rstrip('/').split('/')[-1]
    if "profile.php" in page_url:
        match = re.search(r'[?&]id=(\d+)', page_url)
        if match:
            handle = match.group(1)

    # 1. Fetch checkpoint URL
    checkpoint_url = None
    try:
        doc = daily_data_col.find_one({"channel_url": page_url}, {"posts": {"$slice": 1}})
        if doc and "posts" in doc and len(doc["posts"]) > 0:
            checkpoint_url = doc["posts"][0].get("url")
        print(f"[INFO] Loaded checkpoint URL: {checkpoint_url}")
    except Exception as e:
        print(f"[WARN] Failed to fetch checkpoint: {e}")

    try:
        driver.get(page_url)
        time.sleep(5)  # Allow React/Scripts to initialize

        # Zoom out to fit more posts in viewport and prevent skipping
        try:
            driver.execute_script("document.body.style.zoom='60%'")
        except:
            pass

        try:
            # Smart wait for content
            WebDriverWait(driver, 15).until(
                EC.presence_of_element_located((By.XPATH, CAPTION_XPATH))
            )
        except Exception as e:
            pass

        # Followers (Update on every reload)
        followers = get_follower_count(driver)
        if followers:
            print(f"[INFO] Followers count for {page_url}: {followers}")

        # Update channel metadata
        daily_data_col.update_one(
            {"channel_url": page_url},
            {
                "$set": {
                    "channel_handle": handle,
                    "channel_id": handle,
                    "followers_count": followers if followers > 0 else 0,
                    "last_scraped": datetime.now()
                }
            },
            upsert=True
        )

        session_seen_ids = set()
        CUTOFF_DATE = datetime(2025, 6, 1)
        consecutive_old_posts = 0
        stop_scraping = False
        
        posts_scraped_in_batch = 0
        no_new_in_row = 0
        last_height = driver.execute_script("return document.body.scrollHeight")

        while not stop_scraping:
            driver.execute_script("window.scrollBy(0, 600);")
            
            # Ensure we hit the bottom trigger if close
            driver.execute_script("""
                if ((window.innerHeight + window.scrollY) >= document.body.scrollHeight - 1500) {
                    window.scrollTo(0, document.body.scrollHeight);
                }
            """)

            try:
                driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
            except Exception:
                pass
            
            time.sleep(1.5)  # Reduced wait time for speed
            
            # Scrape Mode
            scraped_batch = collect_captions_step(driver, session_seen_ids, posts_ordered)
            
            batch_new_count = 0
            if scraped_batch:
                new_items = []
                for p in scraped_batch:
                    # Check overlap with Checkpoint
                    if checkpoint_url and p.get("url") == checkpoint_url:
                        print(f"  [STOP] Found checkpoint overlap: {p['url']}")
                        stop_scraping = True
                        break

                    # Check date
                    p_date_str = p.get("date", "")
                    try:
                        if p_date_str:
                            p_dt = datetime.strptime(p_date_str, "%Y-%m-%d %H:%M:%S")
                            if p_dt < CUTOFF_DATE:
                                print(f"  [STOP] Post date {p_date_str} is older than {CUTOFF_DATE.date()}.")
                                consecutive_old_posts += 1
                                if consecutive_old_posts >= 5:
                                    stop_scraping = True
                                    break
                                continue
                            else:
                                consecutive_old_posts = 0
                    except ValueError:
                        pass

                    new_items.append(p)
                    batch_new_count += 1
                
                if new_items:
                    daily_data_col.update_one(
                        {"channel_url": page_url},
                        {"$push": {
                            "posts": {
                                "$each": new_items,
                                "$position": 0
                            }
                        }}
                    )
                    posts_scraped_in_batch += len(new_items)

            if stop_scraping:
                print(f"[INFO] Reached date cutoff ({CUTOFF_DATE.date()}). Stopping page.")
                break

            if batch_new_count == 0:
                no_new_in_row += 1
            else:
                no_new_in_row = 0

            new_height = driver.execute_script("return document.body.scrollHeight")
            is_at_bottom = driver.execute_script(
                "return (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 500;"
            )

            if is_at_bottom and new_height == last_height:
                if no_new_in_row >= 8:
                    print("[INFO] Stuck at bottom, attempting to jiggle scroll...")
                    driver.execute_script("window.scrollBy(0, -500);")
                    time.sleep(2)
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(3)

                if no_new_in_row >= 20:
                    print("[INFO] Reached bottom of page (height stable). Stopping.")
                    stop_scraping = True # Mark as stopped so we break outer loop too
                    break
            last_height = new_height
        

    except Exception as e:
        print(f"[ERROR] Failed to scrape {page_url}: {e}")
        # Re-raise critical driver errors so worker can restart
        err_str = str(e).lower()
        if "invalid session id" in err_str or "no such window" in err_str or "chrome not reachable" in err_str or "disconnected" in err_str:
            raise e

    return posts_ordered

def worker_process(urls):
    driver = create_driver()
    client = MongoClient(FB_MONGO_URL)
    daily_data_col = client['facebook_scraper']['daily_scrap']
    results = []
    
    # Stagger start times to avoid thundering herd on login/network
    time.sleep(random.uniform(1, 5))
    
    try:
        # Retry login logic for worker
        login_success = False
        for _ in range(3):
            if fb_manual_login(driver):
                login_success = True
                break
            time.sleep(5)

        if login_success:
            for i, url in enumerate(urls):
                # Restart driver every 10 pages to prevent Memory Leaks/OOM on EC2
                if i > 0:
                    print(f"[INFO] Restarting driver to free memory (processed {i} pages)...")
                    driver.quit()
                    driver = create_driver()
                    if not fb_manual_login(driver):
                        print("[ERROR] Re-login failed after restart.")
                        break

                try:
                    results.extend(scrape_single_page(driver, url, daily_data_col))
                except Exception as e:
                    err_str = str(e).lower()
                    if "invalid session id" in err_str or "no such window" in err_str or "chrome not reachable" in err_str or "disconnected" in err_str:
                        print(f"[WARN] Driver crashed on {url} ({e}). Restarting...")
                        try:
                            driver.quit()
                        except:
                            pass
                        driver = create_driver()
                        if not fb_manual_login(driver):
                            print("[ERROR] Re-login failed after crash. Aborting worker.")
                            break
                        # Retry once
                        try:
                            results.extend(scrape_single_page(driver, url, daily_data_col))
                        except Exception as e2:
                            print(f"[ERROR] Retry failed for {url}: {e2}")
        else:
            print("[ERROR] Worker failed to login after 3 attempts. Skipping chunk.")
    except Exception as e:
        print(f"[ERROR] Worker exception: {e}")
    finally:
        driver.quit()
        client.close()
    return results

def run_selenium_scraper():
    print("=== Scrape ALL captions + likes + comments + shares + followers + URL (Parallel 5 tabs) ===\n")
    
    # Pre-flight check to ensure cookies are valid or perform one-time login
    print("[INFO] Performing pre-flight login check...")
    check_driver = create_driver()
    if not fb_manual_login(check_driver):
        print("[CRITICAL] Login failed. Aborting.")
        check_driver.quit()
        return []
    check_driver.quit()
    print("[INFO] Pre-flight login successful. Starting parallel workers...")
    
    num_workers = 1
    # Distribute pages among workers
    chunk_size = math.ceil(len(TARGET_PAGES) / num_workers)
    chunks = [TARGET_PAGES[i:i + chunk_size] for i in range(0, len(TARGET_PAGES), chunk_size)]
    
    all_posts = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_workers) as executor:
        futures = [executor.submit(worker_process, chunk) for chunk in chunks]
        for future in concurrent.futures.as_completed(futures):
            try:
                all_posts.extend(future.result())
            except Exception as e:
                print(f"[ERROR] A worker thread failed: {e}")

    # ---------- FINAL RESULTS ----------
    print("\n========== FINAL CAPTIONS + METRICS ==========")
    for idx, p in enumerate(all_posts, start=1):
        print(f"\nPOST {idx}:")
        print("Caption :", p["caption"])
        print("Likes   :", p["likes"])
        print("Comments:", p["comments"])
        print("Shares  :", p["shares"])
        print("Type    :", p["type"])
        print("Views   :", p["views"])
        print("URL     :", p["url"])
    print("\nTotal unique captions collected:", len(all_posts))
    print("====================================")

    return all_posts


async def scrape_and_save_task():
    global SCRAPE_RUNNING
    """
    Runs the sync selenium scraper in a thread, then saves to MongoDB.
    """
    try:
        print("Starting Facebook Scrape Task...")
        loop = asyncio.get_running_loop()
        
        # Run the blocking selenium code in a separate thread
        posts = await loop.run_in_executor(None, run_selenium_scraper)
        
        print(f"Facebook scraping task completed. Total posts found: {len(posts) if posts else 0}")

    except Exception as e:
        print(f"[ERROR] Scrape task failed: {e}")
    finally:
        SCRAPE_RUNNING = False


@router.get("/")
async def root():
    return {"message": "Facebook Scraper Service is Running. Go to /docs to use the API."}


@router.api_route("/run-scrape", methods=["GET", "POST"])
async def trigger_facebook_scrape(background_tasks: BackgroundTasks):
    global SCRAPE_RUNNING
    if SCRAPE_RUNNING:
        return {"message": "Scrape already running. Please wait."}
    
    """
    Triggers the Facebook scraping process in the background.
    """
    SCRAPE_RUNNING = True
    background_tasks.add_task(scrape_and_save_task)
    return {"message": "Facebook scraping started in the background."}

@router.get("/data")
async def get_facebook_data(
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=1000, description="Items per page"),
    search: str = Query(None, description="Search term for caption or channel"),
    start_date: str = Query(None, description="YYYY-MM-DD"),
    end_date: str = Query(None, description="YYYY-MM-DD"),
    channels: List[str] = Query(None, description="Filter by channel URLs"),
    post_type: str = Query("All", description="All, Videos, Posts")
):
    """
    Fetches scraped Facebook data from MongoDB with pagination, filtering, and aggregation.
    """
    try:
        fb_client = AsyncIOMotorClient(FB_MONGO_URL)
        # Note: Using distinct collection for daily_scrap
        collection = fb_client['facebook_scraper']['daily_scrap']

        # --- 1. Fetch All Accounts (Unfiltered) for Dropdown ---
        # Each document in 'daily_scrap' is one channel
        accounts_cursor = collection.find({}, {"channel_url": 1, "channel_handle": 1, "followers_count": 1, "_id": 0})
        all_accounts = await accounts_cursor.to_list(length=None)
        
        # --- 2. Main Aggregation Pipeline ---
        pipeline = [
            {"$unwind": "$posts"},
            {
                "$project": {
                    "_id": 0,
                    "channel_name": "$channel_handle",
                    "channel_url": "$channel_url",
                    "followers": "$followers_count",
                    "post": "$posts"
                }
            },
            {
                "$replaceRoot": {
                    "newRoot": {
                        "$mergeObjects": ["$post", {
                            "channel_name": "$channel_name",
                            "channel_url": "$channel_url",
                            "followers": "$followers"
                        }]
                    }
                }
            },
            # Ensure every field the frontend expects exists with correct types
            {
                "$addFields": {
                    "likes": {"$convert": {"input": {"$ifNull": ["$likes", 0]}, "to": "long", "onError": 0, "onNull": 0}},
                    "comments": {"$convert": {"input": {"$ifNull": ["$comments", 0]}, "to": "long", "onError": 0, "onNull": 0}},
                    "shares": {"$convert": {"input": {"$ifNull": ["$shares", 0]}, "to": "long", "onError": 0, "onNull": 0}},
                    "views": {"$convert": {"input": {"$ifNull": ["$views", 0]}, "to": "long", "onError": 0, "onNull": 0}},
                    "followers": {"$convert": {"input": {"$ifNull": ["$followers", 0]}, "to": "long", "onError": 0, "onNull": 0}},
                    "mentions": {"$ifNull": ["$mentions", []]},
                    "caption": {"$ifNull": ["$caption", ""]},
                    "date": {"$ifNull": ["$date", ""]},
                    "type": {"$ifNull": ["$type", "Post"]},
                    "url": {"$ifNull": ["$url", ""]},
                    "channel_name": {"$ifNull": ["$channel_name", ""]},
                    "channel_url": {"$ifNull": ["$channel_url", ""]}
                }
            }
        ]

        # --- 3. Match Stage (Filtering) ---
        # Use a list of conditions to avoid $or/$and key conflicts
        and_conditions = []

        if search:
            and_conditions.append({
                "$or": [
                    {"caption": {"$regex": search, "$options": "i"}},
                    {"channel_name": {"$regex": search, "$options": "i"}}
                ]
            })

        if channels:
            and_conditions.append({"channel_url": {"$in": channels}})

        if post_type != "All":
            if post_type == "Videos":
                and_conditions.append({
                    "$or": [
                        {"type": "Video"},
                        {"type": "Reel"},
                        {"url": {"$regex": "/videos/|/reel/", "$options": "i"}}
                    ]
                })
            elif post_type == "Posts":
                and_conditions.append({"type": "Post"})
                and_conditions.append(
                    {"url": {"$not": {"$regex": "/videos/|/reel/", "$options": "i"}}}
                )

        # Date Filtering
        if start_date or end_date:
            date_filter = {}
            if start_date:
                date_filter["$gte"] = start_date
            if end_date:
                date_filter["$lte"] = end_date + " 23:59:59"
            if date_filter:
                and_conditions.append({"date": date_filter})

        if and_conditions:
            if len(and_conditions) == 1:
                pipeline.append({"$match": and_conditions[0]})
            else:
                pipeline.append({"$match": {"$and": and_conditions}})

        # --- 4. Facets (Parallel Processing) ---
        skip = (page - 1) * limit
        
        facet_stage = {
            "$facet": {
                # A. Metadata (Total Counts)
                "metadata": [{"$count": "total"}],
                
                # B. Paginated Posts (Feed) — add engagement field for frontend
                "posts": [
                    {
                        "$addFields": {
                            "engagement": {"$add": ["$likes", "$comments", "$shares"]}
                        }
                    },
                    {"$sort": {"date": -1}},
                    {"$skip": skip},
                    {"$limit": limit}
                ],
                
                # C. KPIs (Aggregated Totals) — fields are already ints from $addFields
                "kpis": [
                    {
                        "$group": {
                            "_id": None,
                            "total_likes": {"$sum": "$likes"},
                            "total_comments": {"$sum": "$comments"},
                            "total_shares": {"$sum": "$shares"},
                            "total_views": {"$sum": "$views"},
                            "total_posts": {"$sum": 1},
                            "unique_accounts": {"$addToSet": "$channel_url"},
                            # Collect unique (channel_url, followers) pairs to sum later
                            "channel_followers": {
                                "$addToSet": {
                                    "channel_url": "$channel_url",
                                    "followers": "$followers"
                                }
                            }
                        }
                    },
                     {
                        "$project": {
                            "_id": 0,
                            "total_likes": 1, "total_comments": 1, "total_shares": 1,
                            "total_views": 1, "total_posts": 1,
                            "total_accounts": {"$size": "$unique_accounts"},
                            "total_engagement": {
                                "$add": ["$total_likes", "$total_comments", "$total_shares"]
                            },
                            "total_followers": {
                                "$reduce": {
                                    "input": "$channel_followers",
                                    "initialValue": 0,
                                    "in": {"$add": ["$$value", "$$this.followers"]}
                                }
                            }
                        }
                     }
                ],
                
                # D. Top Posts (By Engagement)
                "top_posts": [
                    {
                        "$addFields": {
                            "engagement": {
                                "$add": ["$likes", "$comments", "$shares"]
                            }
                        }
                    },
                    {"$sort": {"engagement": -1}},
                    {"$limit": 10}
                ],
                
                # E. Top Accounts (By Engagement)
                "top_accounts": [
                    {
                         "$group": {
                            "_id": "$channel_url",
                            "name": {"$first": "$channel_name"},
                            "engagement": {
                                "$sum": {
                                    "$add": ["$likes", "$comments", "$shares"]
                                }
                            },
                            "posts": {"$sum": 1}
                        }
                    },
                    {"$sort": {"engagement": -1}},
                    {"$limit": 10}
                ],

                # F. Best Posting Day (By Engagement)
                "best_day": [
                    {
                        "$match": {"date": {"$ne": ""}}
                    },
                    {
                        "$addFields": {
                            "parsed_date": {
                                "$dateFromString": {
                                    "dateString": "$date",
                                    "format": "%Y-%m-%d %H:%M:%S",
                                    "onError": None,
                                    "onNull": None
                                }
                            }
                        }
                    },
                    {
                        "$match": {"parsed_date": {"$ne": None}}
                    },
                    {
                        "$group": {
                            "_id": {"$dayOfWeek": "$parsed_date"},
                            "total_engagement": {
                                "$sum": {"$add": ["$likes", "$comments", "$shares"]}
                            },
                            "count": {"$sum": 1}
                        }
                    },
                    {
                        "$addFields": {
                            "avg_engagement": {
                                "$cond": [
                                    {"$gt": ["$count", 0]},
                                    {"$divide": ["$total_engagement", "$count"]},
                                    0
                                ]
                            }
                        }
                    },
                    {"$sort": {"avg_engagement": -1}},
                    {"$limit": 1}
                ],

                # G. Unique Channels List (for dropdown)
                "channels": [
                    {
                        "$group": {
                            "_id": "$channel_url",
                            "channel_name": {"$first": "$channel_name"},
                            "followers": {"$first": "$followers"},
                            "post_count": {"$sum": 1}
                        }
                    },
                    {"$sort": {"_id": 1}}
                ]
            }
        }
        
        pipeline.append(facet_stage)
        
        result = await collection.aggregate(pipeline).to_list(length=1)
        
        # --- 5. Format Response ---
        if not result:
            return {
                "data": [], "pagination": {}, "kpis": {},
                "accounts": all_accounts, "top_accounts": [], "top_posts": [],
                "channels": [], "best_posting_day": "N/A"
            }

        data = result[0]
        posts = data.get("posts", [])
        
        kpis = {}
        if data.get("kpis"):
            kpis = data["kpis"][0]
        else:
            kpis = {
                "total_likes": 0, "total_comments": 0, "total_shares": 0,
                "total_views": 0, "total_posts": 0, "total_accounts": 0,
                "total_engagement": 0, "total_followers": 0
            }
            
        top_posts = data.get("top_posts", [])
        top_accounts = data.get("top_accounts", [])
        
        # Best Posting Day
        day_map = {1: "Sunday", 2: "Monday", 3: "Tuesday", 4: "Wednesday",
                   5: "Thursday", 6: "Friday", 7: "Saturday"}
        best_posting_day = "N/A"
        if data.get("best_day") and len(data["best_day"]) > 0:
            best_day_id = data["best_day"][0]["_id"]
            best_posting_day = day_map.get(best_day_id, "N/A")

        # Channels list for dropdown
        channels_list = data.get("channels", [])

        total_count = 0
        if data.get("metadata"):
             total_count = data["metadata"][0]["total"]
             
        total_pages = math.ceil(total_count / limit) if limit > 0 else 0

        return {
            "data": posts,
            "pagination": {
                "total": total_count,
                "page": page,
                "limit": limit,
                "total_pages": total_pages
            },
            "kpis": kpis,
            "top_posts": top_posts,
            "top_accounts": top_accounts,
            "accounts": all_accounts,
            "channels": channels_list,
            "best_posting_day": best_posting_day
        }

    except Exception as e:
        print(f"Error fetching data: {e}")
        return {"error": str(e)}

@router.get("/kpis")
async def get_facebook_kpis(channel_url: str = Query(None)):
    try:
        fb_client = AsyncIOMotorClient(FB_MONGO_URL)
        collection = fb_client['facebook_scraper']['daily_scrap']

        pipeline = []
        if channel_url:
            pipeline.append({"$match": {"channel_url": channel_url}})

        pipeline.extend([
            {"$unwind": "$posts"},
            {
                "$project": {
                    "_id": 0,
                    "date": "$posts.date",
                    "likes": "$posts.likes",
                    "comments": "$posts.comments",
                    "shares": "$posts.shares"
                }
            }
        ])
        
        docs = await collection.aggregate(pipeline).to_list(length=None)
        
        day_stats = defaultdict(lambda: {'total_engagement': 0, 'count': 0})
        
        for doc in docs:
            d_str = doc.get('date')
            if not d_str: continue
            try:
                dt = datetime.strptime(d_str, "%Y-%m-%d %H:%M:%S")
                day_name = dt.strftime('%A')
                
                likes = parse_count(doc.get('likes'))
                comments = parse_count(doc.get('comments'))
                shares = parse_count(doc.get('shares'))
                
                engagement = likes + comments + shares
                day_stats[day_name]['total_engagement'] += engagement
                day_stats[day_name]['count'] += 1
            except:
                continue
                
        best_day = "N/A"
        max_avg_engagement = -1
        
        for day, stats in day_stats.items():
            if stats['count'] > 0:
                # Calculate Average Engagement to prioritize high engagement even with fewer posts
                avg = stats['total_engagement'] / stats['count']
                if avg > max_avg_engagement:
                    max_avg_engagement = avg
                    best_day = day
                    
        return {"best_posting_day": best_day}

    except Exception as e:
        return {"error": str(e)}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://showtime-consulting-employee-portal.onrender.com",
        "https://showtime-employeeportal.vercel.app",
        "https://stc-employeeportal.vercel.app",
        "https://stc-employeeportal.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Facebook Scraper Service is Running"}

app.include_router(router, prefix="/api/facebook")

if __name__ == "__main__":
    # When run directly with 'python fb.py', we start the SCRAPER.
    # To run the backend server, use: 'uvicorn fb:app --reload'
    print("🚀 Starting Facebook Scraper (Standalone Mode)...")
    asyncio.run(scrape_and_save_task())
