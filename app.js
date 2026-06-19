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

// PUSH NOTIFICATIES SETUP
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

function setupPushNotificaties() {
    if (!messaging) return;
    messaging.requestPermission()
        .then(() => {
            return messaging.getToken({ vapidKey: "BMfkVb0XKUWAPQ8HnB_79f1bvyB05Q-DSnkgzSvzfSN9n_ADzgW1FpAFJim8ftNfTeHA5BkUTJ1B-YhKIOyDL9k" });
        })
        .then((token) => {
            if (token && currentUser) {
                db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({
                    push_token: token
                }, { merge: true });
            }
        })
        .catch((err) => {
            console.log("Notificatie setup mislukt of geweigerd:", err);
        });
}

let currentUser = localStorage.getItem('bef_user');
let currentGroup = localStorage.getItem('bef_group');
let unsubscribeScores = null;
let unsubscribeFeed = null;
let unsubscribeBom = null;

let mijnTotalePunten = 0, mijnGedraaideSpins = 0;
let isSpinning = false, vakantieModus = false;
let spelersLijst = []; 

let worldMap = null, mapMarkers = [];
let pieChartInstance = null, barChartInstance = null;
let mijnBingoKaart = [], mijnBingoStatus = [];

// ==========================================
// FULLSCREEN GAME MODALS LOGICA
// ==========================================
function openGame(gameId) { document.getElementById(gameId).classList.add('active'); }
function sluitGame(gameId) { document.getElementById(gameId).classList.remove('active'); }

// ==========================================
// GAME DATA (CO-OP, BINGO & ASSASSIN)
// ==========================================
const coopMissies = [
    { titel: "Drink 100 Pils met de groep", doel: 100, types: ['bier'] },
    { titel: "Verzamel samen 30 Kiss acties", doel: 30, types: ['kiss'] },
    { titel: "Deel 50 Shotjes/Mixjes uit", doel: 50, types: ['mix', 'shotje'] },
    { titel: "Incasseer 20 Rejects", doel: 20, types: ['rejection'] },
    { titel: "Wordt 5x vol Geragd", doel: 5, types: ['raggen'] },
    { titel: "150 Drankjes Totaal", doel: 150, types: ['bier', 'mix', 'shotje'] }
];

let actieveCoopMissie = null;

const bingoOpdrachten = [
    "Neem een shot met de barman", "Regel gratis pils", "Zeg 10 min helemaal niks", 
    "Wijs iemand af", "Trek een Atje", "Eet laat nog iets vets", 
    "Raak iets kwijt", "Krijg een Reject", "Steel een aansteker", 
    "Deel 3 slokken uit", "Drink een uur water", "Klim ergens op",
    "Laat je trakteren", "Dans battle", "Neem een dubbel shot"
];

const assassinMissies = [
    "Zorg dat [SPELER] een shotje neemt.",
    "Laat [SPELER] 'proost' zeggen en negeer hem volledig.",
    "Zorg dat [SPELER] pils voor je haalt.",
    "Steel ongemerkt de aansteker van [SPELER].",
    "Overtuig [SPELER] om water te drinken.",
    "Noem [SPELER] 15 minuten lang bij de verkeerde naam."
];

function genereerNieuweMissie() {
    let optie = assassinMissies[Math.floor(Math.random() * assassinMissies.length)];
    let andereSpelers = spelersLijst.filter(n => n !== currentUser);
    let willekeurigeSpeler = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random() * andereSpelers.length)] : "iemand";
    return optie.replace("[SPELER]", willekeurigeSpeler.charAt(0).toUpperCase() + willekeurigeSpeler.slice(1));
}

function genereerBingoKaart() {
    let shuffled = [...bingoOpdrachten].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 9);
}

document.body.addEventListener('touchstart', function() {
    const geluid = document.getElementById('notificatie-geluid');
    if (geluid && geluid.paused) { geluid.play().then(() => { geluid.pause(); geluid.currentTime = 0; }).catch(e => {}); }
}, { once: true });

bepaalScherm();

