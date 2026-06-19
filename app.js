const firebaseConfig = { apiKey: "AIzaSyDF8LOSjnyIJXrloepCBvSLA2TCH3Us0H8", authDomain: "befcounter.firebaseapp.com", projectId: "befcounter", storageBucket: "befcounter.firebasestorage.app", messagingSenderId: "744277190850", appId: "1:744277190850:web:791ef6faaadfe3a0a3b35b" };
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let messaging = null;
try { if (typeof firebase.messaging === "function" && firebase.messaging.isSupported()) messaging = firebase.messaging(); } catch (e) {}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').then(reg => { if (messaging) messaging.useServiceWorker(reg); });

function setupPushNotificaties() {
    if (!messaging) return;
    messaging.requestPermission().then(() => messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" }))
    .then(token => { if (token && currentUser) db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ push_token: token }, { merge: true }); }).catch(e => console.log(e));
}

let currentUser = localStorage.getItem('bef_user');
let currentGroup = localStorage.getItem('bef_group');
let unsubscribeScores = null, unsubscribeFeed = null, unsubscribeBom = null;
let mijnTotalePunten = 0, mijnGedraaideSpins = 0;
let isSpinning = false, vakantieModus = false;
let spelersLijst = []; 
let worldMap = null, mapMarkers = [];
let pieChartInstance = null, barChartInstance = null;
let mijnBingoKaart = [], mijnBingoStatus = [];

function openGame(gameId) { document.getElementById(gameId).classList.add('active'); }
function sluitGame(gameId) { document.getElementById(gameId).classList.remove('active'); }

const coopMissies = [ { titel: "Drink 100 Pils", doel: 100, types: ['bier'] }, { titel: "Samen 30 Kiss acties", doel: 30, types: ['kiss'] }, { titel: "50 Shotjes/Mixjes", doel: 50, types: ['mix', 'shotje'] }, { titel: "Wordt 5x vol Geragd", doel: 5, types: ['raggen'] }, { titel: "150 Drankjes", doel: 150, types: ['bier', 'mix', 'shotje'] } ];
let actieveCoopMissie = null;
const bingoOpdrachten = ["Shot met barman", "Gratis pils", "Zeg 10 min niks", "Wijs iemand af", "Trek een Atje", "Eet laat vet", "Raak iets kwijt", "Krijg Reject", "Steel aansteker", "Deel 3 slokken uit", "Drink water", "Klim ergens op", "Laat je trakteren", "Dans battle", "Dubbel shot"];
const assassinMissies = ["Zorg dat [SPELER] een shotje neemt.", "Steel ongemerkt de aansteker van [SPELER].", "Overtuig [SPELER] om water te drinken.", "Noem [SPELER] 15 min verkeerd."];

function genereerNieuweMissie() { let andere = spelersLijst.filter(n => n !== currentUser); let s = andere.length > 0 ? andere[Math.floor(Math.random() * andere.length)] : "iemand"; return assassinMissies[Math.floor(Math.random() * assassinMissies.length)].replace("[SPELER]", s.charAt(0).toUpperCase() + s.slice(1)); }
function genereerBingoKaart() { return [...bingoOpdrachten].sort(() => 0.5 - Math.random()).slice(0, 9); }

document.body.addEventListener('touchstart', function() { const geluid = document.getElementById('notificatie-geluid'); if (geluid && geluid.paused) { geluid.play().then(() => { geluid.pause(); geluid.currentTime = 0; }).catch(e => {}); } }, { once: true });

function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block'; document.getElementById('auth-scherm').style.display = 'none'; document.getElementById('lobby-scherm').style.display = 'none'; document.getElementById('app-scherm').style.display = 'none'; document.getElementById('header-controls').style.display = 'none'; document.getElementById('bottom-nav').style.display = 'none';
    if (!currentUser) document.getElementById('auth-scherm').style.display = 'block';
    else if (!currentGroup) { document.getElementById('lobby-gebruikersnaam').innerText = currentUser; document.getElementById('lobby-scherm').style.display = 'block'; }
    else { document.getElementById('auth-container').style.display = 'none'; startApp(); }
}

