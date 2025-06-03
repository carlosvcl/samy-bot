// src/commands/economia/shop.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ComponentType } = require('discord.js'); // MODIFICADO: Adicionado ComponentType

const ITEMS_PER_PAGE = 5;

module.exports = {
    name: 'shop',
    aliases: ['loja', 'market'],
    description: 'Mostra os itens disponíveis na loja para compra.',
    category: 'economia',
    usage: '[categoria] [página]',
    async execute({ client, message, args }) {
        const Item = client.models.Item;
        if (!Item) {
            console.error("Modelo Item não está carregado em client.models!");
            return message.reply("Ocorreu um erro ao carregar a loja. Tente novamente mais tarde.");
        }

        let page = 1;
        let categoryFilter; // Será definido pela lógica de parsing de args abaixo

        // Implementação da função fetchItems
        const fetchItems = async (currentPage, currentCategory) => {
            // currentCategory aqui deve ser null para "todas" ou o nome da categoria
            const query = { buyPrice: { $exists: true, $gt: 0 }, isObtainable: true };
            if (currentCategory) { // Se currentCategory não for null/undefined
                query.category = currentCategory;
            }

            try {
                const totalItems = await Item.countDocuments(query);
                const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
                const validCurrentPage = Math.max(1, Math.min(currentPage, totalPages));

                const items = await Item.find(query)
                    .sort({ name: 1 })
                    .skip((validCurrentPage - 1) * ITEMS_PER_PAGE)
                    .limit(ITEMS_PER_PAGE)
                    .lean();

                return {
                    items: items || [],
                    currentPage: validCurrentPage,
                    totalPages,
                    totalItems,
                    currentCategory: currentCategory || 'all_categories_shop_filter' 
                };
            } catch (error) {
                console.error("Erro ao buscar itens da loja:", error);
                return {
                    items: [],
                    currentPage: 1,
                    totalPages: 1,
                    totalItems: 0,
                    currentCategory: currentCategory || 'all_categories_shop_filter'
                };
            }
        };
        // Fim da implementação de fetchItems

        const itemCategories = await Item.distinct('category', { buyPrice: { $exists: true, $gt: 0 }, isObtainable: true });
        const categoryOptions = itemCategories.sort().map(cat => ({
            label: cat.charAt(0).toUpperCase() + cat.slice(1),
            value: cat.toLowerCase(),
        }));
        if (categoryOptions.length > 0) {
            categoryOptions.unshift({ label: '🛒 Todas as Categorias', value: 'all_categories_shop_filter' });
        }

        const generateEmbedAndRows = (itemsData) => {
            const { items, currentPage, totalPages, totalItems, currentCategory } = itemsData; // currentCategory aqui é 'all_categories_shop_filter' ou nome da categoria

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`🛍️ Loja Oficial ${currentCategory && currentCategory !== 'all_categories_shop_filter' ? `- Categoria: ${currentCategory.charAt(0).toUpperCase() + currentCategory.slice(1)}` : ''}`)
                .setDescription(`Página ${currentPage} de ${totalPages}. ${totalItems} itens disponíveis.\nUse \`${process.env.PREFIX || 's!'}buy <nome do item> [quantidade]\` para comprar.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (!items || items.length === 0) {
                embed.addFields({ name: '🦗 Loja Vazia!', value: 'Nenhum item encontrado para esta categoria ou a loja está sem estoque no momento.' });
            } else {
                items.forEach(item => {
                    let itemValue = `💰 Preço: **${item.buyPrice ? item.buyPrice.toLocaleString() : 'N/A'} moedas**\n`;
                    itemValue += `📜 *${item.description || 'Sem descrição.'}*\n`;
                    itemValue += `📦 Categoria: ${item.category || 'N/A'}\n`;
                    if (item.rarity) itemValue += `✨ Raridade: ${item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}`;
                    if (item.effects && typeof item.effects.passiveIncome === 'number' && typeof item.effects.passiveIncomeIntervalHours === 'number') {
                        itemValue += `\n💸 Gera: ${item.effects.passiveIncome} moedas / ${item.effects.passiveIncomeIntervalHours}h`;
                    }
                    embed.addFields({
                        name: `${item.name || 'Item sem nome'} ${item.imageUrl ? '🖼️' : ''}`,
                        value: itemValue.substring(0, 1024)
                    });
                });
            }

            const rows = [];
            if (categoryOptions.length > 0) {
                const categorySelect = new StringSelectMenuBuilder()
                    .setCustomId('shop_category_select')
                    .setPlaceholder('Filtrar por categoria...')
                    .addOptions(categoryOptions.map(opt => ({
                        label: opt.label,
                        value: opt.value,
                        default: currentCategory === opt.value 
                    })));
                rows.push(new ActionRowBuilder().addComponents(categorySelect));
            }

            if (totalPages > 1) {
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop_prev_page_${currentCategory}_${currentPage - 1}`)
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`shop_next_page_${currentCategory}_${currentPage + 1}`)
                        .setLabel('Próxima ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages || totalItems === 0)
                );
                rows.push(buttonRow);
            }
            return { embeds: [embed], components: rows };
        };

        // Lógica de parsing de argumentos para categoria e página
        if (args.length > 0) {
            const potentialPageLast = parseInt(args[args.length - 1]);
            const potentialPageFirst = parseInt(args[0]);

            if (!isNaN(potentialPageLast) && args.length > 1 && args.slice(0, -1).every(arg => isNaN(parseInt(arg)))) {
                page = potentialPageLast > 0 ? potentialPageLast : 1;
                categoryFilter = args.slice(0, -1).join(' ').toLowerCase();
            } else if (!isNaN(potentialPageFirst) && args.length === 1) {
                page = potentialPageFirst > 0 ? potentialPageFirst : 1;
                categoryFilter = null; 
            } else if (args.length > 0 && args.every(arg => isNaN(parseInt(arg)))) {
                categoryFilter = args.join(' ').toLowerCase();
                page = 1;
            } else {
                 page = 1;
                 categoryFilter = null;
            }
        } else {
            page = 1;
            categoryFilter = null;
        }


        let currentData = await fetchItems(page, categoryFilter);
        const shopDisplayData = generateEmbedAndRows(currentData);
        const shopMessage = await message.channel.send(shopDisplayData);

        if (!shopDisplayData.components || !shopDisplayData.components.some(row => row.components.length > 0)) {
             console.log("[SHOP CMD] Nenhum componente interativo para criar coletor.");
             return; // Não cria coletor se não houver componentes
        }

        const collector = shopMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 300000 
        });

        collector.on('collect', async i => {
            try {
                await i.deferUpdate(); 

                let newPage = currentData.currentPage;
                let newCategoryState = currentData.currentCategory; 

                if (i.isButton()) {
                    const customIdParts = i.customId.split('_');
                    const pageStringFromId = customIdParts[customIdParts.length - 1];
                    const parsedPage = parseInt(pageStringFromId);

                    if (isNaN(parsedPage)) {
                        console.error(`[SHOP CMD] Falha ao parsear página do customId do botão: ${i.customId}`);
                        if (!i.replied && !i.deferred) {
                            await i.followUp({ content: "Ocorreu um erro ao tentar mudar de página.", ephemeral: true }).catch(console.error);
                        }
                        return; 
                    }
                    newPage = parsedPage;
                    
                    if (newCategoryState === 'all_categories_shop_filter') {
                        newCategoryState = null;
                    }

                } else if (i.isStringSelectMenu()) { // MODIFICADO: de i.isSelectMenu() para i.isStringSelectMenu() para v14
                    if (i.customId === 'shop_category_select') {
                        newCategoryState = i.values[0]; 
                        if (newCategoryState === 'all_categories_shop_filter') {
                            newCategoryState = null; 
                        }
                        newPage = 1; 
                    }
                }

                currentData = await fetchItems(newPage, newCategoryState); 
                const newShopDisplayData = generateEmbedAndRows(currentData);
                await shopMessage.edit(newShopDisplayData);

            } catch (error) {
                console.error("Erro no coletor da loja:", error);
                if (i && !i.replied && !i.deferred) {
                    await i.followUp({ content: "Ocorreu um erro ao atualizar a loja. Tente novamente.", ephemeral: true }).catch(e => console.error("Erro ao tentar responder à interação com erro:", e));
                }
            }
        });
        
        // ----- INÍCIO DA MODIFICAÇÃO PARA CORRIGIR O ERRO -----
        collector.on('end', collected => {
            // Verifica se a mensagem ainda existe e pode ser editada
            if (!shopMessage || !shopMessage.editable || !shopMessage.components || shopMessage.components.length === 0) {
                console.warn("[SHOP CMD] Mensagem da loja não encontrada, não editável ou sem componentes ao finalizar o coletor.");
                return;
            }
        
            const disabledRows = shopMessage.components.map(actionRowData => {
                // actionRowData é um APIActionRowComponent (a estrutura de dados da action row)
                const newRow = new ActionRowBuilder();
                if (actionRowData && actionRowData.components) {
                    actionRowData.components.forEach(compData => { // compData é APIButtonComponent, APISelectMenuComponent, etc.
                        let disabledComp;
                        switch (compData.type) {
                            case ComponentType.Button:
                                disabledComp = ButtonBuilder.from(compData).setDisabled(true);
                                break;
                            case ComponentType.StringSelect: // Para StringSelectMenuBuilder
                                disabledComp = StringSelectMenuBuilder.from(compData).setDisabled(true);
                                break;
                            // Adicione outros ComponentTypes se você os usar na loja e quiser desabilitá-los
                            // Exemplo:
                            // case ComponentType.UserSelect:
                            //     disabledComp = UserSelectMenuBuilder.from(compData).setDisabled(true);
                            //     break;
                            default:
                                // Se for um tipo de componente que não pode ser desabilitado ou não é interativo,
                                // você pode optar por adicioná-lo como está ou simplesmente ignorá-lo.
                                // Aqui, optamos por apenas processar os tipos conhecidos que podem ser desabilitados.
                                // Se quiser manter o componente original caso não seja um tipo conhecido:
                                // try { disabledComp = Builders.ComponentBuilder.from(compData); } catch { disabledComp = null; }
                                // Mas é mais seguro apenas lidar com os tipos que você espera.
                                console.warn(`[SHOP CMD] Componente do tipo ${compData.type} não é explicitamente suportado para desabilitar no 'end' handler. Será mantido como está se possível ou ignorado.`);
                                // Para tentar manter componentes não explicitamente cobertos, mas isso pode ser arriscado:
                                // if (typeof compData.setDisabled === 'function') {
                                //     disabledComp = compData.setDisabled(true); // Isso não funcionará para API Objects
                                // } else {
                                //     // Se não tiver setDisabled, e você quiser manter o componente,
                                //     // você precisaria de um builder genérico ou reconstruí-lo
                                //     // Aqui, vamos apenas pular se não for um tipo conhecido
                                // }
                                return; // Pula para o próximo componente na linha se não for explicitamente tratado
                        }
                        if (disabledComp) {
                            newRow.addComponents(disabledComp);
                        }
                    });
                }
                return newRow;
            }).filter(row => row.components.length > 0); // Remove ActionRows que possam ter ficado vazias

            // Edita a mensagem apenas se houver componentes resultantes (desabilitados ou não)
            // ou se a mensagem original tinha componentes e agora não tem mais (para limpar os componentes)
            if (disabledRows.length > 0 || (shopMessage.components && shopMessage.components.length > 0)) {
                shopMessage.edit({ components: disabledRows })
                    .catch(error => {
                        // Erros comuns: "Unknown Message" (se a mensagem foi deletada), "Missing Permissions"
                        console.error("Erro ao tentar desabilitar componentes no final do coletor da loja:", error);
                    });
            }
        });
        // ----- FIM DA MODIFICAÇÃO -----
    }
};