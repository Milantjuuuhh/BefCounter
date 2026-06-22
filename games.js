// ==========================================
// GAME LOBBY SYSTEEM (ALGEMENE FUNCTIES)
// ==========================================
function startLobby(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).set({ fase: 'lobby', host: currentUser, spelers: [currentUser], actief: false, klaar: false });
}

function joinGame(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).update({ spelers: firebase.firestore.FieldValue.arrayUnion(currentUser) });
}

function verlaatGame(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).get().then(doc => {
        if(doc.exists) {
            if(doc.data().host === currentUser) { 
                db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).update({fase: 'wachten', spelers: []}); 
            } else { 
                db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).update({ spelers: firebase.firestore.FieldValue.arrayRemove(currentUser) }); 
            }
        }
    });
}

function luisterNaarGameLobby(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).onSnapshot(doc => {
        let d = doc.exists ? doc.data() : {fase: 'wachten'};
        let spelers = d.spelers || [];
        
        let wachtEl = document.getElementById(`${gameNaam}-wachten`);
        let lobbyEl = document.getElementById(`${gameNaam}-lobby`);
        let lijstEl = document.getElementById(`${gameNaam}-spelers-lijst`);
        let joinBtn = document.getElementById(`btn-${gameNaam}-join`);
        let startBtn = document.getElementById(`btn-${gameNaam}-start`);
        
        if (d.fase === 'wachten' || !doc.exists) {
            if(wachtEl) wachtEl.style.display = 'block';
            if(lobbyEl) lobbyEl.style.display = 'none';
        } else if (d.fase === 'lobby') {
            if(wachtEl) wachtEl.style.display = 'none';
            if(lobbyEl) lobbyEl.style.display = 'block';
            if(lijstEl) lijstEl.innerHTML = spelers.map(s => `<span class="lobby-speler-badge">${s}</span>`).join('');
            if(joinBtn) joinBtn.style.display = spelers.includes(currentUser) ? 'none' : 'inline-block';
            if(startBtn) startBtn.style.display = (d.host === currentUser && spelers.length > 1) ? 'inline-block' : 'none';
        } else {
            if(wachtEl) wachtEl.style.display = 'none';
            if(lobbyEl) lobbyEl.style.display = 'none';
        }
    });
}

function resetGameLobby(gameNaam) {
    db.collection('groepen').doc(currentGroup).collection('games').doc(gameNaam).set({ fase: 'wachten', host: "", spelers: [], actief: false, klaar: false });
}

