const firebaseConfig = {
    apiKey: "AIzaSyDF8LOSjnyIJXrloepCBvSLA2TCH3Us0H8",
    authDomain: "befcounter.firebaseapp.com",
    projectId: "befcounter",
    storageBucket: "befcounter.firebasestorage.app",
    messagingSenderId: "744277190850",
    appId: "1:744277190850:web:791ef6faaadfe3a0a3b35b"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let messaging = null;
try {
    if (typeof firebase.messaging === "function" && firebase.messaging.isSupported()) {
        messaging = firebase.messaging();
    }
} catch (error) { console.log("Push niet ondersteund"); }

if ('serviceWorker' in navigator) { 
    navigator.serviceWorker.register('sw.js').then((reg) => {
        if (messaging) messaging.useServiceWorker(reg);
    }); 
}

function setupPushNotificaties(toonAlert = false) {
    if (!messaging) {
        if(toonAlert) alert("Push notificaties worden niet ondersteund. Zorg dat je de app via Safari aan je Beginscherm hebt toegevoegd!");
        return;
    }
    messaging.requestPermission().then(() => {
        return messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" });
    }).then((token) => {
        if (token && currentUser) {
            db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ push_token: token }, { merge: true });
            if(toonAlert) alert("✅ Meldingen staan succesvol AAN voor dit apparaat!");
        }
    }).catch(err => {
        if(toonAlert) alert("❌ Meldingen geweigerd. Zet ze aan in de instellingen van je telefoon!");
    });
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

const coopMissies = [
    { titel: "Drink 100 Pils met de groep", doel: 100, types: ['bier'] },
    { titel: "Verzamel samen 30 Kiss acties", doel: 30, types: ['kiss'] },
    { titel: "Deel 50 Shotjes/Mixjes uit", doel: 50, types: ['mix', 'shotje'] },
    { titel: "Incasseer 20 Rejects", doel: 20, types: ['rejection'] },
    { titel: "Wordt 5x vol Geragd", doel: 5, types: ['raggen'] },
    { titel: "150 Drankjes Totaal", doel: 150, types: ['bier', 'mix', 'shotje'] }
];
let actieveCoopMissie = null;
const bingoOpdrachten = ["Shot met barman", "Gratis pils", "Zeg 10 min niks", "Wijs iemand af", "Trek een Atje", "Eet laat iets vets", "Raak iets kwijt", "Krijg een Reject", "Steel aansteker", "Deel 3 slokken uit", "Drink een uur water", "Klim ergens op", "Laat je trakteren", "Dans battle", "Dubbel shot"];
const assassinMissies = ["Zorg dat [SPELER] een shotje neemt.", "Laat [SPELER] 'proost' zeggen.", "Zorg dat [SPELER] pils haalt.", "Steel de aansteker van [SPELER].", "Overtuig [SPELER] om water te drinken.", "Noem [SPELER] 15 min verkeerd."];

function genereerNieuweMissie() { let a = spelersLijst.filter(n => n !== currentUser); let s = a.length > 0 ? a[Math.floor(Math.random() * a.length)] : "iemand"; let o = assassinMissies[Math.floor(Math.random() * assassinMissies.length)]; return o.replace("[SPELER]", s.charAt(0).toUpperCase() + s.slice(1)); }
function genereerBingoKaart() { return [...bingoOpdrachten].sort(() => 0.5 - Math.random()).slice(0, 9); }

document.body.addEventListener('touchstart', function() { let g = document.getElementById('notificatie-geluid'); if (g && g.paused) g.play().then(() => { g.pause(); g.currentTime = 0; }).catch(e => {}); }, { once: true });

function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block'; document.getElementById('auth-scherm').style.display = 'none'; document.getElementById('lobby-scherm').style.display = 'none'; document.getElementById('app-scherm').style.display = 'none'; document.getElementById('header-controls').style.display = 'none'; document.getElementById('bottom-nav').style.display = 'none';
    if (!currentUser) document.getElementById('auth-scherm').style.display = 'block'; 
    else if (!currentGroup) { document.getElementById('lobby-gebruikersnaam').innerText = currentUser; document.getElementById('lobby-scherm').style.display = 'block'; }
    else { document.getElementById('auth-container').style.display = 'none'; startApp(); }
}

