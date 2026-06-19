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

if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js'); }

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
// GAME DATA (CO-OP, BINGO & ASSASSIN)
// ==========================================
const coopMissies = [
    { titel: "Drink 100 Pils met de groep", doel: 100, types: ['bier'] },
    { titel: "Verzamel samen 30 Kiss acties", doel: 30, types: ['kiss'] },
    { titel: "Deel 50 Shotjes/Mixjes uit", doel: 50, types: ['mix'] },
    { titel: "Incasseer 20 Rejects", doel: 20, types: ['rejection'] },
    { titel: "Kroon 15 MVP's", doel: 15, types: ['mvp'] },
    { titel: "Eet 10 Broodjes Döner", doel: 10, types: ['doner'] },
    { titel: "150 Drankjes Totaal", doel: 150, types: ['bier', 'mix'] }
];

let actieveCoopMissie = null;

const bingoOpdrachten = [
    "Neem een shot met de barman", "Regel gratis pils", "Zeg 10 min helemaal niks", 
    "Wijs iemand af", "Trek een Atje", "Eet Döner na 03:00", 
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

// iOS Audio bypass
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
        bier: 0, mix: 0, kiss: 0, rejection: 0, mvp: 0, doner: 0, spins: 0
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

    bouwLiveScorebord();
    luisterNaarLiveFeed();
    luisterNaarTijdbom();
    luisterNaarCoopMissie();
}

// ==========================================
// CO-OP MISSIE (DAGELIJKSE RESET)
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
            pasScoreAan('mvp', 5, '🏆 CO-OP BEHAALD');
            stuurNaarFeed("🎉 CO-OP MISSIE BEHAALD! Iedereen bedankt, +5 MVP Coins voor de finale tik!");
        }
    });
}

// Timer tot middernacht
setInterval(() => {
    const nu = new Date();
    const middernacht = new Date();
    middernacht.setHours(24, 0, 0, 0);
    let diff = middernacht - nu;
    let h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    let m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    let s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    document.querySelectorAll('.coop-timer-text').forEach(el => el.innerText = `Nog ${h}:${m}:${s} geldig vandaag`);
}, 1000);

// ==========================================
// SCOREBORD & DATA SYNC
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    const isHappyHour = new Date().getHours() === 23;
    const actueelBedrag = (isHappyHour && bedrag > 0) ? bedrag * 2 : bedrag;
    
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(actueelBedrag) }, { merge: true });

    // Update Co-op Missie als het type overeenkomt
    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) {
        db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(actueelBedrag) });
    }

    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? `scoort +${actueelBedrag} bij` : "deed een correctie bij"} ${emojiNaam}${isHappyHour && bedrag > 0 ? " (HAPPY HOUR x2!)" : ""}`;

    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
            stuurNaarFeed(`${startBericht} 📍 Maps: http://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
        }, () => stuurNaarFeed(`${startBericht}!`));
    } else stuurNaarFeed(`${startBericht}!`);
}

