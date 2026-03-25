
// ========================================================================
// Passphrase Authentication
// ========================================================================

async function hashPassphrase(passphrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(passphrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function checkAuth() {
    const storedHash = localStorage.getItem("passphrase_hash");
    if (!storedHash) {
        await setupPassphrase();
    } else {
        await promptForPassphrase(storedHash);
    }
}

async function setupPassphrase() {
    let passphrase1 = prompt("Set a new passphrase for your D&D vault:");
    if (!passphrase1) {
        document.getElementById("app").innerHTML = "<h1>A passphrase is required to access your characters.</h1>";
        return;
    }
    let passphrase2 = prompt("Confirm your passphrase:");
    if (passphrase1 !== passphrase2) {
        alert("Passphrases do not match. Please try again.");
        return await setupPassphrase();
    }

    const hash = await hashPassphrase(passphrase1);
    localStorage.setItem("passphrase_hash", hash);
    initializeApp();
}

async function promptForPassphrase(storedHash) {
    let passphrase = prompt("Enter your passphrase to unlock your characters:");
    if (!passphrase) {
        document.getElementById("app").innerHTML = "<h1>A passphrase is required to access your characters.</h1>";
        return;
    }
    const hash = await hashPassphrase(passphrase);
    if (hash === storedHash) {
        initializeApp();
    } else {
        alert("Incorrect passphrase. Please try again.");
        await promptForPassphrase(storedHash);
    }
}

// ========================================================================
// Application Globals
// ========================================================================

let party = [];
let statBonusUsato = -1;

const XP_LEVELS = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 
    55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000
];

// ========================================================================
// Application Logic
// ========================================================================

function initializeApp() {
    try {
        party = JSON.parse(localStorage.getItem("party")) || [];
    } catch(e) {
        console.error("Error parsing party data from localStorage", e);
        party = [];
    }
    menuPG();
}

function salva(){
    localStorage.setItem("party", JSON.stringify(party));
}

function menuPG(){
    let html = "<h2>Personaggi</h2>";
    html += '<button onclick="nuovoPG()">➕ Aggiungi PG</button>';

    for(let i=0;i<party.length;i++){
        let pg = party[i];
        if(!pg.classi) pg.classi = [];
        let classi = "";
        let livelloTot = 0;

        for(let j=0;j<pg.classi.length;j++){
            if(j>0){
                classi += "/";
            }
            classi += pg.classi[j].nome+" "+pg.classi[j].livello;
            livelloTot += pg.classi[j].livello;
        }

        let hpPerc = (pg.pf / pg.pfmax) * 100;
        let livello = livelloDaXP(pg.xp);
        let xpBase = XP_LEVELS[livello-1] || 0;
        let xpNext = XP_LEVELS[livello] || xpBase;
        let xpPerc = xpNext > xpBase ? ((pg.xp - xpBase) / (xpNext - xpBase)) * 100 : 0;

        html += `
        <div class="card" onclick="apriPG(${i})">
            <b>${pg.nome} (Lv ${livelloTot})</b><br>
            ${classi}
            <br><br>
            ${pg.pf}/${pg.pfmax}
            <div class="bar"><div class="fill hp" style="width:${hpPerc}%"></div></div>
            XP ${pg.xp} / ${xpNext}
            <div class="bar"><div class="fill xp" style="width:${xpPerc}%"></div></div>
        </div>
        `;
    }
    document.getElementById("app").innerHTML = html;
}

function nuovoPG(){
    let html = `
    <h2>Nuovo Personaggio</h2>
    Nome<br><input id="nome"><br><br>
    <h3>Classi</h3>
    <div id="classi">
        <div>
            <input placeholder="Classe" class="classe">
            <input type="number" placeholder="Livello" class="livello">
        </div>
    </div>
    <button onclick="aggiungiClasse()">+ Classe</button>
    <h3>Caratteristiche</h3>
    <div class="statgrid statgrid-new">
        <div class="statgrid-header">Caratteristica</div>
        <div class="statgrid-header">Valore</div>
        <div class="statgrid-header">Mod</div>
        <div class="stat-name">Forza</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
        <div class="stat-name">Destrezza</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
        <div class="stat-name">Costituzione</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
        <div class="stat-name">Intelligenza</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
        <div class="stat-name">Saggezza</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
        <div class="stat-name">Carisma</div><div class="stat-value"><input type="number" oninput="calcMod(this)"></div><div class="stat-mod">0</div>
    </div>
    <h3>Punti Ferita</h3>
    PF Massimi<br><input id="pfmax" type="number"><br><br>
    <h3>Esperienza</h3>
    XP Totali<br><input id="xp" type="number" value="0"><br><br>
    <button onclick="salvaPG()">💾 Salva</button>
    `;
    document.getElementById("app").innerHTML = html;
}

function aggiungiClasse(){
    let div = document.getElementById("classi");
    let nuovo = document.createElement("div");
    nuovo.innerHTML = `<input placeholder="Classe" class="classe"><input type="number" placeholder="Livello" class="livello">`;
    div.appendChild(nuovo);
}

function calcMod(input){
    let val = parseInt(input.value) || 0;
    let mod = Math.floor((val - 10) / 2);
    let valDiv = input.parentElement;
    let modDiv = input.parentElement.nextElementSibling;
    if(mod >= 0){
        modDiv.textContent = "+" + mod;
    } else {
        modDiv.textContent = mod;
    }
}

function salvaPG(){
    let nome = document.getElementById("nome").value;
    if (nome.trim() === "") {
        alert("Il nome del personaggio non può essere vuoto.");
        return;
    }
    let classInputs = document.querySelectorAll(".classe");
    let levelInputs = document.querySelectorAll(".livello");
    let classi = [];
    for(let i=0;i<classInputs.length;i++){
        let c = classInputs[i].value.trim();
        let l = parseInt(levelInputs[i].value);
        if(c && l > 0){
            classi.push({nome:c, livello:l});
        } else if (c || levelInputs[i].value) {
            alert(`La riga classe ${i+1} non è compilata correttamente.`);
            return;
        }
    }
    if (classi.length === 0) {
        alert("Aggiungi almeno una classe.");
        return;
    }
    let pfmax = parseInt(document.getElementById("pfmax").value);
    let xp = parseInt(document.getElementById("xp").value);
    if (isNaN(pfmax) || pfmax <= 0) {
        alert("I Punti Ferita massimi devono essere un numero maggiore di 0!");
        return;
    }
    if (isNaN(xp) || xp < 0) {
        alert("I Punti Esperienza devono essere un numero uguale o maggiore di 0");
        return;
    }
    let stats = [];
    let statInputs = document.querySelectorAll(".statgrid input");
    for(let i=0;i<statInputs.length;i++){
        let statVal = parseInt(statInputs[i].value);
        if (isNaN(statVal)) {
            let statName = statInputs[i].parentElement.previousElementSibling.textContent;
            alert(`Il valore per ${statName} non è un numero valido.`);
            return;
        }
        stats.push(statVal);
    }
    let pg = {
        nome:nome.trim(), classi:classi, stats:stats, statsBase:[...stats], 
        pfmax:pfmax, pf:pfmax, xpBase:xp, xp:xp, sessioni:[], ultimoAumentoStat:0
    };
    party.push(pg);
    salva();
    menuPG();
}

function calcXP(xp){
    let livello = 1;
    for(let i=0;i<XP_LEVELS.length;i++){
        if(xp >= XP_LEVELS[i]){
        livello = i+1;
        }
    }
    let base = XP_LEVELS[livello-1];
    let next = XP_LEVELS[livello] || XP_LEVELS[livello-1];
    let percentuale = ((xp-base)/(next-base))*100;
    return percentuale;
}

function livelloDaXP(xp){
    let livello = 1;
    for(let i=0;i<XP_LEVELS.length;i++){
        if(xp >= XP_LEVELS[i]){
            livello = i+1;
        }
    }
    return livello;
}

function aumentoCaratteristica(livello, pg){
    if(livello % 4 === 0 && pg.ultimoAumentoStat !== livello){
    return "<span style='color:gold;margin-left:10px;'>⬆ Aumento caratteristica disponibile</span>";
    }
return "";
}

function apriPG(index){
    statBonusUsato = -1;
    document.body.dataset.pgIndex = index;
    let pg = party[index];
    let livello = livelloDaXP(pg.xp);
    let xpBase = XP_LEVELS[livello-1] || 0;
    let xpNext = XP_LEVELS[livello] || xpBase;
    let xpPerc = xpNext > xpBase ? ((pg.xp-xpBase)/(xpNext-xpBase))*100 : 0;
    let aumentoDisponibile = (livello % 4 === 0) && (pg.ultimoAumentoStat !== livello);
    let classiHTML = "";
    let livelloTot = 0;
    for(let i=0;i<pg.classi.length;i++){
        livelloTot += pg.classi[i].livello;
        classiHTML += `<div><span>${pg.classi[i].nome}</span> <span>${"Lv"}</span> <span>${pg.classi[i].livello}</span></div>`;
    }
    let html = `
    <h2>${pg.nome}</h2>
    <div>Livello totale <span id="livelloTotale">${livelloTot}</span></div>
    <h3>Classi</h3>
    <div id="classi">${classiHTML}</div>
    <h3>Caratteristiche <span id="statUp">${aumentoCaratteristica(livelloTot, pg)}</span></h3>
    <div class="statgrid">
        <div class="statgrid-header">Caratteristica</div><div class="statgrid-header">Valore</div><div class="statgrid-header">Mod</div><div class="statgrid-header"></div>
        <div class="stat-name">Forza</div><div class="stat-value"><input type="number" value="${pg.stats[0]}" data-base="${pg.stats[0]}" oninput="gestioneStat(this,0)"></div><div class="stat-mod">${((Math.floor((pg.stats[0]-10)/2)>=0?"+":"") + Math.floor((pg.stats[0]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(0, -1)">➖</button><button onclick="modStat(0, +1)">➕</button>` : ``}</div>
        <div class="stat-name">Destrezza</div><div class="stat-value"><input type="number" value="${pg.stats[1]}" data-base="${pg.stats[1]}" oninput="gestioneStat(this,1)"></div><div class="stat-mod">${((Math.floor((pg.stats[1]-10)/2)>=0?"+":"") + Math.floor((pg.stats[1]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(1, -1)">➖</button><button onclick="modStat(1, +1)">➕</button>` : ``}</div>
        <div class="stat-name">Costituzione</div><div class="stat-value"><input type="number" value="${pg.stats[2]}" data-base="${pg.stats[2]}" oninput="gestioneStat(this,2)"></div><div class="stat-mod">${((Math.floor((pg.stats[2]-10)/2)>=0?"+":"") + Math.floor((pg.stats[2]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(2, -1)">➖</button><button onclick="modStat(2, +1)">➕</button>` : ``}</div>
        <div class="stat-name">Intelligenza</div><div class="stat-value"><input type="number" value="${pg.stats[3]}" data-base="${pg.stats[3]}" oninput="gestioneStat(this,3)"></div><div class="stat-mod">${((Math.floor((pg.stats[3]-10)/2)>=0?"+":"") + Math.floor((pg.stats[3]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(3, -1)">➖</button><button onclick="modStat(3, +1)">➕</button>` : ``}</div>
        <div class="stat-name">Saggezza</div><div class="stat-value"><input type="number" value="${pg.stats[4]}" data-base="${pg.stats[4]}" oninput="gestioneStat(this,4)"></div><div class="stat-mod">${((Math.floor((pg.stats[4]-10)/2)>=0?"+":"") + Math.floor((pg.stats[4]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(4, -1)">➖</button><button onclick="modStat(4, +1)">➕</button>` : ``}</div>
        <div class="stat-name">Carisma</div><div class="stat-value"><input type="number" value="${pg.stats[5]}" data-base="${pg.stats[5]}" oninput="gestioneStat(this,5)"></div><div class="stat-mod">${((Math.floor((pg.stats[5]-10)/2)>=0?"+":"") + Math.floor((pg.stats[5]-10)/2))}</div><div class="statbtn">${aumentoDisponibile ? `<button onclick="modStat(5, -1)">➖</button><button onclick="modStat(5, +1)">➕</button>` : ``}</div>
    </div>
    <h3>Punti Ferita</h3>
    PF Massimi<br><input id="pfmax" type="number" value="${pg.pfmax}" disabled><br><br>
    <button id="salvaBtn" onclick="modificaPG(${index})">💾 Salva modifiche</button>
    <button class="deleteBtn" onclick="eliminaPG(${index})">🗑️ Elimina</button>
    <span id="statMsg" style="margin-left:10px;color:orange;font-weight:bold;"></span>
    <div class="sessionPanel">
        <h3>Esperienza</h3>
        <div id="xpText">${pg.xp} / ${xpNext}</div>
        <div class="bar"><div class="fill xp" id="xpBar"></div></div>
        <br>
        <h3>Sessioni XP</h3>
        <table id="tabellaXP" border="1" style="margin-top:10px;border-collapse:collapse;width:100%;"><tr>
        <th>Sessione</th><th>PX</th><th>Totale</th></tr></table>
        <button onclick="nuovaSessione(${index})">➕ Nuova sessione</button>
    </div>
    <br><br>
    `;
    document.getElementById("app").innerHTML = html;
    document.querySelectorAll(".statgrid input").forEach(input => {
        if(input.value){
            calcMod(input);
        }
    });
    if (pg.inLevelUp){
        document.getElementById("pfmax").disabled = false;
    }
    document.getElementById("xpText").innerText = pg.xp + " / " + xpNext;
    document.getElementById("xpBar").style.width = xpPerc + "%";
    aumentoDisponibile = (livello % 4 === 0) && (pg.ultimoAumentoStat !== livello);
    let btn = document.getElementById("salvaBtn");
    let msg = document.getElementById("statMsg");
    if(aumentoDisponibile){
        btn.disabled = true;
        msg.innerText = "⬆ Distribuisci il punto caratteristica";
    }else{
        btn.disabled = false;
        msg.innerText = "";
    }
    let tabella = document.getElementById("tabellaXP");
    if(pg.sessioni){
        let totale = pg.xpBase;
        for(let i=0;i<pg.sessioni.length;i++){
            totale += pg.sessioni[i];
            let riga = tabella.insertRow();
            let c1 = riga.insertCell(0);
            let c2 = riga.insertCell(1);
            let c3 = riga.insertCell(2);
            c1.innerText = i+1;
            c2.innerText = pg.sessioni[i];
            c3.innerText = totale;
        }
    }
}

function eliminaPG(index) {
    const pg = party[index];
    if (confirm(`Sei sicuro di voler eliminare ${pg.nome}? L'azione è irreversibile.`)) {
        party.splice(index, 1);
        salva();
        menuPG();
    }
}

function modificaPG(index){
    let pg = party[index];
    let livelloPrima = livelloDaXP(pg.xp);
    let stats = [];
    let statInputs = document.querySelectorAll(".statgrid input");
    for(let i=0;i<statInputs.length;i++){
        stats.push(parseInt(statInputs[i].value) || 0);
    }
    pg.stats = stats;
    let nuovoPF = parseInt(document.getElementById("pfmax").value) || 0;
    if(pg.inLevelUp){
        if(nuovoPF >= pg.pfmax){
            pg.pfmax = nuovoPF;
            pg.pf = nuovoPF;
            pg.inLevelUp = false;
        }else{
            alert("Puoi solo aumentare i PF al level up!");
            return;
        }
    }
    pg.xp = pg.xp;
    let livelloDopo = livelloDaXP(pg.xp);
    if(livelloDopo > livelloPrima){
        party[index].inLevelUp = true;
        pannelloLevelUp(index, livelloDopo);
        return;
    }

    let aumentoUsato = false;
    for(let i=0; i<pg.stats.length;i++){
        if(pg.stats[i] > pg.statsBase[i]){
            aumentoUsato=true;
            break;
        }
    }
    if(aumentoUsato){
        pg.ultimoAumentoStat = livelloDaXP(pg.xp);
        pg.statsBase = [...pg.stats];
        
    //if(statBonusUsato !== -1){
    //    pg.ultimoAumentoStat = livelloDaXP(pg.xp);
    //}
    //party[index].inLevelUp = true;
    salva();
        statBonusUsato = -1;
    menuPG();
    }
}

function nuovaSessione(index){
    let pg = party[index];
    if(!pg.sessioni){
        pg.sessioni = [];
    }
    let xpInput = prompt("XP ricevuti nella sessione:");
    if (xpInput === null) { return; }
    let xp = parseInt(xpInput);
    if (isNaN(xp)) {
        alert("Inserisci un valore numerico per gli XP.");
        return;
    }
    pg.sessioni.push(xp);
    let livelloPrima = livelloDaXP(pg.xp);
    let totaleSessioni = 0;
    for(let i=0;i<pg.sessioni.length;i++){
        totaleSessioni += pg.sessioni[i];
    }
    pg.xp = pg.xpBase + totaleSessioni;
    let livelloDopo = livelloDaXP(pg.xp);
    if(livelloDopo > livelloPrima){
        pannelloLevelUp(index, livelloDopo);
        salva();
        return;
    }
    salva();
    apriPG(index);
}

let statBonusUsato = -1;    
    
function gestioneStat(input,index){
    let pgIndex = document.body.dataset.pgIndex;
    let pg = party[pgIndex];
    let livello = livelloDaXP(pg.xp);
    let base = pg.statsBase[index];
    let attuale = pg.stats[index];
    let val = parseInt(input.value);
    let aumentoDisponibile = (livello % 4 === 0) && (pg.ultimoAumentoStat !== livello);
    if(!aumentoDisponibile){
        input.value = base;
        return;
    }
    if(val < base){
        input.value = base;
        return;
    }
    if(val > base + 1){
        input.value = base + 1;
        val = base + 1;
    }
    if(val === base){
        statBonusUsato = -1;
        pg.stats[index] = base;
        document.getElementById("salvaBtn").disabled = true;
        document.getElementById("statMsg").innerText = "⬆ Distribuisci il punto caratteristica";
        return;
    }
    if(val === base + 1){
        if(statBonusUsato !== -1 && statBonusUsato !== index){
            input.value = attuale;
            return;
        }
        statBonusUsato = index;
        pg.stats[index] = val;
        document.getElementById("salvaBtn").disabled = false;
        document.getElementById("statMsg").innerText = "";
    }
}

function pannelloLevelUp(index, livello){
    let pg=party[index];
    //reset stato level up
    pg.levelUpMode = null;
    pg.selectedClassIndex = null;
    
    let html = `
    <h2>🎉 Level Up!</h2>
    <p>Il personaggio è salito al livello ${livello}</p>
    <br><br>
    <h3>Punti Ferita guadagnati</h3>
    <input id="pfLevelUp" type="number" placeholder="da 1 a 20">
    <br><br>
    <h3>Scelta Classe</h3>
    <div id="sceltaClasse">
    <button onclick="mostraClassi(${index})">Classi esistenti</button>
    <br><br>
    <button onclick="mostraNuovaClasse(${index})">Nuova classe</button>
    </div>
    <br><br>
    <button onclick="confermaLevelUp(${index})">✅ Conferma Level Up</button>
    `;
    document.getElementById("app").innerHTML = html;
}

function mostraClassi(index){
    let pg = party[index];
    pg.levelUpMode = "existing";
    let html = `<button onclick="pannelloLevelUp(${index}, ${livelloDaXP(pg.xp)})">⬅ Indietro</button><br><br>`;
    for(let i=0;i<pg.classi.length;i++){
        let selected = (pg.selectedClassIndex === i) ? "style='background:green'" : "";
        html += `
        <button ${selected} onclick="selezionaClasse(${index}, ${i})">${pg.classi[i].nome} (Lv ${pg.classi[i].livello})</button>
        <br><br>
        `;
    }
    document.getElementById("sceltaClasse").innerHTML = html;
}

function selezionaClasse(index, classeIndex){
    let pg = party[index];
    pg.selectedClassIndex = classeIndex;
    mostraClassi(index);
}

function mostraNuovaClasse(index){
    let pg = party[index];
    pg.levelUpMode = "new";
    let html = `
    <button onclick="pannelloLevelUp(${index}, ${livelloDaXP(pg.xp)})">⬅ Indietro</button>
    <br><br>
    Nome nuova classe:<br><input id="nuovaClasseNome">
    `;
    document.getElementById("sceltaClasse").innerHTML = html;
}

function confermaLevelUp(index){
    let pg = party[index];
    let pfGain = parseInt(document.getElementById("pfLevelUp").value);
    // VALIDAZIONE PF
    if(isNaN(pfGain) || pfGain < 1 || pfGain > 20){
        alert("I PF devono essere un numero tra 1 e 20"); //ho messo questo limite perché non penso che con un livello uno possa acquisire più di 20 pf, per ora il DV più alto è il barbaro con il d12 e per arrivare a 20 dovrebbe avere COS 26... 
    return;
    }
    // VALIDAZIONE SCELTA
    if(!pg.levelUpMode){
        alert("Devi scegliere una modalità (classe esistente o nuova)");
    return;
    }
    // CASO CLASSE ESISTENTE
    if(pg.levelUpMode === "existing"){
        if(pg.selectedClassIndex === null){
            alert("Seleziona una classe");
        return;
        }
    pg.classi[pg.selectedClassIndex].livello += 1;
    }
    // CASO NUOVA CLASSE
    if(pg.levelUpMode === "new"){
        let nome = document.getElementById("nuovaClasseNome")?.value;
        if(!nome || nome.trim() === ""){
            alert("Inserisci il nome della nuova classe");
        return;
        }
        pg.classi.push({
        nome:nome.trim(),
        livello:1
        });
    }
    // AGGIUNTA PF
    pg.pfmax += pfGain;
    pg.pf += pfGain;
    // PULIZIA
    pg.levelUpMode = null;
    pg.selectedClassIndex = null;
    pg.inLevelUp = false;

    salva();
    apriPG(index);
}    

//function scegliClasseEsistente(index){
//    let pg = party[index];
//    let html = `<h2>Scegli la classe da aumentare</h2>`;
//    for(let i=0;i<pg.classi.length;i++){
//        html += `<button onclick="aumentaClasse(${index},${i})">${pg.classi[i].nome} (Liv ${pg.classi[i].livello})</button><br><br>`;
//    }
//    document.getElementById("app").innerHTML = html;
//}

//function aumentaClasse(index,classeIndex){
//    party[index].classi[classeIndex].livello += 1;
//    salva();
//    apriPG(index);
//}

//function nuovaClasse(index){
//    let html = `
//    <h2>Nuova Classe</h2>
//    Nome classe<br><input id="nuovaClasseNome">
//    <br><br>
//    <button onclick="confermaNuovaClasse(${index})">Aggiungi classe</button>
//    `;
//    document.getElementById("app").innerHTML = html;
//}

//function confermaNuovaClasse(index){
//    let nome = document.getElementById("nuovaClasseNome").value;
//    if(nome.trim() === ''){
//        alert("Il nome della classe non può essere vuoto.");
//        return;
//    }
//    party[index].classi.push({ nome:nome.trim(), livello:1 });
//    salva();
//    menuPG();
//}

function modStat(statIndex, delta){
    let index = document.body.dataset.pgIndex;
    let inputs = document.querySelectorAll(".statgrid input");
    let input = inputs[statIndex];
    let base = parseInt(input.dataset.base);
    let attuale = parseInt(input.value);
    if(attuale + delta < base)return;
    let bonusUsato = 0;
    inputs.forEach(inp => {
        bonusUsato += (parseInt(inp.value) - parseInt(inp.dataset.base));
    });
    if(delta > 0 && bonusUsato >= 1) return;
    input.value = attuale + delta;
    calcMod(input);
    aggiornaBottoneSalva();
}

function aggiornaBottoneSalva(){
    let inputs = document.querySelectorAll(".statgrid input");
    let bonusUsato = 0;
    inputs.forEach(inp => {
        bonusUsato += (parseInt(inp.value) - parseInt(inp.dataset.base));
    });
    let btn = document.getElementById("salvaBtn");
    let msg = document.getElementById("statMsg");
    if(bonusUsato === 0){
        btn.disabled = true;
        msg.innerText = "⬆ Distribuisci il punto caratteristica";
    }else{
        btn.disabled = false;
        msg.innerText = "";
    }
}

menuPG();

// ========================================================================
// Initial Load
// ========================================================================

checkAuth();
