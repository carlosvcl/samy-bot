// src/commands/economia/buy.js
const { EmbedBuilder } = require('discord.js');
const { addItemToInventory } = require('../../utils/inventoryHelper'); // Supondo que esta função existe e funciona
const mongoose = require('mongoose'); // Necessário se você for verificar ObjectId

module.exports = {
    name: 'buy',
    aliases: ['comprar'],
    description: 'Compra um item da loja.',
    category: 'economia',
    args: true, // Indica que o comando espera argumentos
    usage: '<nome do item completo ou ID> [quantidade]',
    async execute({ client, message, args }) {
        const User = client.models.User; // Seu modelo de usuário
        const Item = client.models.Item; // Seu modelo de item

        let itemNameOrId;
        let quantity = 1; // Quantidade padrão é 1

        if (args.length === 0) {
            return message.reply(`Por favor, especifique o item que deseja comprar. Uso: \`${process.env.PREFIX || '!'}buy ${this.usage}\``);
        }

        const lastArgument = args[args.length - 1];
        const potentialQuantity = parseInt(lastArgument);

        if (args.length > 1 && !isNaN(potentialQuantity) && potentialQuantity > 0) {
            quantity = potentialQuantity;
            itemNameOrId = args.slice(0, -1).join(' ');
        } else {
            itemNameOrId = args.join(' ');
        }

        if (args.length > 1 && !isNaN(potentialQuantity) && potentialQuantity <= 0) {
            return message.reply('A quantidade deve ser um número positivo maior que zero.');
        }

        let itemQuery;
        if (mongoose.Types.ObjectId.isValid(itemNameOrId)) {
            itemQuery = { _id: itemNameOrId };
        } else {
            itemQuery = { name: new RegExp(`^${itemNameOrId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
        }
        
        const itemToBuy = await Item.findOne(itemQuery);
        
        if (!itemToBuy) {
            return message.reply(`😥 Desculpe, não consegui encontrar o item "${itemNameOrId}" na loja. Verifique o nome ou ID e tente novamente. Use \`${process.env.PREFIX || '!'}shop\` para ver os itens disponíveis.`);
        }

        if (!itemToBuy.buyPrice || itemToBuy.buyPrice <= 0) {
            return message.reply(`😕 O item "${itemToBuy.name}" não está disponível para compra no momento.`);
        }

        // IMPORTANTE: Certifique-se que User.findOrCreate usa 'message.author.id' para o campo 'discordId'
        // e 'message.author.tag' (ou message.author.username) para o campo 'username' no seu banco de dados.
        const userProfile = await User.findOrCreate(message.author.id, message.author.tag); 
        
        if (!userProfile) { // Adicionando uma verificação caso findOrCreate retorne nulo por algum erro interno
            console.error(`Falha ao encontrar ou criar perfil para ${message.author.tag} (ID: ${message.author.id})`);
            return message.reply('⚠️ Ocorreu um erro ao acessar seu perfil de economia. Tente novamente.');
        }

        const totalCost = itemToBuy.buyPrice * quantity;

        if (userProfile.balance < totalCost) {
            return message.reply(`Saldo insuficiente! Você tem 🪙 ${userProfile.balance.toLocaleString('pt-BR')} e precisa de 🪙 ${totalCost.toLocaleString('pt-BR')} para comprar ${quantity}x "${itemToBuy.name}".`);
        }

        userProfile.balance -= totalCost;
        try {
            await addItemToInventory(userProfile, itemToBuy._id.toString(), quantity, itemToBuy.name); 
            await userProfile.save();
        } catch (inventoryError) {
            console.error("Erro ao adicionar item ao inventário ou salvar perfil:", inventoryError);
            userProfile.balance += totalCost; 
            try { await userProfile.save(); } catch (revertError) { console.error("Erro crítico ao reverter saldo:", revertError); }
            return message.reply('⚠️ Ocorreu um erro ao tentar adicionar o item ao seu inventário. A transação foi cancelada. Tente novamente mais tarde.');
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('🛒 Compra Realizada com Sucesso!')
            .setDescription(`${message.author.toString()}, sua transação foi concluída e o(s) item(ns) adicionado(s) ao seu inventário.`)
            .addFields(
                { name: '🛍️ Item Comprado', value: `${itemToBuy.name} (x${quantity})` },
                { name: '💸 Custo Total', value: `🪙 ${totalCost.toLocaleString('pt-BR')} moedas` },
                { name: '💰 Saldo Restante', value: `🪙 ${userProfile.balance.toLocaleString('pt-BR')} moedas` },
                { name: '💡 Dica', value: `Use \`${process.env.PREFIX || '!'}inventory\` para ver seus itens.` }
            )
            .setThumbnail(itemToBuy.imageUrl || client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            
        message.channel.send({ embeds: [embed] });
    }
};