// ==========================================
// SWASI
// ==========================================
let actieveSwasiTouches = {}, swasiKleuren = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#f1c40f', '#00c7be'], swasiKleurIndex = 0, swasiTimer = null, swasiAfteller = null, swasiBezig = false;
function startSwasi() { let swasiOverlay = document.getElementById('swasi-overlay'); swasiOverlay.style.display = 'block'; document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger op het scherm..."; document.getElementById('swasi-countdown').style.display = 'none'; document.getElementById('swasi-sluit-btn').style.display = 'none'; actieveSwasiTouches = {}; swasiKleurIndex = 0; swasiBezig = true; document.body.classList.add('modal-open'); swasiOverlay.addEventListener('touchstart', handleTouchStart, {passive: false}); swasiOverlay.addEventListener('touchmove', handleTouchMove, {passive: false}); swasiOverlay.addEventListener('touchend', handleTouchEnd); swasiOverlay.addEventListener('touchcancel', handleTouchEnd); }
function stopSwasi() { let swasiOverlay = document.getElementById('swasi-overlay'); swasiOverlay.style.display = 'none'; document.body.classList.remove('modal-open'); clearTimeout(swasiTimer); clearInterval(swasiAfteller); swasiBezig = false; Object.values(actieveSwasiTouches).forEach(c => c.remove()); actieveSwasiTouches = {}; swasiOverlay.removeEventListener('touchstart', handleTouchStart); swasiOverlay.removeEventListener('touchmove', handleTouchMove); swasiOverlay.removeEventListener('touchend', handleTouchEnd); swasiOverlay.removeEventListener('touchcancel', handleTouchEnd); }
function handleTouchStart(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let color = swasiKleuren[swasiKleurIndex % swasiKleuren.length]; swasiKleurIndex++; let circle = document.createElement('div'); circle.className = 'swasi-circle'; circle.style.borderColor = color; circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px'; document.getElementById('swasi-overlay').appendChild(circle); actieveSwasiTouches[t.identifier] = circle; } checkSwasiTimer(); }
function handleTouchMove(e) { if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let t = e.changedTouches[i]; let circle = actieveSwasiTouches[t.identifier]; if (circle) { circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px'; } } }
function handleTouchEnd(e) { if (!swasiBezig) return; for (let i = 0; i < e.changedTouches.length; i++) { let id = e.changedTouches[i].identifier; let circle = actieveSwasiTouches[id]; if (circle) { circle.remove(); delete actieveSwasiTouches[id]; } } checkSwasiTimer(); }
function checkSwasiTimer() { clearTimeout(swasiTimer); clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; let keys = Object.keys(actieveSwasiTouches); if (keys.length > 1) { document.getElementById('swasi-instructie').style.display = 'none'; document.getElementById('swasi-countdown').style.display = 'block'; let count = 3; document.getElementById('swasi-countdown').innerText = count; swasiAfteller = setInterval(() => { count--; if (count > 0) { document.getElementById('swasi-countdown').innerText = count; } else { clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; kiesSwasiWinnaar(keys); } }, 1000); } else if (keys.length === 1) { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Wacht op meer vingers..."; } else { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger..."; swasiKleurIndex = 0; } }
function kiesSwasiWinnaar(keys) { swasiBezig = false; if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]); let winnerId = keys[Math.floor(Math.random() * keys.length)]; keys.forEach(id => { let circle = actieveSwasiTouches[id]; if (id == winnerId) { circle.classList.add('winner'); } else { circle.classList.add('loser'); } }); document.getElementById('swasi-sluit-btn').style.display = 'block'; }

// ==========================================
// TIJDBOM
// ==========================================
function startTijdbom() { if (spelersLijst.length < 2) return alert("Minimaal 2 spelers nodig."); let randomSpeler = spelersLijst[Math.floor(Math.random() * spelersLijst.length)]; let ontplofTijd = Date.now() + (Math.floor(Math.random() * 45000) + 30000); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: true, houder: randomSpeler, eindTijdUnix: ontplofTijd }); stuurNaarFeed(`💣 TIJDBOM GESTART! Hij ligt nu bij ${randomSpeler.toUpperCase()}!`); }
function gooiBomDoor() { let andereSpelers = spelersLijst.filter(n => n !== currentUser); let slachtoffer = andereSpelers[Math.floor(Math.random() * andereSpelers.length)]; if ("vibrate" in navigator) navigator.vibrate(50); db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ houder: slachtoffer }, { merge: true }); }
function luisterNaarTijdbom() {
    if(unsubscribeBom) unsubscribeBom();
    unsubscribeBom = db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').onSnapshot((doc) => {
        if (!doc.exists) return; const data = doc.data(); 
        const statusTekst = document.getElementById('bom-status-tekst'); 
        const btnGooi = document.getElementById('btn-gooi-door');
        const modal = document.getElementById('modal-bom');

        if (data.actief) {
            document.getElementById('bom-idle-ui').style.display = 'none'; 
            document.getElementById('bom-active-ui').style.display = 'block'; 
            statusTekst.innerText = `Bom is bij ${data.houder.toUpperCase()}!`;
            
            if (data.houder === currentUser) { 
                if(modal) modal.style.backgroundColor = '#ff3b30'; 
                if(btnGooi) btnGooi.style.display = 'inline-block'; 
                if (Date.now() >= data.eindTijdUnix) { 
                    db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); 
                    pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); 
                } 
            } else { 
                if(modal) modal.style.backgroundColor = '#050505'; 
                if(btnGooi) btnGooi.style.display = 'none'; 
            }
        } else { 
            document.getElementById('bom-idle-ui').style.display = 'block'; 
            document.getElementById('bom-active-ui').style.display = 'none'; 
            if(modal) modal.style.backgroundColor = '#050505'; 
        }
    });
    setInterval(() => { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(doc => { if (doc.exists && doc.data().actief && doc.data().houder === currentUser && Date.now() >= doc.data().eindTijdUnix) { db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!"); } }); }, 1000);
}

// ==========================================
// RAD VAN FORTUIN
// ==========================================
let radSpinning = false;
function draaiRad() {
    if (radSpinning) return; if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("Je hebt 0 coins!");
    radSpinning = true; if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    
    let draaiCounter = 0; const box = document.getElementById('rad-box');
    const interval = setInterval(() => {
        const basisRadOpties = ["🍻 Atje!", "🥃 Shotje!", "👉 Deel 2 slokken uit", "🎯 [SPELER] adt!", "💧 Drink water (Laf)", "🔄 Wissel drankje", "🚀 Raggen punt!", "🍻 IEDEREEN ADTEN!"];
        let temp = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)]; document.getElementById('rad-uitkomst').innerText = temp.replace("[SPELER]","iemand"); 
        
        box.style.background = (draaiCounter % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)";
        
        if (++draaiCounter > 20) { 
            clearInterval(interval); let andereSpelers = spelersLijst.filter(n=>n!==currentUser); let slachtoffer = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random()*andereSpelers.length)] : "iemand"; let eind = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)].replace("[SPELER]", slachtoffer); 
            document.getElementById('rad-uitkomst').innerText = eind; 
            box.style.background = "linear-gradient(135deg, #007aff, #0056b3)"; 
            stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${eind}"`); radSpinning = false; 
        }
    }, 100);
}