function wisselPagina(paginaId, nav) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById(paginaId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); nav.classList.add('active');
    if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100);
}

function registreer() { const n = document.getElementById('auth-naam').value.trim().toLowerCase(), w = document.getElementById('auth-wachtwoord').value; if (!n || !w) return alert('Vul in!'); db.collection('gebruikers').doc(n).get().then(d => { if (d.exists) alert('Bezet!'); else db.collection('gebruikers').doc(n).set({ wachtwoord: w }).then(() => { localStorage.setItem('bef_user', n); currentUser = n; bepaalScherm(); }); }); }
function login() { const n = document.getElementById('auth-naam').value.trim().toLowerCase(), w = document.getElementById('auth-wachtwoord').value; db.collection('gebruikers').doc(n).get().then(d => { if (!d.exists || d.data().wachtwoord !== w) alert('Onjuist!'); else { localStorage.setItem('bef_user', n); currentUser = n; bepaalScherm(); } }); }
function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const c = Math.random().toString(36).substring(2, 7).toUpperCase(); db.collection('groepen').doc(c).set({ maker: currentUser }).then(() => joinSpecifiekeGroep(c)); }
function joinGroep() { const c = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(c).get().then(d => { if (!d.exists) alert('Niet gevonden!'); else joinSpecifiekeGroep(c); }); }

function joinSpecifiekeGroep(c) {
    db.collection('groepen').doc(c).collection('scores').doc(currentUser).set({ bier:0, mix:0, kiss:0, rejection:0, raggen:0, kotsen:0, sleutel:0, shotje:0, spins:0 }, { merge: true }).then(() => { localStorage.setItem('bef_group', c); currentGroup = c; bepaalScherm(); });
}

function startApp() {
    document.getElementById('app-scherm').style.display = 'block'; document.getElementById('bottom-nav').style.display = 'flex'; document.getElementById('header-controls').style.display = 'flex'; document.getElementById('ingelogde-naam').innerText = currentUser; document.getElementById('display-groepscode').innerText = currentGroup;
    bouwLiveScorebord(); luisterNaarLiveFeed(); luisterNaarTijdbom(); luisterNaarCoopMissie(); luisterNaarDrinkSessie(); luisterNaarReflex();
}

// ==========================================
// DRINK SESSIE LOGICA
// ==========================================
let sessieCheckInterval = null, actieveDrinkSessieTijd = 0;

function toggleDrinkSessie() {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').get().then(doc => {
        let isActief = doc.exists && doc.data().actief;
        if (!isActief) {
            let wachttijd = Math.floor(Math.random() * (15*60*1000)) + (5*60*1000);
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: true, starter: currentUser, volgende_atje: Date.now() + wachttijd });
            stuurNaarFeed(`🍻 DRINK SESSIE GESTART door ${currentUser.toUpperCase()}! Tracker is actief.`);
            vakantieModus = true; if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition((pos)=>{
                db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: "📍 Locatie Update", lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
            },()=>{});
        } else {
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: false, starter: '', volgende_atje: 0 });
            stuurNaarFeed(`🛑 Sessie gestopt door ${currentUser.toUpperCase()}. Tracker uit.`); vakantieModus = false;
        }
    });
}

function forceerSessieAtje() { 
    // DE OPLOSSING: We forceren de check LOKAAL direct, zonder te wachten op de database!
    actieveDrinkSessieTijd = 1; 
    checkDrinkSessieTijd();
}

