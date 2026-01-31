{\rtf1\ansi\ansicpg936\cocoartf2638
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;\f1\fnil\fcharset134 PingFangSC-Regular;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx566\tx1133\tx1700\tx2267\tx2834\tx3401\tx3968\tx4535\tx5102\tx5669\tx6236\tx6803\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const CACHE_NAME = 'xiaochengji-cache-v1';\
const urlsToCache = [\
  '/',\
  '/index.html',\
  '/style.css',\
  '/main.js',\
  '/manifest.json'\
];\
\
// 
\f1 \'b0\'b2\'d7\'b0\'bb\'ba\'b4\'e6\'ce\'c4\'bc\'fe
\f0 \
self.addEventListener('install', event => \{\
  event.waitUntil(\
    caches.open(CACHE_NAME)\
      .then(cache => cache.addAll(urlsToCache))\
  );\
\});\
\
// 
\f1 \'c0\'b9\'bd\'d8\'c7\'eb\'c7\'f3\'a3\'ac\'d3\'c5\'cf\'c8\'bb\'ba\'b4\'e6
\f0 \
self.addEventListener('fetch', event => \{\
  event.respondWith(\
    caches.match(event.request)\
      .then(response => response || fetch(event.request))\
  );\
\});\
}