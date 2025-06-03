// src/commands/economia/leaderboard.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const USERS_PER_PAGE_LB = 10;

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'ranking', 'classificacao'], // Adicionando mais aliases
    description: 'Mostra o ranking de usuários por XP, Nível ou Saldo.',
    category: 'economia', // Adicionando categoria
    usage: '[xp/balance/level] [página]',
    // cooldown: 5, // Exemplo de cooldown para o comando em si
    async execute({ client, message, args }) { // Alterado para a assinatura padrão
        const User = client.models.User;
        let sortField = 'xp'; 
        let sortLabel = 'XP';
        let page = 1;

        if (args[0]) {
            const criteria = args[0].toLowerCase();
            if (['balance', 'saldo', 'dinheiro', 'money'].includes(criteria)) {
                sortField = 'balance';
                sortLabel = 'Saldo';
            } else if (['level', 'lvl', 'nível'].includes(criteria)) {
                sortField = 'level';
                sortLabel = 'Nível';
            } else if (!isNaN(parseInt(criteria))) {
                page = parseInt(criteria);
            }
        }
        if (args[1] && !isNaN(parseInt(args[1]))) {
            page = parseInt(args[1]);
        }
        
        const sortCriteria = {};
        if (sortField === 'level') {
            sortCriteria[sortField] = -1; // Nível decrescente
            sortCriteria['xp'] = -1;      // XP decrescente como critério de desempate para nível
        } else {
            sortCriteria[sortField] = -1; // XP ou Saldo decrescente
        }

        const fetchLeaderboardPage = async (currentPage) => {
            // Apenas usuários com valor > 0 no campo de ordenação ou com nível > 0
            const queryCondition = sortField === 'balance' ? { balance: { $gt: 0 } } : 
                                   sortField === 'level' ? { level: { $gt: 0 } } : 
                                   { xp: { $gt: 0 } };
            
            const totalUsers = await User.countDocuments(queryCondition); 
            const totalPages = Math.ceil(totalUsers / USERS_PER_PAGE_LB) || 1; // Garante no mínimo 1 página
            currentPage = Math.max(1, Math.min(currentPage, totalPages));

            const users = await User.find(queryCondition)
                .sort(sortCriteria)
                .skip((currentPage - 1) * USERS_PER_PAGE_LB)
                .limit(USERS_PER_PAGE_LB);
            return { users, currentPage, totalPages, totalUsers };
        };

        const generateEmbedAndRows = (lbData) => {
            const { users, currentPage, totalPages, totalUsers } = lbData;
            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa Padrão
                .setTitle(`🏆 Leaderboard Global - Top por ${sortLabel}`)
                .setDescription(`Página **${currentPage}** de **${totalPages}** (${totalUsers} jogadores no total para este critério).`)
                .setTimestamp()
                .setFooter({ text: `Critério: ${sortLabel} | Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

            if (!users.length) {
                embed.addFields({ name: "🦗 Ranking Vazio!", value: 'Ninguém no leaderboard ainda para este critério!' });
            } else {
                let rankString = '';
                users.forEach((user, index) => {
                    const rank = (currentPage - 1) * USERS_PER_PAGE_LB + index + 1;
                    let valueDisplay;
                    if (sortField === 'xp') {
                        valueDisplay = `✨ ${user.xp.toLocaleString()} XP (Nível ${user.level})`;
                    } else if (sortField === 'balance') {
                        valueDisplay = `🪙 ${user.balance.toLocaleString()} moedas`;
                    } else { // level
                        valueDisplay = `🌟 Nível ${user.level} (XP: ${user.xp.toLocaleString()})`;
                    }
                    rankString += `**${rank}.** ${user.username} - ${valueDisplay}\n`;
                });
                // Para garantir que a string não exceda o limite do campo de descrição ou valor do campo
                embed.addFields({name: `Top ${users.length} desta Página:`, value: rankString.substring(0,1020) });
            }
            
            const rows = [];
            if (totalPages > 1) {
                const buttonRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        // Custom ID mais específico para evitar conflitos se houver múltiplos leaderboards abertos pelo mesmo usuário
                        .setCustomId(`lb_${sortField}_${message.id}_prev`) 
                        .setLabel('⬅️ Anterior')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === 1),
                    new ButtonBuilder()
                        .setCustomId(`lb_${sortField}_${message.id}_next`)
                        .setLabel('Próxima ➡️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(currentPage === totalPages || totalPages === 0)
                );
                rows.push(buttonRow);
            }
            return { embeds: [embed], components: rows };
        };
        
        let currentLbData = await fetchLeaderboardPage(page);
        const lbMessage = await message.channel.send(generateEmbedAndRows(currentLbData));

        if (currentLbData.totalPages <= 1) return;

        const collector = lbMessage.createMessageComponentCollector({
            // Filtro mais específico para o customId
            filter: i => i.user.id === message.author.id && i.customId.startsWith(`lb_${sortField}_${message.id}_`),
            time: 180000 // Aumentado para 3 minutos
        });

        collector.on('collect', async interaction => {
            try {
                await interaction.deferUpdate();
                let newPage = currentLbData.currentPage;
                if (interaction.customId.endsWith('_prev')) newPage--;
                if (interaction.customId.endsWith('_next')) newPage++;
                
                currentLbData = await fetchLeaderboardPage(newPage);
                await lbMessage.edit(generateEmbedAndRows(currentLbData));
            } catch (error) {
                 console.error("Erro no coletor do leaderboard:", error);
                 // Pode-se enviar uma mensagem ephemeral de erro para o usuário
                 // await interaction.followUp({ content: 'Ocorreu um erro ao atualizar o leaderboard.', ephemeral: true }).catch(() => {});
            }
        });

        collector.on('end', () => {
            if (!lbMessage.deleted) {
                const finalComponents = generateEmbedAndRows(currentLbData).components.map(row => {
                    row.components.forEach(component => component.setDisabled(true));
                    return row;
                });
                lbMessage.edit({ components: finalComponents }).catch(() => {});
            }
        });
    }
};