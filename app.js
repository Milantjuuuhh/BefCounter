// ==========================================
// 1. FIREBASE CONFIGURATIE & GLOBALE SETUP
// ==========================================
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

// Gebruik 'var' voor globale variabelen (voorkomt vastlopen)
var currentUser = localStorage.getItem('bef_user');
var currentGroup = localStorage.getItem('bef_group');
var unsubscribeScores = null, unsubscribeFeed = null, unsubscribeBom = null;
var mijnTotalePunten = 0, mijnGedraaideSpins = 0;
var isSpinning = false, vakantieModus = false, spelersLijst = []; 
var worldMap = null, mapMarkers = [], pieChartInstance = null, barChartInstance = null;
var mijnBingoKaart = [], mijnBingoStatus = [];

// Globale arrays voor Live Firebase Spelmateriaal
var sjaakVragenArray = ["Laden..."];
var quiplashVragenArray = ["Laden..."];
var bordOpdrachtenArray = ["Laden..."];

document.body.addEventListener('touchstart', function() { 
    const geluid = document.getElementById('notificatie-geluid'); 
    if (geluid && geluid.paused) { geluid.play().then(() => { geluid.pause(); geluid.currentTime = 0; }).catch(e => {}); } 
}, { once: true });

// ==========================================
// 2. PUSH NOTIFICATIES & TOESTEMMINGEN
// ==========================================
let messaging = null;
try { if (typeof firebase.messaging === "function" && firebase.messaging.isSupported()) { messaging = firebase.messaging(); } } catch (error) {}
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then((reg) => { if (messaging) { messaging.useServiceWorker(reg); } }); }

function setupPushNotificaties(toonAlert = false) {
    if (!messaging) { if(toonAlert) alert("Push notificaties worden niet ondersteund."); return; }
    messaging.requestPermission().then(() => { return messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" }); }).then((token) => {
        if (token && currentUser) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ push_token: token }, { merge: true }); if(toonAlert) alert("✅ Meldingen staan AAN!"); }
    }).catch((err) => { if(toonAlert) alert("❌ Meldingen geweigerd."); });
}

function vraagLocatieToestemming() { if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => { alert("✅ Locatie toegang verleend!"); }, (err) => { alert("❌ Locatie toegang geweigerd."); }); } else { alert("Locatie wordt niet ondersteund."); } }
function vraagSensorToestemming() { if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') { DeviceOrientationEvent.requestPermission().then(response => { if (response === 'granted') { alert("✅ Sensoren geactiveerd!"); } else { alert("❌ Sensor toegang geweigerd."); } }).catch(console.error); } else { alert("✅ Sensoren werken automatisch."); } }

// ==========================================
// 3. NAVIGATIE, AUTH & UI FUNCTIES
// ==========================================
function openGame(gameId) { 
    let modal = document.getElementById(gameId);
    modal.classList.add('active'); 
    modal.style.display = 'block'; 
    document.body.classList.add('modal-open'); 
    window.scrollTo(0,0); 
}
function sluitGame(gameId) { 
    let modal = document.getElementById(gameId);
    modal.classList.remove('active'); 
    modal.style.display = 'none'; 
    document.body.classList.remove('modal-open'); 
}
function openInstellingen() { openGame('modal-instellingen'); document.getElementById('instellingen-groepscode').innerText = currentGroup; laadArchiefLijst(); }

window.addEventListener("DOMContentLoaded", () => {
    bepaalScherm();
});

function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block'; document.getElementById('auth-scherm').style.display = 'none'; document.getElementById('lobby-scherm').style.display = 'none'; document.getElementById('app-scherm').style.display = 'none'; document.getElementById('header-controls').style.display = 'none'; document.getElementById('bottom-nav').style.display = 'none';
    if (!currentUser) { document.getElementById('auth-scherm').style.display = 'block'; } else if (!currentGroup) { document.getElementById('lobby-gebruikersnaam').innerText = currentUser; document.getElementById('lobby-scherm').style.display = 'block'; } else { document.getElementById('auth-container').style.display = 'none'; startApp(); }
}
function wisselPagina(paginaId, navItemElement) { document.querySelectorAll('.page').forEach(page => page.classList.remove('active')); document.getElementById(paginaId).classList.add('active'); document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); navItemElement.classList.add('active'); if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100); window.scrollTo(0,0); }
function registreer() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; if (!naam || !ww) return alert('Vul alles in!'); db.collection('gebruikers').doc(naam).get().then((doc) => { if (doc.exists) alert('Naam bezet!'); else { db.collection('gebruikers').doc(naam).set({ wachtwoord: ww }).then(() => { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); }); } }); }
function login() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; db.collection('gebruikers').doc(naam).get().then((doc) => { if (!doc.exists || doc.data().wachtwoord !== ww) alert('Onjuist!'); else { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); } }); }
function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const code = Math.random().toString(36).substring(2, 7).toUpperCase(); db.collection('groepen').doc(code).set({ maker: currentUser }).then(() => joinSpecifiekeGroep(code)); }
function joinGroep() { const code = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(code).get().then((doc) => { if (!doc.exists) alert('Groep niet gevonden!'); else joinSpecifiekeGroep(code); }); }
function joinSpecifiekeGroep(code) { db.collection('groepen').doc(code).collection('scores').doc(currentUser).set({ bier: 0, mix: 0, kiss: 0, rejection: 0, raggen: 0, kotsen: 0, sleutel: 0, shotje: 0, spins: 0 }, { merge: true }).then(() => { localStorage.setItem('bef_group', code); currentGroup = code; bepaalScherm(); }); }
function updateCoinWeergave() { const coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = coins); }
function verwijderSpeler(naam) { if (confirm(`Verwijder ${naam}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(naam).delete(); }

function startApp() {
    document.getElementById('app-scherm').style.display = 'block'; document.getElementById('bottom-nav').style.display = 'flex'; document.getElementById('header-controls').style.display = 'flex'; document.getElementById('ingelogde-naam').innerText = currentUser;
    
    laadSpelmateriaalUitFirebase(); 
    setupPushNotificaties(); bouwLiveScorebord(); luisterNaarLiveFeed(); luisterNaarCoopMissie(); luisterNaarDrinkSessie(); laadScorritoLijsten();

    luisterNaarReflex(); luisterNaarQuiplash(); luisterNaarLava(); luisterNaarShake(); luisterNaarSjaak(); luisterNaarTijdbom(); luisterNaarBordspel();
}

// ==========================================
// 4. FIREBASE SPELMATERIAAL INLADEN
// ==========================================
function laadSpelmateriaalUitFirebase() {
    // Haalt de live arrays altijd op uit Firebase (zonder ze te overschrijven!)
    db.collection('spelmateriaal').doc('sjaak').onSnapshot(doc => { if (doc.exists && doc.data().vragen) sjaakVragenArray = doc.data().vragen; });
    db.collection('spelmateriaal').doc('quiplash').onSnapshot(doc => { if (doc.exists && doc.data().vragen) quiplashVragenArray = doc.data().vragen; });
    db.collection('spelmateriaal').doc('bordspel').onSnapshot(doc => { if (doc.exists && doc.data().opdrachten) bordOpdrachtenArray = doc.data().opdrachten; });
    db.collection('spelmateriaal').doc('coop').onSnapshot(doc => { if (doc.exists && doc.data().missies) coopMissiesArray = doc.data().missies; });
    db.collection('spelmateriaal').doc('assassin').onSnapshot(doc => { if (doc.exists && doc.data().missies) assassinMissiesArray = doc.data().missies; });
}
// ==========================================
// 5. DRINK SESSIE LOGICA
// ==========================================
let sessieCheckInterval = null, actieveDrinkSessieTijd = 0, drinkSessieStarter = "";
function toggleDrinkSessie() {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').get().then(doc => {
        let isActief = doc.exists && doc.data().actief;
        if (!isActief) {
            setupPushNotificaties(false); let wachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: true, starter: currentUser, volgende_atje: Date.now() + wachttijd, wacht_op_atje: false, huidig_slachtoffer: "" });
            stuurNaarFeed(`🍻 DRINK SESSIE GESTART door ${currentUser.toUpperCase()}! Tracker is nu actief.`); vakantieModus = true; if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition(() => {}, () => {}); }
        } else {
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: false, starter: '', volgende_atje: 0, wacht_op_atje: false, huidig_slachtoffer: "" });
            stuurNaarFeed(`🛑 Drink Sessie is gestopt door ${currentUser.toUpperCase()}. Tracker uit.`); vakantieModus = false;
        }
    });
}
function forceerSessieAtje() {
    let nieuweWachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000); let slachtoffer = spelersLijst.length > 0 ? spelersLijst[Math.floor(Math.random() * spelersLijst.length)] : currentUser;
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + nieuweWachttijd, huidig_slachtoffer: slachtoffer, wacht_op_atje: true });
    let bericht = `🚨 SKIP TIMER! De Drink Sessie wijst direct aan... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`; stuurNaarFeed(bericht); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62";
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => { let tokensGevonden = 0; snap.forEach(doc => { if (doc.data().push_token) { tokensGevonden++; fetch(MAKE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e => console.log(e)); } }); });
}
function luisterNaarDrinkSessie() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').onSnapshot(doc => {
        const btn = document.getElementById('btn-drink-sessie'); const timerUI = document.getElementById('drink-sessie-timer-tekst'); const btnSkip = document.getElementById('btn-skip-timer'); if (!btn) return;
        if (doc.exists && doc.data().actief) {
            let d = doc.data(); actieveDrinkSessieTijd = d.volgende_atje; drinkSessieStarter = d.starter;
            if (d.wacht_op_atje === true && d.huidig_slachtoffer === currentUser) { document.getElementById('atje-overlay').style.display = 'block'; if ("vibrate" in navigator) navigator.vibrate([500, 200, 500, 200, 500]); } else { document.getElementById('atje-overlay').style.display = 'none'; }
            btn.innerHTML = "🛑 Stop Drink Sessie"; btn.style.backgroundColor = "#ff3b30"; if(timerUI) timerUI.style.display = "block"; if(btnSkip) btnSkip.style.display = "block";
            if (!vakantieModus && d.starter !== currentUser) { alert(`🍻 DRINK SESSIE GESTART door ${d.starter.toUpperCase()}! Jouw locatie wordt live gedeeld bij scores.`); if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition(() => {}, () => {}); } }
            vakantieModus = true; if (!sessieCheckInterval) sessieCheckInterval = setInterval(checkDrinkSessieTijd, 5000);
        } else {
            actieveDrinkSessieTijd = 0; drinkSessieStarter = ""; document.getElementById('atje-overlay').style.display = 'none'; btn.innerHTML = "🍻 Start Drink Sessie!"; btn.style.backgroundColor = "#ff9500";
            if(timerUI) timerUI.style.display = "none"; if(btnSkip) btnSkip.style.display = "none"; vakantieModus = false; if (sessieCheckInterval) { clearInterval(sessieCheckInterval); sessieCheckInterval = null; }
        }
    });
}
function bevestigAtje() { db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ wacht_op_atje: false, huidig_slachtoffer: "" }); pasScoreAan('bier', 1, '🍻 Straf Atje'); document.getElementById('atje-overlay').style.display = 'none'; }
setInterval(() => {
    if (actieveDrinkSessieTijd > 0) {
        let diff = actieveDrinkSessieTijd - Date.now(); const timerUI = document.getElementById('drink-sessie-timer-tekst');
        if (diff > 0) { let m = Math.floor(diff / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0'); if(timerUI) timerUI.innerText = `⏰ Volgende Atje over: ${m}:${s}`; } else { if(timerUI) timerUI.innerText = "🚨 ALARM! SLACHTOFFER WORDT GEKOZEN..."; }
    }
}, 1000);
function checkDrinkSessieTijd() {
    if (!actieveDrinkSessieTijd || Date.now() < actieveDrinkSessieTijd) return; if (drinkSessieStarter !== currentUser) return;
    let nieuweWachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000); let slachtoffer = spelersLijst.length > 0 ? spelersLijst[Math.floor(Math.random() * spelersLijst.length)] : currentUser;
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + nieuweWachttijd, huidig_slachtoffer: slachtoffer, wacht_op_atje: true });
    let bericht = `🚨 ALARM! De Drink Sessie heeft gekozen... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`; stuurNaarFeed(bericht); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62";
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => { snap.forEach(doc => { if (doc.data().push_token) { fetch(MAKE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e => console.log(e)); } }); });
}

// ==========================================
// 6. SCOREBORD, SYNC & MAPS
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });
    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) }); }
    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? 'scoort +1 bij' : 'deed een correctie bij'} ${emojiNaam}`;
    
    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => { db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, bedrag: bedrag, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() }); stuurNaarFeed(startBericht); }, () => stuurNaarFeed(startBericht));
    } else { stuurNaarFeed(startBericht); }
}