function wisselPagina(paginaId, navItem) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById(paginaId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); navItem.classList.add('active');
    if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100);
}

function registreer() { const n = document.getElementById('auth-naam').value.trim().toLowerCase(), w = document.getElementById('auth-wachtwoord').value; if(!n||!w)return; db.collection('gebruikers').doc(n).get().then(d => { if(d.exists)alert('Bezet!'); else db.collection('gebruikers').doc(n).set({wachtwoord:w}).then(()=>{localStorage.setItem('bef_user',n);currentUser=n;bepaalScherm();}); }); }
function login() { const n = document.getElementById('auth-naam').value.trim().toLowerCase(), w = document.getElementById('auth-wachtwoord').value; db.collection('gebruikers').doc(n).get().then(d => { if(!d.exists||d.data().wachtwoord!==w)alert('Onjuist!'); else {localStorage.setItem('bef_user',n);currentUser=n;bepaalScherm();} }); }
function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const c = Math.random().toString(36).substring(2,7).toUpperCase(); db.collection('groepen').doc(c).set({maker:currentUser}).then(()=>joinSpecifiekeGroep(c)); }
function joinGroep() { const c = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(c).get().then(d => { if(!d.exists)alert('Niet gevonden!'); else joinSpecifiekeGroep(c); }); }
function joinSpecifiekeGroep(code) { db.collection('groepen').doc(code).collection('scores').doc(currentUser).set({bier:0,mix:0,kiss:0,rejection:0,raggen:0,kotsen:0,sleutel:0,shotje:0,spins:0}, {merge:true}).then(() => { localStorage.setItem('bef_group',code);currentGroup=code;bepaalScherm(); }); }

function startApp() {
    document.getElementById('app-scherm').style.display='block'; document.getElementById('bottom-nav').style.display='flex'; document.getElementById('header-controls').style.display='flex'; document.getElementById('ingelogde-naam').innerText=currentUser; document.getElementById('display-groepscode').innerText=currentGroup;
    setupPushNotificaties(); bouwLiveScorebord(); luisterNaarLiveFeed(); luisterNaarTijdbom(); luisterNaarCoopMissie(); luisterNaarDrinkSessie(); luisterNaarReflex();
}

let sessieCheckInterval = null; let actieveDrinkSessieTijd = 0;
function toggleDrinkSessie() {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').get().then(doc => {
        if (!doc.exists || !doc.data().actief) {
            let wachttijd = Math.floor(Math.random() * (15*60*1000)) + (5*60*1000);
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: true, starter: currentUser, volgende_atje: Date.now() + wachttijd });
            stuurNaarFeed(`🍻 DRINK SESSIE GESTART door ${currentUser.toUpperCase()}! Tracker is actief.`);
            vakantieModus = true; if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(()=>{},()=>{});
        } else {
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: false, starter: '', volgende_atje: 0 });
            stuurNaarFeed(`🛑 Sessie gestopt door ${currentUser.toUpperCase()}. Tracker uit.`); vakantieModus = false;
        }
    });
}

function forceerSessieAtje() { db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() - 1000 }); }

function luisterNaarDrinkSessie() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').onSnapshot(doc => {
        const btn = document.getElementById('btn-drink-sessie'), timerUI = document.getElementById('drink-sessie-timer-tekst'), btnSkip = document.getElementById('btn-skip-timer');
        if (!btn) return;
        if (doc.exists && doc.data().actief) {
            actieveDrinkSessieTijd = doc.data().volgende_atje; btn.innerHTML = "🛑 Stop Sessie & GPS"; btn.style.backgroundColor = "#ff3b30"; timerUI.style.display = "block"; btnSkip.style.display = "block";
            if (!vakantieModus && doc.data().starter !== currentUser) { alert(`🍻 DRINK SESSIE GESTART! Jouw locatie wordt nu live gedeeld.`); if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(()=>{},()=>{}); }
            vakantieModus = true; if (!sessieCheckInterval) sessieCheckInterval = setInterval(checkDrinkSessieTijd, 5000);
        } else {
            actieveDrinkSessieTijd = 0; btn.innerHTML = "🍻 Start Drink Sessie!"; btn.style.backgroundColor = "#ff9500"; timerUI.style.display = "none"; btnSkip.style.display = "none"; vakantieModus = false; clearInterval(sessieCheckInterval); sessieCheckInterval = null;
        }
    });
}