function bouwLiveScorebord() {
    if(unsubscribeScores) unsubscribeScores();
    
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        let html = `<tr><th style="text-align:left; padding-left:10px;">Wie</th><th>🍺</th><th>🍹</th><th>😘</th><th>💔</th><th>👑</th><th>🥙</th><th class="totaal-kolom">Tot</th><th></th></tr>`;
        let somBier=0, somMix=0, somKiss=0, somReject=0, somMvp=0, somDoner=0, somAlles=0;
        let statMaxBier=0, statMaxBierNaam="-", statMaxMVP=0, statMaxMVPNaam="-", statMaxSjaak=0, statMaxSjaakNaam="-", statMaxDoner=0, statMaxDonerNaam="-";
        let grafiekNamen = [], grafiekBierEnMix = [];
        let katerHtml = "";
        spelersLijst = []; 

        snapshot.forEach((doc) => {
            const data = doc.data(); const naam = doc.id;
            spelersLijst.push(naam);

            const b = data.bier || 0; const m = data.mix || 0; const k = data.kiss || 0;
            const r = data.rejection || 0; const mv = data.mvp || 0; const d = data.doner || 0;
            const persoonTotaal = b + m + k + r + mv + d;
            somBier += b; somMix += m; somKiss += k; somReject += r; somMvp += mv; somDoner += d; somAlles += persoonTotaal;

            if (naam === currentUser) { 
                mijnTotalePunten = persoonTotaal; 
                mijnGedraaideSpins = data.spins || 0; 
                updateCoinWeergave(); 
                beheerMissiesEnBingo(data);
            }

            if(b > statMaxBier) { statMaxBier = b; statMaxBierNaam = naam; }
            if(mv > statMaxMVP) { statMaxMVP = mv; statMaxMVPNaam = naam; }
            if(r > statMaxSjaak) { statMaxSjaak = r; statMaxSjaakNaam = naam; }
            if(d > statMaxDoner) { statMaxDoner = d; statMaxDonerNaam = naam; }

            grafiekNamen.push(naam.charAt(0).toUpperCase() + naam.slice(1));
            grafiekBierEnMix.push(b + m);

            let katerKans = Math.max(0, Math.min(99, 5 + (b * 4) + (m * 12) - (d * 15)));
            let kleur = katerKans >= 75 ? "#ff3b30" : katerKans >= 40 ? "#ff9500" : "#34c759";
            katerHtml += `<div class="kater-regel"><div class="kater-header"><span>${naam}</span><span>${katerKans}%</span></div><div class="kater-bar-bg"><div class="kater-bar-fill" style="width: ${katerKans}%; background-color: ${kleur};"></div></div></div>`;

            html += `<tr><td class="naam-kolom" style="padding-left:10px;">${naam}</td><td>${b}</td><td>${m}</td><td>${k}</td><td>${r}</td><td>${mv}</td><td>${d}</td><td class="totaal-kolom">${persoonTotaal}</td><td><button class="btn-verwijder" onclick="verwijderSpeler('${naam}')">X</button></td></tr>`;
        });

        html += `<tr class="totaal-rij"><td style="text-align:left; padding-left:10px;">Totaal</td><td>${somBier}</td><td>${somMix}</td><td>${somKiss}</td><td>${somReject}</td><td>${somMvp}</td><td>${somDoner}</td><td class="totaal-kolom">${somAlles}</td><td></td></tr>`;
        document.getElementById('score-tabel').innerHTML = html;
        document.getElementById('kater-container').innerHTML = katerHtml;

        document.getElementById('stats-container').innerHTML = `
            <div class="stat-rij"><span>🍺 Koning Pils</span> <span class="stat-naam">${statMaxBierNaam} (${statMaxBier})</span></div>
            <div class="stat-rij"><span>👑 Meeste MVP</span> <span class="stat-naam">${statMaxMVPNaam} (${statMaxMVP})</span></div>
            <div class="stat-rij"><span>💔 Grootste Sjaak</span> <span class="stat-naam">${statMaxSjaakNaam} (${statMaxSjaak})</span></div>
            <div class="stat-rij"><span>🥙 Döner Baas</span> <span class="stat-naam">${statMaxDonerNaam} (${statMaxDoner})</span></div>
        `;

        tekenGrafieken(somBier, somMix, somKiss, somReject, somMvp, somDoner, grafiekNamen, grafiekBierEnMix);
    });
}

// ==========================================
// MISSIES & BINGO LOGICA
// ==========================================
function beheerMissiesEnBingo(data) {
    if (!data.geheime_missie) db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true });
    else { const mt = document.getElementById('geheime-missie-tekst'); if(mt) mt.innerText = data.geheime_missie; }

    if (!data.bingo_kaart) {
        let nieuweKaart = genereerBingoKaart();
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_kaart: nieuweKaart, bingo_status: [false,false,false,false,false,false,false,false,false], bingo_gehaald: false }, { merge: true });
    } else {
        mijnBingoKaart = data.bingo_kaart;
        mijnBingoStatus = data.bingo_status || [false,false,false,false,false,false,false,false,false];
        renderBingoGrid(data.bingo_gehaald);
    }
}