function bouwLiveScorebord() {
    if (unsubscribeScores) unsubscribeScores();
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        let spelersData = [];
        let somBier=0, somMix=0, somShot=0, somKiss=0, somReject=0, somRaggen=0, somKotsen=0, somSleutel=0;

        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id;
            const b = data.bier || 0; const m = data.mix || 0; const sh = data.shotje || data.doner || 0; const k = data.kiss || 0; const r = data.rejection || 0; const ra = data.raggen || data.mvp || 0; const ko = data.kotsen || 0; const sl = data.sleutel || 0;
            const persoonTotaal = (b * 1) + (m * 2) + (sh * 2) + (k * 10) + (r * 5) + (ra * 15) + (ko * 5) + (sl * 5);
            somBier += b; somMix += m; somShot += sh; somKiss += k; somReject += r; somRaggen += ra; somKotsen += ko; somSleutel += sl;
            spelersData.push({ naam: naam, data: data, b: b, m: m, sh: sh, k: k, r: r, ra: ra, ko: ko, sl: sl, persoonTotaal: persoonTotaal });
        });

        // Sorteer altijd van hoog naar laag
        spelersData.sort((a, b) => b.persoonTotaal - a.persoonTotaal);

        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let grafiekNamen = [], grafiekData = []; let katerHtml = ""; spelersLijst = []; 
        let statMaxBier=0, statMaxBierNaam="-", statMaxRaggen=0, statMaxRaggenNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxKots=0, statMaxKotsNaam="-";

        spelersData.forEach((speler, index) => {
            spelersLijst.push(speler.naam);
            if (speler.naam === currentUser) { mijnTotalePunten = speler.persoonTotaal; mijnGedraaideSpins = speler.data.spins || 0; updateCoinWeergave(); beheerMissiesEnBingo(speler.data); }

            if(speler.b > statMaxBier) { statMaxBier = speler.b; statMaxBierNaam = speler.naam; } if(speler.ra > statMaxRaggen) { statMaxRaggen = speler.ra; statMaxRaggenNaam = speler.naam; } if(speler.r > statMaxSjaak) { statMaxSjaak = speler.r; statMaxSjaakNaam = speler.naam; } if(speler.ko > statMaxKots) { statMaxKots = speler.ko; statMaxKotsNaam = speler.naam; }

            grafiekNamen.push(speler.naam.charAt(0).toUpperCase() + speler.naam.slice(1)); grafiekData.push(speler.b + speler.m + speler.sh);
            let katerKans = Math.max(0, Math.min(99, 5 + (speler.b * 4) + (speler.m * 12) + (speler.sh * 15) + (speler.ko * 30))); let kleur = katerKans >= 75 ? "#ff3b30" : katerKans >= 40 ? "#ff9500" : "#34c759";
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${speler.naam}</span><span>${katerKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${katerKans}%; background-color: ${kleur};"></div></div></div>`;
            
            let rank = (index + 1) + ".";
            if (index === 0) rank = "🥇"; else if (index === 1) rank = "🥈"; else if (index === 2) rank = "🥉";
            html += `<tr><td class="naam-kolom"><span style="font-size:12px; margin-right:4px;">${rank}</span>${speler.naam}</td><td>${speler.b}</td><td>${speler.m}</td><td>${speler.sh}</td><td>${speler.k}</td><td>${speler.r}</td><td>${speler.ra}</td><td>${speler.ko}</td><td>${speler.sl}</td><td class="totaal-kolom">${speler.persoonTotaal}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${speler.naam}')">X</button></td></tr>`;
        });

        document.getElementById('score-tabel').innerHTML = html; document.getElementById('kater-container').innerHTML = katerHtml;
        try { document.getElementById('stats-container').innerHTML = `<div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div><div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${statMaxRaggenNaam} (${statMaxRaggen})</span></div><div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${statMaxKotsNaam} (${statMaxKots})</span></div><div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>`; tekenGrafieken(somBier, somMix, somShot, somKiss, somReject, somRaggen, somKotsen, somSleutel, grafiekNamen, grafiekData); } catch (err) {}
        if(typeof laadScorritoLijsten === 'function') laadScorritoLijsten(); 
    });
}