function luisterNaarDrinkSessie() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').onSnapshot(doc => {
        const btn = document.getElementById('btn-drink-sessie'), timerUI = document.getElementById('drink-sessie-timer-tekst'), btnSkip = document.getElementById('btn-skip-timer');
        if (!btn) return;
        if (doc.exists && doc.data().actief) {
            actieveDrinkSessieTijd = doc.data().volgende_atje; btn.innerHTML = "🛑 Stop Drink Sessie & GPS"; btn.style.backgroundColor = "#ff3b30";
            if(timerUI) timerUI.style.display = "block"; if(btnSkip) btnSkip.style.display = "block";
            
            if (!vakantieModus && doc.data().starter !== currentUser) {
                alert(`🍻 DRINK SESSIE GESTART door ${doc.data().starter.toUpperCase()}! Jouw locatie wordt nu live gedeeld.`);
                if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition((pos)=>{
                    db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: "📍 Locatie Update", lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
                },()=>{});
            }
            vakantieModus = true; if (!sessieCheckInterval) sessieCheckInterval = setInterval(checkDrinkSessieTijd, 5000);
        } else {
            actieveDrinkSessieTijd = 0; btn.innerHTML = "🍻 Start Drink Sessie!"; btn.style.backgroundColor = "#ff9500";
            if(timerUI) timerUI.style.display = "none"; if(btnSkip) btnSkip.style.display = "none";
            vakantieModus = false; if (sessieCheckInterval) { clearInterval(sessieCheckInterval); sessieCheckInterval = null; }
        }
    });
}

setInterval(() => {
    if (actieveDrinkSessieTijd > 0) {
        let diff = actieveDrinkSessieTijd - Date.now(), timerUI = document.getElementById('drink-sessie-timer-tekst');
        if (diff > 0) { let m = Math.floor(diff / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0'); if(timerUI) timerUI.innerText = `⏰ Volgende Atje over: ${m}:${s}`; }
        else { if(timerUI) timerUI.innerText = "🚨 ALARM! SLACHTOFFER WORDT GEKOZEN..."; }
    }
}, 1000);

function checkDrinkSessieTijd() {
    if (!actieveDrinkSessieTijd || Date.now() < actieveDrinkSessieTijd) return;
    
    actieveDrinkSessieTijd = Date.now() + 99999999; 
    let nieuw = Math.floor(Math.random() * (15*60*1000)) + (5*60*1000);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + nieuw });
    
    if (spelersLijst.length === 0) return; 
    let slachtoffer = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let bericht = `🚨 ALARM! De Drink Sessie heeft gekozen... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`;
    
    stuurNaarFeed(bericht); 
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        snap.forEach(doc => {
            if (doc.data().push_token) fetch("https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e=>{});
        });
    });
}