// ==========================================
// BASIS NAVIGATIE & AUTH
// ==========================================
function bepaalScherm() {
    document.getElementById('auth-container').style.display = 'block';
    document.getElementById('auth-scherm').style.display = 'none';
    document.getElementById('lobby-scherm').style.display = 'none';
    document.getElementById('app-scherm').style.display = 'none';
    document.getElementById('header-controls').style.display = 'none';
    document.getElementById('bottom-nav').style.display = 'none';

    if (!currentUser) { document.getElementById('auth-scherm').style.display = 'block'; } 
    else if (!currentGroup) {
        document.getElementById('lobby-gebruikersnaam').innerText = currentUser;
        document.getElementById('lobby-scherm').style.display = 'block';
    } else {
        document.getElementById('auth-container').style.display = 'none';
        startApp();
    }
}

function wisselPagina(paginaId, navItemElement) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(paginaId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    navItemElement.classList.add('active');

    if (paginaId === 'page-kaart') setTimeout(() => initKaart(), 100);
}

function registreer() {
    const naam = document.getElementById('auth-naam').value.trim().toLowerCase();
    const ww = document.getElementById('auth-wachtwoord').value;
    if (!naam || !ww) return alert('Vul alles in!');
    db.collection('gebruikers').doc(naam).get().then((doc) => {
        if (doc.exists) alert('Naam bezet!');
        else db.collection('gebruikers').doc(naam).set({ wachtwoord: ww }).then(() => { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); });
    });
}

function login() {
    const naam = document.getElementById('auth-naam').value.trim().toLowerCase();
    const ww = document.getElementById('auth-wachtwoord').value;
    db.collection('gebruikers').doc(naam).get().then((doc) => {
        if (!doc.exists || doc.data().wachtwoord !== ww) alert('Onjuist!');
        else { localStorage.setItem('bef_user', naam); currentUser = naam; bepaalScherm(); }
    });
}

function uitloggen() { localStorage.clear(); location.reload(); }
function maakNieuweGroep() { const code = Math.random().toString(36).substring(2, 7).toUpperCase(); db.collection('groepen').doc(code).set({ maker: currentUser }).then(() => joinSpecifiekeGroep(code)); }
function joinGroep() { const code = document.getElementById('lobby-code').value.trim().toUpperCase(); db.collection('groepen').doc(code).get().then((doc) => { if (!doc.exists) alert('Groep niet gevonden!'); else joinSpecifiekeGroep(code); }); }

function joinSpecifiekeGroep(code) {
    db.collection('groepen').doc(code).collection('scores').doc(currentUser).set({
        bier: 0, mix: 0, kiss: 0, rejection: 0, raggen: 0, kotsen: 0, sleutel: 0, shotje: 0, spins: 0
    }, { merge: true }).then(() => {
        localStorage.setItem('bef_group', code); currentGroup = code; bepaalScherm();
    });
}

function startApp() {
    document.getElementById('app-scherm').style.display = 'block';
    document.getElementById('bottom-nav').style.display = 'flex';
    document.getElementById('header-controls').style.display = 'flex';
    document.getElementById('ingelogde-naam').innerText = currentUser;
    document.getElementById('display-groepscode').innerText = currentGroup;

    setupPushNotificaties();

    bouwLiveScorebord();
    luisterNaarLiveFeed();
    luisterNaarTijdbom();
    luisterNaarCoopMissie();
    luisterNaarDrinkSessie();
    luisterNaarReflex(); // Start luisteren naar de live reflex game!
}

// ==========================================
// DRINK SESSIE (GPS AAN + RANDOM ATJES MET TIMER)
// ==========================================
let sessieCheckInterval = null;
let actieveDrinkSessieTijd = 0;

function toggleDrinkSessie() {
    if ("vibrate" in navigator) navigator.vibrate(50);
    
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').get().then(doc => {
        let isActief = doc.exists && doc.data().actief;
        
        if (!isActief) {
            let wachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
            
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({
                actief: true,
                starter: currentUser,
                volgende_atje: Date.now() + wachttijd
            });
            stuurNaarFeed(`🍻 DRINK SESSIE GESTART door ${currentUser.toUpperCase()}! Tracker is nu actief.`);
            
            vakantieModus = true;
            if ("geolocation" in navigator) {
                navigator.geolocation.getCurrentPosition(() => {}, () => alert("Zorg dat locatievoorzieningen aan staan voor de GPS tracker!"));
            }
        } else {
            db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').set({
                actief: false,
                starter: '',
                volgende_atje: 0
            });
            stuurNaarFeed(`🛑 Drink Sessie is gestopt door ${currentUser.toUpperCase()}. Tracker uit.`);
            vakantieModus = false;
        }
    });
}

