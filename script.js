
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
let skillsTemp = {};
let skillPointsDisponibili = 0;

const XP_LEVELS = [
    0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 
    55000, 66000, 78000, 91000, 105000, 120000, 136000, 153000, 171000, 190000
];

// Saving Throws - ability scores index (0=STR, 1=DEX, 2=CON, 3=INT, 4=WIS, 5=CHA)
const SAVING_THROWS_CONFIG = {
    "Tempra": 2,      // Costituzione
    "Riflessi": 1,    // Destrezza
    "Volontà": 4      // Saggezza
};

const SKILLS_CONFIG = {
    "Acrobazia": { stat: 1, label: "DES" },
    "Artigianato": { stat: 3, label: "INT" },
    "Concentrazione": { stat: 2, label: "COS" },
    "Diplomazia": { stat: 5, label: "CHA" },
    "Furtività": { stat: 1, label: "DES" },
    "Percezione": { stat: 4, label: "SAG" },
    "Raggirare": { stat: 5, label: "CHA" }
};

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
                classi += " / ";
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
            Razza: ${pg.razza || "-"}<br>
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
    Razza<br>
    <select id="razza">
        <option value="">Seleziona una razza</option>
        <option value="Umano">Umano</option>
        <option value="Nano">Nano</option>
        <option value="Elfo">Elfo</option>
        <option value="Gnomo">Gnomo</option>
        <option value="Mezzorco">Mezzorco</option>
        <option value="Mezzelfo">Mezzelfo</option>
        <option value="Halfling">Halfling</option>
    </select><br><br>
    <h3>Classi</h3>
    <div id="classi">
    <div>
        <input placeholder="Classe" class="classe">
        <input type="number" placeholder="Livello" class="livello">
        <input type="number" placeholder="Skill Points/Lvl" class="skillpoints">
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
    <h3>Tiri Salvezza</h3>
    <div style="overflow-x: auto;">
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ccc; padding: 8px;">Tiro Salvezza</th>
            <th style="border: 1px solid #ccc; padding: 8px;">TS BASE</th>
            <th style="border: 1px solid #ccc; padding: 8px;">Mod. Caratteristica</th>
            <th style="border: 1px solid #ccc; padding: 8px;">ALTRO</th>
            <th style="border: 1px solid #ccc; padding: 8px;">TOTALE</th>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Tempra</b> (COS)</td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-base" data-st="Tempra" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-mod" data-st="Tempra" disabled></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-altro" data-st="Tempra" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><span class="st-total" data-st="Tempra">0</span></td>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Riflessi</b> (DES)</td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-base" data-st="Riflessi" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-mod" data-st="Riflessi" disabled></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-altro" data-st="Riflessi" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><span class="st-total" data-st="Riflessi">0</span></td>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Volontà</b> (SAG)</td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-base" data-st="Volontà" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-mod" data-st="Volontà" disabled></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><input type="number" class="st-altro" data-st="Volontà" value="0"></td>
            <td style="border: 1px solid #ccc; padding: 8px;"><span class="st-total" data-st="Volontà">0</span></td>
        </tr>
    </table>
    </div>    
    <h3>Abilità</h3>
    <div>
    Punti abilità disponibili: <span id="skillPointsDisponibili">0</span>
    </div>
    <div id="skillsTable"></div>
    <button onclick="salvaPG()">💾 Salva</button>
    `;
    document.getElementById("app").innerHTML = html;
    skillsTemp = {};
    skillPointsDisponibili = 0;
    setTimeout(() => {
    document.querySelectorAll(".statgrid input").forEach(input => {
        if(input.value){
            calcMod(input);
        }
    });
        // aggiorna punti abilità quando cambi INT
    document.querySelectorAll(".statgrid input").forEach(input => {
    input.addEventListener("input", aggiornaSkillPointsNewPG);
    });

    // aggiorna quando cambi razza
    document.getElementById("razza").addEventListener("change", aggiornaSkillPointsNewPG);

    // aggiorna quando cambi classi/livelli/SP
    document.addEventListener("input", (e) => {
    if(e.target.classList.contains("classe") ||
       e.target.classList.contains("livello") ||
       e.target.classList.contains("skillpoints")){
        aggiornaSkillPointsNewPG();
    }
    });
    generaSkillsTable();
    aggiornaSkillPointsNewPG();
    document.querySelectorAll(".st-base, .st-altro").forEach(input => {
        input.addEventListener("input", () => aggiornaTotaleTiriSalvezza())
    });
    aggiornaTotaleTiriSalvezza();}, 10);
}

function aggiungiClasse(){
    let div = document.getElementById("classi");
    let nuovo = document.createElement("div");
    nuovo.innerHTML = `<input placeholder="Classe" class="classe"><input type="number" placeholder="Livello" class="livello"><input type="number" placeholder="Skill Points/Lvl" class="skillpoints">`;
    div.appendChild(nuovo);
}

function calcMod(input){
    let val = parseInt(input.value) || 0;
    let mod = Math.floor((val - 10) / 2);
    let valDiv = input.parentElement;
    let modDiv = valDiv.nextElementSibling;
    if(mod >= 0){
        modDiv.textContent = "+" + mod;
    } else {
        modDiv.textContent = mod;
    }
}

function aggiornaTotaleTiriSalvezza() {
    const statValues = [];
    document.querySelectorAll(".statgrid input").forEach(input => {
        statValues.push(parseInt(input.value) || 0);
    });
    Object.keys(SAVING_THROWS_CONFIG).forEach(st => {
        const statIndex = SAVING_THROWS_CONFIG[st];
        const mod = Math.floor((statValues[statIndex] - 10) / 2);
        
        const modInput = document.querySelector(`.st-mod[data-st="${st}"]`);
        const baseInput = document.querySelector(`.st-base[data-st="${st}"]`);
        const altroInput = document.querySelector(`.st-altro[data-st="${st}"]`);
        const totalSpan = document.querySelector(`.st-total[data-st="${st}"]`);
        if (modInput) modInput.value = mod;
            if (baseInput && altroInput && totalSpan) {
            const base = parseInt(baseInput.value) || 0;
            const altro = parseInt(altroInput.value) || 0;
            const total = base + mod + altro;
            totalSpan.textContent = total;
            }
    });
}

function generaSkillsTable(){
    let container = document.getElementById("skillsTable");

    let html = `
    <div class="skills-row skills-header">
        <div>Classe</div>
        <div>Abilità</div>
        <div>Caratt</div>
        <div>Gradi</div>
        <div>+</div>
        <div>-</div>
    </div>
    `;

    Object.keys(SKILLS_CONFIG).forEach(skill => {

        if(!skillsTemp[skill]){
            skillsTemp[skill] = {gradi:0, classe:false};
        }

        html += `
        <div class="skills-row">
            <div>
                <input type="checkbox" 
                       onchange="toggleClasse('${skill}', this.checked)">
            </div>
            <div>${skill}</div>
            <div>${SKILLS_CONFIG[skill].label}</div>
            <div id="gradi-${skill}">0</div>
            <div><button onclick="modSkill('${skill}', 1)">+</button></div>
            <div><button onclick="modSkill('${skill}', -1)">-</button></div>
        </div>
        `;
    });

    container.innerHTML = html;
}

function toggleClasse(skill, value){
    skillsTemp[skill].classe = value;

    let max = maxGradiConsentiti(skill);

    if(skillsTemp[skill].gradi > max){
        let diff = skillsTemp[skill].gradi - max;

        let costo = value ? 1 : 2;

        skillsTemp[skill].gradi = max;
        skillPointsDisponibili += diff * costo;

        document.getElementById(`gradi-${skill}`).innerText = max;
        document.getElementById("skillPointsDisponibili").innerText = skillPointsDisponibili;
    }
}

function aggiornaSkillPointsNewPG(){
    let stats = [];
    document.querySelectorAll(".statgrid input").forEach(i => {
        stats.push(parseInt(i.value) || 0);
    });

    let modInt = Math.floor((stats[3] - 10) / 2);
    let razza = document.getElementById("razza").value;
    let bonusUmano = razza === "Umano" ? 1 : 0;

    let classInputs = document.querySelectorAll(".classe");
    let levelInputs = document.querySelectorAll(".livello");
    let spInputs = document.querySelectorAll(".skillpoints");

    let totale = 0;

    if(classInputs.length > 0){
        let sp = parseInt(spInputs[0].value) || 0;
        totale += (sp + modInt + bonusUmano) * 4;

        let lvl = parseInt(levelInputs[0].value) || 1;
        totale += (lvl - 1) * (sp + modInt + bonusUmano);

        for(let i=1;i<classInputs.length;i++){
            let sp2 = parseInt(spInputs[i].value) || 0;
            let lvl2 = parseInt(levelInputs[i].value) || 0;

            totale += lvl2 * (sp2 + modInt + bonusUmano);
        }
    }

    let puntiSpesi = 0;

    Object.values(skillsTemp).forEach(s => {
    if(s.gradi){
        puntiSpesi += s.gradi * (s.classe ? 1 : 2);
        }
    });

    skillPointsDisponibili = totale - puntiSpesi;

    document.getElementById("skillPointsDisponibili").innerText = totale;
    console.log("Totale:", totale, "Spesi:", puntiSpesi, "Disponibili:", skillPointsDisponibili);
}

function modSkill(skill, delta){
    let s = skillsTemp[skill];

    let costo = s.classe ? 1 : 2;

    if(delta > 0){
    let max = maxGradiConsentiti(skill);

    if(s.gradi >= max) return;
    if(skillPointsDisponibili < costo) return;

    s.gradi += 1;
    skillPointsDisponibili -= costo;
    }

    if(delta < 0){
        if(s.gradi <= 0) return;

        s.gradi -= 1;
        skillPointsDisponibili += costo;
    }

    document.getElementById(`gradi-${skill}`).innerText = s.gradi;
    document.getElementById("skillPointsDisponibili").innerText = skillPointsDisponibili;
}

function maxGradiConsentiti(skill){
    let livelloTot = 0;

    let levelInputs = document.querySelectorAll(".livello");
    levelInputs.forEach(inp => {
        livelloTot += parseInt(inp.value) || 0;
    });

    let isClasse = skillsTemp[skill]?.classe;

    if(isClasse){
        return livelloTot + 3;
    } else {
        return Math.floor((livelloTot + 3) / 2);
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
    let skillpointsInputs = document.querySelectorAll(".skillpoints");
    let classi = [];
    for(let i=0;i<classInputs.length;i++){
        let c = classInputs[i].value.trim();
        let l = parseInt(levelInputs[i].value);
        let sp = parseInt(skillpointsInputs[i].value) || 0;
        if(c && l > 0){
        classi.push({nome:c, livello:l, skillpointsPerLvl:sp});
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
        // Raccogli i dati dei tiri salvezza dalla tabella
    let savingThrows = {
        "Tempra": { base: 0, altro: 0 },
        "Riflessi": { base: 0, altro: 0 },
        "Volontà": { base: 0, altro: 0 }
    };
    
    Object.keys(savingThrows).forEach(st => {
        const baseInput = document.querySelector(`.st-base[data-st="${st}"]`);
        const altroInput = document.querySelector(`.st-altro[data-st="${st}"]`);
        if (baseInput && altroInput) {
            savingThrows[st].base = parseInt(baseInput.value) || 0;
            savingThrows[st].altro = parseInt(altroInput.value) || 0;
        }
    });
    let razza = document.getElementById("razza").value;
    let skills = {};
    Object.keys(SKILLS_CONFIG).forEach(skill => {
    skills[skill] = {
        gradi: skillsTemp[skill]?.gradi || 0,
        altro: 0,
        classe: skillsTemp[skill]?.classe || false
        };
    });
    let pg = {
        nome:nome.trim(), razza:razza, classi:classi, stats:stats, statsBase:[...stats], 
        pfmax:pfmax, pf:pfmax, xpBase:xp, xp:xp, sessioni:[], ultimoAumentoStat:0,
        savingThrows: savingThrows, skills: skills
    };

    party.push(pg);
    salva();
    skillsTemp = {};
    skillPointsDisponibili = 0;
    menuPG();
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

function calcolaTotaleTiriSalvezza(pg, tipoTS) {
    if (!pg.savingThrows || !pg.savingThrows[tipoTS]) {
        return 0;
    }
    const statIndex = SAVING_THROWS_CONFIG[tipoTS];
    const mod = Math.floor((pg.stats[statIndex] - 10) / 2);
    const base = pg.savingThrows[tipoTS].base || 0;
    const altro = pg.savingThrows[tipoTS].altro || 0;
    return base + mod + altro;
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
    <div class="pg-header">
    <h2>${pg.nome}</h2>
    <button class="btn-skill" onclick="apriAbilita(${index})">📚 Abilità</button>
    </div>
    <div><b>Razza:</b> ${pg.razza || "-"}</div>
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
    <h3>Tiri Salvezza</h3>
    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="text-align: center; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
            <b>Tempra</b><br>
            <span style="font-size: 24px; font-weight: bold;">${calcolaTotaleTiriSalvezza(pg, 'Tempra')}</span>
        </div>
        <div style="text-align: center; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
            <b>Riflessi</b><br>
            <span style="font-size: 24px; font-weight: bold;">${calcolaTotaleTiriSalvezza(pg, 'Riflessi')}</span>
        </div>
        <div style="text-align: center; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
            <b>Volontà</b><br>
            <span style="font-size: 24px; font-weight: bold;">${calcolaTotaleTiriSalvezza(pg, 'Volontà')}</span>
        </div>
    </div>
    <h3>Punti Ferita</h3>
    PF Massimi<br><input id="pfmax" type="number" value="${pg.pfmax}" disabled><br><br>
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
    <hr style="margin:20 px 0;">
    <br>
    <button id="salvaBtn" onclick="modificaPG(${index})">💾 Salva modifiche</button>
    <button class="deleteBtn" onclick="eliminaPG(${index})">🗑️ Elimina</button>
    <span id="statMsg" style="margin-left:10px;color:orange;font-weight:bold;"></span>
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

function apriAbilita(index){
    let pg = party[index];

    let html = `
    <h2>Abilità - ${pg.nome}</h2>

    <div class="skills-table">
        <div class="skills-row skills-header">
            <div>Abilità</div>
            <div>Tot</div>
            <div>Caratt</div>
            <div>Gradi</div>
            <div>Altro</div>
        </div>
    `;
        Object.keys(SKILLS_CONFIG).forEach(skill => {

        let config = SKILLS_CONFIG[skill];

        let mod = Math.floor((pg.stats[config.stat] - 10) / 2);
        let modFormatted = mod >= 0 ? "+" + mod : mod;

        let gradi = pg.skills?.[skill]?.gradi || 0;
        let altro = pg.skills?.[skill]?.altro || 0;

        let totale = gradi + mod + altro;
        let totFormatted = totale >= 0 ? "+" + totale : totale;

        html += `
        <div class="skills-row">
            <div class="skill-main"><b>${skill}</b></div>
            <div class="skill-main"><b>${totFormatted}</b></div>
            <div class="skill-muted">${modFormatted}</div>
            <div class="skill-muted">${gradi}</div>
            <div class="skill-muted">${altro}</div>
        </div>
        `;
    });
        html += `</div>`;

    html += `
    <button class="back-btn" onclick="apriPG(${index})">⬅ Torna</button>
    `;

    document.getElementById("app").innerHTML = html;
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
    }
    
    salva();
        statBonusUsato = -1;
    menuPG();
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
    pg.levelUpMode = null;
    pg.selectedClassIndex = null;
    
    let html = `
    <h2>🎉 Level Up!</h2>
    <p>Il personaggio è salito al livello ${livello}</p>
    <br><br>
    <h3>Punti Ferita guadagnati</h3>
    <input id="pfLevelUp" type="number" placeholder="da 1 a 20">
    <br><br>
    <h3>Tiri Salvezza</h3>
    <table style="width:100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f0f0f0;">
            <th style="border: 1px solid #ccc; padding: 8px;">Tiro Salvezza</th>
            <th style="border: 1px solid #ccc; padding: 8px;">TS BASE</th>
            <th style="border: 1px solid #ccc; padding: 8px;">ALTRO</th>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Tempra</b></td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">
                <button onclick="modificaTSBase(${index}, 'Tempra', -1)" style="width: 30px;">−</button>
                <input id="tsBase-Tempra" type="number" value="${pg.savingThrows.Tempra.base}" style="width: 50px; text-align: center; margin: 0 5px;" readonly>
                <button onclick="modificaTSBase(${index}, 'Tempra', 1)" style="width: 30px;">+</button>
            </td>
            <td style="border: 1px solid #ccc; padding: 8px;">
                <input id="tsAltro-Tempra" type="number" value="${pg.savingThrows.Tempra.altro}" style="width: 100%;">
            </td>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Riflessi</b></td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">
                <button onclick="modificaTSBase(${index}, 'Riflessi', -1)" style="width: 30px;">−</button>
                <input id="tsBase-Riflessi" type="number" value="${pg.savingThrows.Riflessi.base}" style="width: 50px; text-align: center; margin: 0 5px;" readonly>
                <button onclick="modificaTSBase(${index}, 'Riflessi', 1)" style="width: 30px;">+</button>
            </td>
            <td style="border: 1px solid #ccc; padding: 8px;">
                <input id="tsAltro-Riflessi" type="number" value="${pg.savingThrows.Riflessi.altro}" style="width: 100%;">
            </td>
        </tr>
        <tr>
            <td style="border: 1px solid #ccc; padding: 8px;"><b>Volontà</b></td>
            <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">
                <button onclick="modificaTSBase(${index}, 'Volontà', -1)" style="width: 30px;">−</button>
                <input id="tsBase-Volontà" type="number" value="${pg.savingThrows.Volontà.base}" style="width: 50px; text-align: center; margin: 0 5px;" readonly>
                <button onclick="modificaTSBase(${index}, 'Volontà', 1)" style="width: 30px;">+</button>
            </td>
            <td style="border: 1px solid #ccc; padding: 8px;">
                <input id="tsAltro-Volontà" type="number" value="${pg.savingThrows.Volontà.altro}" style="width: 100%;">
            </td>
        </tr>
    </table>
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

function modificaTSBase(index, tipoTS, delta) {
    let pg = party[index];
    pg.savingThrows[tipoTS].base += delta;
    if (pg.savingThrows[tipoTS].base < 0) {
        pg.savingThrows[tipoTS].base = 0;
    }
    pannelloLevelUp(index, livelloDaXP(pg.xp));
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
        alert("I PF devono essere un numero tra 1 e 20");
        return;
    }
    
    // VALIDAZIONE SCELTA
    if(!pg.levelUpMode){
        alert("Devi scegliere una modalità (classe esistente o nuova)");
        return;
    }
    
    // Salva i tiri salvezza aggiornati
    pg.savingThrows.Tempra.altro = parseInt(document.getElementById("tsAltro-Tempra").value) || 0;
    pg.savingThrows.Riflessi.altro = parseInt(document.getElementById("tsAltro-Riflessi").value) || 0;
    pg.savingThrows.Volontà.altro = parseInt(document.getElementById("tsAltro-Volontà").value) || 0;
    
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