// ==========================================
// HOGER LAGER
// ==========================================
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

// ==========================================
// MEXEN
// ==========================================
function gooiMexen() { let d1 = Math.floor(Math.random() * 6) + 1; let d2 = Math.floor(Math.random() * 6) + 1; document.getElementById('mex-d1').innerText = d1; document.getElementById('mex-d2').innerText = d2; let score = Math.max(d1, d2).toString() + Math.min(d1, d2).toString(); let extraText = ""; if (score === "21") { extraText = " 🚨 MEX! IEDEREEN DRINKEN!!"; if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } else if (d1 === d2) { extraText = " (Honderden!)"; } stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooide ${score}${extraText}`); }


// ==========================================
// WIE IS DE SJAAK LOGICA (FULLSCREEN)
// ==========================================
const sjaakVragen = [
    "Wie kotst vanavond als eerste?", "Wie regelt er vannacht de minste actie?", "Wie verliest er als eerste zijn telefoon of sleutels?", "Wie is morgen de grootste jankerd met een kater?", 
    "Wie betaalt zonder zeuren de volgende ronde?", "Wie doet de domste uitspraak vanavond?", "Wie is de slechtste leugenaar van de groep?", "Wie durft er nu het minst een atje te trekken?"
];

function startSjaakRonde() {
    let vr = sjaakVragen[Math.floor(Math.random() * sjaakVragen.length)];
    db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ fase: 'actief', vraag: vr, stemmen: {} });
    stuurNaarFeed(`👉 WIE IS DE SJAAK gestart door ${currentUser.toUpperCase()}!`);
}

function luisterNaarSjaak() {
    luisterNaarGameLobby('sjaak');
    db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').onSnapshot(doc => {
        if(!doc.exists) return; let d = doc.data(); let spelers = d.spelers || [];
        let uiActief = document.getElementById('sjaak-actief'); let uiResultaat = document.getElementById('sjaak-resultaat');
        if(!uiActief) return;
        
        if (d.fase === 'wachten' || d.fase === 'lobby') {
            uiActief.style.display = 'none'; uiResultaat.style.display = 'none';
        } else if (d.fase === 'actief') {
            uiActief.style.display = 'block'; uiResultaat.style.display = 'none';
            document.getElementById('sjaak-vraag-tekst').innerText = d.vraag;
            document.getElementById('sjaak-status').innerText = `${Object.keys(d.stemmen || {}).length} van de ${spelers.length} stemmen binnen.`;
            document.getElementById('btn-sjaak-forceer').style.display = (d.host === currentUser) ? 'inline-block' : 'none';
            
            let knoppenBox = document.getElementById('sjaak-stem-knoppen');
            knoppenBox.innerHTML = '';
            
            if (!spelers.includes(currentUser) || (d.stemmen && d.stemmen[currentUser])) {
                knoppenBox.innerHTML = `<h2 style="color:#34c759;">✅ Stem ontvangen!</h2>`;
            } else {
                spelers.forEach((s, idx) => {
                    let btn = document.createElement('button');
                    btn.className = 'ql-btn-stem'; btn.style.animationDelay = (0.1 * idx) + "s";
                    btn.innerText = `👉 ${s.toUpperCase()}`;
                    btn.onclick = () => { db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ [`stemmen.${currentUser}`]: s }); };
                    knoppenBox.appendChild(btn);
                });
            }
            if(Object.keys(d.stemmen || {}).length === spelers.length && spelers.length > 0 && d.host === currentUser) { eindigeSjaakRonde(); }
        } else if (d.fase === 'resultaat') {
            uiActief.style.display = 'none'; uiResultaat.style.display = 'block';
            document.getElementById('sjaak-resultaat-vraag').innerText = d.vraag;
            document.getElementById('btn-sjaak-volgende').style.display = (d.host === currentUser) ? 'inline-block' : 'none';

            let scores = {}; Object.values(d.stemmen || {}).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; });
            let resLijst = document.getElementById('sjaak-uitslag-lijst'); resLijst.innerHTML = '';
            let resArr = Object.entries(scores).map(([naam, stemmen]) => ({naam, stemmen}));
            resArr.sort((a, b) => b.stemmen - a.stemmen);

            resArr.forEach((item, index) => {
                let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s";
                p.innerHTML = `<b style="color:#ff3b30;">${item.naam.toUpperCase()}</b>: ${item.stemmen} stem(men) ${index===0?'🎯':''}`;
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
        
        winnaars.forEach(w => { db.collection('groepen').doc(currentGroup).collection('scores').doc(w).set({ rejection: firebase.firestore.FieldValue.increment(1) }, {merge: true}); });
        if(winnaars.length > 0) stuurNaarFeed(`👉 SJAAK: ${winnaars.join(' & ').toUpperCase()} is de sjaak en krijgt +1 Reject! Drinken!`);
        db.collection('groepen').doc(currentGroup).collection('games').doc('sjaak').update({ fase: 'resultaat' });
    });
}


// ==========================================
// REFLEX LOGICA 
// ==========================================
let huidigeReflexRonde = 0, reflexGroenTijd = 0, reflexGeklikt = false, reflexInterval = null;
function startReflexRonde() { let delay = Math.floor(Math.random() * 4000) + 2000; db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').update({ fase: 'actief', ronde: Date.now(), groen_tijd: Date.now() + delay, scores: {} }); stuurNaarFeed(`⚡ Reflex Roulette is GESTART door ${currentUser.toUpperCase()}!`); }

function luisterNaarReflex() {
    luisterNaarGameLobby('reflex');
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc => {
        if (!doc.exists) return; let d = doc.data(); let ronde = d.ronde || 0; let groen = d.groen_tijd || 0; let scores = d.scores || {}; let spelers = d.spelers || [];
        const btn = document.getElementById('reflex-btn'); const lb = document.getElementById('reflex-leaderboard');
        if (!btn) return;
        
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
function klikReflex(e) { if (e) e.preventDefault(); if (reflexGeklikt || !huidigeReflexRonde) return; reflexGeklikt = true; let isTeVroeg = Date.now() < reflexGroenTijd; let tijdScore = isTeVroeg ? 'TE VROEG' : Date.now() - reflexGroenTijd; if (isTeVroeg) { stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG en neemt een atje!`); alert("TE VROEG! Straf Atje voor jou! 🥃"); if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } const btn = document.getElementById('reflex-btn'); if (btn) { btn.innerText = 'Geklikt!'; btn.style.backgroundColor = '#8e8e93'; } db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ scores: { [currentUser]: tijdScore } }, { merge: true }); }