// FORCEER KNOP VOOR TESTEN
function forceerSessieAtje() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({
        volgende_atje: Date.now() - 1000 // Zet tijd direct in het verleden
    });
}

function luisterNaarDrinkSessie() {
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').onSnapshot(doc => {
        const btn = document.getElementById('btn-drink-sessie');
        const timerUI = document.getElementById('drink-sessie-timer-tekst');
        const btnSkip = document.getElementById('btn-skip-timer');
        if (!btn) return;
        
        if (doc.exists && doc.data().actief) {
            actieveDrinkSessieTijd = doc.data().volgende_atje;
            btn.innerHTML = "🛑 Stop Drink Sessie & GPS";
            btn.style.backgroundColor = "#ff3b30";
            timerUI.style.display = "block";
            btnSkip.style.display = "block"; // Toon forceer knop
            
            // Controleer of iemand ANDERS dit heeft aangezet, en fix de GPS direct!
            if (!vakantieModus && doc.data().starter !== currentUser) {
                alert(`🍻 DRINK SESSIE GESTART door ${doc.data().starter.toUpperCase()}! Jouw locatie wordt nu automatisch meegestuurd.`);
                if ("geolocation" in navigator) navigator.geolocation.getCurrentPosition(() => {}, () => {});
            }
            vakantieModus = true;
            
            if (!sessieCheckInterval) sessieCheckInterval = setInterval(checkDrinkSessieTijd, 5000);
        } else {
            actieveDrinkSessieTijd = 0;
            btn.innerHTML = "🍻 Start Drink Sessie!";
            btn.style.backgroundColor = "#ff9500";
            timerUI.style.display = "none";
            btnSkip.style.display = "none";
            vakantieModus = false; 
            
            if (sessieCheckInterval) {
                clearInterval(sessieCheckInterval);
                sessieCheckInterval = null;
            }
        }
    });
}

setInterval(() => {
    if (actieveDrinkSessieTijd > 0) {
        let diff = actieveDrinkSessieTijd - Date.now();
        const timerUI = document.getElementById('drink-sessie-timer-tekst');
        if (diff > 0) {
            let m = Math.floor(diff / 60000).toString().padStart(2, '0');
            let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            timerUI.innerText = `⏰ Volgende Atje over: ${m}:${s}`;
        } else {
            timerUI.innerText = "🚨 ALARM! SLACHTOFFER WORDT GEKOZEN...";
        }
    }
}, 1000);

function checkDrinkSessieTijd() {
    if (!actieveDrinkSessieTijd || Date.now() < actieveDrinkSessieTijd) return;
    
    actieveDrinkSessieTijd = Date.now() + 99999999; 
    
    let nieuweWachttijd = Math.floor(Math.random() * (15 * 60 * 1000)) + (5 * 60 * 1000);
    db.collection('groepen').doc(currentGroup).collection('sessie').doc('status').update({
        volgende_atje: Date.now() + nieuweWachttijd
    });
    
    if (spelersLijst.length === 0) return;
    let slachtoffer = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let bericht = `🚨 ALARM! De Drink Sessie heeft gekozen... ${slachtoffer.toUpperCase()} moet NU een atje trekken! 🍻`;
    
    stuurNaarFeed(bericht);
    if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 500, 100, 500]);
    
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/iydcsfjwnlx3147b29w38texvyhgrr62";
    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        snap.forEach(doc => {
            if (doc.data().push_token) {
                fetch(MAKE_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: doc.data().push_token, titel: "🍻 ATJE TREKKEN!", bericht: bericht })
                }).catch(e => console.log(e));
            }
        });
    });
}

