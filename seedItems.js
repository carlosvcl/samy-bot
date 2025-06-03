// seedItems.js
require('dotenv').config();
const mongoose = require('mongoose');
const Item = require('./src/models/itemSchema'); // Ajuste o caminho se necessário
const connectDB = require('./src/database/mongoose'); // Ajuste o caminho se necessário

const itemsToSeedDefinition = [
    // --- RECURSOS PRIMÁRIOS ---
    { 
        name: 'Pedra', description: 'Um bloco de pedra comum.', category: 'resource', 
        rarity: 'common', sellPrice: 2, isObtainable: false,
        tags: ['mining_drop', 'crafting_material']
    },
    { 
        name: 'Madeira Bruta', description: 'Um tronco de árvore não processado.', category: 'resource', 
        rarity: 'common', sellPrice: 1, isObtainable: false,
        tags: ['gathering_drop', 'crafting_material']
    },
    { 
        name: 'Minério de Ferro', description: 'Minério de ferro bruto, precisa ser refinado.', category: 'resource', 
        rarity: 'uncommon', sellPrice: 5, isObtainable: false,
        tags: ['mining_drop_rare', 'crafting_material']
    },
    { 
        name: 'Cristal Bruto', description: 'Um cristal com potencial energético.', category: 'resource', 
        rarity: 'rare', sellPrice: 10, isObtainable: false,
        tags: ['mining_drop_very_rare', 'crafting_material', 'magic_component']
    },

    // --- RECURSOS PROCESSADOS ---
    { 
        name: 'Madeira Refinada', description: 'Tábuas de madeira processada.', category: 'resource', 
        rarity: 'common', buyPrice: 10, sellPrice: 4,
        tags: ['crafting_material', 'processed_wood']
    },
    { 
        name: 'Barra de Ferro', description: 'Ferro refinado, pronto para uso.', category: 'resource', 
        rarity: 'uncommon', buyPrice: 50, sellPrice: 20,
        tags: ['crafting_material', 'processed_metal']
    },

    // --- FERRAMENTAS ---
    { 
        name: 'Picareta de Madeira', description: 'Uma picareta básica para mineração.', category: 'tool', 
        rarity: 'common', buyPrice: 50, sellPrice: 10, tags: ['pickaxe', 'tier1', 'mining_tool'],
        _tempEvolution: {
            evolvesToItemName: "Picareta de Pedra",
            requiredLevel: 3, requiredCurrency: 100, requiredEnergy: 15,
            requiredMaterials: [{ itemName: "Pedra", quantity: 20 }, { itemName: "Madeira Refinada", quantity: 5 }]
        }
    },
    { 
        name: 'Picareta de Pedra', description: 'Uma picareta mais eficiente.', category: 'tool', 
        rarity: 'uncommon', buyPrice: 250, sellPrice: 50, tags: ['pickaxe', 'tier2', 'mining_tool'],
        _tempEvolution: {
            evolvesToItemName: "Picareta de Ferro",
            requiredLevel: 8, requiredCurrency: 500, requiredEnergy: 30,
            requiredMaterials: [{ itemName: "Barra de Ferro", quantity: 10 }, { itemName: "Madeira Refinada", quantity: 10 }]
        }
    },
    { 
        name: 'Picareta de Ferro', description: 'Uma picareta robusta para minérios melhores.', category: 'tool', 
        rarity: 'rare', buyPrice: 1200, sellPrice: 250, tags: ['pickaxe', 'tier3', 'mining_tool'],
    },

    // --- CONSUMÍVEIS ---
    { 
        name: 'Poção de Energia Pequena', description: 'Restaura 25 de energia.', category: 'consumable', 
        rarity: 'common', buyPrice: 75, sellPrice: 15, usable: true, 
        useEffects: { action: 'heal_energy', value: 25, message: 'Você bebeu a poção e restaurou 25 de energia!' }
    },
    { 
        name: 'Poção de Sorte Rápida', description: 'Aumenta as recompensas dos próximos 2 usos de `s!work` ou `s!mine` em 20% por 10 minutos.', category: 'consumable', 
        rarity: 'uncommon', buyPrice: 300, sellPrice: 75, usable: true, 
        useEffects: { 
            action: 'activate_luck_boost', value: 1.20, 
            durationMinutes: 10, uses: 2, commandScope: ['work', 'mine'],
            message: 'Você se sente mais sortudo! Suas próximas 2 atividades de trabalho/mineração nos próximos 10 minutos podem render mais!' 
        }
    },
    {
        name: "Pergaminho de XP (Pequeno)", description: "Concede 100 XP instantaneamente.", category: "consumable",
        rarity: "common", buyPrice: 150, sellPrice: 30, usable: true,
        useEffects: { action: "grant_xp", value: 100, message: "Você absorveu o conhecimento e ganhou 100 XP!" }
    },
    {
        name: "Token de Mudança de Apelido (Bot)", description: "Permite alterar seu apelido exibido em alguns contextos do bot.", category: "consumable",
        rarity: "rare", buyPrice: 2000, sellPrice: 100, usable: true,
        useEffects: { 
            action: "change_profile_display_name", 
            value: true, // Placeholder, o nome real vem dos args do comando s!use
            message: "Seu apelido no bot foi alterado! Use s!use \"Token de Mudança de Apelido (Bot)\" <novo_apelido>"
        }
    },

    // --- GERADORES ---
    { 
        name: 'Fazenda de Moedas Rústica', description: 'Gera 5 moedas a cada hora.', category: 'generator', 
        rarity: 'common', buyPrice: 1000, sellPrice: 200, 
        effects: { passiveIncome: 5, passiveIncomeIntervalHours: 1 }, // passiveIncome está OK para a 1ª passagem
        _tempEvolution: {
            evolvesToItemName: "Plantação de Moedas Avançada",
            requiredLevel: 10, requiredCurrency: 2500, requiredEnergy: 50,
            requiredMaterials: [{ itemName: "Madeira Refinada", quantity: 20 }, { itemName: "Barra de Ferro", quantity: 5 }]
        }
    },
    {
        name: "Plantação de Moedas Avançada", description: "Gera 15 moedas a cada hora.", category: "generator",
        rarity: "rare", buyPrice: 6000, sellPrice: 1200,
        effects: { passiveIncome: 15, passiveIncomeIntervalHours: 1 }
    },
    {
        name: "Mina de Cristal Automatizada (P)", description: "Produz 1 Cristal Bruto a cada 24 horas.", category: "generator",
        rarity: "epic", buyPrice: 10000, sellPrice: 2000,
        // A definição original dos dados do item terá a estrutura com 'itemNameForSeed'
        // Esta propriedade _tempPassiveResourceGeneration será usada na segunda passagem para popular effects.passiveResourceGeneration
        effects: { 
             // Outros efeitos que não dependem de resolução de ID podem estar aqui.
             // Por exemplo, se este item também desse um bônus de XP, seria aqui:
             // xpGainModifier: 1.05 
             _tempPassiveResourceGeneration: [{ itemNameForSeed: "Cristal Bruto", quantity: 1, intervalHours: 24 }]
        }
    },

    // --- LOOTBOXES ---
    {
        name: "Caixa Surpresa Comum", description: "Uma caixa simples, mas quem sabe o que você pode encontrar?", category: "lootbox",
        rarity: "common", buyPrice: 250, sellPrice: 10, usable: true,
        effects: { lootTableId: "common_mystery_box_v1" }, // OK para 1ª passagem
        useEffects: { 
            action: "open_lootbox", 
            value: "common_mystery_box_v1", 
            message: "Você abre a Caixa Surpresa Comum e encontra..." 
        }
    },

    // --- MATERIAIS DE EVOLUÇÃO ESPECÍFICOS ---
    {
        name: "Núcleo de Energia Instável", description: "Um núcleo instável usado para evoluções energéticas.", category: "evolutionMaterial",
        rarity: "rare", buyPrice: 750, sellPrice: 150, tags: ['crafting_material', 'energy_component']
    },
    
    // --- ITENS ESPECIAIS (COM EFEITOS PASSIVOS) ---
    {
        name: "Amuleto do Trabalhador Ágil",
        description: "Reduz o cooldown do comando `s!work` em 15% enquanto estiver no inventário.",
        category: "special", rarity: "epic", buyPrice: 20000, sellPrice: 4000, usable: false,
        effects: { commandCooldownModifiers: [{ commandName: 'work', modifier: 0.85 }] }, // OK para 1ª passagem
        tags: ['cooldown_reduction', 'passive_buff']
    }
];

