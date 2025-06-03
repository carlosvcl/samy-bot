// src/commands/economia/mine.js
const { EmbedBuilder } = require('discord.js');
const ms = require('ms');
const { updateUserEnergy } = require('../../utils/energyHelper'); // Ajuste o caminho se necessário
const { addItemToInventory } = require('../../utils/inventoryHelper'); // Ajuste o caminho se necessário

// Constantes para o comando mine
const MINE_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutos
const MINE_ENERGY_COST = 15;
const STONE_REWARD_MIN = 3;
const STONE_REWARD_MAX = 10;
const MINE_XP_REWARD = 10;
// Outros minérios possíveis (exemplo, você precisaria dos itens no DB)
// const CHANCE_FERRO = 0.15; // 15% de chance
// const ID_ITEM_FERRO = 'SEU_ID_DO_ITEM_FERRO';

module.exports = {
    name: 'mine',
    aliases: ['minerar', 'escavar'],
    description: 'Usa sua picareta para minerar pedras e, com sorte, outros recursos.',
    category: 'economia', // Adicionando categoria
    // cooldown: 10, // Cooldown do comando em si, se diferente do cooldown da ação
    async execute({ client, message, args }) {
        const User = client.models.User;
        const Item = client.models.Item; // Para buscar o item "Pedra"

        let userProfile = await User.findOne({ discordId: message.author.id });
        if (!userProfile) { // Se o perfil não existe, findOrCreate o criaria, mas aqui queremos popular logo após
            userProfile = await User.create({ discordId: message.author.id, username: message.author.tag });
        }
        // Popula o inventário para verificar a picareta
        userProfile = await User.findById(userProfile._id).populate('inventory.itemId');
        
        // Atualiza energia antes das verificações
        if (typeof updateUserEnergy !== 'function') {
            console.error("Helper updateUserEnergy não encontrado ou não é uma função.");
            return message.reply("Ocorreu um erro interno (energy helper).");
        }
        userProfile = await updateUserEnergy(userProfile);

        // 1. Verificar se tem picareta
        // A verificação atual busca por nome. Uma propriedade 'itemType: "pickaxe"' no schema Item seria mais robusta.
        const pickaxeInInventory = userProfile.inventory.find(invItem => 
            invItem.itemId && invItem.itemId.category === 'tool' && invItem.itemId.name.toLowerCase().includes('picareta')
        );

        if (!pickaxeInInventory) {
            const noPickaxeEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⛏️ Sem Ferramenta Adequada!')
                .setDescription(`${message.author.toString()}, você precisa de uma picareta para minerar! Visite a \`${process.env.PREFIX}shop\` para adquirir uma.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [noPickaxeEmbed] });
        }
        const usedPickaxeName = pickaxeInInventory.itemId.name; // Nome da picareta usada

        // 2. Cooldown da Mineração
        const lastMineMs = userProfile.mineLastClaimed ? userProfile.mineLastClaimed.getTime() : 0;
        const nextMineAvailableMs = lastMineMs + MINE_COOLDOWN_MS;

        if (Date.now() < nextMineAvailableMs) {
            const timeLeft = nextMineAvailableMs - Date.now();
            const cooldownEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⏳ Cooldown de Mineração Ativo')
                .setDescription(`${message.author.toString()}, sua picareta precisa de um descanso!`)
                .addFields(
                    { name: 'Próxima Mineração em', value: `**${ms(timeLeft, { long: true })}**` },
                    { name: 'Horário Exato', value: `<t:${Math.floor(nextMineAvailableMs / 1000)}:F>` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [cooldownEmbed] });
        }

        // 3. Custo de Energia
        if (userProfile.energy.current < MINE_ENERGY_COST) {
            const noEnergyEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⚡ Energia Insuficiente!')
                .setDescription(`${message.author.toString()}, você não tem energia suficiente (${MINE_ENERGY_COST}) para minerar.`)
                .addFields(
                    { name: 'Sua Energia Atual', value: `${userProfile.energy.current}/${userProfile.energy.max}` },
                    { name: 'Energia Necessária', value: `${MINE_ENERGY_COST}` }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [noEnergyEmbed] });
        }

        // 4. Buscar o item "Pedra" no banco de dados
        const pedraItem = await Item.findOne({ name: 'Pedra' }); // Assumindo que o item se chama "Pedra"
        if (!pedraItem) {
            console.error("Erro de configuração: Item 'Pedra' não encontrado no banco de dados.");
            return message.reply("Ocorreu um erro de configuração do bot. O item 'Pedra' não foi encontrado. Avise um administrador.");
        }

        // 5. Calcular Recompensa
        const stoneEarned = Math.floor(Math.random() * (STONE_REWARD_MAX - STONE_REWARD_MIN + 1)) + STONE_REWARD_MIN;
        let foundResourcesMessage = `🪨 **${stoneEarned.toLocaleString()}** Pedra(s)`;
        
        // Lógica para outros minérios (exemplo)
        // if (Math.random() < CHANCE_FERRO) {
        //     const ferroEarned = 1; // Exemplo
        //     await addItemToInventory(userProfile, ID_ITEM_FERRO, ferroEarned);
        //     foundResourcesMessage += `\n🔩 **${ferroEarned}** Ferro(s)`;
        // }

        // 6. Atualizar Perfil
        userProfile.xp += MINE_XP_REWARD;
        userProfile.energy.current -= MINE_ENERGY_COST;
        userProfile.mineLastClaimed = new Date();

        // Adicionar Pedra ao Inventário
        await addItemToInventory(userProfile, pedraItem._id, stoneEarned);

        // 7. Lógica de Level Up
        const xpToNextLevelFormula = (level) => 5 * (level ** 2) + 50 * level + 100;
        let currentXpToNext = xpToNextLevelFormula(userProfile.level);
        let leveledUp = false;
        let levelUpMessage = "";
        while (userProfile.xp >= currentXpToNext) {
            userProfile.level++;
            userProfile.xp -= currentXpToNext;
            leveledUp = true;
            currentXpToNext = xpToNextLevelFormula(userProfile.level);
        }
        if (leveledUp) {
            levelUpMessage = `🎉 Parabéns, ${message.author.toString()}! Você avançou para o **Nível ${userProfile.level}**!`;
        }
        
        await userProfile.save();

        // 8. Embed de Sucesso
        const successEmbed = new EmbedBuilder()
            .setColor('#FF69B4') // Rosa
            .setTitle(`⛏️ Mineração com ${usedPickaxeName} Concluída!`)
            .setDescription(`${message.author.toString()}, sua jornada na mina foi produtiva!`)
            .addFields(
                { name: 'Recursos Coletados', value: foundResourcesMessage },
                { name: 'XP Ganho', value: `✨ **+${MINE_XP_REWARD}**`, inline: true },
                { name: 'Energia Consumida', value: `⚡ **-${MINE_ENERGY_COST}**`, inline: true },
                { name: '⚡ Energia Restante', value: `${userProfile.energy.current}/${userProfile.energy.max}`, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Próxima mineração em: ${ms(MINE_COOLDOWN_MS, {long: true})} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        
        if (leveledUp) {
            // Enviar mensagem de level up separada para destaque
            message.channel.send({ content: levelUpMessage });
        }
        message.channel.send({ embeds: [successEmbed] });
    }
};