import time
import re
import asyncio
import pickle
import os
import shutil
from datetime import datetime, timedelta
from typing import List, Set, Dict, Any, Tuple

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import (
    StaleElementReferenceException,
    NoSuchElementException,
)
from webdriver_manager.chrome import ChromeDriverManager
from fastapi import FastAPI, APIRouter, BackgroundTasks
from database import stc_db
from pymongo import MongoClient


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
CAPTION_XPATH = "//div[@role='article']//div[@dir='auto']"

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

router = APIRouter()

# Initialize the main FastAPI app
app = FastAPI()

COOKIES_FILE = "fb_cookies.pkl"


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
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")

    chrome_bin = os.environ.get("CHROME_BIN") or os.environ.get("GOOGLE_CHROME_BIN")
    
    # Fallback for Render if env var is missing but binary exists in standard location
    if not chrome_bin:
        paths_to_check = [
            "/opt/render/project/.render/chrome/opt/google/chrome/google-chrome",
            "/usr/bin/google-chrome", 
            "/usr/bin/google-chrome-stable", 
            "/opt/google/chrome/google-chrome", 
            "/usr/bin/chromium", 
            "/usr/bin/chromium-browser"
        ]
        for path in paths_to_check:
            if os.path.exists(path):
                chrome_bin = path
                break

    if not chrome_bin:
        chrome_bin = shutil.which("google-chrome") or shutil.which("chromium")

    if chrome_bin:
        print(f"[INFO] Using Chrome binary at: {chrome_bin}")
        opts.binary_location = chrome_bin
    else:
        print("[INFO] CHROME_BIN not set. Selenium will search system PATH.")

    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=opts)


def fb_manual_login(driver):
    driver.get("https://www.facebook.com")

    # 1. Try to load cookies
    if os.path.exists(COOKIES_FILE):
        try:
            with open(COOKIES_FILE, "rb") as f:
                cookies = pickle.load(f)
                for cookie in cookies:
                    driver.add_cookie(cookie)
            print("[INFO] Cookies loaded. Refreshing page...")
            driver.refresh()
            time.sleep(5)
        except Exception as e:
            print(f"[WARN] Failed to load cookies: {e}")

    # 2. Check if we need to log in (look for login form or 'login' in URL)
    if driver.find_elements(By.ID, "email") or "login" in driver.current_url:
        print("\n[MANUAL LOGIN REQUIRED]")
        print("1. Log in to Facebook in the opened browser.")
        print("2. Solve any 'I'm not a robot' / captcha / 2FA.")
        print("3. Make sure your feed/home is visible.")
        # input("\nWhen you are fully logged in, press ENTER here to continue...\n")
        print("[WARN] Manual login required but running in headless mode. Skipping interactive login.")

        # 3. Save cookies for next time
        with open(COOKIES_FILE, "wb") as f:
            pickle.dump(driver.get_cookies(), f)
        print(f"[INFO] Cookies saved to {COOKIES_FILE}")
    else:
        print("[INFO] Logged in successfully via cookies.")


def safe_inner_text(driver, el) -> str:
    """Return innerText safely, or empty string on stale."""
    try:
        txt = driver.execute_script("return arguments[0].innerText;", el)
        return (txt or "").strip()
    except StaleElementReferenceException:
        return ""


# ---------- DATE PARSER ----------