setInterval(() => {
    if (actieveDrinkSessieTijd > 0) {
        let diff = actieveDrinkSessieTijd - Date.now(), timerUI = document.getElementById('drink-sessie-timer-tekst');
        if (diff > 0) { let m = Math.floor(diff/60000).toString().padStart(2,'0'), s = Math.floor((diff%60000)/1000).toString().padStart(2,'0'); timerUI.innerText = `⏰ Volgende Atje over: ${m}:${s}`; }
        else timerUI.innerText = "🚨 ALARM! SLACHTOFFER KIEZEN...";
    }
}, 1000);

function checkDrinkSessieTijd() {
    if (!actieveDrinkSessieTijd || Date.now() < actieveDrinkSessieTijd) return;
    actieveDrinkSessieTijd = Date.now() + 99999999; 
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + Math.floor(Math.random()*(15*60*1000))+(5*60*1000) });
    if (spelersLijst.length === 0) return;
    let slachtoffer = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let bericht = `🚨 ALARM! Drink Sessie heeft gekozen... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`;
    stuurNaarFeed(bericht); if ("vibrate" in navigator) navigator.vibrate([200,100,200,100,500,100,500]);
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        snap.forEach(doc => { if (doc.data().push_token) fetch("https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e=>{}); });
    });
}

function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });
    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) });
    let b = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag>0?"scoort +1 bij":"deed een correctie bij"} ${emojiNaam}`;
    if (vakantieModus && "geolocation" in navigator) navigator.geolocation.getCurrentPosition(pos => { db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() }); stuurNaarFeed(b); }, () => stuurNaarFeed(b));
    else stuurNaarFeed(b);
}

function bouwLiveScorebord() {
    if(unsubscribeScores) unsubscribeScores();
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot(snap => {
        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let sB=0,sM=0,sSh=0,sK=0,sR=0,sRa=0,sKo=0,sSl=0,sTot=0, maxB=0,maxBName="-", maxRa=0,maxRaName="-", maxSj=0,maxSjName="-", maxKo=0,maxKoName="-";
        let gNamen=[], gData=[], kHtml=""; spelersLijst=[]; 
        snap.forEach(doc => {
            let d=doc.data(), n=doc.id; spelersLijst.push(n);
            let b=d.bier||0, m=d.mix||0, sh=d.shotje||d.doner||0, k=d.kiss||0, r=d.rejection||0, ra=d.raggen||d.mvp||0, ko=d.kotsen||0, sl=d.sleutel||0;
            let pTot = (b*1)+(m*2)+(sh*2)+(k*10)+(r*5)+(ra*15)+(ko*5)+(sl*5);
            sB+=b; sM+=m; sSh+=sh; sK+=k; sR+=r; sRa+=ra; sKo+=ko; sSl+=sl; sTot+=pTot;
            if (n === currentUser) { mijnTotalePunten = pTot; mijnGedraaideSpins = d.spins||0; updateCoinWeergave(); beheerMissiesEnBingo(d); }
            if(b>maxB){maxB=b;maxBName=n;} if(ra>maxRa){maxRa=ra;maxRaName=n;} if(r>maxSj){maxSj=r;maxSjName=n;} if(ko>maxKo){maxKo=ko;maxKoName=n;}
            gNamen.push(n.charAt(0).toUpperCase()+n.slice(1)); gData.push(b+m+sh);
            let kKans = Math.max(0, Math.min(99, 5+(b*4)+(m*12)+(sh*15)+(ko*30))); let kleur = kKans>=75?"#ff3b30":kKans>=40?"#ff9500":"#34c759";
            kHtml += `<div class="kater-regel"><div class="kater-header"><span>${n}</span><span>${kKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width:${kKans}%;background:${kleur};"></div></div></div>`;
            html += `<tr><td class="naam-kolom">${n}</td><td>${b}</td><td>${m}</td><td>${sh}</td><td>${k}</td><td>${r}</td><td>${ra}</td><td>${ko}</td><td>${sl}</td><td class="totaal-kolom">${pTot}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${n}')">X</button></td></tr>`;
        });
        html += `<tr class="totaal-rij"><td style="text-align:left; padding-left:10px;">Totaal</td><td>${sB}</td><td>${sM}</td><td>${sSh}</td><td>${sK}</td><td>${sR}</td><td>${sRa}</td><td>${sKo}</td><td>${sSl}</td><td class="totaal-kolom">${sTot}</td><td></td></tr>`;
        document.getElementById('score-tabel').innerHTML=html; document.getElementById('kater-container').innerHTML=kHtml;
        document.getElementById('stats-container').innerHTML=`<div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${maxBName} (${maxB})</span></div><div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${maxRaName} (${maxRa})</span></div><div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${maxKoName} (${maxKo})</span></div><div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${maxSjName} (${maxSj})</span></div>`;
        tekenGrafieken(sB, sM, sSh, sK, sR, sRa, sKo, sSl, gNamen, gData);
    });
}