function stuurNaarFeed(bericht) { db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').set({ bericht: bericht, tijd: firebase.firestore.FieldValue.serverTimestamp() }); }
function luisterNaarLiveFeed() {
    if (unsubscribeFeed) unsubscribeFeed(); let laatsteMelding = "";
    unsubscribeFeed = db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').onSnapshot((doc) => {
        if (!doc.exists || doc.data().bericht === laatsteMelding) return; laatsteMelding = doc.data().bericht;
        const ticker = document.getElementById('live-ticker'); if(ticker) { ticker.innerText = laatsteMelding; ticker.style.display = 'block'; }
        if ("vibrate" in navigator) navigator.vibrate([200,100,200]); const geluid = document.getElementById('notificatie-geluid'); if (geluid) { geluid.currentTime = 0; geluid.play().catch(e => {}); }
        setTimeout(() => { if(ticker) ticker.style.display = 'none'; }, 5000);
    });
}
function tekenGrafieken(b, m, sh, k, r, ra, ko, sl, namen, drankjes) {
    try {
        if (typeof Chart === 'undefined') return; 
        if (pieChartInstance) pieChartInstance.destroy(); let pieCtx = document.getElementById('groepPieChart'); if(pieCtx) { pieChartInstance = new Chart(pieCtx, { type: 'pie', data: { labels: ['Bier','Mix','Shotje','Kiss','Reject','Raggen', 'Kotsen', 'Sleutel'], datasets: [{ data: [b,m,sh,k,r,ra,ko,sl], backgroundColor: ['#f1c40f','#9b59b6','#e17055','#ff7675','#636e72','#ffeaa7','#16a085','#bdc3c7'] }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        if (barChartInstance) barChartInstance.destroy(); let barCtx = document.getElementById('spelerBarChart'); if(barCtx) { barChartInstance = new Chart(barCtx, { type: 'bar', data: { labels: namen, datasets: [{ label: 'Drankjes', data: drankjes, backgroundColor: '#007aff' }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    } catch (err) {}
}

function initKaart() {
    if (!worldMap) {
        worldMap = L.map('map').setView([45.0, 5.0], 4); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(worldMap);
        db.collection('groepen').doc(currentGroup).collection('locaties').onSnapshot(snap => {
            mapMarkers.forEach(m => worldMap.removeLayer(m)); mapMarkers = []; const groepen = {};
            snap.forEach(doc => {
                const data = doc.data(); 
                if(data.lat && data.lng) {
                    const s = `${data.lat.toFixed(2)}_${data.lng.toFixed(2)}`;
                    if (!groepen[s]) groepen[s] = { lat: data.lat, lng: data.lng, personen: {} };
                    if (!groepen[s].personen[data.naam]) groepen[s].personen[data.naam] = {};
                    let val = data.bedrag !== undefined ? data.bedrag : 1;
                    groepen[s].personen[data.naam][data.actie] = (groepen[s].personen[data.naam][data.actie] || 0) + val;
                }
            });
            Object.values(groepen).forEach(g => {
                let pc = ""; let ta = 0; let he = "📍";
                Object.entries(g.personen).forEach(([naam, acties]) => { 
                    let heeftPunten = false; let pStr = `<b style="text-transform:capitalize; color:#007aff;">${naam}</b><br>`;
                    Object.entries(acties).forEach(([a, n]) => { if (n > 0) { pStr += `${a}: ${n}x<br>`; ta += n; he = a.split(' ')[0]; heeftPunten = true; } });
                    if (heeftPunten) { pc += pStr + `<div style="height:8px;"></div>`; }
                });
                if (ta > 0) {
                    const icon = L.divIcon({ html: `<div class="custom-maps-marker-wrapper" style="width:52px;height:52px;"><span style="font-size:34px;">${he}</span><span style="position:absolute;top:-6px;right:-6px;background:#ff3b30;color:white;font-size:13px;font-weight:900;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid white;">${ta}</span></div>`, className: '', iconSize: [52,52], iconAnchor: [26,26] });
                    const marker = L.marker([g.lat, g.lng], { icon: icon }).bindPopup(pc);
                    marker.on('click', function(e) { worldMap.flyTo(e.latlng, 16, { animate: true }); });
                    marker.addTo(worldMap); mapMarkers.push(marker);
                }
            });
        });
    } else { worldMap.invalidateSize(); }
}

// ==========================================
// 7. MISSIES, BINGO & COOP
// ==========================================
function genereerNieuweMissie() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let willekeurigeSpeler = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random() * andereSpelers.length)] : "iemand"; let optie = assassinMissiesArray[Math.floor(Math.random() * assassinMissiesArray.length)]; return optie.replace("[SPELER]", willekeurigeSpeler.charAt(0).toUpperCase() + willekeurigeSpeler.slice(1)); }
function genereerBingoKaart() { let shuffled = [...bingoOpdrachten].sort(() => 0.5 - Math.random()); return shuffled.slice(0, 9); }

function beheerMissiesEnBingo(data) {
    try { if (!data.geheime_missie) { let nwMissie = genereerNieuweMissie(); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: nwMissie }, { merge: true }); const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = nwMissie; } else { const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = data.geheime_missie; } } catch(err) {}
    try { if (!data.bingo_kaart) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_kaart: genereerBingoKaart(), bingo_status: [false,false,false,false,false,false,false,false,false], bingo_gehaald: false }, { merge: true }); } else { mijnBingoKaart = data.bingo_kaart; mijnBingoStatus = data.bingo_status || [false,false,false,false,false,false,false,false,false]; renderBingoGrid(data.bingo_gehaald); } } catch(err) {}
}
function voltooiGeheimeMissie() { if (confirm("Echt uitgevoerd? Bij liegen moet je adten!")) { pasScoreAan('raggen', 3, '🥷 Geheime Missie'); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true }); alert("+3 Punten verdiend!"); } }
function skipGeheimeMissie() { let coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); if (coins < 1) return alert("Je hebt minimaal 1 Coin nodig om te skippen!"); if (confirm("Wil je 1 Coin inleveren om een nieuwe missie te krijgen?")) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1), geheime_missie: genereerNieuweMissie() }, { merge: true }); stuurNaarFeed(`🥷 ${currentUser.toUpperCase()} was te laf en heeft zijn missie geskipt!`); } }

function renderBingoGrid(isGehaald) { const grid = document.getElementById('bingo-grid'); if(!grid) return; grid.innerHTML = ""; mijnBingoKaart.forEach((taak, index) => { let div = document.createElement('div'); div.className = "bingo-cel " + (mijnBingoStatus[index] ? "voltooid" : ""); div.innerText = taak; div.onclick = () => toggleBingoCel(index, isGehaald); grid.appendChild(div); }); }
function toggleBingoCel(index, isGehaald) {
    if (isGehaald) return alert("Je hebt al Bingo!"); mijnBingoStatus[index] = !mijnBingoStatus[index]; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_status: mijnBingoStatus }, { merge: true }); const winLijnen = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; let bingo = winLijnen.some(lijn => lijn.every(i => mijnBingoStatus[i])); if (bingo) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_gehaald: true }, { merge: true }); pasScoreAan('raggen', 10, '🌴 BINGO'); alert("BINGO! 10 Punten voor jou!"); } 
}

function luisterNaarCoopMissie() {
    db.collection('groepen').doc(currentGroup).collection('coop').doc('status').onSnapshot(doc => {
        let vandaag = new Date().toISOString().split('T')[0];
        if (!doc.exists || doc.data().datum !== vandaag) { let randomMissie = coopMissiesArray[Math.floor(Math.random() * coopMissiesArray.length)]; db.collection('groepen').doc(currentGroup).collection('coop').doc('status').set({ datum: vandaag, score: 0, doel: randomMissie.doel, titel: randomMissie.titel, types: randomMissie.types, behaald: false }); return; }
        actieveCoopMissie = doc.data(); let percentage = Math.min(100, (actieveCoopMissie.score / actieveCoopMissie.doel) * 100);
        document.querySelectorAll('.coop-titel-text').forEach(el => el.innerText = actieveCoopMissie.titel); document.querySelectorAll('.coop-bar-fill').forEach(el => el.style.width = percentage + '%'); document.querySelectorAll('.coop-progress-text').forEach(el => el.innerText = actieveCoopMissie.score + ' / ' + actieveCoopMissie.doel);
        if (actieveCoopMissie.score >= actieveCoopMissie.doel && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ behaald: true }); pasScoreAan('raggen', 5, '🏆 CO-OP BEHAALD'); stuurNaarFeed("🎉 CO-OP MISSIE BEHAALD! Iedereen bedankt, +5 Punten voor de finale tik!"); }
    });
}
setInterval(() => { const nu = new Date(); const middernacht = new Date(); middernacht.setHours(24, 0, 0, 0); let diff = middernacht - nu; let h = Math.floor(diff / 3600000).toString().padStart(2, '0'); let m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0'); document.querySelectorAll('.coop-timer-text').forEach(el => el.innerText = `Nog ${h}:${m}:${s} geldig vandaag`); }, 1000);

// ==========================================
// 8. SCORRITO & VAKANTIE ARCHIEF
// ==========================================
function laadScorritoLijsten() {
    let htmlOpts = `<option value="">-- Kies iemand --</option>` + spelersLijst.map(x => `<option value="${x}">${x.toUpperCase()}</option>`).join('');
    ['scor-pils', 'scor-raggen', 'scor-sjaak', 'scor-kots', 'scor-kiss', 'scor-shotje', 'scor-sleutel', 'scor-out'].forEach(id => {
        let el = document.getElementById(id);
        if(el && el.innerHTML.indexOf('<option') === -1) { let currentVal = el.value; el.innerHTML = htmlOpts; if(currentVal) el.value = currentVal; }
    });

    db.collection('groepen').doc(currentGroup).collection('scorrito').onSnapshot(snap => {
        let overzicht = "";
        snap.forEach(doc => {
            let d = doc.data();
            overzicht += `<div style="background:#f2f2f7; padding:15px; border-radius:12px; margin-bottom:10px; border-left:4px solid #af52de;">
                <b style="color:#007aff; text-transform:capitalize; font-size:16px;">${doc.id}</b> voorspelt:<br>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; margin-top:5px;">
                    <div>🍺 Pils: <b>${d.pils||'-'}</b></div><div>🚀 Raggen: <b>${d.raggen||'-'}</b></div>
                    <div>💔 Sjaak: <b>${d.sjaak||'-'}</b></div><div>🤮 Kots: <b>${d.kots||'-'}</b></div>
                    <div>😘 Kiss: <b>${d.kiss||'-'}</b></div><div>🥃 Shot: <b>${d.shotje||'-'}</b></div>
                    <div>🔑 Sleutel: <b>${d.sleutel||'-'}</b></div><div>💀 Out: <b>${d.out||'-'}</b></div>
                </div>
            </div>`;
        });
        let el = document.getElementById('scorrito-overzicht'); if(el) el.innerHTML = overzicht || "Nog geen voorspellingen.";
    });
}

function slaScorritoOp() {
    let d = {
        pils: document.getElementById('scor-pils').value, raggen: document.getElementById('scor-raggen').value, sjaak: document.getElementById('scor-sjaak').value,
        kots: document.getElementById('scor-kots').value, kiss: document.getElementById('scor-kiss').value, shotje: document.getElementById('scor-shotje').value,
        sleutel: document.getElementById('scor-sleutel').value, out: document.getElementById('scor-out').value, tijd: Date.now()
    };
    if(Object.values(d).some(v => v === "")) return alert("Vul alle 8 voorspellingen in!");
    db.collection('groepen').doc(currentGroup).collection('scorrito').doc(currentUser).set(d).then(() => { alert("🔮 Voorspellingen Opgeslagen!"); sluitGame('modal-scorrito'); });
}

function slaVakantieOp() {
    let naam = document.getElementById('archief-naam').value.trim(); let van = document.getElementById('archief-van').value; let tot = document.getElementById('archief-tot').value;
    if(!naam || !van || !tot) return alert("Vul een naam én beide datums in.");
    if(!confirm("WEET JE DIT ZEKER? Alle huidige scores én alle Scorrito voorspellingen worden gereset naar 0!")) return;

    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        let batch = db.batch();
        snap.forEach(doc => {
            batch.set(db.collection('groepen').doc(currentGroup).collection('archief').doc(naam).collection('scores').doc(doc.id), doc.data());
            batch.update(db.collection('groepen').doc(currentGroup).collection('scores').doc(doc.id), { bier:0, mix:0, shotje:0, kiss:0, rejection:0, raggen:0, kotsen:0, sleutel:0, spins:0 });
        });
        batch.set(db.collection('groepen').doc(currentGroup).collection('archief').doc(naam), { naam: naam, van: van, tot: tot, datum_opgeslagen: Date.now() });
        return batch.commit();
    }).then(() => {
        db.collection('groepen').doc(currentGroup).collection('scorrito').get().then(snapScor => { let batch2 = db.batch(); snapScor.forEach(sDoc => { batch2.delete(sDoc.ref); }); return batch2.commit(); });
    }).then(() => {
        db.collection('groepen').doc(currentGroup).collection('archief').doc('_lijst').set({ namen: firebase.firestore.FieldValue.arrayUnion(naam) }, {merge:true});
        alert("✅ Vakantie succesvol gearchiveerd en scores gereset!");
        document.getElementById('archief-naam').value = ""; document.getElementById('archief-van').value = ""; document.getElementById('archief-tot').value = "";
    });
}