// ==========================================
// SCOREBORD & DATA SYNC
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });
    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) });
    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? 'scoort +1 bij' : 'deed een correctie bij'} ${emojiNaam}`;
    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(pos => {
            db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
            stuurNaarFeed(startBericht);
        }, () => stuurNaarFeed(startBericht));
    } else stuurNaarFeed(startBericht);
}

function bouwLiveScorebord() {
    if (unsubscribeScores) unsubscribeScores();
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let somBier=0, somMix=0, somShot=0, somKiss=0, somReject=0, somRaggen=0, somKotsen=0, somSleutel=0, somAlles=0;
        let statMaxBier=0, statMaxBierNaam="-", statMaxRaggen=0, statMaxRaggenNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxKots=0, statMaxKotsNaam="-";
        let grafiekNamen = [], grafiekData = []; let katerHtml = ""; spelersLijst = []; 

        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id; spelersLijst.push(naam);
            const b = data.bier || 0; const m = data.mix || 0; const sh = data.shotje || data.doner || 0; const k = data.kiss || 0; const r = data.rejection || 0; const ra = data.raggen || data.mvp || 0; const ko = data.kotsen || 0; const sl = data.sleutel || 0;
            const pTot = (b * 1) + (m * 2) + (sh * 2) + (k * 10) + (r * 5) + (ra * 15) + (ko * 5) + (sl * 5);
            somBier += b; somMix += m; somShot += sh; somKiss += k; somReject += r; somRaggen += ra; somKotsen += ko; somSleutel += sl; somAlles += pTot;

            if (naam === currentUser) { mijnTotalePunten = pTot; mijnGedraaideSpins = data.spins || 0; updateCoinWeergave(); beheerMissiesEnBingo(data); }
            if(b > statMaxBier) { statMaxBier = b; statMaxBierNaam = naam; } if(ra > statMaxRaggen) { statMaxRaggen = ra; statMaxRaggenNaam = naam; } if(r > statMaxSjaak) { statMaxSjaak = r; statMaxSjaakNaam = naam; } if(ko > statMaxKots) { statMaxKots = ko; statMaxKotsNaam = naam; }

            grafiekNamen.push(naam.charAt(0).toUpperCase() + naam.slice(1)); grafiekData.push(b + m + sh);
            let kKans = Math.max(0, Math.min(99, 5 + (b * 4) + (m * 12) + (sh * 15) + (ko * 30))); let kleur = kKans >= 75 ? "#ff3b30" : kKans >= 40 ? "#ff9500" : "#34c759";
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${naam}</span><span>${kKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${kKans}%; background-color: ${kleur};"></div></div></div>`;
            html += `<tr><td class="naam-kolom">${naam}</td><td>${b}</td><td>${m}</td><td>${sh}</td><td>${k}</td><td>${r}</td><td>${ra}</td><td>${ko}</td><td>${sl}</td><td class="totaal-kolom">${pTot}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${naam}')">X</button></td></tr>`;
        });

        html += `<tr class="totaal-rij"><td style="text-align:left; padding-left:10px;">Totaal</td><td>${somBier}</td><td>${somMix}</td><td>${somShot}</td><td>${somKiss}</td><td>${somReject}</td><td>${somRaggen}</td><td>${somKotsen}</td><td>${somSleutel}</td><td class="totaal-kolom">${somAlles}</td><td></td></tr>`;
        document.getElementById('score-tabel').innerHTML = html; document.getElementById('kater-container').innerHTML = katerHtml;
        document.getElementById('stats-container').innerHTML = `<div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div><div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${statMaxRaggenNaam} (${statMaxRaggen})</span></div><div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${statMaxKotsNaam} (${statMaxKots})</span></div><div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>`;
        tekenGrafieken(somBier, somMix, somShot, somKiss, somReject, somRaggen, somKotsen, somSleutel, grafiekNamen, grafiekData);
    });
}

