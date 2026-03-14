// --- HELPER FUNCTIONS ---

// Averages ranges like "5-7" for defenses
const getAverage = (min, max) => Math.round((parseInt(min) + parseInt(max)) / 2);

// Splits text like "3 D6" into Foundry's value and dice fields
function splitAttribute(attrString) {
    if (!attrString) return { value: 0, dice: "d6" };
    const parts = attrString.split('D');
    return { 
        value: parseInt(parts[0].trim()), 
        dice: `d${parts[1].trim()}` 
    };
}

// Maps our parsed data into Foundry's exact item schema
function buildItems(npcData) {
    let items = [];

    // Map Weapons
    npcData.weapons.forEach(w => {
        items.push({
            name: w.name,
            type: "weapon",
            system: {
                damage: w.damage.toLowerCase(), 
                range: w.range.toLowerCase(),   
                weaponType: w.attackType.toLowerCase(), 
                description: ""
            }
        });
    });

    // Map Abilities
    npcData.abilities.forEach(a => {
        items.push({
            name: a.name,
            type: "npcability", // Note: matches the 'npcability' ID from your JSON dump
            system: {
                description: a.description
            }
        });
    });

    return items;
}


// --- CORE LOGIC ---

// 1. Parse the raw PDF text into a JavaScript object
function parseConanNPC(rawText) {
    const text = rawText.replace(/–/g, '-').trim(); // Standardize en-dashes
    const lines = text.split('\n').map(l => l.trim());

    let npcData = {
        name: lines[0] || "Unknown NPC",
        origin: lines[1] ? lines[1].split('-')[0].trim() : "",
        type: lines[1] ? lines[1].split('-')[1].trim() : "Minion",
        attributes: {},
        defenses: {},
        health: {},
        weapons: [],
        armor: null,
        abilities: []
    };

    // Extract Attributes
    const attrMatches = lines[3] ? lines[3].match(/(\d+\s*D\d+)/g) : null;
    if (attrMatches && attrMatches.length === 4) {
        npcData.attributes.might = attrMatches[0];
        npcData.attributes.edge = attrMatches[1];
        npcData.attributes.grit = attrMatches[2];
        npcData.attributes.wits = attrMatches[3];
    }

    // Extract Defenses
    const physDefMatch = text.match(/Physical[\s\S]*?Defense\s+(\d+)-(\d+)/i);
    if (physDefMatch) npcData.defenses.physical = getAverage(physDefMatch[1], physDefMatch[2]);

    const sorcDefMatch = text.match(/Sorcery[\s\S]*?Defense\s+(\d+)-(\d+)/i);
    if (sorcDefMatch) npcData.defenses.sorcery = getAverage(sorcDefMatch[1], sorcDefMatch[2]);

    // Extract Health/Threshold
    const thresholdMatch = text.match(/Threshold\s+(\d+)/i);
    if (thresholdMatch) npcData.health.threshold = parseInt(thresholdMatch[1]);

    const lifePointsMatch = text.match(/Life[\s\S]*?points\s+(\d+)/i);
    if (lifePointsMatch) npcData.health.lifePoints = parseInt(lifePointsMatch[1]);

    // Extract Weapons
    const weaponRegex = /(Melee|Ranged|Thrown)\s+Damage\s+(.*?)\n\(Range:\s+(.*?)\)\s+(.*?)(?=\n|$)/gi;
    let match;
    while ((match = weaponRegex.exec(text)) !== null) {
        npcData.weapons.push({
            attackType: match[1].trim(),
            name: match[2].trim(),
            range: match[3].trim(),
            damage: match[4].trim()
        });
    }

    // Extract Armor
    const armorMatch = text.match(/AR\s+of\s+(\d+)-(\d+)/i);
    if (armorMatch) {
        npcData.armor = {
            min: parseInt(armorMatch[1]),
            max: parseInt(armorMatch[2]),
            value: getAverage(armorMatch[1], armorMatch[2])
        };
    }

    // Extract Abilities
    const abilityRegex = /([A-Z][\w\s]+:\s*.*?)(?=\n[A-Z]|\n*$)|(A\s+.*?may\s+take\s+\d+\s+Actions.*)/gi;
    while ((match = abilityRegex.exec(text)) !== null) {
        let abilityText = match[0].replace(/\n/g, ' ').trim();
        if (!abilityText.includes("AR of") && !abilityText.includes("Damage")) {
             npcData.abilities.push({
                 name: abilityText.includes(':') ? abilityText.split(':')[0].trim() : "Action Rule",
                 description: abilityText
             });
        }
    }

    return npcData;
}

// 2. Feed the parsed object into the Foundry database
async function createConanNPC(npcData) {
    const actorData = {
        name: npcData.name,
        type: "npc",
        system: {
            attributes: {
                might: splitAttribute(npcData.attributes.might),
                edge: splitAttribute(npcData.attributes.edge),
                grit: splitAttribute(npcData.attributes.grit),
                wits: splitAttribute(npcData.attributes.wits)
            },
            life: {
                value: npcData.health.lifePoints || 0,
                max: npcData.health.lifePoints || 0
            },
            defence: {
                physical: { value: npcData.defenses.physical || 0 },
                sorcery: { value: npcData.defenses.sorcery || 0 }
            },
            threshold: npcData.health.threshold || 0,
            ennemyType: npcData.type ? npcData.type.toLowerCase() : "minion",
            classification: npcData.origin ? npcData.origin.toLowerCase() : "",
            armorRating: {
                min: npcData.armor ? npcData.armor.min : 0,
                max: npcData.armor ? npcData.armor.max : 0,
                value: npcData.armor ? npcData.armor.value : 0 
            }
        },
        items: buildItems(npcData)
    };

    // Create the actor
    const newActor = await Actor.create(actorData);
    
    // Pop the sheet open on the screen
    if (newActor) {
        newActor.sheet.render(true);
        ui.notifications.info(`Successfully parsed and created ${npcData.name}!`);
    } else {
        ui.notifications.error("Failed to create NPC. Check the console for details.");
    }
}

// --- GLOBAL EXPORT ---
// We attach this to the window so our ui.js file can call it easily
window.ConanPDFParser = {
    parseAndCreate: async function(rawText) {
        try {
            const parsedData = parseConanNPC(rawText);
            await createConanNPC(parsedData);
        } catch (error) {
            console.error("Conan PDF Parser Error:", error);
            ui.notifications.error("Failed to parse the text. Ensure it was copied directly from the PDF.");
        }
    }
};