// src/commands/economia/work.js
const { EmbedBuilder } = require('discord.js');
const ms = require('ms');
const { updateUserEnergy } = require('../../utils/energyHelper'); // Ajuste o caminho

// Constantes base do comando
const BASE_WORK_COOLDOWN_MS = 1 * 60 * 60 * 1000; // 1 hora
const BASE_WORK_ENERGY_COST = 10;
const BASE_WORK_REWARD_MIN = 50;
const BASE_WORK_REWARD_MAX = 200;
const BASE_WORK_XP_REWARD = 25;

module.exports = {
    name: 'work',
    aliases: ['trabalhar', 'trampar'],
    description: 'Trabalha para ganhar moedas e XP, consumindo energia. Efeitos de itens podem alterar os resultados!',
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        // Popula o inventário e os itens dentro do inventário para checar efeitos
        let userProfile = await User.findOne({ discordId: message.author.id })
            .populate({ 
                path: 'inventory.itemId', 
                model: 'Item' // Garante que o model 'Item' está registrado no Mongoose
            });

        if (!userProfile) {
            userProfile = await User.findOrCreate(message.author.id, message.author.tag); // Cria se não existir
            // Repopular se foi recém-criado e você precisa dos itens imediatamente (embora o inventário estaria vazio)
            userProfile = await User.findById(userProfile._id).populate('inventory.itemId');
        }
        
        // Limpar boosts expirados e obter boosts ativos
        if (userProfile.clearExpiredBoosts) userProfile.clearExpiredBoosts(); // Chama o método do schema
        
        if (typeof updateUserEnergy === 'function') {
            userProfile = await updateUserEnergy(userProfile);
        } else {
            console.warn("Helper updateUserEnergy não encontrado ou não é uma função no work.js");
        }

        // --- Aplicar Modificadores e Boosts ---
        let currentWorkCooldown = BASE_WORK_COOLDOWN_MS;
        let currentEnergyCost = BASE_WORK_ENERGY_COST;
        let currentRewardMin = BASE_WORK_REWARD_MIN;
        let currentRewardMax = BASE_WORK_REWARD_MAX;
        let currentXpReward = BASE_WORK_XP_REWARD;
        const activeEffectsMessages = []; // Para informar o usuário sobre boosts/efeitos ativos

        // 1. Efeitos Passivos de Itens no Inventário
        if (userProfile.inventory && userProfile.inventory.length > 0) {
            userProfile.inventory.forEach(invEntry => {
                if (invEntry.itemId && invEntry.itemId.effects) { // Verifica se itemId e effects existem
                    const item = invEntry.itemId;
                    const effects = item.effects;
                    
                    // Modificador de Cooldown de Comando
                    if (effects.commandCooldownModifiers && effects.commandCooldownModifiers.length > 0) {
                        effects.commandCooldownModifiers.forEach(mod => {
                            if (mod.commandName === 'work') {
                                currentWorkCooldown *= mod.modifier;
                                if (!activeEffectsMessages.includes(`🕒 Cooldown Reduzido por ${item.name}!`)) {
                                    activeEffectsMessages.push(`🕒 Cooldown Reduzido por ${item.name}!`);
                                }
                            }
                        });
                    }
                    // Modificador de Recompensa de Comando
                    if (effects.commandRewardModifiers && effects.commandRewardModifiers.length > 0) {
                         effects.commandRewardModifiers.forEach(mod => {
                            if (mod.commandName === 'work') {
                                if (mod.rewardType === 'money') {
                                    currentRewardMin = Math.floor(currentRewardMin * mod.modifier);
                                    currentRewardMax = Math.floor(currentRewardMax * mod.modifier);
                                    if (!activeEffectsMessages.includes(`💰 Recompensa Aumentada por ${item.name}!`)) {
                                        activeEffectsMessages.push(`💰 Recompensa Aumentada por ${item.name}!`);
                                    }
                                } else if (mod.rewardType === 'xp') {
                                    currentXpReward = Math.floor(currentXpReward * mod.modifier);
                                    if (!activeEffectsMessages.includes(`✨ XP Aumentado por ${item.name}!`)) {
                                        activeEffectsMessages.push(`✨ XP Aumentado por ${item.name}!`);
                                    }
                                }
                            }
                        });
                    }
                    // Modificador Global de XP (se diferente do de comando específico)
                    if (effects.xpGainModifier && effects.xpGainModifier !== 1.0) {
                        currentXpReward = Math.floor(currentXpReward * effects.xpGainModifier);
                        if (!activeEffectsMessages.some(m => m.includes("XP Aumentado") || m.includes("XP Multiplicado"))) {
                             activeEffectsMessages.push(`✨ Multiplicador de XP (${(effects.xpGainModifier*100).toFixed(0)}%) de ${item.name} ativo!`);
                        }
                    }
                }
            });
        }
        currentWorkCooldown = Math.max(10000, Math.floor(currentWorkCooldown)); // Cooldown mínimo de 10s, arredondado

        // 2. Boosts Temporários Ativos (usando os helpers do schema)
        if (userProfile.getActiveBoost) { // Verifica se o método existe
            const energySaverBoost = userProfile.getActiveBoost('energy_saver', 'work');
            if (energySaverBoost) {
                currentEnergyCost = Math.max(0, Math.floor(currentEnergyCost * parseFloat(energySaverBoost.value)));
                activeEffectsMessages.push(`⚡ Custo de Energia Reduzido (Boost)! Novo Custo: ${currentEnergyCost}`);
                if (energySaverBoost.usesLeft > 0 && userProfile.decrementBoostUse) userProfile.decrementBoostUse(energySaverBoost._id);
            }

            const luckBoost = userProfile.getActiveBoost('luck', 'work');
            if (luckBoost) {
                currentRewardMin = Math.floor(currentRewardMin * (parseFloat(luckBoost.value) || 1.0));
                currentRewardMax = Math.floor(currentRewardMax * (parseFloat(luckBoost.value) || 1.0));
                activeEffectsMessages.push(`🍀 Sorte Aumentada (Boost)! Recompensas Potenciais Maiores!`);
                if (luckBoost.usesLeft > 0 && userProfile.decrementBoostUse) userProfile.decrementBoostUse(luckBoost._id);
            }
            
            const xpMultiplierBoost = userProfile.getActiveBoost('xp_multiplier', 'work');
            if (xpMultiplierBoost) {
                currentXpReward = Math.floor(currentXpReward * (parseFloat(xpMultiplierBoost.value) || 1.0));
                activeEffectsMessages.push(`✨ XP Multiplicado (${(parseFloat(xpMultiplierBoost.value)*100).toFixed(0)}%) (Boost)!`);
                if (xpMultiplierBoost.usesLeft > 0 && userProfile.decrementBoostUse) userProfile.decrementBoostUse(xpMultiplierBoost._id);
            }
        }

        // --- Lógica do Comando Principal ---
        const lastWorkMs = userProfile.workLastClaimed ? userProfile.workLastClaimed.getTime() : 0;
        const nextWorkAvailableMs = lastWorkMs + currentWorkCooldown;

        if (Date.now() < nextWorkAvailableMs) {
            const timeLeft = nextWorkAvailableMs - Date.now();
            const embedCooldown = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⏳ Cooldown de Trabalho Ativo')
                .setDescription(`${message.author.toString()}, você precisa descansar antes de trabalhar novamente.`)
                .addFields(
                    { name: 'Próximo Trabalho em', value: `**${ms(timeLeft, { long: true })}**` },
                    { name: 'Horário Exato', value: `<t:${Math.floor(nextWorkAvailableMs / 1000)}:F>` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embedCooldown] });
        }

        if (userProfile.energy.current < currentEnergyCost) {
             const embedNoEnergy = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⚡ Energia Insuficiente!')
                .setDescription(`${message.author.toString()}, você não tem energia suficiente (${currentEnergyCost}) para trabalhar.`)
                .addFields(
                    { name: 'Sua Energia Atual', value: `${userProfile.energy.current}/${userProfile.energy.max}` },
                    { name: 'Energia Necessária', value: `${currentEnergyCost}` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embedNoEnergy] });
        }

        const earnings = Math.floor(Math.random() * (Math.max(currentRewardMin, currentRewardMax) - currentRewardMin + 1)) + currentRewardMin; // Garante que max >= min
        
        userProfile.balance += earnings;
        userProfile.xp += currentXpReward;
        userProfile.energy.current -= currentEnergyCost;
        userProfile.workLastClaimed = new Date();

        const xpToNextLevelFormula = (level) => 5 * (level ** 2) + 50 * level + 100;
        let xpForCurrentLevelUp = xpToNextLevelFormula(userProfile.level);
        let leveledUp = false;
        let levelUpMessage = "";
        while (userProfile.xp >= xpForCurrentLevelUp) {
            userProfile.level++;
            userProfile.xp -= xpForCurrentLevelUp;
            leveledUp = true;
            xpForCurrentLevelUp = xpToNextLevelFormula(userProfile.level);
        }
        if (leveledUp) {
            levelUpMessage = `🎉 Parabéns, ${message.author.toString()}! Você avançou para o **Nível ${userProfile.level}**!`;
        }
        
        await userProfile.save();

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('💼 Trabalho Concluído!')
            .setDescription(`${message.author.toString()}, seu esforço foi recompensado!`)
            .addFields(
                { name: 'Moedas Ganhas', value: `🪙 **+${earnings.toLocaleString()}**`, inline: true },
                { name: 'XP Ganho', value: `✨ **+${currentXpReward.toLocaleString()}**`, inline: true },
                { name: 'Energia Consumida', value: `⚡ **-${currentEnergyCost}**`, inline: true },
                { name: 'Saldo Atual', value: `🪙 ${userProfile.balance.toLocaleString()}`, inline: true },
                { name: 'XP (Progresso)', value: `✨ ${userProfile.xp.toLocaleString()}/${xpToNextLevelFormula(userProfile.level).toLocaleString()}`, inline: true },
                { name: '⚡ Energia Restante', value: `${userProfile.energy.current}/${userProfile.energy.max}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Próximo trabalho em: ${ms(currentWorkCooldown, {long: true})} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        if (activeEffectsMessages.length > 0) {
            embed.addFields({ name: '✨ Efeitos Ativos Nesta Ação', value: activeEffectsMessages.join('\n').substring(0,1020) });
        }
        
        if (leveledUp) {
            message.channel.send({ content: levelUpMessage }); // Envia mensagem de level up separada
        }
        message.channel.send({ embeds: [embed] });
    }
};