function laadArchiefLijst() {
    db.collection('groepen').doc(currentGroup).collection('archief').doc('_lijst').onSnapshot(doc => {
        let select = document.getElementById('archief-select'); if(!select) return; select.innerHTML = '<option value="">-- Kies Vakantie --</option>';
        if(doc.exists && doc.data().namen) { doc.data().namen.forEach(n => { select.innerHTML += `<option value="${n}">${n}</option>`; }); }
    });
}

function bekijkArchief() {
    let naam = document.getElementById('archief-select').value; if(!naam) return alert("Selecteer een vakantie.");
    db.collection('groepen').doc(currentGroup).collection('archief').doc(naam).get().then(docMeta => {
        let dInfo = ""; if(docMeta.exists && docMeta.data().van) { dInfo = `(${docMeta.data().van} tot ${docMeta.data().tot})`; }
        db.collection('groepen').doc(currentGroup).collection('archief').doc(naam).collection('scores').get().then(snap => {
            let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th></tr>`;
            snap.forEach(doc => {
                let data = doc.data(); let b = data.bier||0, m=data.mix||0, sh=data.shotje||0, k=data.kiss||0, r=data.rejection||0, ra=data.raggen||0, ko=data.kotsen||0, sl=data.sleutel||0;
                let tot = (b*1)+(m*2)+(sh*2)+(k*10)+(r*5)+(ra*15)+(ko*5)+(sl*5);
                html += `<tr><td class="naam-kolom">${doc.id}</td><td>${b}</td><td>${m}</td><td>${sh}</td><td>${k}</td><td>${r}</td><td>${ra}</td><td>${ko}</td><td>${sl}</td><td class="totaal-kolom">${tot}</td></tr>`;
            });
            document.getElementById('archief-titel-weergave').innerText = `Archief: ${naam}`; document.getElementById('archief-datum-weergave').innerText = dInfo;
            document.getElementById('archief-score-tabel').innerHTML = html; openGame('modal-archief-stats');
        });
    });
}

function verwijderArchief() {
    let naam = document.getElementById('archief-select').value; if(!naam) return alert("Selecteer eerst een archief uit de lijst.");
    if(confirm("Weet je ZEKER dat je dit archief voor altijd wilt verwijderen? Dit kan niet ongedaan worden!")) {
        db.collection('groepen').doc(currentGroup).collection('archief').doc('_lijst').update({ namen: firebase.firestore.FieldValue.arrayRemove(naam) });
        db.collection('groepen').doc(currentGroup).collection('archief').doc(naam).delete(); alert("🗑️ Archief verwijderd!"); document.getElementById('archief-select').value = "";
    }
}

// ==========================================
// 9. GAME LOBBY SYSTEEM (ALGEMENE FUNCTIES)
// ==========================================
function startLobby(gameNaam) { db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).set({ fase: 'lobby', host: currentUser, spelers: [currentUser], actief: false, klaar: false, ronde: 1, totaal_scores: {} }); }
function joinGame(gameNaam) { db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).update({ spelers: firebase.firestore.FieldValue.arrayUnion(currentUser) }); }
function verlaatGame(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).get().then(doc => {
        if(doc.exists && doc.data().spelers) {
            if(doc.data().host === currentUser) { resetGameLobby(gameNaam); } 
            else { db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).update({ spelers: firebase.firestore.FieldValue.arrayRemove(currentUser) }); }
        }
    });
}
function resetGameLobby(gameNaam) { db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).set({ fase: 'wachten', host: "", spelers: [], actief: false, klaar: false, ronde: 1, totaal_scores: {} }); }

function luisterNaarGameLobby(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).onSnapshot(doc => {
        let d = doc.exists ? doc.data() : {fase: 'wachten'}; let spelers = d.spelers || [];
        let wachtEl = document.getElementById(`${gameNaam}-wachten`), lobbyEl = document.getElementById(`${gameNaam}-lobby`), lijstEl = document.getElementById(`${gameNaam}-spelers-lijst`), joinBtn = document.getElementById(`btn-${gameNaam}-join`), startBtn = document.getElementById(`btn-${gameNaam}-start`);
        
        if (d.fase === 'wachten' || !doc.exists) {
            if(wachtEl) wachtEl.style.display = 'block'; if(lobbyEl) lobbyEl.style.display = 'none';
        } else if (d.fase === 'lobby') {
            if(wachtEl) wachtEl.style.display = 'none'; if(lobbyEl) lobbyEl.style.display = 'block';
            if(lijstEl) lijstEl.innerHTML = spelers.map(s => `<span class="lobby-speler-badge">${s}</span>`).join('');
            if(joinBtn) joinBtn.style.display = spelers.includes(currentUser) ? 'none' : 'inline-block';
            if(startBtn) startBtn.style.display = (d.host === currentUser && spelers.length >= 1) ? 'inline-block' : 'none';
        } else {
            if(wachtEl) wachtEl.style.display = 'none'; if(lobbyEl) lobbyEl.style.display = 'none';
        }
    });
}

// ==========================================
// 10. GAMES LOGICA 
// ==========================================

// 10A. TIJDBOM
function startTijdbom() { if (spelersLijst.length < 1) return alert("Geen spelers gevonden."); let randomSpeler = spelersLijst[Math.floor(Math.random() * spelersLijst.length)]; let ontplofTijd = Date.now() + (Math.floor(Math.random() * 45000) + 30000); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: true, houder: randomSpeler, eindTijdUnix: ontplofTijd }); stuurNaarFeed(`💣 TIJDBOM GESTART! Hij ligt nu bij ${randomSpeler.toUpperCase()}!`); }
function gooiBomDoor() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let slachtoffer = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random() * andereSpelers.length)] : currentUser; if ("vibrate" in navigator) navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').update({ houder: slachtoffer }); }
function luisterNaarTijdbom() {
    if(unsubscribeBom) unsubscribeBom();
    unsubscribeBom = db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot((doc) => {
        if (!doc.exists) return; const data = doc.data(); const card = document.getElementById('modal-bom'); const statusTekst = document.getElementById('bom-status-tekst'); const btnGooi = document.getElementById('btn-gooi-door');
        if (data.actief) {
            document.getElementById('bom-idle-ui').style.display = 'none'; document.getElementById('bom-active-ui').style.display = 'block'; statusTekst.innerText = `Bom is bij ${data.houder.toUpperCase()}!`;
            if (data.houder === currentUser) { if(card) card.style.backgroundColor = '#ff3b30'; if(btnGooi) btnGooi.style.display = 'inline-block'; if (Date.now() >= data.eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } } else { if(card) card.style.backgroundColor = '#050505'; if(btnGooi) btnGooi.style.display = 'none'; }
        } else { document.getElementById('bom-idle-ui').style.display = 'block'; document.getElementById('bom-active-ui').style.display = 'none'; if(card) card.style.backgroundColor = '#050505'; }
    });
    setInterval(() => { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(doc => { if (doc.exists && doc.data().actief && doc.data().houder === currentUser && Date.now() >= doc.data().eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } }); }, 1000);
}

// 10B. RAD VAN FORTUIN, HOGER LAGER, MEXEN
let radSpinning = false;
function draaiRad() {
    if (radSpinning) return; if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("Je hebt 0 coins!");
    radSpinning = true; if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    let draaiCounter = 0; const box = document.getElementById('rad-box');
    const interval = setInterval(() => {
        const basisRadOpties = [
            "🍻 [SPELER] trekt NU een Atje!",
            "📱 Jij mag 1 gênant appje sturen vanaf de telefoon van [SPELER].",
            "💃 [SPELER] doet de Macarena midden in de menigte. Weigeren = Adten!",
            "🥃 [SPELER] haalt nú op eigen kosten een shotje voor jou.",
            "🤫 [SPELER] mag 10 minuten niet praten. Elk woord = 1 flinke slok.",
            "🤝 [SPELER] moet een wildvreemde om een stevige knuffel vragen.",
            "📸 [SPELER] moet een lelijke selfie maken met een onbekende.",
            "🍹 Jij mixt 3 dranken door elkaar. [SPELER] neemt er een grote slok van!",
            "🐔 [SPELER] loopt 1 minuut als een tokkende kip over het terras/straat.",
            "🗣️ [SPELER] praat een kwartier met een zwaar accent. Foutje = drinken.",
            "🤮 Geef [SPELER] +5 Raggen strafpunten én hij/zij trekt een Atje!",
            "👕 [SPELER] draagt de rest van het uur zijn/haar shirt binnenstebuiten.",
            "🎤 [SPELER] zingt luidkeels een kinderliedje. Weigeren = 10 slokken.",
            "🧊 [SPELER] stopt een ijsblokje in zijn onderbroek tot het smelt.",
            "😘 [SPELER] geeft een keiharde, ongemakkelijke knipoog aan de ober/serveerster.",
            "🏋️ [SPELER] doet 10 push-ups in het openbaar. Falen = Adten!",
            "🤚 [SPELER] mag 15 min z'n glas niet met z'n handen pakken (iemand moet hem voeren).",
            "🪑 [SPELER] mag 15 minuten lang nergens op zitten.",
            "💸 [SPELER] betaalt het volgende drankje voor jou!",
            "🐾 [SPELER] moet een minuut lang over straat lopen alsof hij jouw uitgelaten hondje is."
        ];
        let temp = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)]; document.getElementById('rad-uitkomst').innerText = temp.replace("[SPELER]","iemand"); 
        box.style.background = (draaiCounter % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)";
        if (++draaiCounter > 20) { 
            clearInterval(interval); let andereSpelers = spelersLijst.filter(n=>n!==currentUser); let slachtoffer = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random()*andereSpelers.length)] : "iemand"; let eind = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)].replace("[SPELER]", slachtoffer); 
            document.getElementById('rad-uitkomst').innerText = eind; box.style.background = "linear-gradient(135deg, #007aff, #0056b3)"; stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${eind}"`); radSpinning = false; 
        }
    }, 100);
}
let hlHuidig = 5;
function initHogerLager() { hlHuidig = Math.floor(Math.random() * 10) + 1; document.getElementById('hl-getal').innerText = hlHuidig; }
function speelHogerLager(keuze) {
    let inzet = parseInt(document.getElementById('hl-inzet').value); let coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins);
    if (isNaN(inzet) || inzet < 1) return alert("Vul een geldige inzet in!"); if (inzet > coins) return alert("Je hebt niet genoeg Coins!");
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(inzet) }, { merge: true });
    let nieuw = Math.floor(Math.random() * 10) + 1; document.getElementById('hl-getal').innerText = nieuw; let win = false;
    if (keuze === 'hoger' && nieuw > hlHuidig) win = true; if (keuze === 'lager' && nieuw < hlHuidig) win = true;
    if (win) { let winst = inzet * 2; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(-winst) }, { merge: true }); alert(`Je raadde het goed! Je wint ${winst} Coins terug! 🎉`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} won zojuist ${winst} Coins met Hoger/Lager!`); } 
    else { let straf = Math.abs(nieuw - hlHuidig) || 1; alert(`FOUT! Het was ${nieuw}. Jij neemt nu ${straf} grote slokken! 🥃`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} verloor met Hoger/Lager en moet ${straf} slokken nemen!`); } hlHuidig = nieuw;
}
function gooiMexen() { let d1 = Math.floor(Math.random() * 6) + 1; let d2 = Math.floor(Math.random() * 6) + 1; document.getElementById('mex-d1').innerText = d1; document.getElementById('mex-d2').innerText = d2; let score = Math.max(d1, d2).toString() + Math.min(d1, d2).toString(); let extraText = ""; if (score === "21") { extraText = " 🚨 MEX! IEDEREEN DRINKEN!!"; if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } else if (d1 === d2) { extraText = " (Honderden!)"; } stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooide ${score}${extraText}`); }

// 10C. WIE IS DE SJAAK (15 Rondes)
function startSjaakRonde(isNieuwSpel = false) { 
    db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').get().then(doc => {
        let d = doc.data() || {};
        let ronde = isNieuwSpel ? 1 : (d.ronde || 1) + 1;
        
        if (ronde > 15) {
            db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ fase: 'eindstand' });
            return;
        }

        let vr = sjaakVragenArray[Math.floor(Math.random() * sjaakVragenArray.length)]; 
        let updateData = { fase: 'actief', vraag: vr, stemmen: {}, ronde: ronde };
        if (isNieuwSpel) updateData.totaal_scores = {};

        db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update(updateData); 
        if (isNieuwSpel) stuurNaarFeed(`👉 WIE IS DE SJAAK gestart door ${currentUser.toUpperCase()}! (15 Rondes)`); 
    });
}

function luisterNaarSjaak() {
    luisterNaarGameLobby('sjaak');
    db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').onSnapshot(doc => {
        if(!doc.exists) return; let d = doc.data(); let spelers = d.spelers || [];
        let uiActief = document.getElementById('sjaak-actief'); let uiResultaat = document.getElementById('sjaak-resultaat'); let uiEindstand = document.getElementById('sjaak-eindstand');
        if(!uiActief) return;
        
        if (d.fase === 'wachten' || d.fase === 'lobby') { 
            uiActief.style.display = 'none'; uiResultaat.style.display = 'none'; uiEindstand.style.display = 'none'; 
        } 
        else if (d.fase === 'actief') {
            uiActief.style.display = 'block'; uiResultaat.style.display = 'none'; uiEindstand.style.display = 'none';
            document.getElementById('sjaak-ronde-tekst').innerText = `Ronde ${d.ronde || 1} van 15`;
            document.getElementById('sjaak-vraag-tekst').innerText = d.vraag;
            document.getElementById('sjaak-status').innerText = `${Object.keys(d.stemmen || {}).length} van de ${spelers.length} stemmen binnen.`;
            document.getElementById('btn-sjaak-forceer').style.display = (d.host === currentUser) ? 'inline-block' : 'none';
            
            let knoppenBox = document.getElementById('sjaak-stem-knoppen'); knoppenBox.innerHTML = '';
            if (!spelers.includes(currentUser) || (d.stemmen && d.stemmen[currentUser])) {
                knoppenBox.innerHTML = `<h2 style="color:#34c759;">✅ Stem ontvangen!</h2>`;
            } else {
                spelers.forEach((s, idx) => {
                    let btn = document.createElement('button'); btn.className = 'ql-btn-stem'; btn.style.animationDelay = (0.1 * idx) + "s"; btn.innerText = `👉 ${s.toUpperCase()}`;
                    btn.onclick = () => { db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ [`stemmen.${currentUser}`]: s }); };
                    knoppenBox.appendChild(btn);
                });
            }
            if(Object.keys(d.stemmen || {}).length === spelers.length && spelers.length > 0 && d.host === currentUser) { eindigeSjaakRonde(); }
        } else if (d.fase === 'resultaat') {
            uiActief.style.display = 'none'; uiResultaat.style.display = 'block'; uiEindstand.style.display = 'none';
            document.getElementById('sjaak-res-ronde-tekst').innerText = `Ronde ${d.ronde || 1} van 15`;
            document.getElementById('sjaak-resultaat-vraag').innerText = d.vraag;
            document.getElementById('btn-sjaak-volgende').style.display = (d.host === currentUser) ? 'inline-block' : 'none';

            let scores = {}; Object.values(d.stemmen || {}).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; });
            let resLijst = document.getElementById('sjaak-uitslag-lijst'); resLijst.innerHTML = '';
            let resArr = Object.entries(scores).map(([naam, stemmen]) => ({naam, stemmen})); resArr.sort((a, b) => b.stemmen - a.stemmen);
            resArr.forEach((item, index) => { let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s"; p.innerHTML = `<b style="color:#ff3b30;">${item.naam.toUpperCase()}</b>: ${item.stemmen} stem(men) ${index===0?'🎯':''}`; resLijst.appendChild(p); });
        } else if (d.fase === 'eindstand') {
            uiActief.style.display = 'none'; uiResultaat.style.display = 'none'; uiEindstand.style.display = 'block';
            let resLijst = document.getElementById('sjaak-eind-lijst'); resLijst.innerHTML = '';
            let tScores = d.totaal_scores || {};
            let arr = Object.entries(tScores).map(([naam, score]) => ({naam, score})).sort((a,b) => b.score - a.score);
            if(arr.length === 0) resLijst.innerHTML = "<p>Niemand heeft strafpunten gescoord!</p>";
            arr.forEach((item, index) => { 
                let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s"; 
                let trofee = index === 0 ? '🏆 Grootste Sjaak!' : '';
                p.innerHTML = `<b style="color:#ff3b30;">${item.naam.toUpperCase()}</b>: ${item.score} keer de Sjaak ${trofee}`; 
                resLijst.appendChild(p); 
            });
        }
    });
}
function eindigeSjaakRonde() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').get().then(doc => {
        let d = doc.data(); let scores = {}; let maxStemmen = 0; let winnaars = [];
        Object.values(d.stemmen || {}).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; if(scores[gestemdOp] > maxStemmen) maxStemmen = scores[gestemdOp]; });
        Object.keys(scores).forEach(naam => { if(scores[naam] === maxStemmen) winnaars.push(naam); });
        
        let actueleTotaalScores = d.totaal_scores || {};
        winnaars.forEach(w => { 
            actueleTotaalScores[w] = (actueleTotaalScores[w] || 0) + 1;
            db.collection('groepen').doc(currentGroup).collection('scores').doc(w).set({ rejection: firebase.firestore.FieldValue.increment(1) }, {merge: true}); 
        });
        
        if(winnaars.length > 0) stuurNaarFeed(`👉 SJAAK (Ronde ${d.ronde || 1}/15): ${winnaars.join(' & ').toUpperCase()} is de sjaak en krijgt +1 Reject! Drinken!`);
        db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ fase: 'resultaat', totaal_scores: actueleTotaalScores });
    });
}

// 10D. REFLEX
let huidigeReflexRonde = 0, reflexGroenTijd = 0, reflexGeklikt = false, reflexInterval = null;
function startReflexRonde() { let delay = Math.floor(Math.random() * 4000) + 2000; db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').update({ fase: 'actief', ronde: Date.now(), groen_tijd: Date.now() + delay, scores: {} }); stuurNaarFeed(`⚡ Reflex Roulette is GESTART door ${currentUser.toUpperCase()}!`); }
function luisterNaarReflex() {
    luisterNaarGameLobby('reflex');
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc => {
        if (!doc.exists) return; let d = doc.data(); let ronde = d.ronde || 0; let groen = d.groen_tijd || 0; let scores = d.scores || {}; let spelers = d.spelers || [];
        const btn = document.getElementById('reflex-btn'); const lb = document.getElementById('reflex-leaderboard'); if (!btn) return;
        
        if(d.fase === 'lobby' || d.fase === 'wachten') { document.getElementById('reflex-actief').style.display = 'none'; clearInterval(reflexInterval); } 
        else if (d.fase === 'actief') {
            document.getElementById('reflex-actief').style.display = 'block';
            if (ronde !== huidigeReflexRonde) { 
                huidigeReflexRonde = ronde; reflexGroenTijd = groen; reflexGeklikt = false; 
                if(btn) { btn.style.backgroundColor = '#ff3b30'; btn.innerText = 'Wacht...'; btn.disabled = !spelers.includes(currentUser); } 
                clearInterval(reflexInterval); reflexInterval = setInterval(() => { if (Date.now() >= reflexGroenTijd && btn && btn.style.backgroundColor !== 'rgb(52, 199, 89)' && !reflexGeklikt) { btn.style.backgroundColor = '#34c759'; btn.innerText = 'KLIK NU!'; } }, 50); 
            }
            if (Object.keys(scores).length > 0 && lb) {
                lb.style.display = 'block'; let arr = []; for (let speler in scores) { arr.push({ naam: speler, tijd: scores[speler] }); }
                arr.sort((a, b) => { if (a.tijd === 'TE VROEG') return 1; if (b.tijd === 'TE VROEG') return -1; return a.tijd - b.tijd; });
                let html = '<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard Deze Ronde</h3><ol style="padding-left: 20px; margin: 0; font-size:16px;">';
                arr.forEach((s, idx) => { let emoji = idx === 0 ? '🏆' : (s.tijd === 'TE VROEG' ? '❌' : '⏱️'); let tijdWeergave = s.tijd === 'TE VROEG' ? '<span style="color:#ff3b30; font-weight:bold;">TE VROEG</span>' : `${s.tijd} ms`; html += `<li style="margin-bottom: 8px;">${emoji} <b>${s.naam.toUpperCase()}</b>: ${tijdWeergave}</li>`; }); html += '</ol>'; lb.innerHTML = html;
            } else if (lb) { lb.style.display = 'none'; }
        }
    });
}
function klikReflex(e) { 
    if (e) e.preventDefault(); if (reflexGeklikt || !huidigeReflexRonde) return; 
    reflexGeklikt = true; let isTeVroeg = Date.now() < reflexGroenTijd; let tijdScore = isTeVroeg ? 'TE VROEG' : Date.now() - reflexGroenTijd; 
    if (isTeVroeg) { stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG en neemt een atje!`); alert("TE VROEG! Straf Atje voor jou! 🥃"); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } 
    const btn = document.getElementById('reflex-btn'); if (btn) { btn.innerText = 'Geklikt!'; btn.style.backgroundColor = '#8e8e93'; } 
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').update({ [`scores.${currentUser}`]: tijdScore }); 
}