// ==========================================
// QUIPLASH LOGICA
// ==========================================
let qlHuidigeVraag = ""; let qlFase = "wachten"; let qlAntwoorden = {}; let qlStemmen = {};
const quiplashVragenArray = [ "De echte reden waarom [SPELER] nog steeds single is, is ___.", "Wat vind je als je een blacklight schijnt op de slaapkamer van [SPELER]?", "Het ergste om te horen vlak nadat je de daad hebt verricht is ___.", "Waarom is [SPELER] gisteravond uit de kroeg gezet?", "Het minst succesvolle condoom-merk heet: ___.", "Wat is de zwaar bewaakte, geheime fetisj van [SPELER]?", "Je bent op een date, alles gaat perfect totdat je date begint te praten over ___.", "Wat staat er op de stiekeme OnlyFans pagina van [SPELER]?", "Wat is het aller ranzigste dat [SPELER] ooit in zijn mond heeft gestopt?", "De dokter had slecht nieuws. [SPELER] is zojuist gediagnosticeerd met chronische ___.", "Wat is de absolute favoriete zoekterm van [SPELER] op de hub?", "Als [SPELER] een superkracht had, zou het de kracht zijn om ___ te verpesten.", "Wat roept [SPELER] per ongeluk tijdens de seks?", "Het allerslechtste excuus van [SPELER] om niet te hoeven adten is ___.", "Wat is de echte reden dat de ouders van [SPELER] diep teleurgesteld in hem zijn?", "Je weet dat het een waardeloze afterparty is als [SPELER] begint over ___.", "Wat verbergt [SPELER] diep achterin zijn nachtkastje?", "Als de browsergeschiedenis van [SPELER] uitlekt, moet hij direct de bak in voor ___.", "Wat is het laatste dat door het hoofd van [SPELER] ging voordat hij out ging op de vloer?", "Het nieuwe parfum van [SPELER] ruikt naar zweet, schaamte en ___.", "Waarom mag [SPELER] absoluut niet meer in het lokale zwembad komen?", "Wat is de ultieme, gigantische red flag van [SPELER]?", "Wat was de daadwerkelijke oorzaak van de scheiding van de ouders van [SPELER]?", "Het allersmerigste dat je na een wilde nacht onder je nagels kunt vinden is ___.", "Wat is het meest beschamende wat [SPELER] heeft gedaan voor een gratis lauw biertje?", "Wat doet [SPELER] als hij denkt dat niemand kijkt?", "Het ergste wat je kan vinden in de koelkast van [SPELER] de ochtend na het stappen is ___.", "Als [SPELER] een SOA was, welke zou hij dan zijn en waarom?", "Waarom begint [SPELER] altijd spontaan te zweten als hij een politieauto ziet?", "Wat is de titel van de autobiografie van [SPELER]?", "De slechtste openingszin die [SPELER] ooit heeft gebruikt (en die faalde) is ___.", "Wat is het eerste wat [SPELER] doet als hij alleen thuis is?", "Het ergste cadeau dat [SPELER] ooit aan een scharrel heeft gegeven is ___.", "Als [SPELER] sterft, wat staat er dan op zijn grafsteen?", "Wat is de echte reden dat [SPELER] is ontslagen bij zijn vorige bijbaan?", "Wat is het vreemdste object dat artsen uit het lichaam van [SPELER] hebben moeten verwijderen?", "Waarom huilt [SPELER] zichzelf elke avond in slaap?", "Wat is de grootste leugen op het Tinder profiel van [SPELER]?", "Als [SPELER] een seksspeeltje was, hoe zou hij dan heten en wat doet het?", "Wat is het smerigste dat [SPELER] ooit van de grond heeft gegeten in de kroeg?", "Waar is [SPELER] daadwerkelijk bang voor in het donker?", "Hoe heeft [SPELER] dat litteken op die ongemakkelijke plek gekregen?", "Wat is de meest trieste gedachte die [SPELER] had tijdens een onenightstand?", "Wat is het geheime wapen van [SPELER] in bed (dat eigenlijk super zielig is)?", "Wat zou de reden zijn dat [SPELER] ooit op Opsporing Verzocht komt?", "Wat is de meest walgelijke gewoonte van [SPELER] op de wc?", "Wat is het donkerste geheim dat [SPELER] voor zijn vrienden achterhoudt?", "Wat is het pijnlijkste compliment dat [SPELER] ooit heeft gekregen?", "Als [SPELER] een geurkaars zou uitbrengen, welke geur zou dat dan zijn?", "Waarom eindigt elke relatie van [SPELER] in een drama met huilbuien en ___?" ];