// ==========================================
// SCOREBORD & PUNTEN SYSTEEM
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(bedrag) }, { merge: true });

    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) {
        db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(bedrag) });
    }

    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? `scoort +1 bij` : "deed een correctie bij"} ${emojiNaam}`;

    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
            stuurNaarFeed(`${startBericht}`);
        }, () => stuurNaarFeed(`${startBericht}`));
    } else {
        stuurNaarFeed(`${startBericht}`);
    }
}

function bouwLiveScorebord() {
    if(unsubscribeScores) unsubscribeScores();
    
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>🥃</th><th>😘</th><th>💔</th><th>🚀</th><th>🤮</th><th>🔑</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let somBier=0, somMix=0, somShot=0, somKiss=0, somReject=0, somRaggen=0, somKotsen=0, somSleutel=0, somAlles=0;
        let statMaxBier=0, statMaxBierNaam="-", statMaxRaggen=0, statMaxRaggenNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxKots=0, statMaxKotsNaam="-";
        let grafiekNamen = [], grafiekData = [];
        let katerHtml = "";
        spelersLijst = []; 

        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id;
            spelersLijst.push(naam);

            const b = data.bier || 0;
            const m = data.mix || 0;
            const sh = data.shotje || data.doner || 0;
            const k = data.kiss || 0;
            const r = data.rejection || 0;
            const ra = data.raggen || data.mvp || 0;
            const ko = data.kotsen || 0;
            const sl = data.sleutel || 0;
            
            const persoonTotaal = (b * 1) + (m * 2) + (sh * 2) + (k * 10) + (r * 5) + (ra * 15) + (ko * 5) + (sl * 5);
            
            somBier += b; somMix += m; somShot += sh; somKiss += k; somReject += r; somRaggen += ra; somKotsen += ko; somSleutel += sl; somAlles += persoonTotaal;

            if (naam === currentUser) { 
                mijnTotalePunten = persoonTotaal; 
                mijnGedraaideSpins = data.spins || 0; 
                updateCoinWeergave(); 
                beheerMissiesEnBingo(data);
            }

            if(b > statMaxBier) { statMaxBier = b; statMaxBierNaam = naam; }
            if(ra > statMaxRaggen) { statMaxRaggen = ra; statMaxRaggenNaam = naam; }
            if(r > statMaxSjaak) { statMaxSjaak = r; statMaxSjaakNaam = naam; }
            if(ko > statMaxKots) { statMaxKots = ko; statMaxKotsNaam = naam; }

            grafiekNamen.push(naam.charAt(0).toUpperCase() + naam.slice(1));
            grafiekData.push(b + m + sh);

            let katerKans = Math.max(0, Math.min(99, 5 + (b * 4) + (m * 12) + (sh * 15) + (ko * 30)));
            let kleur = katerKans >= 75 ? "#ff3b30" : katerKans >= 40 ? "#ff9500" : "#34c759";
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${naam}</span><span>${katerKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${katerKans}%; background-color: ${kleur};"></div></div></div>`;

            html += `<tr><td class="naam-kolom">${naam}</td><td>${b}</td><td>${m}</td><td>${sh}</td><td>${k}</td><td>${r}</td><td>${ra}</td><td>${ko}</td><td>${sl}</td><td class="totaal-kolom">${persoonTotaal}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${naam}')">X</button></td></tr>`;
        });

        html += `<tr class="totaal-rij"><td style="text-align:left; padding-left:10px;">Totaal</td><td>${somBier}</td><td>${somMix}</td><td>${somShot}</td><td>${somKiss}</td><td>${somReject}</td><td>${somRaggen}</td><td>${somKotsen}</td><td>${somSleutel}</td><td class="totaal-kolom">${somAlles}</td><td></td></tr>`;
        document.getElementById('score-tabel').innerHTML = html;
        document.getElementById('kater-container').innerHTML = katerHtml;

        document.getElementById('stats-container').innerHTML = `
            <div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div>
            <div class="stat-rij"><span>🚀 Meest Geragd</span> <span class="stat-naam">${statMaxRaggenNaam} (${statMaxRaggen})</span></div>
            <div class="stat-rij"><span>🤮 Meeste Kots</span> <span class="stat-naam">${statMaxKotsNaam} (${statMaxKots})</span></div>
            <div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>
        `;

        tekenGrafieken(somBier, somMix, somShot, somKiss, somReject, somRaggen, somKotsen, somSleutel, grafiekNamen, grafiekData);
    });
}

// ==========================================
// DE 4 NIEUWE GAMES LOGICA
// ==========================================