function stuurNaarFeed(bericht) { db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').set({ bericht: bericht, tijd: firebase.firestore.FieldValue.serverTimestamp() }); }
function luisterNaarLiveFeed() {
    if (unsubscribeFeed) unsubscribeFeed(); let lM = "";
    unsubscribeFeed = db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').onSnapshot((doc) => {
        if (!doc.exists || doc.data().bericht === lM) return; lM = doc.data().bericht;
        const ticker = document.getElementById('live-ticker'); if(ticker){ ticker.innerText = lM; ticker.style.display = 'block'; }
        if ("vibrate" in navigator) navigator.vibrate([200,100,200]);
        const g = document.getElementById('notificatie-geluid'); if (g) { g.currentTime = 0; g.play().catch(e => {}); }
        setTimeout(() => { if(ticker) ticker.style.display = 'none'; }, 5000);
    });
}
function tekenGrafieken(b, m, sh, k, r, ra, ko, sl, n, d) {
    if (pieChartInstance) pieChartInstance.destroy();
    let pCtx = document.getElementById('groepPieChart');
    if(pCtx) pieChartInstance = new Chart(pCtx, { type: 'pie', data: { labels: ['Bier','Mix','Shotje','Kiss','Reject','Raggen', 'Kotsen', 'Sleutel'], datasets: [{ data: [b,m,sh,k,r,ra,ko,sl], backgroundColor: ['#f1c40f','#9b59b6','#e17055','#ff7675','#636e72','#ffeaa7','#16a085','#bdc3c7'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    if (barChartInstance) barChartInstance.destroy();
    let bCtx = document.getElementById('spelerBarChart');
    if(bCtx) barChartInstance = new Chart(bCtx, { type: 'bar', data: { labels: n, datasets: [{ label: 'Drankjes', data: d, backgroundColor: '#007aff' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function beheerMissiesEnBingo(data) {
    if (!data.geheime_missie) db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true });
    else { const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = data.geheime_missie; }
    if (!data.bingo_kaart) db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_kaart: genereerBingoKaart(), bingo_status: [false,false,false,false,false,false,false,false,false], bingo_gehaald: false }, { merge: true });
    else { mijnBingoKaart = data.bingo_kaart; mijnBingoStatus = data.bingo_status || [false,false,false,false,false,false,false,false,false]; renderBingoGrid(data.bingo_gehaald); }
}
function voltooiGeheimeMissie() { if (confirm("Uitgevoerd? Liegen = adten!")) { pasScoreAan('raggen', 3, '🥷 Missie'); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true }); alert("+3 Punten!"); } }
function renderBingoGrid(isGehaald) { const grid = document.getElementById('bingo-grid'); if(!grid) return; grid.innerHTML = ""; mijnBingoKaart.forEach((taak, index) => { let div = document.createElement('div'); div.className = "bingo-cel " + (mijnBingoStatus[index] ? "voltooid" : ""); div.innerText = taak; div.onclick = () => toggleBingoCel(index, isGehaald); grid.appendChild(div); }); }
function toggleBingoCel(index, isGehaald) { if (isGehaald) return alert("Je hebt al Bingo!"); mijnBingoStatus[index] = !mijnBingoStatus[index]; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_status: mijnBingoStatus }, { merge: true }); const wL = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; if (wL.some(l => l.every(i => mijnBingoStatus[i]))) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_gehaald: true }, { merge: true }); pasScoreAan('raggen', 10, '🌴 BINGO'); alert("BINGO! 10 Punten!"); } }

function luisterNaarCoopMissie() {
    db.collection('groepen').doc(currentGroup).collection('coop').doc('status').onSnapshot(doc => {
        let v = new Date().toISOString().split('T')[0];
        if (!doc.exists || doc.data().datum !== v) { let r = coopMissies[Math.floor(Math.random() * coopMissies.length)]; db.collection('groepen').doc(currentGroup).collection('coop').doc('status').set({ datum: v, score: 0, doel: r.doel, titel: r.titel, types: r.types, behaald: false }); return; }
        actieveCoopMissie = doc.data(); let pct = Math.min(100, (actieveCoopMissie.score / actieveCoopMissie.doel) * 100);
        document.querySelectorAll('.coop-titel-text').forEach(e => e.innerText = actieveCoopMissie.titel); document.querySelectorAll('.coop-bar-fill').forEach(e => e.style.width = pct + '%'); document.querySelectorAll('.coop-progress-text').forEach(e => e.innerText = `${actieveCoopMissie.score} / ${actieveCoopMissie.doel}`);
        if (actieveCoopMissie.score >= actieveCoopMissie.doel && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ behaald: true }); pasScoreAan('raggen', 5, '🏆 CO-OP'); stuurNaarFeed("🎉 CO-OP MISSIE BEHAALD! +5 Punten!"); }
    });
}

