// src/commands/economia/evolve.js
const { EmbedBuilder } = require('discord.js');
const { updateUserEnergy } = require('../../utils/energyHelper');
const { addItemToInventory, removeItemFromInventory } = require('../../utils/inventoryHelper');
const mongoose = require('mongoose');

module.exports = {
    name: 'evolve',
    aliases: ['evoluir', 'upgradeitem'],
    description: 'Evolui um item do seu inventário se você tiver os requisitos.',
    category: 'economia',
    args: true, 
    usage: '<nome do item a evoluir>',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const Item = client.models.Item;

        if (!args.length) {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Alterado para FFCC00 (amarelo) para aviso
                .setTitle('🤔 Como Evoluir um Item?')
                .setDescription(`Por favor, especifique o **nome exato** do item que você deseja evoluir.`)
                .addFields(
                    { name: 'Uso do Comando', value: `\`${process.env.PREFIX || 's!'}evolve <nome do item>\`` },
                    { name: 'Seu Inventário', value: `Use \`${process.env.PREFIX || 's!'}inventory\` para ver os itens que você possui e pode tentar evoluir.` }
                )
                .setTimestamp()
                .setFooter({ text: "Dica: O nome do item deve ser como aparece no seu inventário." });
            return message.reply({ embeds: [usageEmbed] });
        }

        const itemNameInput = args.join(' ');

        let userProfile;
        let baseItemInInventory;
        let baseItemDetails;
        let evolvedItemDetails;
        let recipe;
        const unmetReasonsSimple = []; 
        const detailedRequirementsForEmbed = []; 

        try {
            userProfile = await User.findOne({ discordId: message.author.id })
                .populate({
                    path: 'inventory.itemId',
                    model: Item // Garante que o model Item seja usado para popular
                });

            if (!userProfile) {
                return message.reply('Não encontrei seu perfil de economia. Tente usar um comando de economia primeiro.');
            }

            baseItemInInventory = userProfile.inventory.find(invEntry => 
                invEntry.itemId && invEntry.itemId.name.toLowerCase() === itemNameInput.toLowerCase()
            );

            if (!baseItemInInventory || baseItemInInventory.quantity < 1) {
                return message.reply(`Você não possui o item "${itemNameInput}" no seu inventário ou não tem quantidade suficiente (precisa de pelo menos 1 para evoluir). Use \`${process.env.PREFIX || 's!'}inventory\` para verificar.`);
            }
            baseItemDetails = baseItemInInventory.itemId; // Este é o objeto do item populado

            // Adicione o console.log aqui para depuração, se necessário (remova depois):
            // console.log("Detalhes do Item Base para Evolução:", JSON.stringify(baseItemDetails, null, 2));

            // --- CORREÇÃO PRINCIPAL AQUI ---
            // Usar 'evolutionRecipe' e 'evolvesToItemId' conforme definido no seu ItemSchema.js
            if (!baseItemDetails.evolutionRecipe || !baseItemDetails.evolutionRecipe.evolvesToItemId) {
                return message.reply(`O item "${baseItemDetails.name}" não pode ser evoluído (sem receita ou item alvo definido).`);
            }
            recipe = baseItemDetails.evolutionRecipe; // Correto: usa o campo do seu schema

            evolvedItemDetails = await Item.findById(recipe.evolvesToItemId); // Correto: usa o campo do seu schema
            // --- FIM DA CORREÇÃO PRINCIPAL ---

            if (!evolvedItemDetails) {
                console.error(`[EVOLVE_ERROR] Item evoluído com ID ${recipe.evolvesToItemId} não encontrado (base: ${baseItemDetails.name})`);
                return message.reply('Ocorreu um erro: o item resultante da evolução não foi encontrado. Avise um administrador.');
            }

            // --- Construir a lista detalhada de requisitos e verificar ---
            if (recipe.requiredLevel) {
                const meetsLevel = userProfile.level >= recipe.requiredLevel;
                detailedRequirementsForEmbed.push({
                    name: `${meetsLevel ? '✅' : '❌'} Nível Necessário: ${recipe.requiredLevel}`,
                    value: `Seu nível: ${userProfile.level}`
                });
                if (!meetsLevel) unmetReasonsSimple.push("Nível insuficiente.");
            }
            if (recipe.requiredCurrency) {
                const meetsCurrency = userProfile.balance >= recipe.requiredCurrency;
                detailedRequirementsForEmbed.push({
                    name: `${meetsCurrency ? '✅' : '❌'} Custo em Moedas: 🪙 ${recipe.requiredCurrency.toLocaleString('pt-BR')}`,
                    value: `Seu saldo: 🪙 ${userProfile.balance.toLocaleString('pt-BR')}`
                });
                if (!meetsCurrency) unmetReasonsSimple.push("Moedas insuficientes.");
            }
            if (recipe.requiredEnergy) {
                const currentEnergy = userProfile.energy ? userProfile.energy.current : 0;
                const meetsEnergy = currentEnergy >= recipe.requiredEnergy;
                detailedRequirementsForEmbed.push({
                    name: `${meetsEnergy ? '✅' : '❌'} Custo em Energia: ⚡ ${recipe.requiredEnergy}`,
                    value: `Sua energia: ⚡ ${currentEnergy}`
                });
                if (!meetsEnergy) unmetReasonsSimple.push("Energia insuficiente.");
            }
            if (recipe.requiredItems && recipe.requiredItems.length > 0) {
                for (const requiredMaterial of recipe.requiredItems) {
                    // 'requiredMaterial.itemId' aqui já deve ser o ObjectId se o populate no User não aninhar profundamente,
                    // mas para pegar o NOME do material, precisamos buscar os detalhes do Item.
                    const materialDetails = await Item.findById(requiredMaterial.itemId); 
                    const materialName = materialDetails ? materialDetails.name : `Item ID ${requiredMaterial.itemId.toString().slice(-4)}`;
                    
                    const materialInInventory = userProfile.inventory.find(
                        invEntry => invEntry.itemId && invEntry.itemId._id.equals(requiredMaterial.itemId)
                    );
                    const userHasQty = materialInInventory ? materialInInventory.quantity : 0;
                    const meetsMaterial = userHasQty >= requiredMaterial.quantity;

                    detailedRequirementsForEmbed.push({
                        name: `${meetsMaterial ? '✅' : '❌'} Material: ${requiredMaterial.quantity}x ${materialName}`,
                        value: `Você tem: ${userHasQty}x`
                    });
                    if (!meetsMaterial) unmetReasonsSimple.push(`Faltam materiais (${materialName}).`);
                }
            }
             detailedRequirementsForEmbed.push({
                name: `✅ Item Base: 1x ${baseItemDetails.name}`,
                value: `Você tem: ${baseItemInInventory.quantity}x (Necessário: 1)`
            });

        } catch (error) {
            console.error("Erro na fase de preparação da evolução:", error);
            return message.reply("Ocorreu um erro ao verificar os requisitos para a evolução. Tente novamente.");
        }
        
        if (unmetReasonsSimple.length > 0) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Vermelho para erro
                .setTitle(`❌ Requisitos para Evoluir: ${baseItemDetails.name} ➡️ ${evolvedItemDetails.name}`)
                .setDescription(`${message.author.toString()}, você não atende a todos os requisitos para esta evolução. Veja abaixo o que é necessário:`)
                .addFields(detailedRequirementsForEmbed)
                .setThumbnail(baseItemDetails.imageUrl || client.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [errorEmbed] });
        }

        // --- Se chegou aqui, todos os requisitos foram atendidos: Processar Evolução ---
        try {
            if (recipe.requiredCurrency > 0) userProfile.balance -= recipe.requiredCurrency;
            if (recipe.requiredEnergy > 0) {
                if (userProfile.energy && userProfile.energy.current !== undefined) {
                    userProfile.energy.current -= recipe.requiredEnergy;
                    userProfile.markModified('energy');
                } else { throw new Error("Estrutura de energia do usuário inválida."); }
            }

            if (recipe.requiredItems && recipe.requiredItems.length > 0) {
                for (const requiredMaterial of recipe.requiredItems) {
                    await removeItemFromInventory(userProfile, requiredMaterial.itemId.toString(), requiredMaterial.quantity);
                }
            }
            await removeItemFromInventory(userProfile, baseItemDetails._id.toString(), 1);
            await addItemToInventory(userProfile, evolvedItemDetails._id.toString(), 1, evolvedItemDetails.name);
            
            await userProfile.save();

            let resourcesSpentString = '';
            if (recipe.requiredCurrency > 0) resourcesSpentString += `🪙 ${recipe.requiredCurrency.toLocaleString('pt-BR')}`;
            if (recipe.requiredEnergy > 0) resourcesSpentString += `${resourcesSpentString ? ', ' : ''}⚡ ${recipe.requiredEnergy}`;
            
            let materialsSpentString = '';
            if (recipe.requiredItems && recipe.requiredItems.length > 0) {
                const materialPromises = recipe.requiredItems.map(async mat => {
                    // mat.itemId já é o ObjectId aqui, então buscamos detalhes para nome
                    const matDetails = await Item.findById(mat.itemId); 
                    return `${mat.quantity}x ${matDetails ? matDetails.name : 'Material Desconhecido'}`;
                });
                materialsSpentString = (await Promise.all(materialPromises)).join(', ');
            }

            if(materialsSpentString) {
                 resourcesSpentString += `${resourcesSpentString ? (recipe.requiredCurrency > 0 || recipe.requiredEnergy > 0 ? ', mais ' : '') : ''}${materialsSpentString}`;
            }
            
            if (resourcesSpentString) resourcesSpentString = resourcesSpentString.trim() + '.';
            else resourcesSpentString = 'Nenhum recurso específico gasto.';


            const successEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Verde para sucesso
                .setTitle('✨ Item Evoluído com Sucesso! ✨')
                .setDescription(`${message.author.toString()}, seu **${baseItemDetails.name}** evoluiu para **${evolvedItemDetails.name}**!`)
                .addFields(
                    { name: "Item Base Consumido", value: `1x ${baseItemDetails.name}`, inline: true},
                    { name: "Novo Item Obtido", value: `1x ${evolvedItemDetails.name}`, inline: true},
                    { name: "Recursos Gastos", value: resourcesSpentString }
                )
                .setThumbnail(evolvedItemDetails.imageUrl || baseItemDetails.imageUrl || client.user.displayAvatarURL())
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [successEmbed] });

        } catch (error) {
            console.error("Erro ao processar a evolução:", error);
            // TODO: Considerar uma lógica de rollback mais robusta se o save falhar após deduções parciais.
            message.reply("Ocorreu um erro crítico durante o processo de evolução. Seus recursos podem não ter sido deduzidos corretamente ou o item pode não ter sido trocado. Por favor, contate um administrador.");
        }
    }
};