// src/commands/dev/listguilds.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GUILDS_PER_PAGE = 10;

module.exports = {
    name: 'listguilds',
    aliases: ['lg', 'servers', 'guilds'],
    description: 'Lista todos os servidores em que o bot está. (Apenas Desenvolvedores)',
    category: 'dev',
    devOnly: true,
    async execute({ client, message, args }) {
        const ownerIds = (process.env.OWNER_IDS || "").split(',').map(id => id.trim());
        if (!ownerIds.includes(message.author.id)) {
            return;
        }

        const guilds = Array.from(client.guilds.cache.values()).sort((a, b) => b.memberCount - a.memberCount); // Ordena por contagem de membros
        const totalGuilds = guilds.length;
        const totalPages = Math.ceil(totalGuilds / GUILDS_PER_PAGE) || 1;
        let page = args[0] && !isNaN(parseInt(args[0])) ? parseInt(args[0]) : 1;
        page = Math.max(1, Math.min(page, totalPages));

        const generateEmbed = (currentPage) => {
            const startIndex = (currentPage - 1) * GUILDS_PER_PAGE;
            const endIndex = startIndex + GUILDS_PER_PAGE;
            const currentGuilds = guilds.slice(startIndex, endIndex);

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`🌍 Lista de Servidores (${totalGuilds} total) - Página ${currentPage}/${totalPages}`)
                .setTimestamp()
                .setFooter({ text: `Acessado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (currentGuilds.length === 0) {
                embed.setDescription("Não estou em nenhum servidor (ou nenhum para esta página).");
            } else {
                let description = "";
                currentGuilds.forEach((guild, index) => {
                    description += `**${startIndex + index + 1}.** ${guild.name} (\`${guild.id}\`) - ${guild.memberCount} membros\n`;
                });
                embed.setDescription(description);
            }
            return embed;
        };
        
        const generateRows = (currentPage) => {
            const rows = [];
            if (totalPages > 1) {
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`lg_${message.id}_prev`)
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`lg_${message.id}_next`)
                        .setLabel('Próxima ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages)
                );
                rows.push(buttonRow);
            }
            return rows;
        };


        const sentMessage = await message.channel.send({ 
            embeds: [generateEmbed(page)], 
            components: generateRows(page) 
        });

        if (totalPages <= 1) return;

        const collector = sentMessage.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id && i.customId.startsWith(`lg_${message.id}_`),
            time: 180000 // 3 minutos
        });

        collector.on('collect', async interaction => {
            try {
                await interaction.deferUpdate();
                if (interaction.customId.endsWith('_prev')) page--;
                if (interaction.customId.endsWith('_next')) page++;
                
                page = Math.max(1, Math.min(page, totalPages)); // Garante que a página está nos limites
                
                await sentMessage.edit({ 
                    embeds: [generateEmbed(page)], 
                    components: generateRows(page) 
                });
            } catch (error) {
                console.error("Erro no coletor do listguilds:", error);
            }
        });

        collector.on('end', async () => {
            if (!sentMessage.deleted) {
                const finalComponents = generateRows(page).map(row => { // Passa a página final para desabilitar corretamente
                    row.components.forEach(component => component.setDisabled(true));
                    return row;
                });
                sentMessage.edit({ components: finalComponents }).catch(() => {});
            }
        });
    }
};