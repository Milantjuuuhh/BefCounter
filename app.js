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
} catch (error) {
    console.log("Push notificaties worden momenteel niet ondersteund door deze browser.");
}

if ('serviceWorker' in navigator) { 
    navigator.serviceWorker.register('sw.js').then((reg) => {
        if (messaging) {
            messaging.useServiceWorker(reg);
        }
    }); 
}

function setupPushNotificaties(toonAlert = false) {
    if (!messaging) {
        if(toonAlert) alert("Push notificaties worden niet ondersteund. Zorg dat je op iOS de app aan je Beginscherm hebt toegevoegd!");
        return;
    }
    messaging.requestPermission().then(() => {
        return messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" });
    }).then((token) => {
        if (token && currentUser) {
            db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ push_token: token }, { merge: true });
            if(toonAlert) alert("✅ Meldingen staan succesvol AAN voor dit apparaat!");
        }
    }).catch((err) => {
        if(toonAlert) alert("❌ Meldingen geweigerd. Zet ze aan in de Instellingen van je telefoon/Safari!");
    });
}

function vraagLocatieToestemming() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { alert("✅ Locatie toegang is succesvol verleend!"); },
            (err) => { alert("❌ Locatie toegang geweigerd of niet beschikbaar. Check je instellingen."); }
        );
    } else {
        alert("Locatie wordt niet ondersteund door dit apparaat.");
    }
}

function vraagSensorToestemming() {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
        .then(response => {
            if (response === 'granted') {
                alert("✅ Sensoren succesvol geactiveerd!");
            } else {
                alert("❌ Sensor toegang geweigerd. Spellen zoals Lava en Shake werken niet goed.");
            }
        })
        .catch(console.error);
    } else {
        alert("✅ Sensoren werken automatisch op dit apparaat.");
    }
}

let currentUser = localStorage.getItem('bef_user');
let currentGroup = localStorage.getItem('bef_group');
let unsubscribeScores = null, unsubscribeFeed = null, unsubscribeBom = null;
let mijnTotalePunten = 0, mijnGedraaideSpins = 0;
let isSpinning = false, vakantieModus = false, spelersLijst = []; 
let worldMap = null, mapMarkers = [];
let pieChartInstance = null, barChartInstance = null;
let mijnBingoKaart = [], mijnBingoStatus = [];

function openGame(gameId) { document.getElementById(gameId).classList.add('active'); }
function sluitGame(gameId) { document.getElementById(gameId).classList.remove('active'); }
function openInstellingen() { openGame('modal-instellingen'); }

const coopMissies = [
    { titel: "Drink 100 Pils met de groep", doel: 100, types: ['bier'] },
    { titel: "Verzamel samen 30 Kiss acties", doel: 30, types: ['kiss'] },
    { titel: "Deel 50 Shotjes/Mixjes uit", doel: 50, types: ['mix', 'shotje'] },
    { titel: "Incasseer 20 Rejects", doel: 20, types: ['rejection'] },
    { titel: "Wordt 5x vol Geragd", doel: 5, types: ['raggen'] },
    { titel: "150 Drankjes Totaal", doel: 150, types: ['bier', 'mix', 'shotje'] }
];

let actieveCoopMissie = null;
const bingoOpdrachten = ["Neem een shot met de barman", "Regel gratis pils", "Zeg 10 min helemaal niks", "Wijs iemand af", "Trek een Atje", "Eet laat nog iets vets", "Raak iets kwijt", "Krijg een Reject", "Steel een aansteker", "Deel 3 slokken uit", "Drink een uur water", "Klim ergens op", "Laat je trakteren", "Dans battle", "Neem een dubbel shot"];
const assassinMissies = ["Zorg dat [SPELER] een shotje neemt.", "Laat [SPELER] 'proost' zeggen en negeer hem volledig.", "Zorg dat [SPELER] pils voor je haalt.", "Steel ongemerkt de aansteker van [SPELER].", "Overtuig [SPELER] om water te drinken.", "Noem [SPELER] 15 minuten lang bij de verkeerde naam."];

function genereerNieuweMissie() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let willekeurigeSpeler = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random() * andereSpelers.length)] : "iemand"; let optie = assassinMissies[Math.floor(Math.random() * assassinMissies.length)]; return optie.replace("[SPELER]", willekeurigeSpeler.charAt(0).toUpperCase() + willekeurigeSpeler.slice(1)); }
function genereerBingoKaart() { let shuffled = [...bingoOpdrachten].sort(() => 0.5 - Math.random()); return shuffled.slice(0, 9); }

document.body.addEventListener('touchstart', function() { const geluid = document.getElementById('notificatie-geluid'); if (geluid && geluid.paused) { geluid.play().then(() => { geluid.pause(); geluid.currentTime = 0; }).catch(e => {}); } }, { once: true });

bepaalScherm();

function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block'; document.getElementById('auth-scherm').style.display = 'none'; document.getElementById('lobby-scherm').style.display = 'none'; document.getElementById('app-scherm').style.display = 'none'; document.getElementById('header-controls').style.display = 'none'; document.getElementById('bottom-nav').style.display = 'none';
    if (!currentUser) { document.getElementById('auth-scherm').style.display = 'block'; } else if (!currentGroup) { document.getElementById('lobby-gebruikersnaam').innerText = currentUser; document.getElementById('lobby-scherm').style.display = 'block'; } else { document.getElementById('auth-container').style.display = 'none'; startApp(); }
}

function wisselPagina(paginaId, navItemElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active')); document.getElementById(paginaId).classList.add('active'); document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active')); navItemElement.classList.add('active');
    if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100);
}

function registreer() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; if (!naam || !ww) return alert('Vul alles in!'); db.collection('gebruikers').doc(naam).get().then((doc) => { if (doc.exists) alert('Naam bezet!'); else { db.collection('gebruikers').doc(naam).set({ wachtwoord: ww }).then(() => { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); }); } }); }
function login() { const naam = document.getElementById('auth-naam').value.trim().toLowerCase(); const ww = document.getElementById('auth-wachtwoord').value; db.collection('gebruikers').doc(naam).get().then((doc) => { if (!doc.exists || doc.data().wachtwoord !== ww) alert('Onjuist!'); else { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); } }); }
function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const code = Math.random().toString(36).substring(2, 7).toUpperCase(); db.collection('groepen').doc(code).set({ maker: currentUser }).then(() => joinSpecifiekeGroep(code)); }
function joinGroep() { const code = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(code).get().then((doc) => { if (!doc.exists) alert('Groep niet gevonden!'); else joinSpecifiekeGroep(code); }); }