// 10E. QUIPLASH (15 Rondes)
function startQuiplashRonde(isNieuwSpel = false) {
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').get().then(doc => {
        let d = doc.data() || {};
        let qlSpelers = []; document.querySelectorAll('#quiplash-spelers-lijst .lobby-speler-badge').forEach(el => qlSpelers.push(el.innerText.toLowerCase()));
        
        let ronde = isNieuwSpel ? 1 : (d.ronde || 1) + 1;
        if (ronde > 15) {
            db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'eindstand' });
            return;
        }

        let randomSpeler = qlSpelers.length > 0 ? qlSpelers[Math.floor(Math.random() * qlSpelers.length)] : "iemand";
        let vr = quiplashVragenArray[Math.floor(Math.random() * quiplashVragenArray.length)].replace(/\[SPELER\]/g, randomSpeler.charAt(0).toUpperCase() + randomSpeler.slice(1));
        
        let updateData = { fase: 'antwoorden', vraag: vr, antwoorden: {}, stemmen: {}, ronde: ronde };
        if (isNieuwSpel) updateData.totaal_scores = {};

        db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update(updateData); 
        if(isNieuwSpel) stuurNaarFeed(`🤐 Quiplash is GESTART! (15 Rondes) Vul je antwoorden in!`);
    });
}