function updateCoinWeergave() { document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = Math.max(0, mijnTotalePunten - mijnGedraaideSpins)); }
function verwijderSpeler(n) { if (confirm(`Verwijder ${n}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(n).delete(); }
function stuurNaarFeed(b) { db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').set({ bericht: b, tijd: firebase.firestore.FieldValue.serverTimestamp() }); }

function luisterNaarLiveFeed() {
    if(unsubscribeFeed) unsubscribeFeed(); let l = "";
    unsubscribeFeed = db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').onSnapshot(doc => {
        if (!doc.exists || doc.data().bericht === l) return; l = doc.data().bericht;
        let t = document.getElementById('live-ticker'); t.innerText = l; t.style.display = 'block';
        if ("vibrate" in navigator) navigator.vibrate([200,100,200]); let a = document.getElementById('notificatie-geluid'); if(a){a.currentTime=0;a.play().catch(e=>{});}
        setTimeout(() => t.style.display='none', 5000);
    });
}

function tekenGrafieken(b, m, sh, k, r, ra, ko, sl, n, d) {
    if(pieChartInstance)pieChartInstance.destroy(); pieChartInstance=new Chart(document.getElementById('groepPieChart'),{type:'pie',data:{labels:['Bier','Mix','Shotje','Kiss','Reject','Raggen','Kotsen','Sleutel'],datasets:[{data:[b,m,sh,k,r,ra,ko,sl],backgroundColor:['#f1c40f','#9b59b6','#e17055','#ff7675','#636e72','#ffeaa7','#16a085','#bdc3c7']}]},options:{responsive:true,maintainAspectRatio:false}});
    if(barChartInstance)barChartInstance.destroy(); barChartInstance=new Chart(document.getElementById('spelerBarChart'),{type:'bar',data:{labels:n,datasets:[{label:'Drankjes',data:d,backgroundColor:'#007aff'}]},options:{responsive:true,maintainAspectRatio:false}});
}

function beheerMissiesEnBingo(d) {
    if(!d.geheime_missie)db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({geheime_missie:genereerNieuweMissie()},{merge:true}); else{let mt=document.getElementById('geheime-missie-tekst');if(mt)mt.innerText=d.geheime_missie;}
    if(!d.bingo_kaart){db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({bingo_kaart:genereerBingoKaart(),bingo_status:[false,false,false,false,false,false,false,false,false],bingo_gehaald:false},{merge:true});}
    else {mijnBingoKaart=d.bingo_kaart;mijnBingoStatus=d.bingo_status;renderBingoGrid(d.bingo_gehaald);}
}
function voltooiGeheimeMissie() { if(confirm("Echt uitgevoerd? Liegen = adten!")) { pasScoreAan('raggen',3,'🥷 Missie'); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({geheime_missie:genereerNieuweMissie()},{merge:true}); alert("+3 Punten!"); } }
function renderBingoGrid(isG) { let g=document.getElementById('bingo-grid');if(!g)return;g.innerHTML=""; mijnBingoKaart.forEach((t,i)=>{let d=document.createElement('div');d.className="bingo-cel "+(mijnBingoStatus[i]?"voltooid":"");d.innerText=t;d.onclick=()=>toggleBingoCel(i,isG);g.appendChild(d);}); }
function toggleBingoCel(i,isG) {
    if(isG)return alert("Bingo al gehaald!"); mijnBingoStatus[i]=!mijnBingoStatus[i]; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({bingo_status:mijnBingoStatus},{merge:true});
    if([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]].some(l=>l.every(x=>mijnBingoStatus[x]))) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({bingo_gehaald:true},{merge:true}); pasScoreAan('raggen',10,'🌴 BINGO'); alert("BINGO! 10 Punten!"); }
}

function luisterNaarCoopMissie() {
    db.collection('groepen').doc(currentGroup).collection('coop').doc('status').onSnapshot(doc => {
        let v = new Date().toISOString().split('T')[0];
        if (!doc.exists || doc.data().datum !== v) { let r = coopMissies[Math.floor(Math.random()*coopMissies.length)]; db.collection('groepen').doc(currentGroup).collection('coop').doc('status').set({ datum:v, score:0, doel:r.doel, titel:r.titel, types:r.types, behaald:false }); return; }
        actieveCoopMissie = doc.data();
        document.querySelectorAll('.coop-titel-text').forEach(e=>e.innerText=actieveCoopMissie.titel); document.querySelectorAll('.coop-bar-fill').forEach(e=>e.style.width=Math.min(100,(actieveCoopMissie.score/actieveCoopMissie.doel)*100)+'%'); document.querySelectorAll('.coop-progress-text').forEach(e=>e.innerText=`${actieveCoopMissie.score} / ${actieveCoopMissie.doel}`);
        if(actieveCoopMissie.score>=actieveCoopMissie.doel && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({behaald:true}); pasScoreAan('raggen',5,'🏆 CO-OP'); stuurNaarFeed("🎉 CO-OP BEHAALD! Iedereen +5 Punten!"); }
    });
}
setInterval(()=>{ let d=new Date();d.setHours(24,0,0,0);let f=d-new Date();document.querySelectorAll('.coop-timer-text').forEach(e=>e.innerText=`Nog ${Math.floor(f/3600000).toString().padStart(2,'0')}:${Math.floor((f%3600000)/60000).toString().padStart(2,'0')}:${Math.floor((f%60000)/1000).toString().padStart(2,'0')} geldig`); },1000);

/* GAMES */
let swasiTouches={}, swKleur=0, swTimer=null, swBezig=false;
function startSwasi(){ document.getElementById('swasi-overlay').style.display='block'; document.getElementById('swasi-instructie').style.display='block'; document.getElementById('swasi-countdown').style.display='none'; document.getElementById('swasi-sluit-btn').style.display='none'; swasiTouches={}; swBezig=true; document.getElementById('swasi-overlay').addEventListener('touchstart', swTouchS, {passive:false}); document.getElementById('swasi-overlay').addEventListener('touchmove', swTouchM, {passive:false}); document.getElementById('swasi-overlay').addEventListener('touchend', swTouchE); document.getElementById('swasi-overlay').addEventListener('touchcancel', swTouchE); }
function stopSwasi(){ document.getElementById('swasi-overlay').style.display='none'; clearInterval(swTimer); swBezig=false; Object.values(swasiTouches).forEach(c=>c.remove()); swasiTouches={}; }
function swTouchS(e){ if(e.target.id==='swasi-sluit-btn')return; e.preventDefault(); if(!swBezig)return; for(let i=0;i<e.changedTouches.length;i++){ let t=e.changedTouches[i], c=document.createElement('div'); c.className='swasi-circle'; c.style.borderColor=['#007aff','#34c759','#ff9500','#af52de','#5856d6','#ff2d55','#f1c40f','#00c7be'][swKleur++%8]; c.style.left=t.clientX+'px'; c.style.top=t.clientY+'px'; document.getElementById('swasi-overlay').appendChild(c); swasiTouches[t.identifier]=c; } checkSw(); }
function swTouchM(e){ if(e.target.id==='swasi-sluit-btn')return; e.preventDefault(); if(!swBezig)return; for(let i=0;i<e.changedTouches.length;i++){ let t=e.changedTouches[i], c=swasiTouches[t.identifier]; if(c){c.style.left=t.clientX+'px';c.style.top=t.clientY+'px';} } }
function swTouchE(e){ if(!swBezig)return; for(let i=0;i<e.changedTouches.length;i++){ let c=swasiTouches[e.changedTouches[i].identifier]; if(c){c.remove();delete swasiTouches[e.changedTouches[i].identifier];} } checkSw(); }
function checkSw(){ clearInterval(swTimer); document.getElementById('swasi-countdown').style.display='none'; let k=Object.keys(swasiTouches); if(k.length>1){ document.getElementById('swasi-instructie').style.display='none'; document.getElementById('swasi-countdown').style.display='block'; let c=3; document.getElementById('swasi-countdown').innerText=c; swTimer=setInterval(()=>{c--;if(c>0)document.getElementById('swasi-countdown').innerText=c;else{clearInterval(swTimer);document.getElementById('swasi-countdown').style.display='none';swBezig=false;if("vibrate" in navigator)navigator.vibrate([100,50,100,50,300]);let w=k[Math.floor(Math.random()*k.length)];k.forEach(id=>{let ci=swasiTouches[id];if(id==w)ci.classList.add('winner');else ci.classList.add('loser');});document.getElementById('swasi-sluit-btn').style.display='block';}},1000); } else document.getElementById('swasi-instructie').style.display='block'; }

function startTijdbom(){ if(spelersLijst.length<2)return alert("Minimaal 2 spelers."); let r=spelersLijst[Math.floor(Math.random()*spelersLijst.length)]; db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({actief:true,houder:r,eindTijdUnix:Date.now()+(Math.floor(Math.random()*45000)+30000)}); stuurNaarFeed(`💣 TIJDBOM GESTART! Hij ligt nu bij ${r.toUpperCase()}!`); }
function gooiBomDoor(){ let a=spelersLijst.filter(n=>n!==currentUser); if("vibrate" in navigator)navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').update({houder:a[Math.floor(Math.random()*a.length)]}); }
function luisterNaarTijdbom(){ if(unsubscribeBom)unsubscribeBom(); unsubscribeBom=db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot(d=>{ if(!d.exists)return; let c=document.getElementById('bom-card'); if(d.data().actief){ document.getElementById('bom-idle-ui').style.display='none'; document.getElementById('bom-active-ui').style.display='block'; document.getElementById('bom-status-tekst').innerText=`Bom is bij ${d.data().houder.toUpperCase()}!`; if(d.data().houder===currentUser){ c.classList.add('bom-gevaar'); document.getElementById('btn-gooi-door').style.display='inline-block'; }else{ c.classList.remove('bom-gevaar'); document.getElementById('btn-gooi-door').style.display='none'; } }else{ document.getElementById('bom-idle-ui').style.display='block'; document.getElementById('bom-active-ui').style.display='none'; if(c)c.classList.remove('bom-gevaar'); } }); setInterval(()=>{ db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(d=>{ if(d.exists&&d.data().actief&&d.data().houder===currentUser&&Date.now()>=d.data().eindTijdUnix){ db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({actief:false}); pasScoreAan('raggen',-3,'💥 BOM'); alert("KABOEM! -3 Punten!"); } }); },1000); }

function draaiRad(){ if(isSpinning)return; if((mijnTotalePunten-mijnGedraaideSpins)<=0)return alert("0 coins!"); isSpinning=true; if("vibrate" in navigator)navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({spins:firebase.firestore.FieldValue.increment(1)},{merge:true}); let c=0, o=["🍻 Atje!","🥃 Shotje!","👉 Deel 2 slokken uit","🎯 [SPELER] adt!","💧 Water (Laf)","🔄 Wissel drankje met [SPELER]","🚀 Raggen punt!","🍻 IEDEREEN ADTEN!"]; let i=setInterval(()=>{ document.getElementById('rad-uitkomst').innerText=o[Math.floor(Math.random()*o.length)].replace("[SPELER]","iemand"); document.getElementById('rad-box').style.background=(c%2===0)?"linear-gradient(135deg,#34c759,#30b050)":"linear-gradient(135deg,#ff9500,#ff2d55)"; if(++c>20){ clearInterval(i); let e=o[Math.floor(Math.random()*o.length)].replace("[SPELER]",spelersLijst.filter(n=>n!==currentUser)[0]||"iemand"); document.getElementById('rad-uitkomst').innerText=e; document.getElementById('rad-box').style.background="linear-gradient(135deg,#007aff,#0056b3)"; stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${e}"`); isSpinning=false; } },100); }