def parse_facebook_date(date_str: str) -> str:
    """
    Convert Facebook relative/short dates (2w, 13m, Yesterday) to DD/MM/YYYY.
    """
    if not date_str:
        return ""
    
    now = datetime.now()
    s = date_str.replace("\u00a0", " ").strip()

    # Handle "January 3 at 19:30" or "3 January at 19:30"
    m1 = re.search(r"([A-Za-z]+)\s+(\d{1,2})\s+at", s)
    m2 = re.search(r"(\d{1,2})\s+([A-Za-z]+)\s+at", s) 

    if m1 or m2:
        if m1:
            month, day = m1.group(1), int(m1.group(2))
        else:
            day, month = int(m2.group(1)), m2.group(2)

        year = now.year
        for fmt in ("%d %B %Y", "%d %b %Y"):
            try:
                dt = datetime.strptime(f"{day} {month} {year}", fmt)
                if dt > now:
                    dt = dt.replace(year=year - 1)
                return dt.strftime("%d/%m/%Y")
            except ValueError:
                pass

    # Handle "Just now"
    if "Just now" in s:
        return now.strftime("%d/%m/%Y")

    # 1) Check for short codes: 13m, 2h, 5d, 2w, 1y
    # Regex looks for digits at start followed by the unit char.
    
    # Minutes (m, min, mins)
    m_min = re.search(r"^(\d+)\s*m", s)
    if m_min:
        val = int(m_min.group(1))
        dt = now - timedelta(minutes=val)
        return dt.strftime("%d/%m/%Y")

    # Hours (h, hr, hrs)
    m_hour = re.search(r"^(\d+)\s*h", s)
    if m_hour:
        val = int(m_hour.group(1))
        dt = now - timedelta(hours=val)
        return dt.strftime("%d/%m/%Y")

    # Days (d, day, days)
    m_day = re.search(r"^(\d+)\s*d", s)
    if m_day:
        val = int(m_day.group(1))
        dt = now - timedelta(days=val)
        return dt.strftime("%d/%m/%Y")

    # Weeks (w, wk, weeks)
    m_week = re.search(r"^(\d+)\s*w", s)
    if m_week:
        val = int(m_week.group(1))
        dt = now - timedelta(weeks=val)
        return dt.strftime("%d/%m/%Y")

    # Years (y, yr, years)
    m_year = re.search(r"^(\d+)\s*y", s)
    if m_year:
        val = int(m_year.group(1))
        dt = now - timedelta(days=val*365)
        return dt.strftime("%d/%m/%Y")

    # 2) "Yesterday at ..."
    if "Yesterday" in s:
        dt = now - timedelta(days=1)
        return dt.strftime("%d/%m/%Y")

    # 3) Explicit dates
    # Clean up " at " and day names (e.g. "Wednesday, July 26, 2023 at ...")
    clean_date = s.split(" at ")[0].strip()
    # Remove day name if present (e.g. "Monday, ")
    clean_date = re.sub(r"^[A-Za-z]+,\s+", "", clean_date)
    
    # Try parsing various formats
    formats = [
        "%B %d, %Y",  # July 25, 2023
        "%d %B %Y",   # 25 July 2023
        "%B %d",      # July 25 (current year)
        "%d %B",      # 25 July
        "%b %d, %Y",  # Jul 25, 2023
        "%d %b %Y",   # 25 Jul 2023
        "%b %d",      # Jul 25
        "%d %b",      # 25 Jul
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(clean_date, fmt)
            # If year is default (1900), set to current year
            if dt.year == 1900:
                dt = dt.replace(year=now.year)
                # If date is in future (e.g. scraping in Jan, post is Dec), subtract 1 year
                if dt > now:
                    dt = dt.replace(year=now.year - 1)
            return dt.strftime("%d/%m/%Y")
        except ValueError:
            continue

    # Fallback: return original string if we can't parse
    return s


# ---------- NUMERIC EXTRACTOR ----------

def extract_like_number(raw: str) -> str:
    """
    Extract number like '123', '1.2K', '12,345' from the raw text.
    Returns '' if nothing numeric is found.
    """
    if not raw:
        return ""
    raw = raw.replace("\u00a0", " ").strip()
    m = re.search(r"([\d.,]+K?)", raw)
    if not m:
        return ""
    return m.group(1)


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

def get_post_details_from_ancestors(driver, cap_el) -> Tuple[str, str]:
    """
    Starting from the caption element, walk up ancestors.
    On each ancestor, find <a> with /posts/, /videos/, or /photos/ in href.
    Also extract the date from that anchor (aria-label or text).

    Prefer URLs that DO NOT contain 'comment_id=' or 'reply_comment_id='
    (to avoid comment permalinks). If no clean URL found, fall back to
    the first candidate.
    """
    # Helper to check if date string looks valid
    def is_valid_date(d_str):
        if not d_str: return False
        # Check for relative time units or specific keywords
        if any(x in d_str for x in ["Just now", "Yesterday", "mins", "hrs", "days"]): return True
        # Check for short units with digits (e.g. 2h, 2m)
        if re.search(r"\d+\s*[mhdyw]", d_str): return True
        # Check for months
        if any(m in d_str for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]): return True
        return False

    current = cap_el
    for _ in range(12):  # climb up a bit more
        try:
            links = current.find_elements(By.TAG_NAME, "a")
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

            # Only consider post-like URLs
            if any(p in href for p in ("/posts/", "/videos/", "/photos/", "/reel/")):
                # Make absolute if relative
                if href.startswith("/"):
                    href = "https://www.facebook.com" + href
                
                # Extract Date (Anchor vs XPath)
                date_str = "" # aria-label
                xpath_date = "" # fallback
                try:
                    date_str = a.get_attribute("aria-label")
                except StaleElementReferenceException:
                    pass
                
                try:
                    abbr = a.find_element(By.TAG_NAME, "abbr")
                    xpath_date = abbr.get_attribute("title")
                except (NoSuchElementException, StaleElementReferenceException):
                    pass
                
                if not xpath_date:
                    xpath_date = safe_inner_text(driver, a)

                # Prefer the one that actually looks like a date
                d1 = date_str.strip() if date_str else ""
                d2 = xpath_date.strip() if xpath_date else ""
                
                if is_valid_date(d1):
                    final_date = d1
                elif is_valid_date(d2):
                    final_date = d2
                else:
                    final_date = d1 if d1 else d2

                # print("RAW DATE TEXT:", date_str)
                # print("XPATH DATE   :", xpath_date)
                # print("FINAL DATE   :", final_date)
                # print("RAW URL      :", href)

                candidates.append((href, final_date))

        if candidates:
            # prefer ones without comment_id / reply_comment_id
            primary = [
                (h, d) for (h, d) in candidates
                if "comment_id=" not in h and "reply_comment_id=" not in h
            ]

            # Try to find one with a valid date in primary
            for h, d in primary:
                if is_valid_date(d):
                    return clean_facebook_url(h), d

            if primary:
                return clean_facebook_url(primary[0][0]), primary[0][1]
            
            # Fallback to candidates with valid date
            for h, d in candidates:
                if is_valid_date(d):
                    return clean_facebook_url(h), d

            # no clean one, fallback to first candidate (comment permalink)
            return clean_facebook_url(candidates[0][0]), candidates[0][1]

        # go one level up
        try:
            current = current.find_element(By.XPATH, "./..")
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return "", ""