function voltooiGeheimeMissie() {
    if (confirm("Echt uitgevoerd? Bij liegen moet je adten!")) {
        pasScoreAan('mvp', 3, '🥷 Geheime Missie');
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ geheime_missie: genereerNieuweMissie() }, { merge: true });
        alert("+3 MVP Coins verdiend!");
    }
}

function renderBingoGrid(isGehaald) {
    const grid = document.getElementById('bingo-grid');
    if(!grid) return;
    grid.innerHTML = "";
    
    mijnBingoKaart.forEach((taak, index) => {
        let div = document.createElement('div');
        div.className = "bingo-cel " + (mijnBingoStatus[index] ? "voltooid" : "");
        div.innerText = taak;
        div.onclick = () => toggleBingoCel(index, isGehaald);
        grid.appendChild(div);
    });
}

function toggleBingoCel(index, isGehaald) {
    if (isGehaald) return alert("Je hebt al Bingo!");
    mijnBingoStatus[index] = !mijnBingoStatus[index];
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_status: mijnBingoStatus }, { merge: true });
    
    const winLijnen = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let bingo = winLijnen.some(lijn => lijn.every(i => mijnBingoStatus[i]));
    
    if (bingo) {
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ bingo_gehaald: true }, { merge: true });
        pasScoreAan('mvp', 10, '🌴 BINGO');
        alert("BINGO! 10 MVP Coins voor jou!");
    }
}

// ==========================================
// SWASI FINGER ROULETTE (FIXED & GEÜPDATET)
// ==========================================
const swasiOverlay = document.getElementById('swasi-overlay');
let actieveSwasiTouches = {};
let swasiKleuren = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#f1c40f', '#00c7be'];
let swasiKleurIndex = 0;
let swasiTimer = null;
let swasiAfteller = null;
let swasiBezig = false;

function startSwasi() {
    swasiOverlay.style.display = 'block';
    document.getElementById('swasi-instructie').style.display = 'block';
    document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger op het scherm...";
    document.getElementById('swasi-countdown').style.display = 'none';
    document.getElementById('swasi-sluit-btn').style.display = 'none';
    
    actieveSwasiTouches = {};
    swasiKleurIndex = 0;
    swasiBezig = true;
    document.body.style.overflow = 'hidden'; // Voorkom scrollen
    
    swasiOverlay.addEventListener('touchstart', handleTouchStart, {passive: false});
    swasiOverlay.addEventListener('touchmove', handleTouchMove, {passive: false});
    swasiOverlay.addEventListener('touchend', handleTouchEnd);
    swasiOverlay.addEventListener('touchcancel', handleTouchEnd);
}

function stopSwasi() {
    swasiOverlay.style.display = 'none';
    document.body.style.overflow = '';
    clearTimeout(swasiTimer);
    clearInterval(swasiAfteller);
    swasiBezig = false;
    
    // Verwijder alle circels
    Object.values(actieveSwasiTouches).forEach(c => c.remove());
    actieveSwasiTouches = {};
    
    swasiOverlay.removeEventListener('touchstart', handleTouchStart);
    swasiOverlay.removeEventListener('touchmove', handleTouchMove);
    swasiOverlay.removeEventListener('touchend', handleTouchEnd);
    swasiOverlay.removeEventListener('touchcancel', handleTouchEnd);
}