let sjaakI=null, sV=["Wie kotst eerst?", "Minste actie vannacht?", "Wie verliest z'n telefoon?", "Grootste jankerd morgen?", "Wie betaalt de volgende ronde?", "Domste uitspraak vanavond?", "Slechtste leugenaar?", "Wie durft niet te adten?"];
function startSjaakVraag(){ clearInterval(sjaakI); document.getElementById('sjaak-timer').innerText="5"; document.getElementById('sjaak-vraag').innerText=sV[Math.floor(Math.random()*sV.length)]; }
function startSjaakGame(){ startSjaakVraag(); let c=5; if("vibrate" in navigator)navigator.vibrate(50); sjaakI=setInterval(()=>{ document.getElementById('sjaak-timer').innerText=--c; if(c<=0){ clearInterval(sjaakI); document.getElementById('sjaak-timer').innerText="👉 WIE IS HET?!"; if("vibrate" in navigator)navigator.vibrate([300,100,300]); } },1000); }

let hlH=5; function initHogerLager(){ hlH=Math.floor(Math.random()*10)+1; document.getElementById('hl-getal').innerText=hlH; }
function speelHogerLager(k){ let i=parseInt(document.getElementById('hl-inzet').value); if(isNaN(i)||i<1)return alert("Geldige inzet!"); if(i>(mijnTotalePunten-mijnGedraaideSpins))return alert("Niet genoeg Coins!"); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({spins:firebase.firestore.FieldValue.increment(i)},{merge:true}); let n=Math.floor(Math.random()*10)+1; document.getElementById('hl-getal').innerText=n; let w=false; if((k==='hoger'&&n>hlH)||(k==='lager'&&n<hlH))w=true; if(w){ db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({spins:firebase.firestore.FieldValue.increment(-(i*2))},{merge:true}); alert(`Goed! Win ${i*2} Coins!`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} wint ${i*2} Coins met HL!`); }else{ let s=Math.abs(n-hlH)||1; alert(`FOUT! Het was ${n}. Neem ${s} grote slokken! 🥃`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} verliest met HL: ${s} slokken!`); } hlH=n; }

