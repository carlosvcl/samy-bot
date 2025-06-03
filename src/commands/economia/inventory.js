// src/commands/economia/inventory.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField } = require('discord.js');
const ITEMS_PER_PAGE_INV = 5; // Reduzi um pouco para acomodar mais detalhes por item sem ficar muito longo

module.exports = {
    name: 'inventory',
    aliases: ['inv', 'mochila', 'meusitens'],
    description: 'Mostra seu inventário ou o de outro usuário.',
    category: 'economia',
    usage: '[@usuário ou ID] [página]',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const Item = client.models.Item;

        let targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]);
        let page = 1;

        if (targetMember) {
            if (args[1] && !isNaN(parseInt(args[1]))) {
                page = Math.max(1, parseInt(args[1]));
            }
        } else if (args.length > 0 && !isNaN(parseInt(args[0]))) {
            targetMember = message.member;
            page = Math.max(1, parseInt(args[0]));
        } else {
            targetMember = message.member;
        }
        
        const targetUser = targetMember.user;
        
        const fetchInventoryPage = async (userId, userTag, currentPage) => {
            let userProfile = await User.findOne({ discordId: userId }) 
                .populate({
                    path: 'inventory.itemId',
                    model: Item
                });

            if (!userProfile) {
                return null;
            }

            if (!userProfile.inventory || userProfile.inventory.length === 0) {
                return {
                    inventoryItems: [], currentPage: 1, totalPages: 1,
                    totalItemCount: 0, userProfile: userProfile, totalQuantityOfAllItems: 0
                };
            }

            const validInventory = userProfile.inventory.filter(entry => entry.itemId);
            const totalItemCount = validInventory.length; // Tipos de itens distintos
            const totalQuantityOfAllItems = validInventory.reduce((sum, entry) => sum + entry.quantity, 0); // Soma de todas as quantidades
            const totalPages = Math.max(1, Math.ceil(totalItemCount / ITEMS_PER_PAGE_INV));
            currentPage = Math.max(1, Math.min(currentPage, totalPages));

            const startIndex = (currentPage - 1) * ITEMS_PER_PAGE_INV;
            const endIndex = startIndex + ITEMS_PER_PAGE_INV;
            const inventoryItems = validInventory.slice(startIndex, endIndex);

            return {
                inventoryItems, currentPage, totalPages, totalItemCount, userProfile, totalQuantityOfAllItems
            };
        };
        
        const generateEmbedAndRows = (invData, disableButtons = false) => {
            if (!invData || !invData.userProfile) {
                const noUserEmbed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`🎒 Inventário de ${targetUser.username}`)
                    .setDescription(`${targetUser.username} ainda não possui um inventário ou perfil de economia.`)
                    .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                    .setTimestamp()
                    .setFooter({ text: `Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
                return { embeds: [noUserEmbed], components: [] };
            }

            const { inventoryItems, currentPage, totalPages, totalItemCount, userProfile, totalQuantityOfAllItems } = invData;
            let totalInventoryValue = 0;

            userProfile.inventory.forEach(entry => {
                if (entry.itemId && typeof entry.itemId.sellPrice === 'number' && entry.itemId.sellPrice > 0) {
                    totalInventoryValue += entry.itemId.sellPrice * entry.quantity;
                }
            });

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🎒 Inventário de ${targetUser.username}`)
                .setDescription(`Página ${currentPage}/${totalPages} • Saldo: 🪙 **${userProfile.balance.toLocaleString('pt-BR')}**\nValor de Venda Estimado: 🪙 **${totalInventoryValue.toLocaleString('pt-BR')}**`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Itens Únicos: ${totalItemCount} • Total de Itens: ${totalQuantityOfAllItems} | Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (totalItemCount === 0) {
                embed.addFields({ name: 'Inventário Vazio', value: `😕 ${targetUser.username} não possui itens no momento.` });
            } else {
                inventoryItems.forEach(entry => {
                    if (entry.itemId) { 
                        let itemFieldValue = `📝 *${entry.itemId.description || 'Sem descrição.'}*\n\n`;
                        itemFieldValue += `✨ **Raridade:** ${entry.itemId.rarity || 'Comum'}\n`;
                        itemFieldValue += `🏷️ **Categoria:** ${entry.itemId.category || 'Geral'}\n`;
                        itemFieldValue += `🛒 **Compra:** ${entry.itemId.buyPrice > 0 ? `🪙 ${entry.itemId.buyPrice.toLocaleString('pt-BR')}` : 'Não comprável'}\n`;
                        itemFieldValue += `💰 **Venda:** ${entry.itemId.sellPrice > 0 ? `🪙 ${entry.itemId.sellPrice.toLocaleString('pt-BR')}` : 'Não vendável'}`;
                        
                        if (entry.itemId.usable) {
                            // Certifique-se que entry.itemId.name existe e é uma string para o comando use
                            const useCommandName = typeof entry.itemId.name === 'string' ? entry.itemId.name : 'item';
                            itemFieldValue += `\n\n🔧 *Pode ser usado com \`${process.env.PREFIX || '!'}use "${useCommandName}"\`*`;
                        }
                        // Exemplo de como adicionar mais informações se elas existirem no seu ItemSchema:
                        // if (entry.itemId.durability) {
                        //     itemFieldValue += `\n🛡️ **Durabilidade:** ${entry.itemId.durability}`;
                        // }
                        // if (entry.itemId.effects) {
                        //     itemFieldValue += `\n🔮 **Efeitos:** ${entry.itemId.effects}`;
                        // }

                        const itemIcon = entry.itemId.icon || '🔹'; // Ícone padrão se não houver
                        const hasImageIndicator = entry.itemId.imageUrl ? '🖼️' : ''; // Indicador se tem imagem (para thumbnail no !iteminfo por exemplo)
                        const itemNameDisplay = `${itemIcon} ${entry.itemId.name || 'Item Desconhecido'} ${hasImageIndicator}`.trim();

                        embed.addFields({
                            name: `${itemNameDisplay} (x${entry.quantity.toLocaleString('pt-BR')})`,
                            value: itemFieldValue,
                            inline: false 
                        });
                    } else {
                         embed.addFields({ name: '⚠️ Item Corrompido', value: 'Um item no inventário não pôde ser carregado corretamente.', inline: false });
                    }
                });
            }
            
            const rows = [];
            if (totalPages > 1) {
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`inventory_prev_${currentPage}_${targetUser.id}`)
                            .setLabel('⬅️ Anterior')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === 1 || disableButtons),
                        new ButtonBuilder()
                            .setCustomId(`inventory_next_${currentPage}_${targetUser.id}`)
                            .setLabel('Próxima ➡️')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(currentPage === totalPages || disableButtons)
                    );
                rows.push(row);
            }
            return { embeds: [embed], components: rows };
        };
        
        // --- Lógica Principal do Comando (permanece a mesma) ---
        let currentPage = page;
        const initialInvData = await fetchInventoryPage(targetUser.id, targetUser.tag, currentPage);

        if (!initialInvData) {
            const noProfilePayload = generateEmbedAndRows(null);
            return message.channel.send(noProfilePayload);
        }
        
        currentPage = initialInvData.currentPage;

        let messagePayload = generateEmbedAndRows(initialInvData);
        const inventoryMessage = await message.channel.send(messagePayload);

        if (initialInvData.totalPages <= 1) return;

        const filter = (interaction) => 
            interaction.customId.startsWith('inventory_') && 
            interaction.customId.endsWith(`_${targetUser.id}`) && 
            interaction.user.id === message.author.id; 

        const collector = inventoryMessage.createMessageComponentCollector({ filter, time: 120000 }); 

        collector.on('collect', async interaction => {
            const parts = interaction.customId.split('_'); 
            const action = parts[1];
            
            if (action === 'prev') {
                currentPage = Math.max(1, currentPage - 1);
            } else if (action === 'next') {
                currentPage = Math.min(initialInvData.totalPages, currentPage + 1);
            }

            const newInvData = await fetchInventoryPage(targetUser.id, targetUser.tag, currentPage);
            messagePayload = generateEmbedAndRows(newInvData);
            try {
                await interaction.update(messagePayload);
            } catch (updateError) {
                console.error("Erro ao atualizar interação do inventário:", updateError);
            }
        });

        collector.on('end', collected => {
            fetchInventoryPage(targetUser.id, targetUser.tag, currentPage) 
                .then(data => { 
                    if (inventoryMessage.editable && data) { // Adicionado cheque para 'data'
                        const finalPayload = generateEmbedAndRows(data, true); 
                        inventoryMessage.edit(finalPayload).catch(err => console.error("Erro ao editar msg do inventário no 'end' do collector:", err));
                    }
                })
                .catch(err => console.error("Erro ao buscar dados finais do inventário:", err));
        });
    }
};