// SWASI
let actieveSwasiTouches = {}, swasiKleurIndex = 0, swasiTimer = null, swasiAfteller = null, swasiBezig = false;
function startSwasi() { let ov = document.getElementById('swasi-overlay'); ov.style.display = 'block'; document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-countdown').style.display = 'none'; document.getElementById('swasi-sluit-btn').style.display = 'none'; actieveSwasiTouches = {}; swasiKleurIndex = 0; swasiBezig = true; document.body.style.overflow = 'hidden'; ov.addEventListener('touchstart', swTStart, {passive: false}); ov.addEventListener('touchmove', swTMove, {passive: false}); ov.addEventListener('touchend', swTEnd); ov.addEventListener('touchcancel', swTEnd); }
function stopSwasi() { let ov = document.getElementById('swasi-overlay'); ov.style.display = 'none'; document.body.style.overflow = ''; clearTimeout(swasiTimer); clearInterval(swasiAfteller); swasiBezig = false; Object.values(actieveSwasiTouches).forEach(c => c.remove()); actieveSwasiTouches = {}; ov.removeEventListener('touchstart', swTStart); ov.removeEventListener('touchmove', swTMove); ov.removeEventListener('touchend', swTEnd); ov.removeEventListener('touchcancel', swTEnd); }
function swTStart(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; let k = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#f1c40f', '#00c7be']; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let c = document.createElement('div'); c.className = 'swasi-circle'; c.style.borderColor = k[swasiKleurIndex++ % k.length]; c.style.left = t.clientX + 'px'; c.style.top = t.clientY + 'px'; document.getElementById('swasi-overlay').appendChild(c); actieveSwasiTouches[t.identifier] = c; } swCheck(); }
function swTMove(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let c = actieveSwasiTouches[t.identifier]; if (c) { c.style.left = t.clientX + 'px'; c.style.top = t.clientY + 'px'; } } }
function swTEnd(e) { if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let c = actieveSwasiTouches[e.changedTouches[i].identifier]; if (c) { c.remove(); delete actieveSwasiTouches[e.changedTouches[i].identifier]; } } swCheck(); }
function swCheck() { clearTimeout(swasiTimer); clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; let ks = Object.keys(actieveSwasiTouches); if (ks.length > 1) { document.getElementById('swasi-instructie').style.display = 'none'; document.getElementById('swasi-countdown').style.display = 'block'; let count = 3; document.getElementById('swasi-countdown').innerText = count; swasiAfteller = setInterval(() => { count--; if (count > 0) document.getElementById('swasi-countdown').innerText = count; else { clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; swasiBezig = false; if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]); let win = ks[Math.floor(Math.random() * ks.length)]; ks.forEach(id => { let ci = actieveSwasiTouches[id]; if (id == win) ci.classList.add('winner'); else ci.classList.add('loser'); }); document.getElementById('swasi-sluit-btn').style.display = 'block'; } }, 1000); } else if (ks.length === 1) { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Wacht op meer vingers..."; } else { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger..."; swasiKleurIndex = 0; } }