let reflexR=0, reflexGr=0, reflexG=false, reflexI=null;
function luisterNaarReflex(){ db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc=>{ if(!doc.exists)return; let d=doc.data(), btn=document.getElementById('reflex-btn'), lb=document.getElementById('reflex-leaderboard'); if(d.ronde!==reflexR){ reflexR=d.ronde; reflexGr=d.groen_tijd; reflexG=false; if(btn){btn.style.backgroundColor='#ff3b30';btn.innerText='Wacht...';btn.disabled=false;} clearInterval(reflexI); reflexI=setInterval(()=>{ if(Date.now()>=reflexGr && btn && btn.style.backgroundColor!=='rgb(52, 199, 89)' && !reflexG){btn.style.backgroundColor='#34c759';btn.innerText='KLIK NU!';} },50); } if(Object.keys(d.scores||{}).length>0 && lb){ lb.style.display='block'; let a=[]; for(let s in d.scores)a.push({n:s,t:d.scores[s]}); a.sort((x,y)=>{if(x.t==='TE VROEG')return 1;if(y.t==='TE VROEG')return -1;return x.t-y.t;}); let h='<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard</h3><ol style="padding-left:20px; margin:0;">'; a.forEach((s,i)=>h+=`<li style="margin-bottom:8px;">${i===0?'🏆':(s.t==='TE VROEG'?'❌':'⏱️')} <b>${s.n.toUpperCase()}</b>: ${s.t==='TE VROEG'?'<span style="color:#ff3b30;font-weight:bold;">TE VROEG</span>':s.t+' ms'}</li>`); lb.innerHTML=h+'</ol>'; }else if(lb)lb.style.display='none'; }); }
function startReflexRonde(){ db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ronde:Date.now(),groen_tijd:Date.now()+Math.floor(Math.random()*4000)+2000,scores:{}}); stuurNaarFeed(`⚡ Reflex Roulette GESTART door ${currentUser.toUpperCase()}!`); }
function klikReflex(e){ if(e)e.preventDefault(); if(reflexG||!reflexR)return; reflexG=true; let v=Date.now()<reflexGr; let t=v?'TE VROEG':Date.now()-reflexGr; if(v){ stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} TE VROEG! Straf atje!`); alert("TE VROEG! Atje! 🥃"); if("vibrate" in navigator)navigator.vibrate([200,100,200]); } let b=document.getElementById('reflex-btn'); if(b){b.innerText='Geklikt!';b.style.backgroundColor='#8e8e93';} db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({scores:{[currentUser]:t}},{merge:true}); }

function gooiMexen(){ let d1=Math.floor(Math.random()*6)+1, d2=Math.floor(Math.random()*6)+1; document.getElementById('mex-d1').innerText=d1; document.getElementById('mex-d2').innerText=d2; let s=Math.max(d1,d2).toString()+Math.min(d1,d2).toString(); let x=""; if(s==="21"){x=" 🚨 MEX! DRINKEN!";if("vibrate" in navigator)navigator.vibrate([200,100,200]);} else if(d1===d2)x=" (Honderden!)"; stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooit ${s}${x}`); }

