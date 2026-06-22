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

let currentUser = localStorage.getItem('bef_user');
let currentGroup = localStorage.getItem('bef_group');
let unsubscribeScores = null, unsubscribeFeed = null;
let mijnTotalePunten = 0, mijnGedraaideSpins = 0;
let isSpinning = false, vakantieModus = false, spelersLijst = []; 
let worldMap = null, mapMarkers = [], pieChartInstance = null, barChartInstance = null;
let mijnBingoKaart = [], mijnBingoStatus = [];

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
    messaging.requestPermission().then(() => { 
        return messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" }); 
    }).then((token) => {
        if (token && currentUser) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ push_token: token }, { merge: true }); if(toonAlert) alert("✅ Meldingen staan AAN!"); }
    }).catch((err) => { if(toonAlert) alert("❌ Meldingen geweigerd."); });
}

function vraagLocatieToestemming() {
    if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition((pos) => { alert("✅ Locatie toegang verleend!"); }, (err) => { alert("❌ Locatie toegang geweigerd."); }); } else { alert("Locatie wordt niet ondersteund."); }
}

function vraagSensorToestemming() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission().then(response => { if (response === 'granted') { alert("✅ Sensoren geactiveerd!"); } else { alert("❌ Sensor toegang geweigerd."); } }).catch(console.error);
    } else { alert("✅ Sensoren werken automatisch."); }
}

// ==========================================
// 3. NAVIGATIE, AUTH & UI FUNCTIES
// ==========================================
function openGame(gameId) { document.getElementById(gameId).classList.add('active'); document.body.classList.add('modal-open'); window.scrollTo(0,0); }
function sluitGame(gameId) { document.getElementById(gameId).classList.remove('active'); document.body.classList.remove('modal-open'); }
function openInstellingen() { openGame('modal-instellingen'); document.getElementById('instellingen-groepscode').innerText = currentGroup; laadArchiefLijst(); }
function bevestigNoodstop(gameNaam) { if(confirm("Weet je zeker dat je het spel voor iedereen wilt stoppen en resetten?")) { if(typeof resetGameLobby === 'function') resetGameLobby(gameNaam); } }

bepaalScherm();

function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block'; document.getElementById('auth-scherm').style.display = 'none'; document.getElementById('lobby-scherm').style.display = 'none'; document.getElementById('app-scherm').style.display = 'none'; document.getElementById('header-controls').style.display = 'none'; document.getElementById('bottom-nav').style.display = 'none';
    if (!currentUser) { document.getElementById('auth-scherm').style.display = 'block'; } else if (!currentGroup) { document.getElementById('lobby-gebruikersnaam').innerText = currentUser; document.getElementById('lobby-scherm').style.display = 'block'; } else { document.getElementById('auth-container').style.display = 'none'; startApp(); }
}

function wisselPagina(paginaId, navItemElement) { 
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active')); document.getElementById(paginaId).classList.add('active'); document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); navItemElement.classList.add('active'); if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100); window.scrollTo(0,0); 
}

function registreer() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; if (!naam || !ww) return alert('Vul alles in!'); db.collection('gebruikers').doc(naam).get().then((doc) => { if (doc.exists) alert('Naam bezet!'); else { db.collection('gebruikers').doc(naam).set({ wachtwoord: ww }).then(() => { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); }); } }); }
function login() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; db.collection('gebruikers').doc(naam).get().then((doc) => { if (!doc.exists || doc.data().wachtwoord !== ww) alert('Onjuist!'); else { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); } }); }
function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const code = Math.random().toString(36).substring(2, 7).toUpperCase(); db.collection('groepen').doc(code).set({ maker: currentUser }).then(() => joinSpecifiekeGroep(code)); }
function joinGroep() { const code = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(code).get().then((doc) => { if (!doc.exists) alert('Groep niet gevonden!'); else joinSpecifiekeGroep(code); }); }
function joinSpecifiekeGroep(code) { db.collection('groepen').doc(code).collection('scores').doc(currentUser).set({ bier: 0, mix: 0, kiss: 0, rejection: 0, raggen: 0, kotsen: 0, sleutel: 0, shotje: 0, spins: 0 }, { merge: true }).then(() => { localStorage.setItem('bef_group', code); currentGroup = code; bepaalScherm(); }); }

