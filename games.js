// ==========================================
// FULLSCREEN GAME MODALS LOGICA
// ==========================================
function openGame(gameId) { document.getElementById(gameId).classList.add('active'); }
function sluitGame(gameId) { document.getElementById(gameId).classList.remove('active'); }

// ==========================================
// SWASI FINGER ROULETTE
// ==========================================
let actieveSwasiTouches = {}, swasiKleurIndex = 0, swasiTimer = null, swasiAfteller = null, swasiBezig = false;

function startSwasi() {
    let swasiOverlay = document.getElementById('swasi-overlay');
    swasiOverlay.style.display = 'block'; document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger op het scherm..."; document.getElementById('swasi-countdown').style.display = 'none'; document.getElementById('swasi-sluit-btn').style.display = 'none';
    actieveSwasiTouches = {}; swasiKleurIndex = 0; swasiBezig = true; document.body.style.overflow = 'hidden';
    swasiOverlay.addEventListener('touchstart', handleTouchStart, {passive: false}); swasiOverlay.addEventListener('touchmove', handleTouchMove, {passive: false}); swasiOverlay.addEventListener('touchend', handleTouchEnd); swasiOverlay.addEventListener('touchcancel', handleTouchEnd);
}

function stopSwasi() {
    let swasiOverlay = document.getElementById('swasi-overlay');
    swasiOverlay.style.display = 'none'; document.body.style.overflow = ''; clearTimeout(swasiTimer); clearInterval(swasiAfteller); swasiBezig = false;
    Object.values(actieveSwasiTouches).forEach(c => c.remove()); actieveSwasiTouches = {};
    swasiOverlay.removeEventListener('touchstart', handleTouchStart); swasiOverlay.removeEventListener('touchmove', handleTouchMove); swasiOverlay.removeEventListener('touchend', handleTouchEnd); swasiOverlay.removeEventListener('touchcancel', handleTouchEnd);
}

function handleTouchStart(e) {
    if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return;
    let k = ['#007aff', '#34c759', '#ff9500', '#af52de', '#5856d6', '#ff2d55', '#f1c40f', '#00c7be'];
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]; let color = k[swasiKleurIndex++ % k.length];
        let circle = document.createElement('div'); circle.className = 'swasi-circle'; circle.style.borderColor = color; circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px';
        document.getElementById('swasi-overlay').appendChild(circle); actieveSwasiTouches[t.identifier] = circle;
    }
    checkSwasiTimer();
}

function handleTouchMove(e) {
    if (e.target.id === 'swasi-sluit-btn') return; e.preventDefault(); if (!swasiBezig) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let t = e.changedTouches[i]; let circle = actieveSwasiTouches[t.identifier];
        if (circle) { circle.style.left = t.clientX + 'px'; circle.style.top = t.clientY + 'px'; }
    }
}

function handleTouchEnd(e) {
    if (!swasiBezig) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        let id = e.changedTouches[i].identifier; let circle = actieveSwasiTouches[id];
        if (circle) { circle.remove(); delete actieveSwasiTouches[id]; }
    }
    checkSwasiTimer();
}

function checkSwasiTimer() {
    clearTimeout(swasiTimer); clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none';
    let keys = Object.keys(actieveSwasiTouches);
    if (keys.length > 1) {
        document.getElementById('swasi-instructie').style.display = 'none'; document.getElementById('swasi-countdown').style.display = 'block';
        let count = 3; document.getElementById('swasi-countdown').innerText = count;
        swasiAfteller = setInterval(() => {
            count--;
            if (count > 0) { document.getElementById('swasi-countdown').innerText = count; } else {
                clearInterval(swasiAfteller); document.getElementById('swasi-countdown').style.display = 'none'; kiesSwasiWinnaar(keys);
            }
        }, 1000);
    } else if (keys.length === 1) { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Wacht op meer vingers..."; } else { document.getElementById('swasi-instructie').style.display = 'block'; document.getElementById('swasi-instructie').innerText = "Plaats allemaal 1 vinger..."; swasiKleurIndex = 0; }
}

function kiesSwasiWinnaar(keys) {
    swasiBezig = false; if ("vibrate" in navigator) navigator.vibrate([100, 50, 100, 50, 300]);
    let winnerId = keys[Math.floor(Math.random() * keys.length)];
    keys.forEach(id => { let circle = actieveSwasiTouches[id]; if (id == winnerId) { circle.classList.add('winner'); } else { circle.classList.add('loser'); } });
    document.getElementById('swasi-sluit-btn').style.display = 'block';
}

// ==========================================
// TIJDBOM
// ==========================================
function startTijdbom() {
    if (spelersLijst.length < 2) return alert("Minimaal 2 spelers nodig.");
    let randomSpeler = spelersLijst[Math.floor(Math.random() * spelersLijst.length)];
    let ontplofTijd = Date.now() + (Math.floor(Math.random() * 45000) + 30000);
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
        const data = doc.data(); const card = document.getElementById('bom-card'); const statusTekst = document.getElementById('bom-status-tekst'); const btnGooi = document.getElementById('btn-gooi-door');
        if (data.actief) {
            document.getElementById('bom-idle-ui').style.display = 'none'; document.getElementById('bom-active-ui').style.display = 'block'; statusTekst.innerText = `Bom is bij ${data.houder.toUpperCase()}!`;
            if (data.houder === currentUser) {
                if(card) card.classList.add('bom-gevaar'); if(btnGooi) btnGooi.style.display = 'inline-block';
                if (Date.now() >= data.eindTijdUnix) {
                    db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!");
                }
            } else {
                if(card) card.classList.remove('bom-gevaar'); if(btnGooi) btnGooi.style.display = 'none';
            }
        } else {
            document.getElementById('bom-idle-ui').style.display = 'block'; document.getElementById('bom-active-ui').style.display = 'none'; if(card) card.classList.remove('bom-gevaar');
        }
    });

    setInterval(() => {
        db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').get().then(doc => {
            if (doc.exists && doc.data().actief && doc.data().houder === currentUser && Date.now() >= doc.data().eindTijdUnix) {
                db.collection('groepen').doc(currentGroup).collection('tijdbom').doc('status').set({ actief: false }); pasScoreAan('raggen', -3, '💥 BOM ONTPLOFT'); alert("KABOEM! -3 Punten!");
            }
        });
    }, 1000);
}

