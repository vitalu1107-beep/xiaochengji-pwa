{\rtf1\ansi\ansicpg936\cocoartf2638
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fnil\fcharset134 PingFangSC-Regular;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww28600\viewh14960\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 function showPage(pageId)\{\
  const pages = document.querySelectorAll('.page');\
  pages.forEach(p => p.classList.add('hidden'));\
  document.getElementById(pageId).classList.remove('hidden');\
\}\
\
function showOverlay(id)\{\
  document.getElementById(id).classList.remove('hidden');\
\}\
\
function closeOverlay(id)\{\
  document.getElementById(id).classList.add('hidden');\
\}\
\
// 
\f1 \'b3\'c9\'be\'cd\'c7\'bd\'cf\'ea\'c7\'e9
\f0 \
function showAchievementDetail(title)\{\
  document.getElementById('achievementTitle').innerText = title;\
  showOverlay('achievementDetail');\
\}\
\
// 
\f1 \'c3\'fb\'c8\'cb\'cf\'ea\'c7\'e9
\f0 \
function showCelebrityDetail(title)\{\
  document.getElementById('celebrityTitle').innerText = title;\
  showOverlay('celebrityDetail');\
\}\
\
// 
\f1 \'cb\'e6\'bb\'fa\'bb\'d8\'b9\'cb
\f0 \
function showRandomReview()\{\
  showOverlay('randomReview');\
\}\
}