function joinSpecifiekeGroep(code) { db.collection('groepen').doc(code).collection('scores').doc(currentUser).set({ bier: 0, mix: 0, kiss: 0, rejection: 0, raggen: 0, kotsen: 0, sleutel: 0, shotje: 0, spins: 0 }, { merge: true }).then(() => { localStorage.setItem('bef_group', code); currentGroup = code; bepaalScherm(); }); }

function startApp() {
    document.getElementById('app-scherm').style.display = 'block'; document.getElementById('bottom-nav').style.display = 'flex'; document.getElementById('header-controls').style.display = 'flex'; document.getElementById('ingelogde-naam').innerText = currentUser; document.getElementById('display-groepscode').innerText = currentGroup;
    setupPushNotificaties(); bouwLiveScorebord(); luisterNaarLiveFeed(); luisterNaarTijdbom(); luisterNaarCoopMissie(); luisterNaarDrinkSessie(); luisterNaarReflex(); luisterNaarQuiplash(); luisterNaarLava(); luisterNaarShake();
}

let sessieCheckInterval = null, actieveDrinkSessieTijd = 0, drinkSessieStarter = "";

function toggleDrinkSessie() {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').get().then(doc => {
        let isActief = doc.exists && doc.data().actief;
        if (!isActief) {
            setupPushNotificaties(false); 
            let wachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: true, starter: currentUser, volgende_atje: Date.now() + wachttijd });
            stuurNaarFeed(`🍻 DRINK SESSIE GESTART door ${currentUser.toUpperCase()}! Tracker is nu actief.`);
            vakantieModus = true; if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition(() => {}, () => {}); }
        } else {
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({ actief: false, starter: '', volgende_atje: 0 });
            stuurNaarFeed(`🛑 Drink Sessie is gestopt door ${currentUser.toUpperCase()}. Tracker uit.`); vakantieModus = false;
        }
    });
}

function forceerSessieAtje() {
    let nieuweWachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + nieuweWachttijd });

    let slachtoffer = spelersLijst.length > 0 ? spelersLijst[Math.floor(Math.random() * spelersLijst.length)] : currentUser;
    let bericht = `🚨 SKIP TIMER! De Drink Sessie wijst direct aan... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`;
    stuurNaarFeed(bericht); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62";
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        let tokensGevonden = 0;
        snap.forEach(doc => {
            if (doc.data().push_token) {
                tokensGevonden++; fetch(MAKE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e => console.log(e));
            }
        });
        if (tokensGevonden === 0) { alert("❌ Er is geen enkel Push-Token in de database gevonden. Klik in de Instellingen op 'Zet Meldingen Aan'!"); }
    });
}

function luisterNaarDrinkSessie() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').onSnapshot(doc => {
        const btn = document.getElementById('btn-drink-sessie'); const timerUI = document.getElementById('drink-sessie-timer-tekst'); const btnSkip = document.getElementById('btn-skip-timer');
        if (!btn) return;
        if (doc.exists && doc.data().actief) {
            actieveDrinkSessieTijd = doc.data().volgende_atje; drinkSessieStarter = doc.data().starter;
            btn.innerHTML = "🛑 Stop Drink Sessie"; btn.style.backgroundColor = "#ff3b30";
            if(timerUI) timerUI.style.display = "block"; if(btnSkip) btnSkip.style.display = "block";
            if (!vakantieModus && doc.data().starter !== currentUser) {
                alert(`🍻 DRINK SESSIE GESTART door ${doc.data().starter.toUpperCase()}! Jouw locatie wordt nu live gedeeld (bij scoren).`);
                if ("geolocation" in navigator) { navigator.geolocation.getCurrentPosition(() => {}, () => {}); }
            }
            vakantieModus = true; if (!sessieCheckInterval) sessieCheckInterval = setInterval(checkDrinkSessieTijd, 5000);
        } else {
            actieveDrinkSessieTijd = 0; drinkSessieStarter = "";
            btn.innerHTML = "🍻 Start Drink Sessie!"; btn.style.backgroundColor = "#ff9500";
            if(timerUI) timerUI.style.display = "none"; if(btnSkip) btnSkip.style.display = "none";
            vakantieModus = false; if (sessieCheckInterval) { clearInterval(sessieCheckInterval); sessieCheckInterval = null; }
        }
    });
}

setInterval(() => {
    if (actieveDrinkSessieTijd > 0) {
        let diff = actieveDrinkSessieTijd - Date.now(); const timerUI = document.getElementById('drink-sessie-timer-tekst');
        if (diff > 0) {
            let m = Math.floor(diff / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            if(timerUI) timerUI.innerText = `⏰ Volgende Atje over: ${m}:${s}`;
        } else { if(timerUI) timerUI.innerText = "🚨 ALARM! SLACHTOFFER WORDT GEKOZEN..."; }
    }
}, 1000);

function checkDrinkSessieTijd() {
    if (!actieveDrinkSessieTijd || Date.now() < actieveDrinkSessieTijd) return;
    if (drinkSessieStarter !== currentUser) return;
    actieveDrinkSessieTijd = Date.now() + 99999999; 
    let nieuweWachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({ volgende_atje: Date.now() + nieuweWachttijd });
    
    if (spelersLijst.length === 0) return;
    let slachtoffer = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let bericht = `🚨 ALARM! De Drink Sessie heeft gekozen... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`;
    stuurNaarFeed(bericht); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62";
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        snap.forEach(doc => {
            if (doc.data().push_token) { fetch(MAKE_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht }) }).catch(e => console.log(e)); }
        });
    });
}

