// src/commands/economia/use.js
const { EmbedBuilder } = require('discord.js');
const { removeItemFromInventory, addItemToInventory } = require('../../utils/inventoryHelper'); // Ajuste o caminho se necessário
// Se você tiver um helper para processar loot tables:
// const { processLootTable } = require('../../utils/lootHelper'); 

module.exports = {
    name: 'use',
    aliases: ['usar', 'consumir', 'abrir'], // Adicionado 'abrir' para caixas
    description: 'Usa um item consumível do seu inventário ou abre uma caixa.',
    category: 'economia',
    args: true, // Indica que o comando espera argumentos
    usage: '<nome do item ou ID> [argumentos específicos do item, ex: novo apelido]',
    async execute({ client, message, args }) {
        const User = client.models.User;
        // const Item = client.models.Item; // Para buscar detalhes do item se não vierem populados

        // 1. VERIFICAR SE UM NOME DE ITEM FOI FORNECIDO
        if (!args.length || !args[0] || args[0].trim() === "") {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('❓ Item Não Especificado')
                .setDescription(`Por favor, especifique o nome ou ID do item que deseja usar.\n**Uso correto:** \`${process.env.PREFIX}use ${this.usage}\``)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [usageEmbed] });
        }

        // Se o nome do item tiver espaços e não estiver entre aspas, args[0] pegará só a primeira palavra.
        // Para pegar o nome completo do item, podemos juntar os args até encontrar um argumento que não faça parte do nome (ex: para token de apelido)
        // Por simplicidade aqui, vamos assumir que o item pode ser identificado pelo primeiro argumento,
        // ou que o usuário usará aspas se o nome do item tiver espaços.
        // Uma abordagem mais robusta para nomes de itens com múltiplos espaços seria necessária se args[0] não for suficiente.
        
        // Para o "Token de Mudança de Apelido (Bot)", o nome do item pode ser args[0] e o novo apelido args[1...]
        // Para outros itens, args[0] é o nome do item.
        
        let itemNameOrId;
        let itemSpecificArgs = [];

        // Lógica para separar nome do item de outros argumentos (ex: para o token de apelido)
        // Tenta encontrar o item com o máximo de palavras possível
        let foundItemEntry = null;
        let wordsUsedForItemName = 0;
        
        const userProfileForFind = await User.findOne({ discordId: message.author.id }).populate('inventory.itemId');
        if (!userProfileForFind) return message.reply("Seu perfil não foi encontrado. Tente usar `s!balance` primeiro.");


        for (let i = args.length; i >= 1; i--) {
            const potentialItemName = args.slice(0, i).join(' ');
            const tempEntry = userProfileForFind.inventory.find(entry =>
                entry.itemId && (
                    entry.itemId.name.toLowerCase() === potentialItemName.toLowerCase() ||
                    entry.itemId._id.toString() === potentialItemName
                )
            );
            if (tempEntry) {
                foundItemEntry = tempEntry;
                itemNameOrId = potentialItemName;
                wordsUsedForItemName = i;
                itemSpecificArgs = args.slice(i);
                break;
            }
        }
        
        // Se após o loop, nenhum item foi encontrado
        if (!foundItemEntry) {
            // Usa o primeiro argumento (ou todos se não houver quantidade) como tentativa de nome para a msg de erro
            const attemptedItemName = args.join(' '); 
            return message.reply(`Você não possui o item "${attemptedItemName}" em seu inventário, ou o nome/ID está incorreto.`);
        }


        // Agora itemNameOrId contém o nome/ID do item encontrado e itemSpecificArgs os argumentos restantes
        // const itemArgs = args.slice(1); // Usar itemSpecificArgs em vez disso

        let userProfile = userProfileForFind; // Já temos o perfil populado

        // Limpar boosts expirados
        if (userProfile.clearExpiredBoosts) userProfile.clearExpiredBoosts();

        // A variável inventoryEntry já é foundItemEntry
        const inventoryEntry = foundItemEntry;
        const itemToUse = inventoryEntry.itemId;

        if (!itemToUse.usable || !itemToUse.useEffects || !itemToUse.useEffects.action) {
            return message.reply(`O item "${itemToUse.name}" não pode ser usado ou não tem um efeito definido.`);
        }

        let successMessage = itemToUse.useEffects.message || `Você usou ${itemToUse.name}!`;
        let requiresSave = false; // Flag para salvar no DB apenas se necessário
        let consumedItem = true; // A maioria dos itens usáveis são consumidos

        // Lógica para cada tipo de ação do item
        switch (itemToUse.useEffects.action) {
            case 'grant_xp':
                userProfile.xp += parseInt(itemToUse.useEffects.value) || 0;
                successMessage = itemToUse.useEffects.message || `Você usou ${itemToUse.name} e ganhou **${parseInt(itemToUse.useEffects.value) || 0} XP**!`;
                requiresSave = true;
                break;

            case 'grant_money':
                userProfile.balance += parseInt(itemToUse.useEffects.value) || 0;
                successMessage = itemToUse.useEffects.message || `Você usou ${itemToUse.name} e ganhou **🪙 ${ (parseInt(itemToUse.useEffects.value) || 0).toLocaleString()} moedas**!`;
                requiresSave = true;
                break;

            case 'heal_energy':
                const energyToHeal = parseInt(itemToUse.useEffects.value) || 0;
                const oldEnergy = userProfile.energy.current;
                userProfile.energy.current = Math.min(userProfile.energy.max, userProfile.energy.current + energyToHeal);
                const healedAmount = userProfile.energy.current - oldEnergy;
                successMessage = itemToUse.useEffects.message || `Você usou ${itemToUse.name} e recuperou **${healedAmount} de energia**! Energia atual: ${userProfile.energy.current}/${userProfile.energy.max}.`;
                requiresSave = true;
                break;

            case 'activate_luck_boost':
            case 'activate_energy_saver_boost':
            case 'activate_xp_boost':
                const boostType = itemToUse.useEffects.action.replace('activate_', '').replace('_boost', '');
                const durationMs = (itemToUse.useEffects.durationMinutes || 0) * 60 * 1000;
                const uses = itemToUse.useEffects.uses || 0; // 0 para infinito dentro da duração
                const commandScope = itemToUse.useEffects.commandScope || [];

                if (durationMs > 0) {
                    userProfile.activeBoosts.push({
                        boostType: boostType,
                        value: itemToUse.useEffects.value,
                        expiresAt: new Date(Date.now() + durationMs),
                        usesLeft: uses,
                        commandScope: commandScope
                    });
                    successMessage = itemToUse.useEffects.message || `Você ativou um boost de ${boostType} por ${ms(durationMs, {long: true})}!`;
                    requiresSave = true;
                } else {
                    return message.reply("Este item de boost não tem uma duração válida.");
                }
                break;

            case 'open_lootbox':
                const lootTableId = itemToUse.effects.lootTableId || itemToUse.useEffects.value; 
                if (!lootTableId) return message.reply("Esta caixa misteriosa parece estar vazia ou mal configurada (sem tabela de loot).");
                
                // Placeholder para a função de processar loot table
                // const lootResult = await processLootTable(lootTableId, userProfile, client);
                // successMessage = lootResult.message;
                // if(lootResult.requiresSave) requiresSave = true;
                
                // Lógica de Exemplo Simples de Loot (SUBSTITUA PELA SUA LÓGICA DE LOOT TABLE)
                const randomCoins = Math.floor(Math.random() * 500) + 50;
                userProfile.balance += randomCoins;
                successMessage = `Você abriu a ${itemToUse.name} e encontrou **🪙 ${randomCoins.toLocaleString()} moedas**!`;
                requiresSave = true;
                // Fim da lógica de exemplo simples de loot
                break;
            
            case 'change_profile_display_name':
                const newDisplayName = itemSpecificArgs.join(' ');
                if (!newDisplayName || newDisplayName.length < 3 || newDisplayName.length > 32) {
                    return message.reply(`Por favor, forneça um novo nome de exibição entre 3 e 32 caracteres após o nome do token.\nEx: \`${process.env.PREFIX}use "${itemToUse.name}" Meu Novo Apelido\``);
                }
                userProfile.customBotDisplayName = newDisplayName;
                successMessage = itemToUse.useEffects.message || `Seu apelido de exibição no bot foi alterado para: "**${newDisplayName}**"!`;
                requiresSave = true;
                break;

            default:
                return message.reply(`A ação "${itemToUse.useEffects.action}" para o item ${itemToUse.name} ainda não foi implementada ou é desconhecida.`);
        }

        if (consumedItem) {
            const removed = await removeItemFromInventory(userProfile, itemToUse._id, 1);
            if (!removed) {
                return message.reply("Ocorreu um erro crítico ao tentar consumir o item do seu inventário após o uso.");
            }
            requiresSave = true; // Garante que o save ocorra se o item foi removido
        }

        if (requiresSave) {
            try {
                await userProfile.save();
            } catch (error) {
                console.error("Erro ao salvar perfil após usar item:", error);
                return message.reply("Ocorreu um erro ao salvar as alterações após usar o item. Tente novamente.");
            }
        }
        
        const embed = new EmbedBuilder()
            .setColor('#FF69B4') // Rosa
            .setTitle('✨ Item Utilizado com Sucesso! ✨')
            .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({dynamic: true})})
            .setDescription(successMessage)
            .setThumbnail(itemToUse.imageUrl || client.user.displayAvatarURL())
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        
        message.channel.send({ embeds: [embed] });
    }
};