function handleTouchStart(e) {
    // Laat de "Sluiten" button gewoon z'n click afvuren zonder e.preventDefault()
    if (e.target.id === 'swasi-sluit-btn') return;
    
    e.preventDefault();
    if (!swasiBezig) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        let color = swasiKleuren[swasiKleurIndex % swasiKleuren.length];
        swasiKleurIndex++;
        
        let circle = document.createElement('div');
        circle.className = 'swasi-circle';
        circle.style.borderColor = color;
        circle.style.left = t.clientX + 'px';
        circle.style.top = t.clientY + 'px';
        
        swasiOverlay.appendChild(circle);
        actieveSwasiTouches[t.identifier] = circle;
    }
    checkSwasiTimer();
}

function handleTouchMove(e) {
    if (e.target.id === 'swasi-sluit-btn') return;
    e.preventDefault();
    if (!swasiBezig) return;
    
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i];
        let circle = actieveSwasiTouches[t.identifier];
        if (circle) {
            circle.style.left = t.clientX + 'px';
            circle.style.top = t.clientY + 'px';
        }
    }
}

function handleTouchEnd(e) {
    if (!swasiBezig) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let id = e.changedTouches[i].identifier;
        let circle = actieveSwasiTouches[id];
        if (circle) {
            circle.remove();
            delete actieveSwasiTouches[id];
        }
    }
    checkSwasiTimer();
}

function checkSwasiTimer() {
    clearTimeout(swasiTimer);
    clearInterval(swasiAfteller);
    document.getElementById('swasi-countdown').style.display = 'none';
    
    let keys = Object.keys(actieveSwasiTouches);
    
    if (keys.length > 1) {
        document.getElementById('swasi-instructie').style.display = 'none';
        document.getElementById('swasi-countdown').style.display = 'block';
        
        let count = 3;
        document.getElementById('swasi-countdown').innerText = count;
        
        swasiAfteller = setInterval(() => {
            count--;
            if (count > 0) {
                document.getElementById('swasi-countdown').innerText = count;
            } else {
                clearInterval(swasiAfteller);
                document.getElementById('swasi-countdown').style.display = 'none';
                kiesSwasiWinnaar(keys);
            }
        }, 1000);
        
    } else if (keys.length === 1) {
        document.getElementById('swasi-instructie').style.display = 'block';
        document.getElementById('swasi-instructie').innerText = "Wacht op meer vingers...";
    } else {
        document.getElementById('swasi-instructie').style.display = 'block';
        document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger...";
        swasiKleurIndex = 0; // Reset colors if everyone let go
    }
}

function kiesSwasiWinnaar(keys) {
    swasiBezig = false; // Blokkeer nieuwe touches
    if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]);
    
    let winnerId = keys[Math.floor(Math.random() * keys.length)];
    
    keys.forEach(id => {
        let circle = actieveSwasiTouches[id];
        if (id == winnerId) {
            circle.classList.add('winner');
        } else {
            circle.classList.add('loser');
        }
    });

    document.getElementById('swasi-sluit-btn').style.display = 'block';
}

// ==========================================
// TIJDBOM
// ==========================================
function startTijdbom() {
    if (spelersLijst.length < 2) return alert("Minimaal 2 spelers nodig.");
    let randomSpeler = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let ontplofTijd = Date.now() + (Math.floor(Math.random() * 45000) + 30000); // 30-75 seconden
    
    db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: true, houder: randomSpeler, eindTijdUnix: ontplofTijd });
    stuurNaarFeed(`💣 TIJDBOM GESTART! Hij ligt nu bij ${randomSpeler.toUpperCase()}!`);
}

function gooiBomDoor() {
    let andereSpelers = spelersLijst.filter(n => n !== currentUser);
    let slachtoffer = andereSpelers[Math.floor(Math.random() * andereSpelers.length)];
    if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ houder: slachtoffer }, { merge: true });
}