function updateCoinWeergave() { 
    const coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); 
    document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = coins); 
}
function verwijderSpeler(naam) { if (confirm(`Verwijder ${naam}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(naam).delete(); }

function startApp() {
    document.getElementById('app-scherm').style.display = 'block'; document.getElementById('bottom-nav').style.display = 'flex'; document.getElementById('header-controls').style.display = 'flex'; document.getElementById('ingelogde-naam').innerText = currentUser;
    setupPushNotificaties(); bouwLiveScorebord(); luisterNaarLiveFeed(); luisterNaarCoopMissie(); luisterNaarDrinkSessie(); laadScorritoLijsten();

    // Activeer de game-listeners (die in games.js staan)
    if(typeof luisterNaarReflex === 'function') luisterNaarReflex();
    if(typeof luisterNaarQuiplash === 'function') luisterNaarQuiplash();
    if(typeof luisterNaarLava === 'function') luisterNaarLava();
    if(typeof luisterNaarShake === 'function') luisterNaarShake();
    if(typeof luisterNaarSjaak === 'function') luisterNaarSjaak();
    if(typeof luisterNaarTijdbom === 'function') luisterNaarTijdbom();
    if(typeof luisterNaarBordspel === 'function') luisterNaarBordspel();
}

// ==========================================
// 4. DRINK SESSIE LOGICA
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
            if (!vakantieModus && d.starter !== currentUser) { alert(`🍻 DRINK SESSIE GESTART door ${d.starter.toUpperCase()}! Jouw locatie wordt nu live gedeeld (bij scoren).`); if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition(() => {}, () => {}); } }
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
// 5. SCOREBORD, SYNC & MAPS (MET MEDAILLES)
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });
    
    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) { 
        db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) }); 
    }
    
    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? 'scoort +1 bij' : 'deed een correctie bij'} ${emojiNaam}`;
    
    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => { 
            db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, bedrag: bedrag, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() }); 
            stuurNaarFeed(startBericht); 
        }, () => stuurNaarFeed(startBericht));
    } else { stuurNaarFeed(startBericht); }
}

