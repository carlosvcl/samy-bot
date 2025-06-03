// src/commands/economia/sell.js
const { EmbedBuilder } = require('discord.js');
const { removeItemFromInventory } = require('../../utils/inventoryHelper'); // Certifique-se que o caminho está correto
const mongoose = require('mongoose'); // Para ObjectId.isValid

module.exports = {
    name: 'sell',
    aliases: ['vender'],
    description: 'Vende um item do seu inventário.',
    category: 'economia',
    args: true, // Indica que o comando espera argumentos
    usage: '<nome do item completo ou ID do item no inventário> [quantidade]',
    async execute({ client, message, args }) { 
        const User = client.models.User;
        // const Item = client.models.Item; // Não é estritamente necessário aqui se o itemDetails é obtido do inventário populado

        // 1. DECLARAÇÃO E INICIALIZAÇÃO DAS VARIÁVEIS
        let quantityToSell = 1; // Valor padrão se nenhuma quantidade for especificada
        let itemNameOrId;

        // 2. PARSE DOS ARGUMENTOS para itemNameOrId e quantityToSell
        if (args.length === 0) {
            // Se o handler de comandos não previne isso, tratar aqui.
            // Com args: true, o handler de eventos (messageCreate.js) já deve retornar se não houver args.
            // Mas por segurança:
            return message.reply(`Uso correto: \`${process.env.PREFIX}${this.name} ${this.usage}\``);
        }

        const lastArg = args[args.length - 1];
        const potentialQuantity = parseInt(lastArg);

        // Se houver mais de um argumento E o último for um número positivo, ele é a quantidade
        if (args.length > 1 && !isNaN(potentialQuantity) && potentialQuantity > 0) {
            quantityToSell = potentialQuantity;
            itemNameOrId = args.slice(0, -1).join(' '); // Todos os argumentos exceto o último
        } else {
            // Caso contrário, todos os argumentos formam o nome/ID do item e a quantidade é 1
            itemNameOrId = args.join(' ');
        }

        // 3. VALIDAÇÃO DA QUANTIDADE (Linha onde o erro provavelmente ocorreu se a declaração acima falhou)
        // Esta checagem agora é um pouco redundante se a lógica acima já garante > 0,
        // mas mantemos como uma dupla verificação.
        if (quantityToSell <= 0) {
            return message.reply('A quantidade para vender deve ser um número positivo maior que zero.');
        }

        // 4. LÓGICA DO COMANDO
        const userProfile = await User.findOne({ discordId: message.author.id })
            .populate({
                path: 'inventory.itemId', // Popula os detalhes do item para cada entrada no inventário
                model: 'Item'
            });

        if (!userProfile || !userProfile.inventory || userProfile.inventory.length === 0) {
            const embedEmptyInv = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🎒 Inventário Vazio')
                .setDescription('Você não tem itens no seu inventário para vender.')
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [embedEmptyInv] });
        }
        
        const inventoryEntry = userProfile.inventory.find(entry =>
            entry.itemId && ( // Garante que o itemId (item populado) existe
                (entry.itemId.name.toLowerCase() === itemNameOrId.toLowerCase()) ||
                (entry.itemId._id.toString() === itemNameOrId) // Compara com o ID do Item Schema
            )
        );

        if (!inventoryEntry) {
            return message.reply(`Você não possui o item "${itemNameOrId}" no seu inventário, ou o nome/ID está incorreto.`);
        }

        const itemDetails = inventoryEntry.itemId; // Detalhes do item já populados

        if (itemDetails.sellPrice === undefined || itemDetails.sellPrice <= 0) {
            return message.reply(`O item "${itemDetails.name}" não pode ser vendido ou não tem um preço de venda definido.`);
        }
        
        if (inventoryEntry.quantity < quantityToSell) {
            return message.reply(`Você não tem ${quantityToSell}x "${itemDetails.name}" para vender. Você possui apenas ${inventoryEntry.quantity}x.`);
        }

        const earnings = itemDetails.sellPrice * quantityToSell;
        // O helper removeItemFromInventory deve atualizar o userProfile.inventory diretamente
        // e retornar true/false. O userProfile.save() será chamado depois.
        const successfullyRemoved = await removeItemFromInventory(userProfile, itemDetails._id, quantityToSell); 
        
        if (!successfullyRemoved) {
             // Isso pode acontecer se, por alguma concorrência ou erro lógico, o item não puder ser removido
             return message.reply('Ocorreu um erro ao tentar remover o item do seu inventário. Verifique se você ainda possui a quantidade informada.');
        }
        
        userProfile.balance += earnings;
        
        try {
            await userProfile.save(); // Salva todas as alterações (inventário e saldo)

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('💸 Venda Realizada com Sucesso!')
                .setDescription(`${message.author.toString()}, você vendeu seus itens e recebeu moedas!`)
                .addFields(
                    { name: '📦 Item Vendido', value: `${itemDetails.name} (x${quantityToSell})` },
                    { name: '💰 Valor Recebido', value: `🪙 ${earnings.toLocaleString()} moedas` },
                    { name: '💳 Novo Saldo', value: `🪙 ${userProfile.balance.toLocaleString()} moedas` },
                    { name: '💡 Dica', value: `Use \`${process.env.PREFIX}inventory\` para ver os itens restantes.` }
                )
                .setThumbnail(itemDetails.imageUrl || message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao salvar perfil após venda:", error);
            // Considerar reverter a lógica de remoção do inventário se o save falhar (complexo)
            // ou pelo menos não adicionar o balance. Por simplicidade, apenas logamos.
            message.reply("Ocorreu um erro ao finalizar a venda. Tente novamente.");
        }
    }
};