/* 1. WIE IS DE SJAAK */
const sjaakVragen = [
    "Wie kotst vanavond als eerste?", "Wie regelt er vannacht de minste actie?", 
    "Wie verliest er als eerste zijn telefoon of sleutels?", "Wie is morgen de grootste jankerd met een kater?", 
    "Wie betaalt zonder zeuren de volgende ronde?", "Wie doet de domste uitspraak vanavond?", 
    "Wie is de slechtste leugenaar van de groep?", "Wie durft er nu het minst een atje te trekken?"
];
let sjaakInterval = null;

function startSjaakVraag() {
    clearInterval(sjaakInterval);
    document.getElementById('sjaak-timer').innerText = "5";
    document.getElementById('sjaak-vraag').innerText = sjaakVragen[Math.floor(Math.random() * sjaakVragen.length)];
}

function startSjaakGame() {
    startSjaakVraag();
    let count = 5;
    const timerUI = document.getElementById('sjaak-timer');
    if ("vibrate" in navigator) navigator.vibrate(50);
    
    sjaakInterval = setInterval(() => {
        count--;
        timerUI.innerText = count;
        if(count <= 0) {
            clearInterval(sjaakInterval);
            timerUI.innerText = "👉 WIE IS HET?!";
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]);
        }
    }, 1000);
}

/* 2. HOGER OF LAGER */
let hlHuidig = 5;
function initHogerLager() {
    hlHuidig = Math.floor(Math.random() * 10) + 1;
    document.getElementById('hl-getal').innerText = hlHuidig;
}

function speelHogerLager(keuze) {
    let inzet = parseInt(document.getElementById('hl-inzet').value);
    let coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins);
    
    if (isNaN(inzet) || inzet < 1) return alert("Vul een geldige inzet in!");
    if (inzet > coins) return alert("Je hebt niet genoeg Coins!");

    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(inzet) }, { merge: true });

    let nieuw = Math.floor(Math.random() * 10) + 1;
    document.getElementById('hl-getal').innerText = nieuw;
    
    let win = false;
    if (keuze === 'hoger' && nieuw > hlHuidig) win = true;
    if (keuze === 'lager' && nieuw < hlHuidig) win = true;
    if (nieuw === hlHuidig) win = false; 

    if (win) {
        let winst = inzet * 2;
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(-winst) }, { merge: true });
        alert(`Je raadde het goed! Je wint ${winst} Coins terug! 🎉`);
        stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} won zojuist ${winst} Coins met Hoger/Lager!`);
    } else {
        let straf = Math.abs(nieuw - hlHuidig) || 1;
        alert(`FOUT! Het was ${nieuw}. Jij neemt nu ${straf} grote slokken! 🥃`);
        stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} verloor met Hoger/Lager en moet ${straf} slokken nemen!`);
    }
    hlHuidig = nieuw;
}

/* 3. REFLEX ROULETTE (MET LIVE LEADERBOARD) */
let huidigeReflexRonde = 0;
let reflexGroenTijd = 0;
let reflexGeklikt = false;
let reflexInterval = null;

function luisterNaarReflex() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc => {
        if (!doc.exists) return;
        let data = doc.data();
        let ronde = data.ronde || 0;
        let groen = data.groen_tijd || 0;
        let scores = data.scores || {};

        const btn = document.getElementById('reflex-btn');
        const lb = document.getElementById('reflex-leaderboard');

        // Check of dit een totaal nieuwe ronde is
        if (ronde !== huidigeReflexRonde) {
            huidigeReflexRonde = ronde;
            reflexGroenTijd = groen;
            reflexGeklikt = false;
            
            if(btn) {
                btn.style.backgroundColor = '#ff3b30'; // Rode kleur
                btn.innerText = 'Wacht...';
                btn.disabled = false;
            }
            
            // Loopje dat wacht tot het groen mag worden
            clearInterval(reflexInterval);
            reflexInterval = setInterval(() => {
                if (Date.now() >= reflexGroenTijd && btn && btn.style.backgroundColor !== 'rgb(52, 199, 89)' && !reflexGeklikt) {
                    btn.style.backgroundColor = '#34c759'; // Groene kleur
                    btn.innerText = 'KLIK NU!';
                }
            }, 50);
        }

        // Leaderboard tekenen
        if (Object.keys(scores).length > 0 && lb) {
            lb.style.display = 'block';
            let arr = [];
            for (let speler in scores) {
                arr.push({ naam: speler, tijd: scores[speler] });
            }
            
            // Sorteer: nummers eerst (laag naar hoog), "TE VROEG" als laatste
            arr.sort((a, b) => {
                if (a.tijd === 'TE VROEG') return 1;
                if (b.tijd === 'TE VROEG') return -1;
                return a.tijd - b.tijd;
            });
            
            let html = '<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard Deze Ronde</h3><ol style="padding-left: 20px; margin: 0; font-size:16px;">';
            arr.forEach((s, idx) => {
                let emoji = idx === 0 ? '🏆' : (s.tijd === 'TE VROEG' ? '❌' : '⏱️');
                let tijdWeergave = s.tijd === 'TE VROEG' ? '<span style="color:#ff3b30; font-weight:bold;">TE VROEG</span>' : `${s.tijd} ms`;
                html += `<li style="margin-bottom: 8px;">${emoji} <b>${s.naam.toUpperCase()}</b>: ${tijdWeergave}</li>`;
            });
            html += '</ol>';
            lb.innerHTML = html;
        } else if (lb) {
            lb.style.display = 'none';
        }
    });
}