function bouwLiveScorebord() {
    if (unsubscribeScores) unsubscribeScores();
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        let spelersData = [];
        let somBier=0, somMix=0, somShot=0, somKiss=0, somReject=0, somRaggen=0, somKotsen=0, somSleutel=0;

        // Gegevens verzamelen
        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id;
            const b = data.bier || 0; const m = data.mix || 0; const sh = data.shotje || data.doner || 0; 
            const k = data.kiss || 0; const r = data.rejection || 0; const ra = data.raggen || data.mvp || 0; 
            const ko = data.kotsen || 0; const sl = data.sleutel || 0;
            
            const persoonTotaal = (b * 1) + (m * 2) + (sh * 2) + (k * 10) + (r * 5) + (ra * 15) + (ko * 5) + (sl * 5);
            somBier += b; somMix += m; somShot += sh; somKiss += k; somReject += r; somRaggen += ra; somKotsen += ko; somSleutel += sl;

            spelersData.push({ naam: naam, data: data, b: b, m: m, sh: sh, k: k, r: r, ra: ra, ko: ko, sl: sl, persoonTotaal: persoonTotaal });
        });

        // Sorteer van hoog naar laag (Echte Leaderboard)
        spelersData.sort((a, b) => b.persoonTotaal - a.persoonTotaal);

        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let grafiekNamen = [], grafiekData = []; let katerHtml = ""; spelersLijst = []; 
        let statMaxBier=0, statMaxBierNaam="-", statMaxRaggen=0, statMaxRaggenNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxKots=0, statMaxKotsNaam="-";

        spelersData.forEach((speler, index) => {
            spelersLijst.push(speler.naam);
            
            if (speler.naam === currentUser) { 
                mijnTotalePunten = speler.persoonTotaal; 
                mijnGedraaideSpins = speler.data.spins || 0; 
                updateCoinWeergave(); 
                beheerMissiesEnBingo(speler.data); 
            }

            if(speler.b > statMaxBier) { statMaxBier = speler.b; statMaxBierNaam = speler.naam; } 
            if(speler.ra > statMaxRaggen) { statMaxRaggen = speler.ra; statMaxRaggenNaam = speler.naam; } 
            if(speler.r > statMaxSjaak) { statMaxSjaak = speler.r; statMaxSjaakNaam = speler.naam; } 
            if(speler.ko > statMaxKots) { statMaxKots = speler.ko; statMaxKotsNaam = speler.naam; }

            grafiekNamen.push(speler.naam.charAt(0).toUpperCase() + speler.naam.slice(1)); grafiekData.push(speler.b + speler.m + speler.sh);
            let katerKans = Math.max(0, Math.min(99, 5 + (speler.b * 4) + (speler.m * 12) + (speler.sh * 15) + (speler.ko * 30))); let kleur = katerKans >= 75 ? "#ff3b30" : katerKans >= 40 ? "#ff9500" : "#34c759";
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${speler.naam}</span><span>${katerKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${katerKans}%; background-color: ${kleur};"></div></div></div>`;
            
            // Medailles & Nummers
            let rank = (index + 1) + ".";
            if (index === 0) rank = "🥇";
            if (index === 1) rank = "🥈";
            if (index === 2) rank = "🥉";

            html += `<tr><td class="naam-kolom"><span style="font-size:12px; margin-right:4px;">${rank}</span>${speler.naam}</td><td>${speler.b}</td><td>${speler.m}</td><td>${speler.sh}</td><td>${speler.k}</td><td>${speler.r}</td><td>${speler.ra}</td><td>${speler.ko}</td><td>${speler.sl}</td><td class="totaal-kolom">${speler.persoonTotaal}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${speler.naam}')">X</button></td></tr>`;
        });

        // Totale groepsrij is verwijderd.
        document.getElementById('score-tabel').innerHTML = html; 
        document.getElementById('kater-container').innerHTML = katerHtml;
        
        try { 
            document.getElementById('stats-container').innerHTML = `<div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div><div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${statMaxRaggenNaam} (${statMaxRaggen})</span></div><div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${statMaxKotsNaam} (${statMaxKots})</span></div><div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>`; 
            tekenGrafieken(somBier, somMix, somShot, somKiss, somReject, somRaggen, somKotsen, somSleutel, grafiekNamen, grafiekData); 
        } catch (err) {}
        
        laadScorritoLijsten(); 
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
// 6. MISSIES, BINGO & COOP
// ==========================================
const coopMissies = [{ titel: "Drink 100 Pils met de groep", doel: 100, types: ['bier'] }, { titel: "Verzamel samen 30 Kiss acties", doel: 30, types: ['kiss'] }, { titel: "Deel 50 Shotjes/Mixjes uit", doel: 50, types: ['mix', 'shotje'] }, { titel: "Incasseer 20 Rejects", doel: 20, types: ['rejection'] }, { titel: "Wordt 5x vol Geragd", doel: 5, types: ['raggen'] }, { titel: "150 Drankjes Totaal", doel: 150, types: ['bier', 'mix', 'shotje'] }];
let actieveCoopMissie = null;
const bingoOpdrachten = ["Neem een shot met de barman", "Regel gratis pils", "Zeg 10 min helemaal niks", "Wijs iemand af", "Trek een Atje", "Eet laat nog iets vets", "Raak iets kwijt", "Krijg een Reject", "Steel een aansteker", "Deel 3 slokken uit", "Drink een uur water", "Klim ergens op", "Laat je trakteren", "Dans battle", "Neem een dubbel shot"];
const assassinMissies = ["Zorg dat [SPELER] een shotje neemt.", "Laat [SPELER] 'proost' zeggen en negeer hem volledig.", "Zorg dat [SPELER] pils voor je haalt.", "Steel ongemerkt de aansteker van [SPELER].", "Overtuig [SPELER] om water te drinken.", "Noem [SPELER] 15 minuten lang bij de verkeerde naam."];

function genereerNieuweMissie() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let willekeurigeSpeler = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random() * andereSpelers.length)] : "iemand"; let optie = assassinMissies[Math.floor(Math.random() * assassinMissies.length)]; return optie.replace("[SPELER]", willekeurigeSpeler.charAt(0).toUpperCase() + willekeurigeSpeler.slice(1)); }
function genereerBingoKaart() { let shuffled = [...bingoOpdrachten].sort(() => 0.5 - Math.random()); return shuffled.slice(0, 9); }

function beheerMissiesEnBingo(data) {
    try { 
        if (!data.geheime_missie) { 
            let nwMissie = genereerNieuweMissie(); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: nwMissie }, { merge: true }); const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = nwMissie; 
        } else { const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = data.geheime_missie; } 
    } catch(err) {}
    
    try { 
        if (!data.bingo_kaart) { 
            db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_kaart: genereerBingoKaart(), bingo_status: [false,false,false,false,false,false,false,false,false], bingo_gehaald: false }, { merge: true }); 
        } else { 
            mijnBingoKaart = data.bingo_kaart; mijnBingoStatus = data.bingo_status || [false,false,false,false,false,false,false,false,false]; renderBingoGrid(data.bingo_gehaald); 
        } 
    } catch(err) {}
}