function luisterNaarQuiplash() {
    luisterNaarGameLobby('quiplash');
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').onSnapshot(doc => {
        if (!doc.exists) return; const data = doc.data(); qlFase = data.fase || 'wachten'; qlHuidigeVraag = data.vraag || ''; qlAntwoorden = data.antwoorden || {}; qlStemmen = data.stemmen || {}; let qlSpelers = data.spelers || [];
        
        let uiAntwoorden = document.getElementById('quiplash-actief'); if(!uiAntwoorden) return;
        uiAntwoorden.style.display = 'none'; document.getElementById('quiplash-stemmen').style.display = 'none'; document.getElementById('quiplash-resultaat').style.display = 'none';

        if (qlFase === 'antwoorden') {
            uiAntwoorden.style.display = 'block'; document.getElementById('ql-vraag-tekst').innerText = qlHuidigeVraag;
            if (!qlSpelers.includes(currentUser)) { document.getElementById('ql-invoer-sectie').style.display = 'none'; document.getElementById('ql-ingevuld-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').innerHTML = `<h2 style="color:#ff9500;">Je doet niet mee.</h2><p>Kijk mee op het scherm van de rest!</p>`; } 
            else if (qlAntwoorden[currentUser]) { document.getElementById('ql-invoer-sectie').style.display = 'none'; document.getElementById('ql-ingevuld-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').innerHTML = `<h2 style="color:#34c759; margin:0 0 10px 0;">✅ Antwoord Ingevuld!</h2><p style="color:#a1a1aa; margin:0;">Wachten op de trage rest...</p>`; } 
            else { document.getElementById('ql-invoer-sectie').style.display = 'block'; document.getElementById('ql-ingevuld-sectie').style.display = 'none'; document.getElementById('ql-invoer').value = ''; }
            document.getElementById('ql-status-antwoorden').innerText = `${Object.keys(qlAntwoorden).length} van de ${qlSpelers.length} antwoorden binnen.`;
            document.getElementById('btn-ql-forceer-stemmen').style.display = (data.host === currentUser) ? 'inline-block' : 'none';
            if(Object.keys(qlAntwoorden).length === qlSpelers.length && qlSpelers.length > 0 && data.host === currentUser) { startQuiplashStemmen(); }
        } else if (qlFase === 'stemmen') {
            document.getElementById('quiplash-stemmen').style.display = 'block'; document.getElementById('ql-vraag-stemmen').innerText = qlHuidigeVraag;
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
            document.getElementById('quiplash-resultaat').style.display = 'block'; document.getElementById('ql-vraag-resultaat').innerText = qlHuidigeVraag;
            let resLijst = document.getElementById('ql-uitslag-lijst'); resLijst.innerHTML = ''; document.getElementById('btn-ql-volgende').style.display = (data.host === currentUser) ? 'inline-block' : 'none';

            let scores = {}; Object.values(qlStemmen).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; });
            let resArr = Object.entries(qlAntwoorden).map(([naam, antw]) => ({naam, antw, stemmen: scores[naam] || 0})); resArr.sort((a, b) => b.stemmen - a.stemmen);
            resArr.forEach((item, index) => {
                let p = document.createElement('div'); p.className = "ql-result-item"; p.style.animationDelay = (0.2 * index) + "s";
                p.innerHTML = `<b style="color:#af52de; font-size:18px;">${item.naam.toUpperCase()}</b> <span style="color:#34c759; font-weight:bold;">(${item.stemmen} stemmen)</span><br><span style="color:#fff; font-size:20px; line-height:1.5;">"${item.antw}"</span>`; resLijst.appendChild(p);
            });
        }
    });
}
function startQuiplashRonde() {
    let qlSpelers = []; document.querySelectorAll('#quiplash-spelers-lijst .lobby-speler-badge').forEach(el => qlSpelers.push(el.innerText.toLowerCase()));
    let randomSpeler = qlSpelers.length > 0 ? qlSpelers[Math.floor(Math.random() * qlSpelers.length)] : "iemand";
    let vr = quiplashVragenArray[Math.floor(Math.random() * quiplashVragenArray.length)].replace(/\[SPELER\]/g, randomSpeler.charAt(0).toUpperCase() + randomSpeler.slice(1));
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'antwoorden', vraag: vr, antwoorden: {}, stemmen: {} }); stuurNaarFeed(`🤐 Quiplash is GESTART! Vul je antwoorden in!`);
}
function verstuurQuiplashAntwoord() { let v = document.getElementById('ql-invoer').value.trim(); if(!v) return alert("Vul iets in!"); db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ [`antwoorden.${currentUser}`]: v }); }
function startQuiplashStemmen() { db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'stemmen' }); }
function stemOpQuiplash(opWie) { db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ [`stemmen.${currentUser}`]: opWie }); }
function toonQuiplashResultaten() {
    let maxStemmen = 0; let winnaars = []; let scores = {};
    Object.values(qlStemmen).forEach(gestemdOp => { scores[gestemdOp] = (scores[gestemdOp] || 0) + 1; if(scores[gestemdOp] > maxStemmen) maxStemmen = scores[gestemdOp]; });
    Object.keys(scores).forEach(naam => { if(scores[naam] === maxStemmen) winnaars.push(naam); });
    winnaars.forEach(w => { db.collection('groepen').doc(currentGroup).collection('scores').doc(w).set({ raggen: firebase.firestore.FieldValue.increment(5) }, {merge: true}); });
    if(winnaars.length > 0) { stuurNaarFeed(`🏆 Quiplash: ${winnaars.join(' & ').toUpperCase()} won(nen) en kregen 5 punten!`); }
    db.collection('groepen').doc(currentGroup).collection('games').doc('quiplash').update({ fase: 'resultaat' });
}