function startReflexRonde() {
    let delay = Math.floor(Math.random() * 4000) + 2000;
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({
        ronde: Date.now(),
        groen_tijd: Date.now() + delay,
        scores: {}
    });
    stuurNaarFeed(`⚡ Reflex Roulette is GESTART door ${currentUser.toUpperCase()}! Open snel de game!`);
}

function klikReflex(e) {
    if (e) e.preventDefault(); // Voorkom dubbele kliks op mobiel
    if (reflexGeklikt || !huidigeReflexRonde) return;
    
    reflexGeklikt = true;
    let isTeVroeg = Date.now() < reflexGroenTijd;
    let tijdScore = isTeVroeg ? 'TE VROEG' : Date.now() - reflexGroenTijd;
    
    if (isTeVroeg) {
        stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG en neemt een atje!`);
        alert("TE VROEG! Straf Atje voor jou! 🥃");
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }

    const btn = document.getElementById('reflex-btn');
    if (btn) {
        btn.innerText = 'Geklikt!';
        btn.style.backgroundColor = '#8e8e93';
    }

    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({
        scores: { [currentUser]: tijdScore }
    }, { merge: true });
}

/* 4. VIRTUEEL MEXEN */
function gooiMexen() {
    let d1 = Math.floor(Math.random() * 6) + 1;
    let d2 = Math.floor(Math.random() * 6) + 1;
    let high = Math.max(d1, d2);
    let low = Math.min(d1, d2);
    let score = high.toString() + low.toString();
    
    document.getElementById('mex-d1').innerText = d1;
    document.getElementById('mex-d2').innerText = d2;
    
    let extraText = "";
    if (score === "21") {
        extraText = " 🚨 MEX! IEDEREEN DRINKEN!!";
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    } else if (d1 === d2) {
        extraText = " (Honderden!)";
    }

    stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooide ${score}${extraText}`);
}

// ==========================================
// DE REST (CO-OP, BINGO, RAD, BOM, STATS)
// ==========================================

function luisterNaarCoopMissie() {
    db.collection('groepen').doc(currentGroup).collection('coop').doc('status').onSnapshot(doc => {
        let vandaag = new Date().toISOString().split('T')[0];
        
        if (!doc.exists || doc.data().datum !== vandaag) {
            let randomMissie = coopMissies[Math.floor(Math.random() * coopMissies.length)];
            db.collection('groepen').doc(currentGroup).collection('coop').doc('status').set({
                datum: vandaag, score: 0, doel: randomMissie.doel, titel: randomMissie.titel, types: randomMissie.types, behaald: false
            });
            return;
        }

        actieveCoopMissie = doc.data();
        let percentage = Math.min(100, (actieveCoopMissie.score / actieveCoopMissie.doel) * 100);

        document.querySelectorAll('.coop-titel-text').forEach(el => el.innerText = actieveCoopMissie.titel);
        document.querySelectorAll('.coop-bar-fill').forEach(el => el.style.width = percentage + '%');
        document.querySelectorAll('.coop-progress-text').forEach(el => el.innerText = actieveCoopMissie.score + ' / ' + actieveCoopMissie.doel);

        if (actieveCoopMissie.score >= actieveCoopMissie.doel && !actieveCoopMissie.behaald) {
            db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ behaald: true });
            pasScoreAan('raggen', 5, '🏆 CO-OP BEHAALD');
            stuurNaarFeed("🎉 CO-OP MISSIE BEHAALD! Iedereen bedankt, +5 Punten voor de finale tik!");
        }
    });
}