// BOM
function startTijdbom() { if (spelersLijst.length < 2) return alert("Minimaal 2 spelers."); let r = spelersLijst[Math.floor(Math.random() * spelersLijst.length)]; db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: true, houder: r, eindTijdUnix: Date.now() + (Math.floor(Math.random() * 45000) + 30000) }); stuurNaarFeed(`💣 TIJDBOM GESTART! Ligt bij ${r.toUpperCase()}!`); }
function gooiBomDoor() { let a = spelersLijst.filter(n => n !== currentUser); if ("vibrate" in navigator) navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').update({ houder: a[Math.floor(Math.random() * a.length)] }); }
function luisterNaarTijdbom() { if(unsubscribeBom) unsubscribeBom(); unsubscribeBom = db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot((doc) => { if (!doc.exists) return; let d = doc.data(), c = document.getElementById('bom-card'), bt = document.getElementById('btn-gooi-door'); if (d.actief) { document.getElementById('bom-idle-ui').style.display = 'none'; document.getElementById('bom-active-ui').style.display = 'block'; document.getElementById('bom-status-tekst').innerText = `Bom is bij ${d.houder.toUpperCase()}!`; if (d.houder === currentUser) { if(c) c.classList.add('bom-gevaar'); if(bt) bt.style.display = 'inline-block'; } else { if(c) c.classList.remove('bom-gevaar'); if(bt) bt.style.display = 'none'; } } else { document.getElementById('bom-idle-ui').style.display = 'block'; document.getElementById('bom-active-ui').style.display = 'none'; if(c) c.classList.remove('bom-gevaar'); } }); setInterval(() => { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(d => { if (d.exists && d.data().actief && d.data().houder === currentUser && Date.now() >= d.data().eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } }); }, 1000); }

// RAD
function draaiRad() { if (isSpinning) return; if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("0 coins!"); isSpinning = true; if ("vibrate" in navigator) navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true }); let dC = 0, opts = ["🍻 Atje!", "🥃 Shotje!", "👉 2 slokken uit", "🎯 [SPELER] adt!", "💧 Drink water", "🔄 Wissel drankje", "🚀 Raggen punt!", "🍻 IEDEREEN ADTEN!"]; let iv = setInterval(() => { document.getElementById('rad-uitkomst').innerText = opts[Math.floor(Math.random() * opts.length)].replace("[SPELER]","iemand"); document.getElementById('rad-box').style.background = (dC % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)"; if (++dC > 20) { clearInterval(iv); let s = spelersLijst.filter(n=>n!==currentUser); let e = opts[Math.floor(Math.random() * opts.length)].replace("[SPELER]", s.length > 0 ? s[Math.floor(Math.random()*s.length)] : "iemand"); document.getElementById('rad-uitkomst').innerText = e; document.getElementById('rad-box').style.background = "linear-gradient(135deg, #007aff, #0056b3)"; stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draait: "${e}"`); isSpinning = false; } }, 100); }
function updateCoinWeergave() { document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = Math.max(0, mijnTotalePunten - mijnGedraaideSpins)); }
function verwijderSpeler(n) { if (confirm(`Verwijder ${n}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(n).delete(); }

// SJAAK
let sjaakI = null;
function startSjaakVraag() { clearInterval(sjaakI); document.getElementById('sjaak-timer').innerText = "5"; document.getElementById('sjaak-vraag').innerText = ["Wie kotst eerst?", "Minste actie vannacht?", "Verliest tel/sleutels?", "Grootste jankerd?", "Wie betaalt de volgende ronde?", "Domste uitspraak?", "Slechtste leugenaar?", "Durft niet te adten?"][Math.floor(Math.random() * 8)]; }
function startSjaakGame() { startSjaakVraag(); let c = 5; if ("vibrate" in navigator) navigator.vibrate(50); sjaakI = setInterval(() => { document.getElementById('sjaak-timer').innerText = --c; if(c <= 0) { clearInterval(sjaakI); document.getElementById('sjaak-timer').innerText = "👉 WIE IS HET?!"; if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]); } }, 1000); }

// HL
let hlH = 5; function initHogerLager() { hlH = Math.floor(Math.random() * 10) + 1; document.getElementById('hl-getal').innerText = hlH; }
function speelHogerLager(k) { let i = parseInt(document.getElementById('hl-inzet').value), c = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); if (isNaN(i) || i < 1) return alert("Inzet!"); if (i > c) return alert("Niet genoeg Coins!"); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(i) }, { merge: true }); let n = Math.floor(Math.random() * 10) + 1; document.getElementById('hl-getal').innerText = n; let w = (k === 'hoger' && n > hlH) || (k === 'lager' && n < hlH); if (w) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(-(i * 2)) }, { merge: true }); alert(`Goed! +${i * 2} Coins!`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} wint ${i * 2} Coins!`); } else { let s = Math.abs(n - hlH) || 1; alert(`FOUT! Het was ${n}. Neem ${s} slokken!`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} verliest en neemt ${s} slokken!`); } hlH = n; }

// REFLEX
let refR = 0, refGr = 0, refGek = false, refI = null;
function luisterNaarReflex() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(d => {
        if (!d.exists) return; let dd = d.data(), b = document.getElementById('reflex-btn'), l = document.getElementById('reflex-leaderboard');
        if (dd.ronde !== refR) {
            refR = dd.ronde; refGr = dd.groen_tijd; refGek = false; if(b){ b.style.backgroundColor = '#ff3b30'; b.innerText = 'Wacht...'; }
            clearInterval(refI); refI = setInterval(() => { if (Date.now() >= refGr && b && b.style.backgroundColor !== 'rgb(52, 199, 89)' && !refGek) { b.style.backgroundColor = '#34c759'; b.innerText = 'KLIK NU!'; } }, 50);
        }
        if (Object.keys(dd.scores||{}).length > 0 && l) {
            l.style.display = 'block'; let arr = []; for (let s in dd.scores) arr.push({ n: s, t: dd.scores[s] });
            arr.sort((x, y) => { if (x.t === 'TE VROEG') return 1; if (y.t === 'TE VROEG') return -1; return x.t - y.t; });
            let h = '<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard</h3><ol style="padding-left:20px;margin:0;font-size:16px;">';
            arr.forEach((x, i) => { h += `<li style="margin-bottom:8px;">${i===0?'🏆':(x.t==='TE VROEG'?'❌':'⏱️')} <b>${x.n.toUpperCase()}</b>: ${x.t==='TE VROEG'?'<span style="color:#ff3b30;font-weight:bold;">TE VROEG</span>':x.t+' ms'}</li>`; }); h += '</ol>'; l.innerHTML = h;
        } else if (l) l.style.display = 'none';
    });
}
function startReflexRonde() { db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ ronde: Date.now(), groen_tijd: Date.now() + Math.floor(Math.random() * 4000) + 2000, scores: {} }); stuurNaarFeed(`⚡ Reflex GESTART door ${currentUser.toUpperCase()}!`); }
function klikReflex(e) { if (e) e.preventDefault(); if (refGek || !refR) return; refGek = true; let v = Date.now() < refGr, ts = v ? 'TE VROEG' : Date.now() - refGr; if (v) { stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG! Atje!`); alert("TE VROEG! Straf Atje! 🥃"); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } let b = document.getElementById('reflex-btn'); if (b) { b.innerText = 'Geklikt!'; b.style.backgroundColor = '#8e8e93'; } db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ scores: { [currentUser]: ts } }, { merge: true }); }

