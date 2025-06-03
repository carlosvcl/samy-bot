// src/commands/economia/collectincome.js
const { EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    name: 'collectincome',
    aliases: ['collect', 'renda', 'passive'],
    description: 'Coleta a renda passiva gerada pelos seus itens.',
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const userProfile = await User.findOne({ discordId: message.author.id })
            .populate('inventory.itemId');

        if (!userProfile) {
            return message.reply('😥 Não encontrei seu perfil de economia. Tente usar um comando de economia primeiro (como `!daily`) para criar um.');
        }

        let totalGained = 0;
        const collectedFromItemsDetails = [];
        const now = new Date();
        const INCOME_COLLECTION_COOLDOWN_MS = ms('24h');

        // --- MODIFICAÇÃO CRÍTICA AQUI ---
        let lastCollectedTimestampObject = userProfile.lastPassiveIncomeCollectedTimestamp;
        let lastCollectedDate;

        // Verifique a estrutura real com console.log(lastCollectedTimestampObject)
        // Assumindo que o objeto tem uma propriedade como .value, .date, ou .timestamp que guarda a data
        const datePropertyKey = 'value'; // <<<<<< AJUSTE ESTE NOME DE PROPRIEDADE CONFORME SEU OBJETO REAL

        if (lastCollectedTimestampObject && typeof lastCollectedTimestampObject === 'object') {
            if (lastCollectedTimestampObject[datePropertyKey] instanceof Date) {
                lastCollectedDate = lastCollectedTimestampObject[datePropertyKey];
            } else if (typeof lastCollectedTimestampObject[datePropertyKey] === 'string' || typeof lastCollectedTimestampObject[datePropertyKey] === 'number') {
                lastCollectedDate = new Date(lastCollectedTimestampObject[datePropertyKey]);
            } else {
                console.warn(`[collectincome] Subpropriedade '${datePropertyKey}' em lastPassiveIncomeCollectedTimestamp não é uma data válida ou não existe. Estrutura:`, lastCollectedTimestampObject);
                lastCollectedDate = new Date(0); // Primeira coleta ou estrutura inesperada
            }
        } else if (lastCollectedTimestampObject instanceof Date) { // Caso seja um campo Date direto (menos provável dado o DB)
            lastCollectedDate = lastCollectedTimestampObject;
        } else { // Se for null, undefined, ou outro tipo primitivo incorreto
            lastCollectedDate = new Date(0); // Primeira coleta
        }
        
        // Segurança extra: garantir que lastCollectedDate é uma data válida
        if (!(lastCollectedDate instanceof Date) || isNaN(lastCollectedDate.getTime())) {
            console.error(`[collectincome] Falha crítica ao processar lastCollectedDate. Fallback para new Date(0). Valor original do DB: `, userProfile.lastPassiveIncomeCollectedTimestamp);
            lastCollectedDate = new Date(0);
        }
        // --- FIM DA MODIFICAÇÃO CRÍTICA ---
        
        // Linha 33 original (agora deve funcionar)
        const timeSinceLastCollection = now.getTime() - lastCollectedDate.getTime();

        if (timeSinceLastCollection < INCOME_COLLECTION_COOLDOWN_MS) {
            const timeLeft = ms(INCOME_COLLECTION_COOLDOWN_MS - timeSinceLastCollection, { long: true });
            const alreadyCollectedEmbed = new EmbedBuilder()
                .setColor('#FFCC00')
                .setTitle('💸 Coleta de Renda Passiva')
                .setDescription(`${message.author.toString()}, você já coletou sua renda passiva recentemente.`)
                .addFields({ name: 'Tempo Restante', value: `Você poderá coletar novamente em aproximadamente **${timeLeft}**.`})
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [alreadyCollectedEmbed] });
        }

        if (userProfile.inventory && userProfile.inventory.length > 0) {
            for (const inventoryEntry of userProfile.inventory) {
                const item = inventoryEntry.itemId;
                if (item && typeof item.incomeRate === 'number' && item.incomeRate > 0 && inventoryEntry.quantity > 0) {
                    const incomeFromThisItemStack = item.incomeRate * inventoryEntry.quantity;
                    totalGained += incomeFromThisItemStack;
                    collectedFromItemsDetails.push(`- ${item.name} (x${inventoryEntry.quantity}): 🪙 ${incomeFromThisItemStack.toLocaleString('pt-BR')}`);
                }
            }
        }

        if (totalGained === 0) {
            const noIncomeEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('💸 Coleta de Renda Passiva')
                .setDescription(`${message.author.toString()}, você não possui itens que gerem renda passiva ou não há renda para coletar no momento.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [noIncomeEmbed] });
        }

        userProfile.balance += totalGained;
        
        // Atualiza o timestamp da última coleta
        if (userProfile.lastPassiveIncomeCollectedTimestamp && typeof userProfile.lastPassiveIncomeCollectedTimestamp === 'object' && !(userProfile.lastPassiveIncomeCollectedTimestamp instanceof Date)) {
            userProfile.lastPassiveIncomeCollectedTimestamp[datePropertyKey] = now; // Usa a mesma chave
        } else {
             // Se o campo não existir ou for para ser um objeto novo, ou se o schema for apenas Date
            userProfile.lastPassiveIncomeCollectedTimestamp = { [datePropertyKey]: now }; // Ou simplesmente = now se o schema for Date
        }
        userProfile.markModified('lastPassiveIncomeCollectedTimestamp');

        try {
            await userProfile.save();
        } catch (dbError) {
            console.error("Erro ao salvar perfil após coletar renda:", dbError);
            return message.reply("⚠️ Ocorreu um erro ao salvar suas informações. Tente novamente.");
        }
        
        const embed = new EmbedBuilder()
            .setColor('#7FFF00')
            .setTitle('💰 Renda Passiva Coletada!')
            .setDescription(`${message.author.toString()}, você coletou um total de **🪙 ${totalGained.toLocaleString('pt-BR')} moedas** dos seus itens geradores!`)
            .addFields(
                { name: 'Itens que Geraram Renda', value: collectedFromItemsDetails.length > 0 ? collectedFromItemsDetails.join('\n').substring(0, 1020) : 'Nenhum item específico contribuiu nesta coleta.' },
                { name: 'Novo Saldo', value: `🪙 ${userProfile.balance.toLocaleString('pt-BR')}` }
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        message.channel.send({ embeds: [embed] });
    }
};