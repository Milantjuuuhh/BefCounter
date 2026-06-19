// ==========================================
// SCOREBORD & DATA SYNC (WEBHOOK TRIGGER FIX)
// ==========================================
function pasScoreAan(categorie, bedrag, emojiNaam) {
    if ("vibrate" in navigator) navigator.vibrate(50);
    const isHappyHour = new Date().getHours() === 23;
    const actueelBedrag = (isHappyHour && bedrag > 0) ? bedrag * 2 : bedrag;
    
    db.collection('groepen').doc(currentGroup).collection('scores').doc(currentUser).set({ [categorie]: firebase.firestore.FieldValue.increment(actueelBedrag) }, { merge: true });

    if (actieveCoopMissie && bedrag > 0 && actieveCoopMissie.types.includes(categorie) && !actieveCoopMissie.behaald) {
        db.collection('groepen').doc(currentGroup).collection('coop').doc('status').update({ score: firebase.firestore.FieldValue.increment(actueelBedrag) });
    }

    let startBericht = `${currentUser.charAt(0).toUpperCase() + currentUser.slice(1)} ${bedrag > 0 ? `scoort +${actueelBedrag} bij` : "deed een correctie bij"} ${emojiNaam}${isHappyHour && bedrag > 0 ? " (HAPPY HOUR x2!)" : ""}`;

    // --- DE WEBHOOK NAAR MAKE.COM ---
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/x5392a4m2kc3ixqy4sbna33m8kuk9m4g";

    db.collection('groepen').doc(currentGroup).collection('scores').get().then(snap => {
        snap.forEach(doc => {
            // BEVEILIGING VERWIJDERD VOOR TESTEN: Stuurt nu altijd naar Make als iemand een token heeft!
            if (doc.data().push_token) {
                fetch(MAKE_WEBHOOK_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        token: doc.data().push_token,
                        titel: "BefCounter 🍻",
                        bericht: startBericht
                    })
                }).catch(e => console.log(e));
            }
        });
    });
    // --------------------------------

    if (vakantieModus && "geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
            db.collection('groepen').doc(currentGroup).collection('locaties').add({ naam: currentUser, actie: emojiNaam, lat: pos.coords.latitude, lng: pos.coords.longitude, tijd: new Date().toISOString() });
            stuurNaarFeed(`${startBericht} Maps: https://maps.google.com/?q=${pos.coords.latitude},${pos.coords.longitude}`);
        }, () => stuurNaarFeed(`${startBericht}!`));
    } else stuurNaarFeed(`${startBericht}!`);
}

function bouwLiveScorebord() {
    if(unsubscribeScores) unsubscribeScores();
    
    unsubscribeScores = db.collection('groepen').doc(currentGroup).collection('scores').onSnapshot((snapshot) => {
        // TYPFOUT FIX BIJ DÖNER KOLOM
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