function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });

    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) { db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) }); }

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
        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let somBier=0, somMix=0, somShot=0, somKiss=0, somReject=0, somRaggen=0, somKotsen=0, somSleutel=0, somAlles=0;
        let statMaxBier=0, statMaxBierNaam="-", statMaxRaggen=0, statMaxRaggenNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxKots=0, statMaxKotsNaam="-";
        let grafiekNamen = [], grafiekData = []; let katerHtml = ""; spelersLijst = []; 

        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id; spelersLijst.push(naam);
            const b = data.bier || 0; const m = data.mix || 0; const sh = data.shotje || data.doner || 0;
            const k = data.kiss || 0; const r = data.rejection || 0; const ra = data.raggen || data.mvp || 0; const ko = data.kotsen || 0; const sl = data.sleutel || 0;
            
            const persoonTotaal = (b * 1) + (m * 2) + (sh * 2) + (k * 10) + (r * 5) + (ra * 15) + (ko * 5) + (sl * 5);
            somBier += b; somMix += m; somShot += sh; somKiss += k; somReject += r; somRaggen += ra; somKotsen += ko; somSleutel += sl; somAlles += persoonTotaal;

            if (naam === currentUser) { mijnTotalePunten = persoonTotaal; mijnGedraaideSpins = data.spins || 0; updateCoinWeergave(); beheerMissiesEnBingo(data); }

            if(b > statMaxBier) { statMaxBier = b; statMaxBierNaam = naam; } if(ra > statMaxRaggen) { statMaxRaggen = ra; statMaxRaggenNaam = naam; } if(r > statMaxSjaak) { statMaxSjaak = r; statMaxSjaakNaam = naam; } if(ko > statMaxKots) { statMaxKots = ko; statMaxKotsNaam = naam; }

            grafiekNamen.push(naam.charAt(0).toUpperCase() + naam.slice(1)); grafiekData.push(b + m + sh);
            
            // DE BUG IS HIER GEFIXT: katerKans is nu consequent gespeld in plaats van kKans
            let katerKans = Math.max(0, Math.min(99, 5 + (b * 4) + (m * 12) + (sh * 15) + (ko * 30)));
            let kleur = katerKans >= 75 ? "#ff3b30" : katerKans >= 40 ? "#ff9500" : "#34c759";
            
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${naam}</span><span>${katerKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${katerKans}%; background-color: ${kleur};"></div></div></div>`;
            html += `<tr><td class="naam-kolom">${naam}</td><td>${b}</td><td>${m}</td><td>${sh}</td><td>${k}</td><td>${r}</td><td>${ra}</td><td>${ko}</td><td>${sl}</td><td class="totaal-kolom">${persoonTotaal}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${naam}')">X</button></td></tr>`;
        });

        html += `<tr class="totaal-rij"><td style="text-align:left; padding-left:10px;">Totaal</td><td>${somBier}</td><td>${somMix}</td><td>${somShot}</td><td>${somKiss}</td><td>${somReject}</td><td>${somRaggen}</td><td>${somKotsen}</td><td>${somSleutel}</td><td class="totaal-kolom">${somAlles}</td><td></td></tr>`;
        document.getElementById('score-tabel').innerHTML = html; document.getElementById('kater-container').innerHTML = katerHtml;
        
        try {
            document.getElementById('stats-container').innerHTML = `<div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div><div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${statMaxRaggenNaam} (${statMaxRaggen})</span></div><div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${statMaxKotsNaam} (${statMaxKots})</span></div><div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>`;
            tekenGrafieken(somBier, somMix, somShot, somKiss, somReject, somRaggen, somKotsen, somSleutel, grafiekNamen, grafiekData);
        } catch (err) { console.error("Fout bij laden statistieken: ", err); }
    });
}

function stuurNaarFeed(bericht) { db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').set({ bericht: bericht, tijd: firebase.firestore.FieldValue.serverTimestamp() }); }

function luisterNaarLiveFeed() {
    if (unsubscribeFeed) unsubscribeFeed(); let laatsteMelding = "";
    unsubscribeFeed = db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').onSnapshot((doc) => {
        if (!doc.exists || doc.data().bericht === laatsteMelding) return;
        laatsteMelding = doc.data().bericht;
        const ticker = document.getElementById('live-ticker'); if(ticker) { ticker.innerText = laatsteMelding; ticker.style.display = 'block'; }
        if ("vibrate" in navigator) navigator.vibrate([200,100,200]);
        const geluid = document.getElementById('notificatie-geluid'); if (geluid) { geluid.currentTime = 0; geluid.play().catch(e => {}); }
        setTimeout(() => { if(ticker) ticker.style.display = 'none'; }, 5000);
    });
}

function tekenGrafieken(b, m, sh, k, r, ra, ko, sl, namen, drankjes) {
    try {
        if (typeof Chart === 'undefined') return; 
        if (pieChartInstance) pieChartInstance.destroy();
        let pieCtx = document.getElementById('groepPieChart');
        if(pieCtx) { pieChartInstance = new Chart(pieCtx, { type: 'pie', data: { labels: ['Bier','Mix','Shotje','Kiss','Reject','Raggen', 'Kotsen', 'Sleutel'], datasets: [{ data: [b,m,sh,k,r,ra,ko,sl], backgroundColor: ['#f1c40f','#9b59b6','#e17055','#ff7675','#636e72','#ffeaa7','#16a085','#bdc3c7'] }] }, options: { responsive: true, maintainAspectRatio: false } }); }
        if (barChartInstance) barChartInstance.destroy();
        let barCtx = document.getElementById('spelerBarChart');
        if(barCtx) { barChartInstance = new Chart(barCtx, { type: 'bar', data: { labels: namen, datasets: [{ label: 'Drankjes', data: drankjes, backgroundColor: '#007aff' }] }, options: { responsive: true, maintainAspectRatio: false } }); }
    } catch (err) { console.error("Fout bij tekenen grafieken:", err); }
}

function beheerMissiesEnBingo(data) {
    try {
        if (!data.geheime_missie) { 
            let nwMissie = genereerNieuweMissie();
            db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: nwMissie }, { merge: true }); 
            const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = nwMissie;
        } else { 
            const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = data.geheime_missie; 
        }
    } catch(err) { console.error("Fout in Secret Assassin:", err); }
    
    try {
        if (!data.bingo_kaart) { db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_kaart: genereerBingoKaart(), bingo_status: [false,false,false,false,false,false,false,false,false], bingo_gehaald: false }, { merge: true }); } else { mijnBingoKaart = data.bingo_kaart; mijnBingoStatus = data.bingo_status || [false,false,false,false,false,false,false,false,false]; renderBingoGrid(data.bingo_gehaald); }
    } catch(err) { console.error("Fout in Bingo:", err); }
}