function luisterNaarQuiplash() {
    luisterNaarGameLobby('quiplash');
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').onSnapshot(doc => {
        if (!doc.exists) return; const data = doc.data(); 
        let qlFase = data.fase || 'wachten'; 
        let qlHuidigeVraag = data.vraag || ''; 
        let qlAntwoorden = data.antwoorden || {}; 
        let qlStemmen = data.stemmen || {}; 
        let qlSpelers = data.spelers || [];
        
        let uiAntwoorden = document.getElementById('ql-antwoorden'); 
        let uiStemmen = document.getElementById('ql-stemmen'); 
        let uiResultaten = document.getElementById('ql-resultaten'); 
        let uiEindstand = document.getElementById('ql-eindstand');
        if(!uiAntwoorden) return;

        if (qlFase === 'wachten' || qlFase === 'lobby') {
            uiAntwoorden.style.display = 'none'; uiStemmen.style.display = 'none'; uiResultaten.style.display = 'none'; uiEindstand.style.display = 'none';
        } else if (qlFase === 'antwoorden') {
            uiAntwoorden.style.display = 'block'; uiStemmen.style.display = 'none'; uiResultaten.style.display = 'none'; uiEindstand.style.display = 'none';
            document.getElementById('ql-ronde-tekst').innerText = `Ronde ${data.ronde || 1} van 15`;
            document.getElementById('ql-vraag-tekst').innerText = qlHuidigeVraag;
            if (!qlSpelers.includes(currentUser)) { document.getElementById('ql-invoer-sectie').style.display = 'none'; document.getElementById('ql-ingevuld-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').innerHTML = `<h2 style="color:#ff9500;">Je doet niet mee.</h2><p>Kijk mee op het scherm van de rest!</p>`; } 
            else if (qlAntwoorden[currentUser]) { document.getElementById('ql-invoer-sectie').style.display = 'none'; document.getElementById('ql-ingevuld-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').innerHTML = `<h2 style="color:#34c759; margin:0 0 10px 0;">✅ Antwoord Ingevuld!</h2><p style="color:#a1a1aa; margin:0;">Wachten op de rest...</p>`; } 
            else { document.getElementById('ql-invoer-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').style.display = 'none'; document.getElementById('ql-invoer').value = ''; }
            document.getElementById('ql-status-antwoorden').innerText = `${Object.keys(qlAntwoorden).length} van de ${qlSpelers.length} antwoorden binnen.`;
            document.getElementById('btn-ql-forceer-stemmen').style.display = (data.host === currentUser) ? 'inline-block' : 'none';
            if(Object.keys(qlAntwoorden).length === qlSpelers.length && qlSpelers.length > 0 && data.host === currentUser) { startQuiplashStemmen(); }
        } else if (qlFase === 'stemmen') {
            uiAntwoorden.style.display = 'none'; uiStemmen.style.display = 'block'; uiResultaten.style.display = 'none'; uiEindstand.style.display = 'none';
            document.getElementById('ql-stem-ronde-tekst').innerText = `Ronde ${data.ronde || 1} van 15`;
            document.getElementById('ql-vraag-stemmen').innerText = qlHuidigeVraag;
            document.getElementById('ql-status-stemmen').innerText = `${Object.keys(qlStemmen).length} van de ${qlSpelers.length} stemmen binnen.`;
            document.getElementById('btn-ql-forceer-resultaat').style.display = (data.host === currentUser) ? 'inline-block' : 'none';

            let stemLijst = document.getElementById('ql-stem-lijst'); stemLijst.innerHTML = '';
            if (!qlSpelers.includes(currentUser) || qlStemmen[currentUser]) { stemLijst.innerHTML = `<h2 style="color:#34c759; margin-top:40px;">✅ Stem ontvangen!</h2>`; } 
            else {
                let ansArr = Object.entries(qlAntwoorden).map(([naam, antw]) => ({naam, antw})).sort(() => 0.5 - Math.random());
                ansArr.forEach((item, index) => {
                    let btn = document.createElement('button'); btn.className = 'ql-btn-stem'; btn.style.animationDelay = (0.1 * index) + "s";
                    btn.innerText = item.antw; btn.disabled = (item.naam === currentUser); 
                    btn.onclick = () => { if(item.naam !== currentUser) stemOpQuiplash(item.naam); }; stemLijst.appendChild(btn);
                });
            }
            if(Object.keys(qlStemmen).length === qlSpelers.length && qlSpelers.length > 0 && data.host === currentUser) { toonQuiplashResultaten(); }
        } else if (qlFase === 'resultaat') {
            uiAntwoorden.style.display = 'none'; uiStemmen.style.display = 'none'; uiResultaten.style.display = 'block'; uiEindstand.style.display = 'none';
            document.getElementById('ql-res-ronde-tekst').innerText = `Ronde ${data.ronde || 1} van 15`;
            document.getElementById('ql-vraag-resultaat').innerText = qlHuidigeVraag;
            let resLijst = document.getElementById('ql-uitslag-lijst'); resLijst.innerHTML = ''; document.getElementById('btn-ql-volgende').style.display = (data.host === currentUser) ? 'inline-block' : 'none';

            let scores = {}; Object.values(qlStemmen).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; });
            let resArr = Object.entries(qlAntwoorden).map(([naam, antw]) => ({naam, antw, stemmen: scores[naam] || 0})); resArr.sort((a, b) => b.stemmen - a.stemmen);
            resArr.forEach((item, index) => {
                let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s";
                p.innerHTML = `<b style="color:#af52de; font-size:18px;">${item.naam.toUpperCase()}</b> <span style="color:#34c759; font-weight:bold;">(${item.stemmen} stemmen)</span><br><span style="color:#fff; font-size:20px; line-height:1.5;">"${item.antw}"</span>`; resLijst.appendChild(p);
            });
        } else if (qlFase === 'eindstand') {
            uiAntwoorden.style.display = 'none'; uiStemmen.style.display = 'none'; uiResultaten.style.display = 'none'; uiEindstand.style.display = 'block';
            let resLijst = document.getElementById('ql-eind-lijst'); resLijst.innerHTML = '';
            let tScores = data.totaal_scores || {};
            let arr = Object.entries(tScores).map(([naam, score]) => ({naam, score})).sort((a,b) => b.score - a.score);
            if(arr.length === 0) resLijst.innerHTML = "<p>Niemand heeft punten gescoord!</p>";
            arr.forEach((item, index) => {
                let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s";
                let trofee = index === 0 ? '🏆 WINNAAR!' : '';
                p.innerHTML = `<b style="color:#ffcc00;">${item.naam.toUpperCase()}</b>: ${item.score} Punten ${trofee}`;
                resLijst.appendChild(p);
            });
        }
    });
}
function verstuurQuiplashAntwoord() { let v = document.getElementById('ql-invoer').value.trim(); if(!v) return alert("Vul iets in!"); db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ [`antwoorden.${currentUser}`]: v }); }
function startQuiplashStemmen() { db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'stemmen' }); }
function stemOpQuiplash(opWie) { db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ [`stemmen.${currentUser}`]: opWie }); }
function toonQuiplashResultaten() {
    let maxStemmen = 0; let winnaars = []; let scores = {};
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').get().then(doc => {
        let d = doc.data();
        let qlStemmen = d.stemmen || {};
        Object.values(qlStemmen).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; if(scores[gestemdOp] > maxStemmen) maxStemmen = scores[gestemdOp]; });
        Object.keys(scores).forEach(naam => { if(scores[naam] === maxStemmen) winnaars.push(naam); });
        
        let actueleTotaalScores = d.totaal_scores || {};
        winnaars.forEach(w => { 
            actueleTotaalScores[w] = (actueleTotaalScores[w] || 0) + 5;
            db.collection('groepen').doc(currentGroup).collection('scores').doc(w).set({ raggen: firebase.firestore.FieldValue.increment(5) }, {merge: true}); 
        });
        
        if(winnaars.length > 0) { stuurNaarFeed(`🏆 Quiplash (Ronde ${d.ronde || 1}/15): ${winnaars.join(' & ').toUpperCase()} kregen 5 punten!`); }
        db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'resultaat', totaal_scores: actueleTotaalScores });
    });
}