// MEXEN
function gooiMexen() { let d1 = Math.floor(Math.random() * 6) + 1, d2 = Math.floor(Math.random() * 6) + 1; document.getElementById('mex-d1').innerText = d1; document.getElementById('mex-d2').innerText = d2; let s = Math.max(d1, d2).toString() + Math.min(d1, d2).toString(); let x = s === "21" ? " 🚨 MEX! IEDEREEN DRINKEN!!" : (d1 === d2 ? " (Honderden!)" : ""); if (s === "21" && "vibrate" in navigator) navigator.vibrate([200, 100, 200]); stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooit ${s}${x}`); }

function initKaart() {
    if (!worldMap) {
        worldMap = L.map('map').setView([45.0, 5.0], 4); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(worldMap);
        db.collection('groepen').doc(currentGroup).collection('locaties').onSnapshot(sn => {
            mapMarkers.forEach(m => worldMap.removeLayer(m)); mapMarkers = []; let gs = {};
            sn.forEach(d => { let dt = d.data(); if(dt.lat && dt.lng) { let s = `${dt.naam}_${dt.lat.toFixed(4)}_${dt.lng.toFixed(4)}`; if (!gs[s]) gs[s] = { n: dt.naam, lat: dt.lat, lng: dt.lng, a: {} }; gs[s].a[dt.actie] = (gs[s].a[dt.actie] || 0) + 1; } });
            Object.values(gs).forEach(g => { let pc = `<b>${g.n}</b><br>`, ta = 0, he = "🍺"; Object.entries(g.a).forEach(([a, n]) => { pc += `${a}: ${n}x<br>`; ta += n; he = a.split(' ')[0]; }); let i = L.divIcon({ html: `<div class="custom-maps-marker-wrapper" style="width:52px;height:52px;"><span style="font-size:34px;">${he}</span><span style="position:absolute;top:-6px;right:-6px;background:#ff3b30;color:white;font-size:13px;font-weight:900;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid white;">${ta}</span></div>`, className: '', iconSize: [52,52], iconAnchor: [26,26] }); let m = L.marker([g.lat, g.lng], { icon: i }).bindPopup(pc); m.addTo(worldMap); mapMarkers.push(m); });
        });
    } else worldMap.invalidateSize();
}