function voltooiGeheimeMissie() {
    if (confirm("Echt uitgevoerd? Bij liegen moet je adten!")) { pasScoreAan('raggen', 3, '🥷 Geheime Missie'); db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true }); alert("+3 Punten verdiend!"); }
}

function renderBingoGrid(isGehaald) {
    const grid = document.getElementById('bingo-grid'); if(!grid) return; grid.innerHTML = "";
    mijnBingoKaart.forEach((taak, index) => { let div = document.createElement('div'); div.className = "bingo-cel " + (mijnBingoStatus[index] ? "voltooid" : ""); div.innerText = taak; div.onclick = () => toggleBingoCel(index, isGehaald); grid.appendChild(div); });
}

function toggleBingoCel(index, isGehaald) {
    if (isGehaald) return alert("Je hebt al Bingo!");
    mijnBingoStatus[index] = !mijnBingoStatus[index]; db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_status: mijnBingoStatus }, { merge: true });
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
    let diff = middernacht - nu; let h = Math.floor(diff / 3600000).toString().padStart(2, '0'); let m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0'); let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    document.querySelectorAll('.coop-timer-text').forEach(el => el.innerText = `Nog ${h}:${m}:${s} geldig vandaag`);
}, 1000);

let actieveSwasiTouches = {}, swasiKleuren = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#f1c40f', '#00c7be'], swasiKleurIndex = 0, swasiTimer = null, swasiAfteller = null, swasiBezig = false;
function startSwasi() { let swasiOverlay = document.getElementById('swasi-overlay'); swasiOverlay.style.display = 'block'; document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger op het scherm..."; document.getElementById('swasi-countdown').style.display = 'none'; document.getElementById('swasi-sluit-btn').style.display = 'none'; actieveSwasiTouches = {}; swasiKleurIndex = 0; swasiBezig = true; document.body.style.overflow = 'hidden'; swasiOverlay.addEventListener('touchstart', handleTouchStart, {passive: false}); swasiOverlay.addEventListener('touchmove', handleTouchMove, {passive: false}); swasiOverlay.addEventListener('touchend', handleTouchEnd); swasiOverlay.addEventListener('touchcancel', handleTouchEnd); }
function stopSwasi() { let swasiOverlay = document.getElementById('swasi-overlay'); swasiOverlay.style.display = 'none'; document.body.style.overflow = ''; clearTimeout(swasiTimer); clearInterval(swasiAfteller); swasiBezig = false; Object.values(actieveSwasiTouches).forEach(c => c.remove()); actieveSwasiTouches = {}; swasiOverlay.removeEventListener('touchstart', handleTouchStart); swasiOverlay.removeEventListener('touchmove', handleTouchMove); swasiOverlay.removeEventListener('touchend', handleTouchEnd); swasiOverlay.removeEventListener('touchcancel', handleTouchEnd); }
function handleTouchStart(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let color = swasiKleuren[swasiKleurIndex % swasiKleuren.length]; swasiKleurIndex++; let circle = document.createElement('div'); circle.className = 'swasi-circle'; circle.style.borderColor = color; circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px'; document.getElementById('swasi-overlay').appendChild(circle); actieveSwasiTouches[t.identifier] = circle; } checkSwasiTimer(); }
function handleTouchMove(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let circle = actieveSwasiTouches[t.identifier]; if (circle) { circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px'; } } }
function handleTouchEnd(e) { if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let id = e.changedTouches[i].identifier; let circle = actieveSwasiTouches[id]; if (circle) { circle.remove(); delete actieveSwasiTouches[id]; } } checkSwasiTimer(); }
function checkSwasiTimer() { clearTimeout(swasiTimer); clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; let keys = Object.keys(actieveSwasiTouches); if (keys.length > 1) { document.getElementById('swasi-instructie').style.display = 'none'; document.getElementById('swasi-countdown').style.display = 'block'; let count = 3; document.getElementById('swasi-countdown').innerText = count; swasiAfteller = setInterval(() => { count--; if (count > 0) { document.getElementById('swasi-countdown').innerText = count; } else { clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; kiesSwasiWinnaar(keys); } }, 1000); } else if (keys.length === 1) { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Wacht op meer vingers..."; } else { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger..."; swasiKleurIndex = 0; } }
function kiesSwasiWinnaar(keys) { swasiBezig = false; if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]); let winnerId = keys[Math.floor(Math.random() * keys.length)]; keys.forEach(id => { let circle = actieveSwasiTouches[id]; if (id == winnerId) { circle.classList.add('winner'); } else { circle.classList.add('loser'); } }); document.getElementById('swasi-sluit-btn').style.display = 'block'; }

function startTijdbom() { if (spelersLijst.length < 2) return alert("Minimaal 2 spelers nodig."); let randomSpeler = spelersLijst[Math.floor(Math.random() * spelersLijst.length)]; let ontplofTijd = Date.now() + (Math.floor(Math.random() * 45000) + 30000); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: true, houder: randomSpeler, eindTijdUnix: ontplofTijd }); stuurNaarFeed(`💣 TIJDBOM GESTART! Hij ligt nu bij ${randomSpeler.toUpperCase()}!`); }
function gooiBomDoor() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let slachtoffer = andereSpelers[Math.floor(Math.random() * andereSpelers.length)]; if ("vibrate" in navigator) navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ houder: slachtoffer }, { merge: true }); }
function luisterNaarTijdbom() {
    if(unsubscribeBom) unsubscribeBom();
    unsubscribeBom = db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot((doc) => {
        if (!doc.exists) return; const data = doc.data(); const card = document.getElementById('bom-card'); const statusTekst = document.getElementById('bom-status-tekst'); const btnGooi = document.getElementById('btn-gooi-door');
        if (data.actief) {
            document.getElementById('bom-idle-ui').style.display = 'none'; document.getElementById('bom-active-ui').style.display = 'block'; statusTekst.innerText = `Bom is bij ${data.houder.toUpperCase()}!`;
            if (data.houder === currentUser) { if(card) card.classList.add('bom-gevaar'); if(btnGooi) btnGooi.style.display = 'inline-block'; if (Date.now() >= data.eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } } else { if(card) card.classList.remove('bom-gevaar'); if(btnGooi) btnGooi.style.display = 'none'; }
        } else { document.getElementById('bom-idle-ui').style.display = 'block'; document.getElementById('bom-active-ui').style.display = 'none'; if(card) card.classList.remove('bom-gevaar'); }
    });
    setInterval(() => { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(doc => { if (doc.exists && doc.data().actief && doc.data().houder === currentUser && Date.now() >= doc.data().eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } }); }, 1000);
}