// 10F. VLOER IS LAVA
let lavaRonde = 0; let lavaGroenTijd = 0; let lavaGeklikt = false; let lavaInterval = null; let lavaBezig = false;
function startLavaRonde() {
    let delay = Math.floor(Math.random() * 4000) + 2000;
    db.collection('groepen').doc(currentGroup).collection('games').doc('lava').update({ fase: 'actief', ronde: Date.now(), lava_tijd: Date.now() + delay, scores: {} });
    stuurNaarFeed(`🌋 VLOER IS LAVA gestart door ${currentUser.toUpperCase()}!`);
}
function luisterNaarLava() {
    luisterNaarGameLobby('lava');
    db.collection('groepen').doc(currentGroup).collection('games').doc('lava').onSnapshot(doc => {
        if(!doc.exists) return; let d = doc.data(); let ronde = d.ronde || 0; let lavaTijd = d.lava_tijd || 0; let spelers = d.spelers || [];
        let uiWacht = document.getElementById('lava-wacht-ui'); if(!uiWacht) return;

        if(d.fase === 'lobby' || d.fase === 'wachten') { uiWacht.style.display = 'none'; document.getElementById('lava-actief-ui').style.display = 'none'; document.getElementById('lava-resultaat-ui').style.display = 'none'; document.getElementById('modal-lava').style.backgroundColor = '#1c1c1e'; lavaBezig = false; } 
        else if (d.fase === 'actief') {
            if(ronde !== lavaRonde) {
                lavaRonde = ronde; lavaGroenTijd = lavaTijd; lavaGeklikt = false;
                if(spelers.includes(currentUser)) { lavaBezig = true; window.addEventListener('deviceorientation', checkLavaOrientatie); }
                uiWacht.style.display = spelers.includes(currentUser) ? 'block' : 'none';
                uiWacht.innerHTML = spelers.includes(currentUser) ? `<h1 style="font-size: 40px; margin-top:30px; color:white;">WACHT...</h1><p style="font-size: 18px;">Hou je telefoon vast. Nog NIET platleggen!</p>` : `<h1 style="font-size: 40px; color:white; margin-top:40px;">Kijk mee!</h1>`;
                document.getElementById('lava-actief-ui').style.display = 'none'; document.getElementById('lava-resultaat-ui').style.display = 'none';
                clearInterval(lavaInterval);
                lavaInterval = setInterval(() => {
                    if (Date.now() >= lavaGroenTijd && !lavaGeklikt) {
                        if(spelers.includes(currentUser)) uiWacht.style.display = 'none';
                        if(spelers.includes(currentUser)) document.getElementById('lava-actief-ui').style.display = 'block';
                        document.getElementById('modal-lava').style.backgroundColor = '#ff3b30';
                        if ("vibrate" in navigator && spelers.includes(currentUser)) navigator.vibrate([500, 200, 500]);
                    } else if (Date.now() < lavaGroenTijd) { document.getElementById('modal-lava').style.backgroundColor = '#ff9500'; }
                }, 50);
            }
        }
        else if (d.fase === 'resultaat') {
            lavaBezig = false; window.removeEventListener('deviceorientation', checkLavaOrientatie); clearInterval(lavaInterval);
            document.getElementById('modal-lava').style.backgroundColor = '#1c1c1e';
            uiWacht.style.display = 'none'; document.getElementById('lava-actief-ui').style.display = 'none'; document.getElementById('lava-resultaat-ui').style.display = 'block'; document.getElementById('lava-nieuw-btn').style.display = (d.host === currentUser) ? 'inline-block' : 'none';
            let html = "<h3 style='color:#ff3b30; margin-top:0;'>Uitslag:</h3><ol style='padding-left:20px; font-size:18px;'>";
            let arr = []; for(let sp in d.scores) arr.push({n:sp, t: d.scores[sp]});
            spelers.forEach(sp => { if(d.scores[sp] === undefined) arr.push({n:sp, t: 99999999}); });
            arr.sort((a,b) => { if(a.t === 'TE VROEG') return 1; if(b.t === 'TE VROEG') return -1; return a.t - b.t; });
            arr.forEach((x, i) => {
                let tijdWeergave = x.t === 99999999 ? "<span style='color:#ff3b30;'>DOOD 💀</span>" : (x.t === 'TE VROEG' ? "<span style='color:#ff9500;'>TE VROEG!</span>" : (x.t/1000).toFixed(2) + "s");
                let icoon = (i === arr.length-1 && x.t !== 99999999 && x.t !== 'TE VROEG') ? '💀' : ''; html += `<li style="margin-bottom:5px;"><b>${x.n.toUpperCase()}</b>: ${tijdWeergave} ${icoon}</li>`;
            });
            document.getElementById('lava-resultaat-ui').innerHTML = html + "</ol>";
        }
    });
}
function checkLavaOrientatie(e) {
    if(!lavaBezig || lavaGeklikt) return; let flat = (Math.abs(e.beta) < 15 || Math.abs(e.beta) > 165) && Math.abs(e.gamma) < 15;
    if(flat) {
        lavaGeklikt = true; let isTeVroeg = Date.now() < lavaGroenTijd; let reactieTijd = isTeVroeg ? 'TE VROEG' : Date.now() - lavaGroenTijd;
        if(isTeVroeg) { document.getElementById('lava-wacht-ui').innerHTML = `<h1 style="font-size:40px; color:white;">TE VROEG!</h1><p style="color:white; font-size:18px;">Straf atje voor jou!</p>`; } 
        else { document.getElementById('lava-status').innerHTML = `✅ Veilig!<br>Tijd: ${(reactieTijd/1000).toFixed(2)}s`; document.getElementById('lava-status').style.color = "#34c759"; }
        db.collection('groepen').doc(currentGroup).collection('games').doc('lava').update({ [`scores.${currentUser}`]: reactieTijd });
        db.collection('groepen').doc(currentGroup).collection('games').doc('lava').get().then(doc => { if(Object.keys(doc.data().scores).length >= doc.data().spelers.length) { db.collection('groepen').doc(currentGroup).collection('games').doc('lava').update({fase: 'resultaat'}); } });
    }
}