// ==========================================
// RAD VAN FORTUIN
// ==========================================
function draaiRad() {
    if (isSpinning) return;
    if ((mijnTotalePunten - mijnGedraaideSpins) <= 0) return alert("Je hebt 0 coins!");
    isSpinning = true; if ("vibrate" in navigator) navigator.vibrate(50);
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(1) }, { merge: true });
    let draaiCounter = 0;

    const interval = setInterval(() => {
        const basisRadOpties = ["🍻 Atje!", "🥃 Shotje!", "👉 Deel 2 slokken uit", "🎯 [SPELER] adt!", "💧 Drink water (Laf)", "🔄 Wissel drankje", "🚀 Raggen punt!", "🍻 IEDEREEN ADTEN!"];
        let temp = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)];
        document.getElementById('rad-uitkomst').innerText = temp.replace("[SPELER]","iemand");
        document.getElementById('rad-box').style.background = (draaiCounter % 2 === 0) ? "linear-gradient(135deg, #34c759, #30b050)" : "linear-gradient(135deg, #ff9500, #ff2d55)";
        
        if (++draaiCounter > 20) {
            clearInterval(interval);
            let andereSpelers = spelersLijst.filter(n=>n!==currentUser);
            let slachtoffer = andereSpelers.length > 0 ? andereSpelers[Math.floor(Math.random()*andereSpelers.length)] : "iemand";
            let eind = basisRadOpties[Math.floor(Math.random() * basisRadOpties.length)].replace("[SPELER]", slachtoffer);
            document.getElementById('rad-uitkomst').innerText = eind;
            document.getElementById('rad-box').style.background = "linear-gradient(135deg, #007aff, #0056b3)";
            stuurNaarFeed(`🎡 RAD: ${currentUser.toUpperCase()} draaide: "${eind}"`);
            isSpinning = false;
        }
    }, 100);
}

// ==========================================
// SJAAK
// ==========================================
const sjaakVragen = ["Wie kotst vanavond als eerste?", "Wie regelt er vannacht de minste actie?", "Wie verliest er als eerste zijn telefoon of sleutels?", "Wie is morgen de grootste jankerd met een kater?", "Wie betaalt zonder zeuren de volgende ronde?", "Wie doet de domste uitspraak vanavond?", "Wie is de slechtste leugenaar van de groep?", "Wie durft er nu het minst een atje te trekken?"];
let sjaakInterval = null;

function startSjaakVraag() {
    clearInterval(sjaakInterval);
    document.getElementById('sjaak-timer').innerText = "5";
    document.getElementById('sjaak-vraag').innerText = sjaakVragen[Math.floor(Math.random() * sjaakVragen.length)];
}

function startSjaakGame() {
    startSjaakVraag();
    let count = 5; const timerUI = document.getElementById('sjaak-timer');
    if ("vibrate" in navigator) navigator.vibrate(50);
    sjaakInterval = setInterval(() => {
        count--; timerUI.innerText = count;
        if(count <= 0) {
            clearInterval(sjaakInterval); timerUI.innerText = "👉 WIE IS HET?!";
            if ("vibrate" in navigator) navigator.vibrate([300, 100, 300]);
        }
    }, 1000);
}