function draaiRad() {
    if (isSpinning) return; if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("Je hebt 0 coins!");
    isSpinning = true; if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    let draaiCounter = 0; const interval = setInterval(() => {
        const basisRadOpties = ["🍻 Atje!", "🥃 Shotje!", "👉 Deel 2 slokken uit", "🎯 [SPELER] adt!", "💧 Drink water (Laf)", "🔄 Wissel drankje", "🚀 Raggen punt!", "🍻 IEDEREEN ADTEN!"];
        let temp = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)]; document.getElementById('rad-uitkomst').innerText = temp.replace("[SPELER]","iemand"); document.getElementById('rad-box').style.background = (draaiCounter % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)";
        if (++draaiCounter > 20) { clearInterval(interval); let andereSpelers = spelersLijst.filter(n=>n!==currentUser); let slachtoffer = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random()*andereSpelers.length)] : "iemand"; let eind = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)].replace("[SPELER]", slachtoffer); document.getElementById('rad-uitkomst').innerText = eind; document.getElementById('rad-box').style.background = "linear-gradient(135deg, #007aff, #0056b3)"; stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${eind}"`); isSpinning = false; }
    }, 100);
}
function updateCoinWeergave() { const coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = coins); }
function verwijderSpeler(naam) { if (confirm(`Verwijder ${naam}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(naam).delete(); }

const sjaakVragen = ["Wie kotst vanavond als eerste?", "Wie regelt er vannacht de minste actie?", "Wie verliest er als eerste zijn telefoon of sleutels?", "Wie is morgen de grootste jankerd met een kater?", "Wie betaalt zonder zeuren de volgende ronde?", "Wie doet de domste uitspraak vanavond?", "Wie is de slechtste leugenaar van de groep?", "Wie durft er nu het minst een atje te trekken?"];
let sjaakInterval = null;
function startSjaakVraag() { clearInterval(sjaakInterval); document.getElementById('sjaak-timer').innerText = "5"; document.getElementById('sjaak-vraag').innerText = sjaakVragen[Math.floor(Math.random() * sjaakVragen.length)]; }
function startSjaakGame() {
    startSjaakVraag(); let count = 5; const timerUI = document.getElementById('sjaak-timer'); if ("vibrate" in navigator) navigator.vibrate(50);
    sjaakInterval = setInterval(() => { count--; timerUI.innerText = count; if(count <= 0) { clearInterval(sjaakInterval); timerUI.innerText = "👉 WIE IS HET?!"; if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]); } }, 1000);
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

let huidigeReflexRonde = 0, reflexGroenTijd = 0, reflexGeklikt = false, reflexInterval = null;
function luisterNaarReflex() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc => {
        if (!doc.exists) return; let data = doc.data(); let ronde = data.ronde || 0; let groen = data.groen_tijd || 0; let scores = data.scores || {};
        const btn = document.getElementById('reflex-btn'); const lb = document.getElementById('reflex-leaderboard');
        if (ronde !== huidigeReflexRonde) { huidigeReflexRonde = ronde; reflexGroenTijd = groen; reflexGeklikt = false; if(btn) { btn.style.backgroundColor = '#ff3b30'; btn.innerText = 'Wacht...'; btn.disabled = false; } clearInterval(reflexInterval); reflexInterval = setInterval(() => { if (Date.now() >= reflexGroenTijd && btn && btn.style.backgroundColor !== 'rgb(52, 199, 89)' && !reflexGeklikt) { btn.style.backgroundColor = '#34c759'; btn.innerText = 'KLIK NU!'; } }, 50); }
        if (Object.keys(scores).length > 0 && lb) {
            lb.style.display = 'block'; let arr = []; for (let speler in scores) { arr.push({ naam: speler, tijd: scores[speler] }); }
            arr.sort((a, b) => { if (a.tijd === 'TE VROEG') return 1; if (b.tijd === 'TE VROEG') return -1; return a.tijd - b.tijd; });
            let html = '<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard Deze Ronde</h3><ol style="padding-left: 20px; margin: 0; font-size:16px;">';
            arr.forEach((s, idx) => { let emoji = idx === 0 ? '🏆' : (s.tijd === 'TE VROEG' ? '❌' : '⏱️'); let tijdWeergave = s.tijd === 'TE VROEG' ? '<span style="color:#ff3b30; font-weight:bold;">TE VROEG</span>' : `${s.tijd} ms`; html += `<li style="margin-bottom: 8px;">${emoji} <b>${s.naam.toUpperCase()}</b>: ${tijdWeergave}</li>`; }); html += '</ol>'; lb.innerHTML = html;
        } else if (lb) { lb.style.display = 'none'; }
    });
}
function startReflexRonde() { let delay = Math.floor(Math.random() * 4000) + 2000; db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ ronde: Date.now(), groen_tijd: Date.now() + delay, scores: {} }); stuurNaarFeed(`⚡ Reflex Roulette is GESTART door ${currentUser.toUpperCase()}!`); }
function klikReflex(e) { if (e) e.preventDefault(); if (reflexGeklikt || !huidigeReflexRonde) return; reflexGeklikt = true; let isTeVroeg = Date.now() < reflexGroenTijd; let tijdScore = isTeVroeg ? 'TE VROEG' : Date.now() - reflexGroenTijd; if (isTeVroeg) { stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG en neemt een atje!`); alert("TE VROEG! Straf Atje voor jou! 🥃"); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } const btn = document.getElementById('reflex-btn'); if (btn) { btn.innerText = 'Geklikt!'; btn.style.backgroundColor = '#8e8e93'; } db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ scores: { [currentUser]: tijdScore } }, { merge: true }); }