// 10G. SHAKE IT
let shakeTimerInterval = null; let shakeScore = 0; let shakeBezig = false; let shakeLastX = null, shakeLastY = null, shakeLastZ = null;
function startShakeRonde() {
    let spelers = []; document.querySelectorAll('#shake-spelers-lijst .lobby-speler-badge').forEach(el => spelers.push(el.innerText.toLowerCase()));
    if(spelers.length < 1) return alert("Geen spelers in de lobby.");
    let p1 = spelers[Math.floor(Math.random()*spelers.length)]; let over = spelers.filter(x => x !== p1); let p2 = over.length > 0 ? over[Math.floor(Math.random()*over.length)] : p1;
    db.collection('groepen').doc(currentGroup).collection('games').doc('shake').update({ fase: 'actief', eindTijd: Date.now() + 10000, p1: p1, p2: p2, scores: { [p1]:0, [p2]:0 } }); stuurNaarFeed(`📳 SHAKE DUEL: ${p1.toUpperCase()} VS ${p2.toUpperCase()}!`);
}
function luisterNaarShake() {
    luisterNaarGameLobby('shake');
    db.collection('groepen').doc(currentGroup).collection('games').doc('shake').onSnapshot(doc => {
        if(!doc.exists) return; let d = doc.data(); let uiActief = document.getElementById('shake-actief-ui'); if(!uiActief) return;
        
        if(d.fase === 'lobby' || d.fase === 'wachten') { uiActief.style.display = 'none'; document.getElementById('shake-resultaat-ui').style.display = 'none'; document.getElementById('shake-nieuw-btn').style.display = 'none'; shakeBezig = false; clearInterval(shakeTimerInterval); }
        else if(d.fase === 'actief') {
            uiActief.style.display = 'block'; document.getElementById('shake-resultaat-ui').style.display = 'none'; document.getElementById('shake-spelers-tekst').innerText = `${d.p1.toUpperCase()} VS ${d.p2.toUpperCase()}`;
            if(currentUser === d.p1 || currentUser === d.p2) { shakeScore = 0; shakeLastX = null; shakeLastY = null; shakeLastZ = null; shakeBezig = true; window.addEventListener('devicemotion', handleShake); document.getElementById('shake-score').innerText = "0"; } else { document.getElementById('shake-score').innerText = "Kijk hoe ze schudden!"; }
            clearInterval(shakeTimerInterval);
            shakeTimerInterval = setInterval(() => {
                let rest = Math.max(0, Math.ceil((d.eindTijd - Date.now())/1000)); document.getElementById('shake-timer').innerText = rest;
                if(shakeBezig) { db.collection('groepen').doc(currentGroup).collection('games').doc('shake').update({ [`scores.${currentUser}`]: Math.floor(shakeScore) }); }
                if(rest <= 0) { clearInterval(shakeTimerInterval); shakeBezig = false; window.removeEventListener('devicemotion', handleShake); document.getElementById('shake-timer').innerText = "Berekent..."; if(d.host === currentUser) { setTimeout(() => { db.collection('groepen').doc(currentGroup).collection('games').doc('shake').update({fase: 'resultaat'}); }, 1500); } }
            }, 1000);
        } else if(d.fase === 'resultaat') {
            clearInterval(shakeTimerInterval); shakeBezig = false; window.removeEventListener('devicemotion', handleShake);
            uiActief.style.display = 'none'; document.getElementById('shake-resultaat-ui').style.display = 'block'; document.getElementById('shake-nieuw-btn').style.display = (d.host === currentUser) ? 'inline-block' : 'none';
            let s1 = d.scores[d.p1] || 0; let s2 = d.scores[d.p2] || 0;
            let html = `<h3 style="margin-bottom:10px; margin-top:0;">Uitslag</h3><p style="margin:5px 0;"><b>${d.p1.toUpperCase()}:</b> ${s1} Kracht</p><p style="margin:5px 0;"><b>${d.p2.toUpperCase()}:</b> ${s2} Kracht</p>`;
            if(s1 > s2) html += `<h2 style="color:#34c759; margin-top:15px;">🏆 ${d.p1.toUpperCase()} WINT!</h2>`; else if (s2 > s1) html += `<h2 style="color:#34c759; margin-top:15px;">🏆 ${d.p2.toUpperCase()} WINT!</h2>`; else html += `<h2 style="color:#ffcc00; margin-top:15px;">Gelijkspel!</h2>`;
            document.getElementById('shake-resultaat-ui').innerHTML = html;
        }
    });
}
function handleShake(e) {
    if(!shakeBezig) return; let acc = e.accelerationIncludingGravity || e.acceleration; if(!acc) return;
    if(shakeLastX === null) { shakeLastX = acc.x; shakeLastY = acc.y; shakeLastZ = acc.z; return; }
    let deltaX = Math.abs(acc.x - shakeLastX); let deltaY = Math.abs(acc.y - shakeLastY); let deltaZ = Math.abs(acc.z - shakeLastZ); let delta = deltaX + deltaY + deltaZ;
    if(delta > 15) { shakeScore += delta; document.getElementById('shake-score').innerText = Math.floor(shakeScore); }
    shakeLastX = acc.x; shakeLastY = acc.y; shakeLastZ = acc.z;
}

// 10H. BORDSPEL
function startBordspel() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').get().then(doc => {
        let d = doc.data(); let pos = {}; d.spelers.forEach(s => pos[s] = 0);
        db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').update({ fase: 'actief', beurt_index: 0, posities: pos, actieve_opdracht: null });
        stuurNaarFeed(`🎲 HET BORDSPEL is gestart! Succes strijders.`);
    });
}
function luisterNaarBordspel() {
    luisterNaarGameLobby('bordspel');
    db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').onSnapshot(doc => {
        if(!doc.exists) return; let d = doc.data(); let spelers = d.spelers || [];
        let uiActief = document.getElementById('bordspel-actief'); if(!uiActief) return;
        
        if (d.fase === 'wachten' || d.fase === 'lobby') { uiActief.style.display = 'none'; document.getElementById('bord-opdracht-overlay').style.display = 'none'; } 
        else if (d.fase === 'actief') {
            uiActief.style.display = 'block';
            let huidigeSpeler = spelers[d.beurt_index % spelers.length];
            document.getElementById('bord-beurt-naam').innerText = huidigeSpeler;
            
            if (huidigeSpeler === currentUser && !d.actieve_opdracht) { document.getElementById('bord-dobbel-sectie').style.display = 'block'; document.getElementById('bord-wacht-sectie').style.display = 'none'; } 
            else if (!d.actieve_opdracht) { document.getElementById('bord-dobbel-sectie').style.display = 'none'; document.getElementById('bord-wacht-sectie').style.display = 'block'; } 
            else { document.getElementById('bord-dobbel-sectie').style.display = 'none'; document.getElementById('bord-wacht-sectie').style.display = 'none'; }
            
            tekenBord(d.posities || {});

            if (d.actieve_opdracht) {
                document.getElementById('bord-opdracht-overlay').style.display = 'flex';
                document.getElementById('bord-opdracht-speler').innerText = d.actieve_opdracht.speler;
                document.getElementById('bord-opdracht-tekst').innerText = d.actieve_opdracht.tekst;
                document.getElementById('bord-dobbel-uitslag').innerText = `🎲 ${d.dobbel_uitslag}`;
                
                if (d.actieve_opdracht.speler === currentUser || d.host === currentUser) { document.getElementById('bord-opdracht-klaar-btn').style.display = 'inline-block'; document.getElementById('bord-opdracht-wacht').style.display = 'none'; } 
                else { document.getElementById('bord-opdracht-klaar-btn').style.display = 'none'; document.getElementById('bord-opdracht-wacht').style.display = 'block'; }
            } else { document.getElementById('bord-opdracht-overlay').style.display = 'none'; }
        }
    });
}
function tekenBord(posities) {
    let grid = document.getElementById('bord-grid-container'); if(!grid) return; grid.innerHTML = '';
    let kleuren = ['#ff3b30', '#34c759', '#007aff', '#ffcc00', '#af52de', '#ff2d55'];
    for (let i = 0; i < 40; i++) {
        let tegel = document.createElement('div'); tegel.className = 'bord-tegel';
        let type = "normaal";
        if(i === 0) type = "start"; else if(i === 39) type = "finish"; else if(i % 7 === 0) type = "regel"; else if(i % 5 === 0) type = "straf"; else if(i % 3 === 0) type = "actie";
        tegel.setAttribute('data-type', type); tegel.innerHTML = `<div class="bord-tegel-nummer">${i}</div>`;
        
        let pIndex = 0;
        for (let speler in posities) {
            if (posities[speler] === i) {
                let pion = document.createElement('div'); pion.className = 'bord-pion'; pion.style.backgroundColor = kleuren[pIndex % kleuren.length]; pion.innerText = speler.charAt(0); tegel.appendChild(pion);
            }
            pIndex++;
        }
        grid.appendChild(tegel);
    }
}
function gooiDobbelsteenBordspel() {
    document.getElementById('bord-dobbel-sectie').style.display = 'none'; let gooi = Math.floor(Math.random() * 6) + 1;
    document.getElementById('bord-dobbel-uitslag').classList.add('dobbelsteen-animatie');
    setTimeout(()=>document.getElementById('bord-dobbel-uitslag').classList.remove('dobbelsteen-animatie'), 600);
    
    db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').get().then(doc => {
        let d = doc.data(); let huidigePos = d.posities[currentUser] || 0; let nieuwePos = huidigePos + gooi; if (nieuwePos >= 39) nieuwePos = 39;
        
        let opdrachtTekst = bordOpdrachtenArray[Math.floor(Math.random() * bordOpdrachtenArray.length)];
        if (nieuwePos === 39) opdrachtTekst = "🏆 JE BENT GEFINISHT! Deel 10 slokken uit en trek zelf een Atje om het te vieren!";
        
        let nwPosities = d.posities; nwPosities[currentUser] = nieuwePos;
        db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').update({ posities: nwPosities, dobbel_uitslag: gooi, actieve_opdracht: { speler: currentUser, tekst: opdrachtTekst } });
        if ("vibrate" in navigator) navigator.vibrate([100, 100, 100]);
    });
}
function voltooiBordspelBeurt() { db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').update({ beurt_index: firebase.firestore.FieldValue.increment(1), actieve_opdracht: null }); }