// ==========================================
// HOGER LAGER
// ==========================================
let hlHuidig = 5;
function initHogerLager() { hlHuidig = Math.floor(Math.random() * 10) + 1; document.getElementById('hl-getal').innerText = hlHuidig; }

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
    
    if (win) {
        let winst = inzet * 2;
        db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ spins: firebase.firestore.FieldValue.increment(-winst) }, { merge: true });
        alert(`Je raadde het goed! Je wint ${winst} Coins terug! 🎉`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} won zojuist ${winst} Coins met Hoger/Lager!`);
    } else {
        let straf = Math.abs(nieuw - hlHuidig) || 1;
        alert(`FOUT! Het was ${nieuw}. Jij neemt nu ${straf} grote slokken! 🥃`); stuurNaarFeed(`🃏 Casino: ${currentUser.toUpperCase()} verloor met Hoger/Lager en moet ${straf} slokken nemen!`);
    }
    hlHuidig = nieuw;
}

// ==========================================
// REFLEX
// ==========================================
let huidigeReflexRonde = 0, reflexGroenTijd = 0, reflexGeklikt = false, reflexInterval = null;

function luisterNaarReflex() {
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').onSnapshot(doc => {
        if (!doc.exists) return;
        let data = doc.data(); let ronde = data.ronde || 0; let groen = data.groen_tijd || 0; let scores = data.scores || {};
        const btn = document.getElementById('reflex-btn'); const lb = document.getElementById('reflex-leaderboard');

        if (ronde !== huidigeReflexRonde) {
            huidigeReflexRonde = ronde; reflexGroenTijd = groen; reflexGeklikt = false;
            if(btn) { btn.style.backgroundColor = '#ff3b30'; btn.innerText = 'Wacht...'; btn.disabled = false; }
            clearInterval(reflexInterval);
            reflexInterval = setInterval(() => {
                if (Date.now() >= reflexGroenTijd && btn && btn.style.backgroundColor !== 'rgb(52, 199, 89)' && !reflexGeklikt) {
                    btn.style.backgroundColor = '#34c759'; btn.innerText = 'KLIK NU!';
                }
            }, 50);
        }

        if (Object.keys(scores).length > 0 && lb) {
            lb.style.display = 'block'; let arr = [];
            for (let speler in scores) { arr.push({ naam: speler, tijd: scores[speler] }); }
            arr.sort((a, b) => { if (a.tijd === 'TE VROEG') return 1; if (b.tijd === 'TE VROEG') return -1; return a.tijd - b.tijd; });
            let html = '<h3 style="margin-top:0; border-bottom:1px solid #eee; padding-bottom:5px;">Leaderboard Deze Ronde</h3><ol style="padding-left: 20px; margin: 0; font-size:16px;">';
            arr.forEach((s, idx) => {
                let emoji = idx === 0 ? '🏆' : (s.tijd === 'TE VROEG' ? '❌' : '⏱️');
                let tijdWeergave = s.tijd === 'TE VROEG' ? '<span style="color:#ff3b30; font-weight:bold;">TE VROEG</span>' : `${s.tijd} ms`;
                html += `<li style="margin-bottom: 8px;">${emoji} <b>${s.naam.toUpperCase()}</b>: ${tijdWeergave}</li>`;
            });
            lb.innerHTML = html + '</ol>';
        } else if (lb) { lb.style.display = 'none'; }
    });
}

function startReflexRonde() {
    let delay = Math.floor(Math.random() * 4000) + 2000;
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ ronde: Date.now(), groen_tijd: Date.now() + delay, scores: {} });
    stuurNaarFeed(`⚡ Reflex Roulette is GESTART door ${currentUser.toUpperCase()}!`);
}

function klikReflex(e) {
    if (e) e.preventDefault(); if (reflexGeklikt || !huidigeReflexRonde) return;
    reflexGeklikt = true;
    let isTeVroeg = Date.now() < reflexGroenTijd;
    let tijdScore = isTeVroeg ? 'TE VROEG' : Date.now() - reflexGroenTijd;
    if (isTeVroeg) {
        stuurNaarFeed(`⚡ Reflex: ${currentUser.toUpperCase()} was TE VROEG en neemt een atje!`); alert("TE VROEG! Straf Atje voor jou! 🥃");
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    }
    const btn = document.getElementById('reflex-btn');
    if (btn) { btn.innerText = 'Geklikt!'; btn.style.backgroundColor = '#8e8e93'; }
    db.collection('groepen').doc(currentGroup).collection('games').doc('reflex').set({ scores: { [currentUser]: tijdScore } }, { merge: true });
}

// ==========================================
// MEXEN
// ==========================================
function gooiMexen() {
    let d1 = Math.floor(Math.random() * 6) + 1; let d2 = Math.floor(Math.random() * 6) + 1;
    document.getElementById('mex-d1').innerText = d1; document.getElementById('mex-d2').innerText = d2;
    let score = Math.max(d1, d2).toString() + Math.min(d1, d2).toString();
    let extraText = "";
    if (score === "21") { extraText = " 🚨 MEX! IEDEREEN DRINKEN!!"; if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]); } 
    else if (d1 === d2) { extraText = " (Honderden!)"; }
    stuurNaarFeed(`🎲 Mexen: ${currentUser.toUpperCase()} gooide ${score}${extraText}`);
}