function updateCoinWeergave() { 
    const coins = Math.max(0, mijnTotalePunten - mijnGedraaideSpins);
    document.querySelectorAll('.coin-weergave-class').forEach(el => el.innerText = coins);
}
function verwijderSpeler(naam) { if (confirm(`Verwijder ${naam}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(naam).delete(); }

function stuurNaarFeed(bericht) { db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').set({ bericht: bericht, tijd: firebase.firestore.FieldValue.serverTimestamp() }); }

function luisterNaarLiveFeed() {
    if(unsubscribeFeed) unsubscribeFeed();
    let laatsteMelding = "";
    unsubscribeFeed = db.collection('groepen').doc(currentGroup).collection('feed').doc('laatste').onSnapshot((doc) => {
        if (!doc.exists || doc.data().bericht === laatsteMelding) return;
        laatsteMelding = doc.data().bericht;
        const ticker = document.getElementById('live-ticker');
        ticker.innerText = laatsteMelding; ticker.style.display = 'block';
        if ("vibrate" in navigator) navigator.vibrate([200,100,200]);
        const geluid = document.getElementById('notificatie-geluid');
        if (geluid) { geluid.currentTime = 0; geluid.play().catch(e => {}); }
        setTimeout(() => { ticker.style.display = 'none'; }, 5000);
    });
}

function tekenGrafieken(b, m, sh, k, r, ra, ko, sl, namen, drankjes) {
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(document.getElementById('groepPieChart'), { type: 'pie', data: { labels: ['Bier','Mix','Shotje','Kiss','Reject','Raggen', 'Kotsen', 'Sleutel'], datasets: [{ data: [b,m,sh,k,r,ra,ko,sl], backgroundColor: ['#f1c40f','#9b59b6','#e17055','#ff7675','#636e72','#ffeaa7','#16a085','#bdc3c7'] }] }, options: { responsive: true, maintainAspectRatio: false } });
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart(document.getElementById('spelerBarChart'), { type: 'bar', data: { labels: namen, datasets: [{ label: 'Drankjes', data: drankjes, backgroundColor: '#007aff' }] }, options: { responsive: true, maintainAspectRatio: false } });
}

function initKaart() {
    if (!worldMap) {
        worldMap = L.map('map').setView([45.0, 5.0], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(worldMap);
        db.collection('groepen').doc(currentGroup).collection('locaties').onSnapshot(snap => {
            mapMarkers.forEach(m => worldMap.removeLayer(m)); mapMarkers = []; const groepen = {};
            snap.forEach(doc => {
                const data = doc.data(); if(data.lat && data.lng) {
                    const s = `${data.naam}_${data.lat.toFixed(4)}_${data.lng.toFixed(4)}`;
                    if (!groepen[s]) groepen[s] = { naam: data.naam, lat: data.lat, lng: data.lng, acties: {} };
                    groepen[s].acties[data.actie] = (groepen[s].acties[data.actie] || 0) + 1;
                }
            });
            Object.values(groepen).forEach(g => {
                let pc = `<b>${g.naam}</b><br>`, ta = 0, he = "🍺";
                Object.entries(g.acties).forEach(([a, n]) => { pc += `${a}: ${n}x<br>`; ta += n; he = a.split(' ')[0]; });
                const icon = L.divIcon({ html: `<div class="custom-maps-marker-wrapper" style="width:52px;height:52px;"><span style="font-size:34px;">${he}</span><span style="position:absolute;top:-6px;right:-6px;background:#ff3b30;color:white;font-size:13px;font-weight:900;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border:2px solid white;">${ta}</span></div>`, className: '', iconSize: [52,52], iconAnchor: [26,26] });
                const marker = L.marker([g.lat, g.lng], { icon: icon }).bindPopup(pc);
                marker.addTo(worldMap); mapMarkers.push(marker);
            });
        });
    } else worldMap.invalidateSize();
}