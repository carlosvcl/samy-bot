// src/commands/moderacao/history.js
const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ITEMS_PER_PAGE_HIST = 5;

module.exports = {
    name: 'history',
    aliases: ['modlogs', 'casos', 'punishments', 'punicoes'],
    description: 'Mostra o histórico de moderação de um usuário neste servidor.',
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> [página]',
    permissionsUser: [PermissionsBitField.Flags.ViewAuditLog], // Ou outra permissão adequada como KickMembers
    async execute({ client, message, args }) {
        const ModerationLog = client.models.ModerationLog;
        const targetUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
        let page = 1;
        if (args[1] && !isNaN(parseInt(args[1]))) {
            page = parseInt(args[1]);
        }

        if (!targetUser) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }

        const fetchHistoryPage = async (currentPage) => {
            const totalLogs = await ModerationLog.countDocuments({ guildId: message.guild.id, userId: targetUser.id });
            const totalPages = Math.ceil(totalLogs / ITEMS_PER_PAGE_HIST) || 1;
            currentPage = Math.max(1, Math.min(currentPage, totalPages));

            const logs = await ModerationLog.find({ guildId: message.guild.id, userId: targetUser.id })
                .sort({ timestamp: -1 }) // Mais recentes primeiro
                .skip((currentPage - 1) * ITEMS_PER_PAGE_HIST)
                .limit(ITEMS_PER_PAGE_HIST);
            
            return { logs, currentPage, totalPages, totalLogs };
        };
        
        const generateEmbedAndRows = async (histData) => {
            const { logs, currentPage, totalPages, totalLogs } = histData;
            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`📜 Histórico de Moderação para ${targetUser.tag} (ID: \`${targetUser.id}\`)`)
                .setDescription(`Página ${currentPage}/${totalPages}. Exibindo ${logs.length} de ${totalLogs} registro(s).`)
                .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (logs.length === 0) {
                embed.addFields({ name: "Nenhum Registro Encontrado", value: 'Este usuário não possui ações de moderação registradas neste servidor.' });
            } else {
                for (const log of logs) {
                    let moderatorTag = `ID: ${log.moderatorId}`;
                    try {
                        const moderatorMember = await message.guild.members.fetch(log.moderatorId).catch(() => null);
                        if (moderatorMember) moderatorTag = moderatorMember.user.tag;
                        else { // Tenta buscar como usuário se não for membro
                            const modUser = await client.users.fetch(log.moderatorId).catch(()=>null);
                            if(modUser) moderatorTag = modUser.tag;
                        }
                    } catch (e) { /* Mantém o ID */ }

                    embed.addFields({
                        name: `📝 Caso #${log.caseId} - ${log.actionType.toUpperCase()} - <t:${Math.floor(new Date(log.timestamp).getTime() / 1000)}:D>`,
                        value: `**Moderador:** ${moderatorTag}\n**Razão:** ${log.reason.substring(0, 200) || 'N/A'}\n**Duração:** ${log.duration || 'N/A'}`
                    });
                }
            }
            const rows = [];
            if (totalPages > 1) {
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`history_${targetUser.id}_prev`) // Custom ID com target para múltiplos coletores
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`history_${targetUser.id}_next`)
                        .setLabel('Próxima ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages || totalPages === 0)
                );
                rows.push(buttonRow);
            }
            return { embeds: [embed], components: rows };
        };

        let currentHistData = await fetchHistoryPage(page);
        const historyMessage = await message.channel.send(await generateEmbedAndRows(currentHistData));

        if (currentHistData.totalPages <= 1) return;

        const collector = historyMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId.startsWith(`history_${targetUser.id}_`), // Filtro mais específico
            time: 180000 // 3 minutos
        });

        collector.on('collect', async interaction => {
            try {
                await interaction.deferUpdate();
                let newPage = currentHistData.currentPage;
                if (interaction.customId.endsWith('_prev')) newPage--;
                if (interaction.customId.endsWith('_next')) newPage++;
                
                currentHistData = await fetchHistoryPage(newPage);
                await historyMessage.edit(await generateEmbedAndRows(currentHistData));
            } catch (error) {
                console.error("Erro no coletor do histórico:", error);
                // interaction.followUp({ content: 'Ocorreu um erro ao navegar no histórico.', ephemeral: true }).catch(() => {});
            }
        });

        collector.on('end', async () => {
            if (!historyMessage.deleted) {
                const data = await generateEmbedAndRows(currentHistData); // Recalcula para pegar o estado final dos botões
                const finalComponents = data.components.map(row => {
                    row.components.forEach(component => component.setDisabled(true));
                    return row;
                });
                historyMessage.edit({ components: finalComponents }).catch(() => {});
            }
        });
    }
};