def get_post_type(url: str) -> str:
    if not url:
        return "Post"
    if "/reel/" in url:
        return "Reel"
    if "/videos/" in url or "/watch" in url:
        return "Video"
    return "Post"


def get_video_views(driver, container) -> str:
    """
    Extract views for Reels/Videos.
    Checks aria-labels and visible text.
    """
    if not container:
        return ""
    
    def _extract_views_from_node(node):
        # 1. Check visible text in the container (e.g. "1.2M views")
        try:
            text = safe_inner_text(driver, node)
            # Look for pattern like "23K views" or "1M plays", handling newlines
            matches = re.findall(r"([\d.,]+[KMB]?)\s*(?:[\n\r\s]+)?(?:views|plays)", text, re.IGNORECASE)
            if matches:
                return matches[0].upper()
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
                        m = re.search(r"([\d.,]+[KMB]?)\s*(?:views|plays)", aria, re.IGNORECASE)
                        if m:
                            return m.group(1).upper()
                except StaleElementReferenceException:
                    continue
        except Exception:
            pass
        return ""

    # 1. Try current container
    v = _extract_views_from_node(container)
    if v:
        return v

    # 2. Walk up ancestors (up to 3 levels) to find video player if it's a sibling
    current = container
    for _ in range(3):
        try:
            parent = current.find_element(By.XPATH, "./..")
            v = _extract_views_from_node(parent)
            if v:
                return v
            current = parent
        except (NoSuchElementException, StaleElementReferenceException):
            break

    return ""


def get_metrics_for_caption_el(driver, cap_el) -> Dict[str, Any]:
    """
    Full pipeline for metrics of a single caption element:
      - likes: using ancestor-walk logic
      - comments & shares: from the same container (if found)
      - url: from timestamp/post link, walking up from caption
      - date: from the same link
      - type: inferred from URL
      - views: extracted only for Reels/Videos
    """
    likes, container = find_likes_for_caption_el(driver, cap_el)
    comments, shares = get_comments_shares_from_container(driver, container)
    url, date_str = get_post_details_from_ancestors(driver, cap_el)
    
    post_type = get_post_type(url)
    
    parsed_date = parse_facebook_date(date_str)
    
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
        "date": parsed_date,
        "type": post_type,
        "views": views
    }


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

        # 2) Likes + Comments + Shares + URL
        metrics = get_metrics_for_caption_el(driver, el)

        seen.add(text)
        posts.append(
            {
                "caption": text,
                "likes": metrics["likes"],
                "comments": metrics["comments"],
                "shares": metrics["shares"],
                "url": metrics["url"],
                "posted_date": metrics["date"],
                "type": metrics["type"],
                "views": metrics["views"]
            }
        )
        added += 1
        print(
            f"  [+] New caption: {text[:80]!r} | "
            f"Type: {metrics['type']} | Date: {metrics['date']} | "
            f"Views: {metrics['views']} | Likes: {metrics['likes']} | "
            f"Comments: {metrics['comments']} | Shares: {metrics['shares']} | "
            f"URL: {metrics['url']}"
        )

    return added


# ---------- MAIN ----------