// ==========================================
// VLOER IS LAVA LOGICA
// ==========================================
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

// ==========================================
// SHAKE IT LOGICA
// ==========================================
let shakeTimerInterval = null; let shakeScore = 0; let shakeBezig = false; let shakeLastX = null, shakeLastY = null, shakeLastZ = null;
function startShakeRonde() {
    let spelers = []; document.querySelectorAll('#shake-spelers-lijst .lobby-speler-badge').forEach(el => spelers.push(el.innerText.toLowerCase()));
    if(spelers.length < 2) return alert("Minimaal 2 spelers in de lobby nodig.");
    let p1 = spelers[Math.floor(Math.random()*spelers.length)]; let over = spelers.filter(x => x !== p1); let p2 = over[Math.floor(Math.random()*over.length)];
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

// ==========================================
// BORDSPEL (SLOTTA STIJL)
// ==========================================
const bordOpdrachten = [
    "Adt je glas helemaal leeg! 🍻", "Deel 3 slokken uit aan degene tegenover je.", "Jongens drinken 2 slokken.", "Meiden drinken 2 slokken.",
    "Bedenk een nieuwe regel. Wie hem breekt drinkt 1 slok.", "Drink 1 slok voor elke ex die je hebt gehad.", "Deel 5 slokken uit.",
    "Iedereen met blonde haren drinkt.", "Iedereen met bruine/zwarte haren drinkt.", "Kies een Drink-Buddy. Als jij drinkt, drinkt hij/zij ook.",
    "Je bent de Sjaak. Neem een shotje! 🥃", "Speel Steen-Papier-Schaar met degene links van je. Verliezer drinkt 3 slokken.",
    "Truth or Drink: Wat is je ranzigste geheim? Of drink 5 slokken.", "Iedereen wijst op 3 naar de domste van de groep. Diegene drinkt.",
    "Noem 3 pornocategorieën binnen 5 seconden. Lukt dat niet? Adten.", "Geef je telefoon aan degene rechts. Die mag 1 appje sturen naar iemand, of jij trekt een adt.",
    "Deel 1 slok uit voor elke centimeter die je denkt dat je hebt (of je cupmaat).", "Doe een handstand. Lukt het niet? Drinken.",
    "Iedereen die vandaag geneukt heeft, mag 3 slokken uitdelen.", "Neem 2 slokken water (Laf).", "Iedereen drinkt! Proost! 🍻"
];

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
        tegel.setAttribute('data-type', type);
        tegel.innerHTML = `<div class="bord-tegel-nummer">${i}</div>`;
        
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
        let opdrachtTekst = bordOpdrachten[Math.floor(Math.random() * bordOpdrachten.length)];
        if (nieuwePos === 39) opdrachtTekst = "🏆 JE BENT GEFINISHT! Deel 10 slokken uit en trek zelf een Atje om het te vieren!";
        let nwPosities = d.posities; nwPosities[currentUser] = nieuwePos;
        db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').update({ posities: nwPosities, dobbel_uitslag: gooi, actieve_opdracht: { speler: currentUser, tekst: opdrachtTekst } });
        if ("vibrate" in navigator) navigator.vibrate([100, 100, 100]);
    });
}

function voltooiBordspelBeurt() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('bordspel').update({ beurt_index: firebase.firestore.FieldValue.increment(1), actieve_opdracht: null });
}