function luisterNaarTijdbom() {
    if(unsubscribeBom) unsubscribeBom();
    
    unsubscribeBom = db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot((doc) => {
        if (!doc.exists) return;
        const data = doc.data();
        const card = document.getElementById('bom-card'), statusTekst = document.getElementById('bom-status-tekst'), btnGooi = document.getElementById('btn-gooi-door');
        
        if (data.actief) {
            document.getElementById('bom-idle-ui').style.display = 'none';
            document.getElementById('bom-active-ui').style.display = 'block';
            statusTekst.innerText = `Bom is bij ${data.houder.toUpperCase()}!`;
            
            if (data.houder === currentUser) {
                card.classList.add('bom-gevaar');
                btnGooi.style.display = 'inline-block';
                if (Date.now() >= data.eindTijdUnix) {
                    db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false });
                    pasScoreAan('mvp', -3, '💥 BOM ONTPLOFT');
                    alert("KABOEM! -3 Coins!");
                }
            } else {
                card.classList.remove('bom-gevaar');
                btnGooi.style.display = 'none';
            }
        } else {
            document.getElementById('bom-idle-ui').style.display = 'block';
            document.getElementById('bom-active-ui').style.display = 'none';
            card.classList.remove('bom-gevaar');
        }
    });

    setInterval(() => {
        db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(doc => {
            if (doc.exists && doc.data().actief && doc.data().houder === currentUser && Date.now() >= doc.data().eindTijdUnix) {
                db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false });
                pasScoreAan('mvp', -3, '💥 BOM ONTPLOFT');
                alert("KABOEM! -3 Coins!");
            }
        });
    }, 1000);
}

// ==========================================
// RAD VAN FORTUIN, KAART & CHARTS
// ==========================================
function draaiRad() {
    if (isSpinning) return;
    if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("Je hebt 0 coins!");
    isSpinning = true;
    if ("vibrate" in navigator) navigator.vibrate(50);

    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    let draaiCounter = 0;

    const interval = setInterval(() => {
        document.getElementById('rad-uitkomst').innerText = haalRandomOptie();
        document.getElementById('rad-box').style.background = (draaiCounter % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)";
        if (++draaiCounter > 20) {
            clearInterval(interval);
            const eind = haalRandomOptie();
            document.getElementById('rad-uitkomst').innerText = eind;
            document.getElementById('rad-box').style.background = "linear-gradient(135deg, #007aff, #0056b3)";
            stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${eind}"`);
            isSpinning = false;
        }
    }, 100);
}

function haalRandomOptie() {
    const basisRadOpties = ["🍻 Atje voor de sfeer!", "🥃 Neem een shotje!", "👉 Deel 2 slokken uit aan [SPELER]", "🎯 [SPELER] moet adten!", "💧 Drink water (Laf)", "🔄 Wissel drankje met [SPELER]", "👑 MVP punt!", "🍻 IEDEREEN ADTEN!"];
    let optie = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)];
    if (optie.includes("[SPELER]")) optie = optie.replace("[SPELER]", spelersLijst.filter(n=>n!==currentUser)[Math.floor(Math.random()*(spelersLijst.length-1))] || "iemand");
    return optie;
}

function updateCoinWeergave() { document.getElementById('coin-weergave').innerText = Math.max(0, mijnTotalePunten - mijnGedraaideSpins); }
function verwijderSpeler(naam) { if (confirm(`Verwijder ${naam}?`)) db.collection('groepen').doc(currentGroup).collection('scores').doc(naam).delete(); }

function stuurBierAlarm() { if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); stuurNaarFeed(`⚠️ RONDJE BIER VOOR IEDEREEN DOOR ${currentUser.toUpperCase()}!`); }
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

function tekenGrafieken(b, m, k, r, mv, d, namen, drankjes) {
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart(document.getElementById('groepPieChart'), { type: 'pie', data: { labels: ['Bier','Mix','Kiss','Reject','MVP','Döner'], datasets: [{ data: [b,m,k,r,mv,d], backgroundColor: ['#f1c40f','#9b59b6','#ff7675','#636e72','#ffeaa7','#e17055'] }] }, options: { responsive: true, maintainAspectRatio: false } });
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