def run_selenium_scraper():
    print("=== Scrape ALL captions + likes + comments + shares + followers + URL (smart-stop) ===\n")

    driver = create_driver()
    all_posts = []
    
    # Setup MongoDB connection for immediate saving
    mongo_url = os.environ.get("ATTENDANCE_MONGO_URL")
    client = MongoClient(mongo_url)
    daily_data_col = client['facebook_db']['daily_data']

    try:
        fb_manual_login(driver)

        for page_url in TARGET_PAGES:
            try:
                print(f"\n[STEP] Processing page: {page_url}")
                driver.get(page_url)
                time.sleep(8)

                # -------- Followers (once) --------
                followers = get_follower_count(driver)
                if followers:
                    print(f"\n[INFO] Followers count: {followers}")
                else:
                    print("\n[INFO] Could not read followers count.")

                seen_texts: Set[str] = set()
                posts_ordered: List[Dict[str, Any]] = []

                # Initial capture before scrolling
                print("\n[STEP] Initial capture before scrolling...")
                collect_captions_step(driver, seen_texts, posts_ordered)

                # Smart scroll control (taken from your caption-only script)
                max_scrolls = 5000         # hard safety limit (increased to scrape all)
                no_new_limit = 20          # stop after 20 scrolls with no new captions
                no_new_in_row = 0

                last_height = driver.execute_script("return document.body.scrollHeight")

                for i in range(max_scrolls):
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    try:
                        # Press ESCAPE to close potential blocking popups (login/cookies)
                        driver.find_element(By.TAG_NAME, "body").send_keys(Keys.ESCAPE)
                    except Exception:
                        pass
                    print(f"\n[SCROLL] {i+1}/{max_scrolls}")
                    time.sleep(4)

                    new_captions = collect_captions_step(driver, seen_texts, posts_ordered)

                    if new_captions == 0:
                        no_new_in_row += 1
                    else:
                        no_new_in_row = 0

                    new_height = driver.execute_script("return document.body.scrollHeight")

                    if new_height == last_height:
                        print("[INFO] Page height stopped increasing.")
                        if no_new_in_row >= 5:
                            print("[INFO] No new captions in last 5 scrolls and height stable. Stopping.")
                            break
                    last_height = new_height

                    if no_new_in_row >= no_new_limit:
                        print(f"[INFO] No new captions for {no_new_limit} consecutive scrolls. Stopping.")
                        break
                
                # Save posts for this account immediately
                if posts_ordered:
                    print(f"[INFO] Saving {len(posts_ordered)} posts for {page_url} to facebook_db.daily_data...")
                    for p in posts_ordered:
                        daily_data_col.update_one(
                            {"url": p["url"]}, 
                            {"$set": p}, 
                            upsert=True
                        )
                all_posts.extend(posts_ordered)
            except Exception as e:
                print(f"[ERROR] Failed to scrape {page_url}: {e}")
                continue

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
            print("Date    :", p["posted_date"])
            print("URL     :", p["url"])
        print("\nTotal unique captions collected:", len(all_posts))
        print("====================================")

        return all_posts

    finally:
        # input("\nPress ENTER to close browser...")
        driver.quit()


async def scrape_and_save_task():
    """
    Runs the sync selenium scraper in a thread, then saves to MongoDB.
    """
    print("Starting Facebook Scrape Task...")
    loop = asyncio.get_running_loop()
    
    # Run the blocking selenium code in a separate thread
    posts = await loop.run_in_executor(None, run_selenium_scraper)
    
    if posts:
        print(f"Saving {len(posts)} posts to MongoDB...")
        collection = stc_db["facebook_posts"]
        
        # Optional: Clear old data or upsert. Here we insert new ones.
        # To avoid duplicates, we can use 'url' as a unique key if desired.
        # For now, we'll just insert all found (simple approach).
        # Or better: update based on URL.
        
        for p in posts:
            # Update if exists, else insert
            await collection.update_one(
                {"url": p["url"]}, 
                {"$set": p}, 
                upsert=True
            )
            
        print("Facebook posts saved to MongoDB successfully.")
    else:
        print("No posts found to save.")


@router.get("/")
async def root():
    return {"message": "Facebook Scraper Service is Running. Go to /docs to use the API."}


@router.post("/run-scrape")
async def trigger_facebook_scrape(background_tasks: BackgroundTasks):
    """
    Triggers the Facebook scraping process in the background.
    """
    background_tasks.add_task(scrape_and_save_task)
    return {"message": "Facebook scraping started in the background."}

@router.get("/data")
async def get_facebook_data():
    """
    Fetches scraped Facebook data from MongoDB.
    """
    posts = await stc_db["facebook_posts"].find({}, {"_id": 0}).to_list(length=None)
    return posts

@app.on_event("startup")
async def startup_event():
    print(">>> Web Server Ready. Send POST to /run-scrape to start scraping.")
    # Uncomment the line below to run scraper automatically on deployment
    # asyncio.create_task(scrape_and_save_task())

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