const seedDB = async () => {
    try {
        await connectDB();
        console.log('Limpando itens existentes...');
        await Item.deleteMany({});
        console.log('Itens limpos.');

        // 1ª Passagem: Preparar dados para inserção inicial
        const itemsToInsertInitially = itemsToSeedDefinition.map(itemDef => {
            // Desestrutura para separar _tempEvolution e o objeto effects original
            const { _tempEvolution, effects: originalEffects, ...itemDataForInsert } = itemDef;
            
            const initialEffectsObject = {}; // Objeto para construir os 'effects' da 1ª passagem

            if (originalEffects) {
                // Copia todos os campos de 'effects' EXCETO 'passiveResourceGeneration' e '_tempPassiveResourceGeneration'
                for (const key in originalEffects) {
                    if (key !== 'passiveResourceGeneration' && key !== '_tempPassiveResourceGeneration' && 
                        Object.prototype.hasOwnProperty.call(originalEffects, key)) {
                        initialEffectsObject[key] = originalEffects[key];
                    }
                }
            }

            const finalItemData = { ...itemDataForInsert };
            // Adiciona o objeto 'effects' apenas se ele tiver alguma propriedade
            // (ou se era um objeto vazio intencionalmente na definição original e não continha os campos problemáticos)
            if (Object.keys(initialEffectsObject).length > 0 || (originalEffects && Object.keys(originalEffects).length === 0 && !originalEffects.passiveResourceGeneration && !originalEffects._tempPassiveResourceGeneration) ) {
                 finalItemData.effects = initialEffectsObject;
            }
            // 'useEffects' já foi copiado como está em itemDataForInsert
            // 'evolutionRecipe' e 'effects.passiveResourceGeneration' serão adicionados/completados na 2ª passagem.

            return finalItemData;
        });

        console.log('Inserindo itens básicos (1ª passagem)...');
        await Item.insertMany(itemsToInsertInitially);
        console.log(`${itemsToInsertInitially.length} Itens básicos semeados com sucesso!`);

        // Preparar para a 2ª Passagem
        const allInsertedItems = await Item.find({});
        const itemNameMap = new Map();
        allInsertedItems.forEach(item => itemNameMap.set(item.name, item._id));
        console.log('Mapa de nome de item para ID criado.');

        console.log('Atualizando itens com referências de ObjectId (2ª passagem)...');
        for (const itemDef of itemsToSeedDefinition) { // Itera sobre a definição ORIGINAL dos itens
            const baseItemFromDB = allInsertedItems.find(i => i.name === itemDef.name);
            if (!baseItemFromDB) {
                console.warn(`Item base "${itemDef.name}" não encontrado na segunda passagem.`);
                continue;
            }

            const updatesForSet = {}; 
            let needsDBUpdate = false;

            // Processar Receitas de Evolução (usando _tempEvolution da definição original)
            if (itemDef._tempEvolution) {
                const evolvedToId = itemNameMap.get(itemDef._tempEvolution.evolvesToItemName);
                if (evolvedToId) {
                    const recipe = {
                        evolvesToItemId: evolvedToId,
                        requiredLevel: itemDef._tempEvolution.requiredLevel || 0,
                        requiredCurrency: itemDef._tempEvolution.requiredCurrency || 0,
                        requiredEnergy: itemDef._tempEvolution.requiredEnergy || 0,
                        requiredItems: []
                    };
                    if (itemDef._tempEvolution.requiredMaterials) {
                        for (const material of itemDef._tempEvolution.requiredMaterials) {
                            const materialId = itemNameMap.get(material.itemName);
                            if (materialId) {
                                recipe.requiredItems.push({ itemId: materialId, quantity: material.quantity });
                            } else {
                                console.warn(`  Material "${material.itemName}" não encontrado para a receita de "${itemDef.name}".`);
                            }
                        }
                    }
                    updatesForSet.evolutionRecipe = recipe;
                    needsDBUpdate = true;
                } else {
                    console.warn(`  Item evoluído "${itemDef._tempEvolution.evolvesToItemName}" (para "${itemDef.name}") não encontrado no mapa.`);
                }
            }

            // Processar passiveResourceGeneration (usando _tempPassiveResourceGeneration da definição original)
            if (itemDef.effects && itemDef.effects._tempPassiveResourceGeneration ) {
                const tempPassiveGen = itemDef.effects._tempPassiveResourceGeneration;
                const finalResourceGenArray = [];
                if (tempPassiveGen) {
                    for (const resDef of tempPassiveGen) {
                        const resourceItemId = itemNameMap.get(resDef.itemNameForSeed);
                        if (resourceItemId) {
                            finalResourceGenArray.push({
                                itemId: resourceItemId,
                                quantity: resDef.quantity,
                                intervalHours: resDef.intervalHours
                            });
                        } else {
                             console.warn(`  Recurso "${resDef.itemNameForSeed}" não encontrado para geração passiva em "${itemDef.name}".`);
                        }
                    }
                }

                if (finalResourceGenArray.length > 0) {
                    // Para atualizar um campo dentro de um subdocumento, precisamos especificar o caminho completo no $set
                    // ou reconstruir o objeto effects. Vamos usar a notação de ponto para $set.
                    // updatesForSet['effects.passiveResourceGeneration'] = finalResourceGenArray;
                    // Para garantir que outros campos em 'effects' não sejam perdidos se 'effects' não estava em updatesForSet:
                    if (!updatesForSet.effects) { // Se effects ainda não está sendo modificado por evolutionRecipe
                        updatesForSet.effects = baseItemFromDB.effects ? { ...baseItemFromDB.effects.toObject() } : {};
                    }
                    updatesForSet.effects.passiveResourceGeneration = finalResourceGenArray;
                    needsDBUpdate = true;
                }
            }
            
            if (needsDBUpdate) {
                await Item.updateOne({ _id: baseItemFromDB._id }, { $set: updatesForSet });
                console.log(`  Item atualizado: ${baseItemFromDB.name} com referências.`);
            }
        }
        console.log('Itens completamente atualizados com receitas e IDs de recursos!');

    } catch (error) {
        console.error('Erro ao semear o banco de dados:', error.message);
        if (error.errors) {
            for (const field in error.errors) {
                console.error(`  - ${field}: ${error.errors[field].message}`);
            }
        }
    } finally {
        mongoose.connection.close().then(() => console.log('Conexão com o MongoDB fechada.'));
    }
};

seedDB();