function voltooiGeheimeMissie() { if (confirm("Echt uitgevoerd? Bij liegen moet je adten!")) { pasScoreAan('raggen', 3, '🥷 Geheime Missie'); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true }); alert("+3 Punten verdiend!"); } }

function skipGeheimeMissie() { 
    let coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); 
    if (coins < 1) return alert("Je hebt minimaal 1 Coin nodig om te skippen!"); 
    if (confirm("Wil je 1 Coin inleveren om een nieuwe missie te krijgen?")) { 
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1), geheime_missie: genereerNieuweMissie() }, { merge: true }); stuurNaarFeed(`🥷 ${currentUser.toUpperCase()} was te laf en heeft zijn missie geskipt!`); 
    } 
}

function renderBingoGrid(isGehaald) { const grid = document.getElementById('bingo-grid'); if(!grid) return; grid.innerHTML = ""; mijnBingoKaart.forEach((taak, index) => { let div = document.createElement('div'); div.className = "bingo-cel " + (mijnBingoStatus[index] ? "voltooid" : ""); div.innerText = taak; div.onclick = () => toggleBingoCel(index, isGehaald); grid.appendChild(div); }); }
function toggleBingoCel(index, isGehaald) {
    if (isGehaald) return alert("Je hebt al Bingo!"); mijnBingoStatus[index] = !mijnBingoStatus[index]; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_status: mijnBingoStatus }, { merge: true }); 
    const winLijnen = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; let bingo = winLijnen.some(lijn => lijn.every(i => mijnBingoStatus[i])); 
    if (bingo) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_gehaald: true }, { merge: true }); pasScoreAan('raggen', 10, '🌴 BINGO'); alert("BINGO! 10 Punten voor jou!"); } 
}

function luisterNaarCoopMissie() {
    db.collection('groepen').doc(currentGroup).collection('coop').doc('status').onSnapshot(doc => {
        let vandaag = new Date().toISOString().split('T')[0];
        if (!doc.exists || doc.data().datum !== vandaag) { let randomMissie = coopMissies[Math.floor(Math.random() * coopMissies.length)]; db.collection('groepen').doc(currentGroup).collection('coop').doc('status').set({ datum: vandaag, score: 0, doel: randomMissie.doel, titel: randomMissie.titel, types: randomMissie.types, behaald: false }); return; }
        actieveCoopMissie = doc.data(); let percentage = Math.min(100, (actieveCoopMissie.score / actieveCoopMissie.doel) * 100);
        document.querySelectorAll('.coop-titel-text').forEach(el => el.innerText = actieveCoopMissie.titel); document.querySelectorAll('.coop-bar-fill').forEach(el => el.style.width = percentage + '%'); document.querySelectorAll('.coop-progress-text').forEach(el => el.innerText = actieveCoopMissie.score + ' / ' + actieveCoopMissie.doel);
        if (actieveCoopMissie.score >= actieveCoopMissie.doel && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ behaald: true }); pasScoreAan('raggen', 5, '🏆 CO-OP BEHAALD'); stuurNaarFeed("🎉 CO-OP MISSIE BEHAALD! Iedereen bedankt, +5 Punten voor de finale tik!"); }
    });
}

setInterval(() => { 
    const nu = new Date(); const middernacht = new Date(); middernacht.setHours(24, 0, 0, 0); 
    let diff = middernacht - nu; let h = Math.floor(diff / 3600000).toString().padStart(2, '0'); let m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0'); document.querySelectorAll('.coop-timer-text').forEach(el => el.innerText = `Nog ${h}:${m}:${s} geldig vandaag`); 
}, 1000);

// ==========================================
// 7. SCORRITO & VAKANTIE ARCHIEF
// ==========================================
function laadScorritoLijsten() {
    let htmlOpts = `<option value="">-- Kies iemand --</option>` + spelersLijst.map(x => `<option value="${x}">${x.toUpperCase()}</option>`).join('');
    ['scor-pils', 'scor-raggen', 'scor-sjaak', 'scor-kots', 'scor-kiss', 'scor-shotje', 'scor-sleutel', 'scor-out'].forEach(id => {
        let el = document.getElementById(id);
        if(el && el.innerHTML.indexOf('<option') === -1) el.innerHTML = htmlOpts;
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