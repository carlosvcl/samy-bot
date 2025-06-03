// src/commands/economia/investimentos.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ms = require('ms'); // Para formatar durações

const INVESTMENTS_PER_PAGE = 3; // Mostrar 3 investimentos por página para não ficar muito poluído

module.exports = {
    name: 'investimentos',
    aliases: ['meusinvestimentos', 'listarinvestimentos', 'invlist'],
    description: 'Mostra todos os seus investimentos ativos, seus IDs e status.',
    category: 'economia',
    // usage: '[página]', // A paginação será controlada por botões
    async execute({ client, message, args }) {
        const User = client.models.User;
        const userId = message.author.id;

        let page = 1;
        if (args[0] && !isNaN(parseInt(args[0]))) {
            page = parseInt(args[0]);
        }

        const fetchInvestmentsPage = async (currentPage) => {
            const userProfile = await User.findOne({ discordId: userId });

            if (!userProfile || !userProfile.activeInvestments || userProfile.activeInvestments.length === 0) {
                return { investmentsToShow: [], currentPage: 1, totalPages: 0, totalInvestments: 0, userProfile };
            }
            
            const totalInvestments = userProfile.activeInvestments.length;
            const totalPages = Math.ceil(totalInvestments / INVESTMENTS_PER_PAGE) || 1;
            currentPage = Math.max(1, Math.min(currentPage, totalPages));

            const startIndex = (currentPage - 1) * INVESTMENTS_PER_PAGE;
            const endIndex = startIndex + INVESTMENTS_PER_PAGE;
            // Ordenar por data de maturidade (mais próximos primeiro) ou data de início
            const sortedInvestments = userProfile.activeInvestments.sort((a, b) => {
                const maturityA = a.startTime.getTime() + (a.durationMinutes * 60 * 1000);
                const maturityB = b.startTime.getTime() + (b.durationMinutes * 60 * 1000);
                return maturityA - maturityB; // Mais próximos de maturar primeiro
            });
            const investmentsToShow = sortedInvestments.slice(startIndex, endIndex);
            
            return { investmentsToShow, currentPage, totalPages, totalInvestments, userProfile };
        };
        
        const generateEmbedAndRows = (invData) => {
            const { investmentsToShow, currentPage, totalPages, totalInvestments, userProfile } = invData;
            
            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`🏦 Seus Investimentos Ativos - ${message.author.username}`)
                .setDescription(`Página ${currentPage}/${totalPages}. Total de investimentos ativos: ${totalInvestments}.\nUse \`${process.env.PREFIX}collectinvestment <ID>\` para resgatar.`)
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (totalInvestments === 0) {
                 embed.addFields({name: "💸 Nenhum Investimento", value: `Você não possui investimentos ativos no momento. Use \`${process.env.PREFIX}invest <quantia>\` para começar!`});
            } else {
                 investmentsToShow.forEach(inv => {
                    const startTimeMs = inv.startTime.getTime();
                    const durationMs = inv.durationMinutes * 60 * 1000;
                    const maturityTimeMs = startTimeMs + durationMs;
                    const isMature = Date.now() >= maturityTimeMs;
                    const estimatedReturn = Math.floor(inv.principal * (1 + inv.returnRatePercent / 100));

                    embed.addFields({
                        name: `🆔 Investimento: \`${inv.investmentId}\``,
                        value: `**Valor Principal:** 🪙 ${inv.principal.toLocaleString()}\n` +
                               `**Taxa de Retorno:** ${inv.returnRatePercent}%\n` +
                               `**Retorno Estimado:** 🪙 ${estimatedReturn.toLocaleString()}\n` +
                               `**Iniciado em:** <t:${Math.floor(startTimeMs / 1000)}:f>\n` +
                               `**Duração:** ${ms(durationMs, { long: true })}\n` +
                               `**Maturidade:** <t:${Math.floor(maturityTimeMs / 1000)}:F> (<t:${Math.floor(maturityTimeMs / 1000)}:R>)\n` +
                               `**Status:** ${isMature ? '🟢 Maduro (Pronto para Coleta!)' : `⏳ Ativo (Faltam ${ms(maturityTimeMs - Date.now(), {long: true, roundUp: true})} )`}`
                    });
                });
            }
            
            const rows = [];
            if (totalPages > 1) {
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`investlist_${message.author.id}_prev`)
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`investlist_${message.author.id}_next`)
                        .setLabel('Próxima ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages || totalPages === 0)
                );
                rows.push(buttonRow);
            }
            return { embeds: [embed], components: rows };
        };
        
        let currentInvData = await fetchInvestmentsPage(page);
        const invMessage = await message.channel.send(generateEmbedAndRows(currentInvData));

        if (currentInvData.totalPages <= 1) return; 

        const collector = invMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId.startsWith(`investlist_${message.author.id}_`),
            time: 180000 // 3 minutos
        });

        collector.on('collect', async interaction => {
            try {
                await interaction.deferUpdate();
                let newPage = currentInvData.currentPage;

                if (interaction.customId.endsWith('_prev')) newPage--;
                if (interaction.customId.endsWith('_next')) newPage++;
                
                currentInvData = await fetchInvestmentsPage(newPage);
                await invMessage.edit(generateEmbedAndRows(currentInvData));
            } catch (error) {
                console.error("Erro no coletor da lista de investimentos:", error);
            }
        });

        collector.on('end', () => {
            if (!invMessage.deleted) {
                 const finalComponents = generateEmbedAndRows(currentInvData).components.map(row => {
                        row.components.forEach(component => component.setDisabled(true));
                        return row;
                    });
                invMessage.edit({ components: finalComponents }).catch(() => {});
            }
        });
    }
};