function gooiMexen() { let d1 = Math.floor(Math.random() * 6) + 1; let d2 = Math.floor(Math.random() * 6) + 1; document.getElementById('mex-d1').innerText = d1; document.getElementById('mex-d2').innerText = d2; let score = Math.max(d1, d2).toString() + Math.min(d1, d2).toString(); let extraText = ""; if (score === "21") { extraText = " 🚨 MEX! IEDEREEN DRINKEN!!"; if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } else if (d1 === d2) { extraText = " (Honderden!)"; } stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooide ${score}${extraText}`); }

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
// VLOER IS LAVA
// ==========================================
let lavaStartTijd = 0;
let lavaBezig = false;

function startLava() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('lava').set({
        actief: true, start: Date.now(), scores: {}, host: currentUser
    });
    stuurNaarFeed(`🌋 VLOER IS LAVA gestart door ${currentUser.toUpperCase()}!`);
}

function luisterNaarLava() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('lava').onSnapshot(doc => {
        if(!doc.exists) return;
        let d = doc.data();
        if(d.actief) {
            openGame('modal-lava');
            document.getElementById('lava-start-ui').style.display = 'none';
            document.getElementById('lava-actief-ui').style.display = 'block';
            document.getElementById('lava-resultaat-ui').style.display = 'none';
            document.getElementById('lava-status').innerText = "Aan het meten...";
            document.getElementById('lava-stop-btn').style.display = (d.host === currentUser) ? 'inline-block' : 'none';
            
            lavaStartTijd = d.start;
            lavaBezig = true;
            window.addEventListener('deviceorientation', checkLavaOrientatie);
            if ("vibrate" in navigator) navigator.vibrate([500, 200, 500]);
        } else if (!d.actief && d.start) {
            lavaBezig = false;
            window.removeEventListener('deviceorientation', checkLavaOrientatie);
            document.getElementById('lava-start-ui').style.display = 'block';
            document.getElementById('lava-actief-ui').style.display = 'none';
            document.getElementById('lava-resultaat-ui').style.display = 'block';
            
            let html = "<h3>Uitslag:</h3><ol style='padding-left:20px; font-size:18px;'>";
            let arr = [];
            for(let sp in d.scores) arr.push({n:sp, t: d.scores[sp]});
            spelersLijst.forEach(sp => { if(d.scores[sp] === undefined) arr.push({n:sp, t: 99999999}); });
            arr.sort((a,b) => a.t - b.t);
            arr.forEach((x, i) => {
                let tijdWeergave = x.t === 99999999 ? "<span style='color:#ff3b30;'>DOOD</span>" : (x.t/1000).toFixed(2) + "s";
                html += `<li style="margin-bottom:5px;"><b>${x.n.toUpperCase()}</b>: ${tijdWeergave} ${i === arr.length-1 ? '💀' : ''}</li>`;
            });
            document.getElementById('lava-resultaat-ui').innerHTML = html + "</ol>";
        }
    });
}

function checkLavaOrientatie(e) {
    if(!lavaBezig) return;
    let flat = (Math.abs(e.beta) < 15 || Math.abs(e.beta) > 165) && Math.abs(e.gamma) < 15;
    if(flat) {
        lavaBezig = false;
        window.removeEventListener('deviceorientation', checkLavaOrientatie);
        let reactieTijd = Date.now() - lavaStartTijd;
        let afgerondeTijd = (reactieTijd/1000).toFixed(2); 
        document.getElementById('lava-status').innerHTML = `✅ Veilig!<br>Tijd: ${afgerondeTijd}s`;
        document.getElementById('lava-status').style.color = "#34c759";
        db.collection('groepen').doc(currentGroup).collection('games').doc('lava').set({
            scores: { [currentUser]: reactieTijd }
        }, {merge:true});
    }
}

function stopLava() { db.collection('groepen').doc(currentGroup).collection('games').doc('lava').update({actief: false}); }

// ==========================================
// SHAKE IT!
// ==========================================
let shakeTimerInterval = null;
let shakeScore = 0;
let shakeBezig = false;

function startShake() {
    if(spelersLijst.length < 2) return alert("Minimaal 2 spelers nodig.");
    let p1 = spelersLijst[Math.floor(Math.random()*spelersLijst.length)];
    let over = spelersLijst.filter(x => x !== p1);
    let p2 = over[Math.floor(Math.random()*over.length)];
    
    db.collection('groepen').doc(currentGroup).collection('games').doc('shake').set({
        actief: true, eindTijd: Date.now() + 10000, p1: p1, p2: p2, scores: { [p1]:0, [p2]:0 }
    });
    stuurNaarFeed(`📳 SHAKE DUEL: ${p1.toUpperCase()} VS ${p2.toUpperCase()}!`);
}

function luisterNaarShake() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('shake').onSnapshot(doc => {
        if(!doc.exists) return;
        let d = doc.data();
        if(d.actief) {
            openGame('modal-shake');
            document.getElementById('shake-start-ui').style.display = 'none';
            document.getElementById('shake-actief-ui').style.display = 'block';
            document.getElementById('shake-resultaat-ui').style.display = 'none';
            document.getElementById('shake-spelers-tekst').innerText = `${d.p1.toUpperCase()} VS ${d.p2.toUpperCase()}`;
            
            if(currentUser === d.p1 || currentUser === d.p2) {
                shakeScore = 0;
                shakeBezig = true;
                window.addEventListener('devicemotion', handleShake);
                document.getElementById('shake-score').innerText = "0";
            } else {
                document.getElementById('shake-score').innerText = "Kijk hoe ze schudden!";
            }

            clearInterval(shakeTimerInterval);
            shakeTimerInterval = setInterval(() => {
                let rest = Math.max(0, Math.ceil((d.eindTijd - Date.now())/1000));
                document.getElementById('shake-timer').innerText = rest;
                if(rest <= 0) {
                    clearInterval(shakeTimerInterval);
                    shakeBezig = false;
                    window.removeEventListener('devicemotion', handleShake);
                    if(currentUser === d.p1 || currentUser === d.p2) {
                        db.collection('groepen').doc(currentGroup).collection('games').doc('shake').set({
                            scores: { [currentUser]: Math.floor(shakeScore) }
                        }, {merge:true});
                    }
                }
            }, 1000);

        } else if(!d.actief && d.p1) {
            clearInterval(shakeTimerInterval);
            shakeBezig = false;
            window.removeEventListener('devicemotion', handleShake);
            document.getElementById('shake-start-ui').style.display = 'block';
            document.getElementById('shake-actief-ui').style.display = 'none';
            document.getElementById('shake-resultaat-ui').style.display = 'block';

            let s1 = d.scores[d.p1] || 0;
            let s2 = d.scores[d.p2] || 0;
            let html = `<h3 style="margin-bottom:10px;">Uitslag</h3><p style="margin:5px 0;"><b>${d.p1.toUpperCase()}:</b> ${s1} Kracht</p><p style="margin:5px 0;"><b>${d.p2.toUpperCase()}:</b> ${s2} Kracht</p>`;
            if(s1 > s2) html += `<h2 style="color:#34c759; margin-top:15px;">🏆 ${d.p1.toUpperCase()} WINT!</h2>`;
            else if (s2 > s1) html += `<h2 style="color:#34c759; margin-top:15px;">🏆 ${d.p2.toUpperCase()} WINT!</h2>`;
            else html += `<h2 style="color:#ffcc00; margin-top:15px;">Gelijkspel!</h2>`;
            document.getElementById('shake-resultaat-ui').innerHTML = html;
        }
    });
    
    setInterval(() => {
        db.collection('groepen').doc(currentGroup).collection('games').doc('shake').get().then(doc => {
            if(doc.exists && doc.data().actief && Date.now() > doc.data().eindTijd + 2000) {
                db.collection('groepen').doc(currentGroup).collection('games').doc('shake').update({actief: false});
            }
        });
    }, 3000);
}

function handleShake(e) {
    if(!shakeBezig) return;
    let acc = e.accelerationIncludingGravity || e.acceleration;
    if(acc) {
        let kracht = Math.abs(acc.x) + Math.abs(acc.y) + Math.abs(acc.z);
        if(kracht > 15) { 
            shakeScore += (kracht / 10);
            document.getElementById('shake-score').innerText = Math.floor(shakeScore);
        }
    }
}

// ==========================================
// QUIPLASH LOGICA
// ==========================================
let qlHuidigeVraag = "";
let qlFase = "wachten";
let qlAntwoorden = {};
let qlStemmen = {};

const quiplashVragenArray = [
    "De echte reden waarom [SPELER] nog steeds single is, is ___.",
    "Wat vind je als je een blacklight schijnt op de slaapkamer van [SPELER]?",
    "Het ergste om te horen vlak nadat je de daad hebt verricht is ___.",
    "Waarom is [SPELER] gisteravond uit de kroeg gezet?",
    "Het minst succesvolle condoom-merk heet: ___.",
    "Wat is de zwaar bewaakte, geheime fetisj van [SPELER]?",
    "Je bent op een date, alles gaat perfect totdat je date begint te praten over ___.",
    "Wat staat er op de stiekeme OnlyFans pagina van [SPELER]?",
    "Wat is het aller ranzigste dat [SPELER] ooit in zijn mond heeft gestopt?",
    "De dokter had slecht nieuws. [SPELER] is zojuist gediagnosticeerd met chronische ___.",
    "Wat is de absolute favoriete zoekterm van [SPELER] op de hub?",
    "Als [SPELER] een superkracht had, zou het de kracht zijn om ___ te verpesten.",
    "Wat roept [SPELER] per ongeluk tijdens de seks?",
    "Het allerslechtste excuus van [SPELER] om niet te hoeven adten is ___.",
    "Wat is de echte reden dat de ouders van [SPELER] diep teleurgesteld in hem zijn?",
    "Je weet dat het een waardeloze afterparty is als [SPELER] begint over ___.",
    "Wat verbergt [SPELER] diep achterin zijn nachtkastje?",
    "Als de browsergeschiedenis van [SPELER] uitlekt, moet hij direct de bak in voor ___.",
    "Wat is het laatste dat door het hoofd van [SPELER] ging voordat hij out ging op de vloer?",
    "Het nieuwe parfum van [SPELER] ruikt naar zweet, schaamte en ___.",
    "Waarom mag [SPELER] absoluut niet meer in het lokale zwembad komen?",
    "Wat is de ultieme, gigantische red flag van [SPELER]?",
    "Wat was de daadwerkelijke oorzaak van de scheiding van de ouders van [SPELER]?",
    "Het allersmerigste dat je na een wilde nacht onder je nagels kunt vinden is ___.",
    "Wat is het meest beschamende wat [SPELER] heeft gedaan voor een gratis lauw biertje?",
    "Wat doet [SPELER] als hij denkt dat niemand kijkt?",
    "Het ergste wat je kan vinden in de koelkast van [SPELER] de ochtend na het stappen is ___.",
    "Als [SPELER] een SOA was, welke zou hij dan zijn en waarom?",
    "Waarom begint [SPELER] altijd spontaan te zweten als hij een politieauto ziet?",
    "Wat is de titel van de autobiografie van [SPELER]?",
    "De slechtste openingszin die [SPELER] ooit heeft gebruikt (en die faalde) is ___.",
    "Wat is het eerste wat [SPELER] doet als hij alleen thuis is?",
    "Het ergste cadeau dat [SPELER] ooit aan een scharrel heeft gegeven is ___.",
    "Als [SPELER] sterft, wat staat er dan op zijn grafsteen?",
    "Wat is de echte reden dat [SPELER] is ontslagen bij zijn vorige bijbaan?",
    "Wat is het vreemdste object dat artsen uit het lichaam van [SPELER] hebben moeten verwijderen?",
    "Waarom huilt [SPELER] zichzelf elke avond in slaap?",
    "Wat is de grootste leugen op het Tinder profiel van [SPELER]?",
    "Als [SPELER] een seksspeeltje was, hoe zou hij dan heten en wat doet het?",
    "Wat is het smerigste dat [SPELER] ooit van de grond heeft gegeten in de kroeg?",
    "Waar is [SPELER] daadwerkelijk bang voor in het donker?",
    "Hoe heeft [SPELER] dat litteken op die ongemakkelijke plek gekregen?",
    "Wat is de meest trieste gedachte die [SPELER] had tijdens een onenightstand?",
    "Wat is het geheime wapen van [SPELER] in bed (dat eigenlijk super zielig is)?",
    "Wat zou de reden zijn dat [SPELER] ooit op Opsporing Verzocht komt?",
    "Wat is de meest walgelijke gewoonte van [SPELER] op de wc?",
    "Wat is het donkerste geheim dat [SPELER] voor zijn vrienden achterhoudt?",
    "Wat is het pijnlijkste compliment dat [SPELER] ooit heeft gekregen?",
    "Als [SPELER] een geurkaars zou uitbrengen, welke geur zou dat dan zijn?",
    "Waarom eindigt elke relatie van [SPELER] in een drama met huilbuien en ___?"
];

function luisterNaarQuiplash() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').onSnapshot(doc => {
        if (!doc.exists) return;
        const data = doc.data();
        qlFase = data.fase || 'wachten';
        qlHuidigeVraag = data.vraag || '';
        qlAntwoorden = data.antwoorden || {};
        qlStemmen = data.stemmen || {};

        document.getElementById('ql-wachten').style.display = 'none';
        document.getElementById('ql-antwoorden').style.display = 'none';
        document.getElementById('ql-stemmen').style.display = 'none';
        document.getElementById('ql-resultaten').style.display = 'none';

        if (qlFase === 'wachten') {
            document.getElementById('ql-wachten').style.display = 'block';
        } else if (qlFase === 'antwoorden') {
            document.getElementById('ql-antwoorden').style.display = 'block';
            document.getElementById('ql-vraag-tekst').innerText = qlHuidigeVraag;
            document.getElementById('ql-invoer').value = qlAntwoorden[currentUser] || '';
            document.getElementById('ql-status-antwoorden').innerText = `${Object.keys(qlAntwoorden).length} van de ${spelersLijst.length} spelers hebben geantwoord.`;
            document.getElementById('btn-ql-forceer-stemmen').style.display = (data.host === currentUser) ? 'inline-block' : 'none';
        } else if (qlFase === 'stemmen') {
            document.getElementById('ql-stemmen').style.display = 'block';
            document.getElementById('ql-vraag-stemmen').innerText = qlHuidigeVraag;
            document.getElementById('ql-status-stemmen').innerText = `${Object.keys(qlStemmen).length} stemmen binnen.`;
            document.getElementById('btn-ql-forceer-resultaat').style.display = (data.host === currentUser) ? 'inline-block' : 'none';

            let stemLijst = document.getElementById('ql-stem-lijst');
            stemLijst.innerHTML = '';
            
            let ansArr = Object.entries(qlAntwoorden).map(([naam, antw]) => ({naam, antw})).sort(() => 0.5 - Math.random());
            ansArr.forEach(item => {
                let btn = document.createElement('button');
                btn.className = 'btn-primair';
                btn.style.backgroundColor = (qlStemmen[currentUser] === item.naam) ? '#34c759' : '#007aff';
                btn.innerText = item.antw;
                btn.disabled = (qlStemmen[currentUser] != null || item.naam === currentUser);
                btn.onclick = () => { if(item.naam !== currentUser) stemOpQuiplash(item.naam); };
                stemLijst.appendChild(btn);
            });
        } else if (qlFase === 'resultaat') {
            document.getElementById('ql-resultaten').style.display = 'block';
            document.getElementById('ql-vraag-resultaat').innerText = qlHuidigeVraag;
            let resLijst = document.getElementById('ql-uitslag-lijst');
            resLijst.innerHTML = '';

            let scores = {};
            Object.values(qlStemmen).forEach(gestemdOp => {
                scores[gestemdOp] = (scores[gestemdOp] || 0) + 1;
            });

            let resArr = Object.entries(qlAntwoorden).map(([naam, antw]) => ({naam, antw, stemmen: scores[naam] || 0}));
            resArr.sort((a, b) => b.stemmen - a.stemmen);

            resArr.forEach((item) => {
                let p = document.createElement('div');
                p.style.backgroundColor = '#1c1c1e'; p.style.padding = '10px'; p.style.borderRadius = '8px'; p.style.marginBottom = '5px';
                p.innerHTML = `<b>${item.naam.toUpperCase()}</b> (${item.stemmen} stemmen)<br><span style="color:#a1a1aa;">"${item.antw}"</span>`;
                resLijst.appendChild(p);
            });
        }
    });
}

function startQuiplashRonde() {
    let randomSpeler = spelersLijst.length > 0 ? spelersLijst[Math.floor(Math.random() * spelersLijst.length)] : "iemand";
    let vr = quiplashVragenArray[Math.floor(Math.random() * quiplashVragenArray.length)].replace(/\[SPELER\]/g, randomSpeler.charAt(0).toUpperCase() + randomSpeler.slice(1));
    
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').set({
        fase: 'antwoorden', vraag: vr, host: currentUser, antwoorden: {}, stemmen: {}
    });
    stuurNaarFeed(`🤐 Quiplash gestart door ${currentUser.toUpperCase()}!`);
}

function verstuurQuiplashAntwoord() {
    let v = document.getElementById('ql-invoer').value.trim();
    if(!v) return alert("Vul iets in!");
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').set({
        antwoorden: { [currentUser]: v }
    }, {merge: true});
    document.getElementById('ql-invoer').value = '';
}

function startQuiplashStemmen() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'stemmen' });
}

function stemOpQuiplash(opWie) {
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').set({
        stemmen: { [currentUser]: opWie }
    }, {merge: true});
}

function toonQuiplashResultaten() {
    let maxStemmen = 0;
    let winnaars = [];
    let scores = {};
    
    Object.values(qlStemmen).forEach(gestemdOp => {
        scores[gestemdOp] = (scores[gestemdOp] || 0) + 1;
        if(scores[gestemdOp] > maxStemmen) maxStemmen = scores[gestemdOp];
    });
    
    Object.keys(scores).forEach(naam => {
        if(scores[naam] === maxStemmen) winnaars.push(naam);
    });

    winnaars.forEach(w => {
        db.collection('groepen').doc(currentGroup).collection('scores').doc(w).set({
            raggen: firebase.firestore.FieldValue.increment(5)
        }, {merge: true});
    });

    if(winnaars.length > 0) {
        stuurNaarFeed(`🏆 Quiplash: ${winnaars.join(' & ').toUpperCase()} won(nen) en kregen 5 punten!`);
    }

    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'resultaat' });
}