function initKaart(){ if(!worldMap){ worldMap=L.map('map').setView([45.0,5.0],4); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(worldMap); db.collection('groepen').doc(currentGroup).collection('locaties').onSnapshot(s=>{ mapMarkers.forEach(m=>worldMap.removeLayer(m)); mapMarkers=[]; let g={}; s.forEach(d=>{ let dt=d.data(); if(dt.lat&&dt.lng){ let st=`${dt.naam}_${dt.lat.toFixed(4)}_${dt.lng.toFixed(4)}`; if(!g[st])g[st]={n:dt.naam,lat:dt.lat,lng:dt.lng,a:{}}; g[st].a[dt.actie]=(g[st].a[dt.actie]||0)+1; } }); Object.values(g).forEach(gr=>{ let pc=`<b>${gr.n}</b><br>`,ta=0,he="🍺"; Object.entries(gr.a).forEach(([a,n])=>{pc+=`${a}: ${n}x<br>`;ta+=n;he=a.split(' ')[0];}); let ic=L.divIcon({html:`<div class="custom-maps-marker-wrapper" style="width:52px;height:52px;"><span style="font-size:34px;">${he}</span><span style="position:absolute;top:-6px;right:-6px;background:#ff3b30;color:white;font-size:13px;font-weight:900;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid white;">${ta}</span></div>`,className:'',iconSize:[52,52],iconAnchor:[26,26]}); let m=L.marker([gr.lat,gr.lng],{icon:ic}).bindPopup(pc); m.addTo(worldMap); mapMarkers.push(m); }); }); }else worldMap.invalidateSize(); }