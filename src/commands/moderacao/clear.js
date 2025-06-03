// src/commands/moderação/clear.js
const { EmbedBuilder, PermissionsBitField, ChannelType, Collection } = require('discord.js');

// const ownerIdsString = process.env.OWNER_IDS || "SEU_ID_DE_PROPRIETARIO_AQUI_COMO_FALLBACK";
// const ownerIds = ownerIdsString.split(',').map(id => id.trim()).filter(id => id);

module.exports = {
    name: 'clear',
    aliases: ['limpar', 'purge', 'prune'],
    description: 'Apaga mensagens com várias opções de filtro.',
    category: 'moderação',
    // A string de 'usage' pode ser usada pelo comando de help geral
    usage: '<número> [@usuário|ID] [--bots|--humanos|--texto "frase"|--anexos|--embeds]',
    // filePath: __filename,

    async execute({ client, message, args, prefix }) {
        // ... (verificações de permissão como antes) ...
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ content: "❌ Você não tem permissão para gerenciar mensagens neste canal!" });
        }
        if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ content: "❌ Eu não tenho permissão para gerenciar mensagens neste canal! Por favor, me conceda essa permissão." });
        }

        const currentPrefix = prefix || client.prefix || process.env.PREFIX || "s!";

        if (!args[0] || isNaN(parseInt(args[0]))) {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`💡 Como usar o Comando \`${currentPrefix}clear\``)
                .setDescription(`Este comando apaga um número específico de mensagens no canal atual. Você pode adicionar filtros para refinar a limpeza.`)
                .addFields(
                    { name: '1. Formato Básico (apenas número):', value: `\`${currentPrefix}clear <número>\`\n*Exemplo:* \`${currentPrefix}clear 50\`` },
                    { name: '2. Filtrar por Usuário Específico:', value: `\`${currentPrefix}clear <número> @usuário\`\n*Exemplo:* \`${currentPrefix}clear 25 @${message.author.username}\`\n\`${currentPrefix}clear <número> <ID_do_usuário>\`\n*Exemplo:* \`${currentPrefix}clear 10 405910935119855616\`` },
                    {
                        name: '3. Adicionar Filtros de Conteúdo (Opcional):',
                        value: "Você pode adicionar **um** dos seguintes filtros *após* o número (e opcionalmente após o usuário):\n" +
                               `• \`--bots\` - Apaga apenas mensagens enviadas por bots.\n   *Ex:* \`${currentPrefix}clear 20 --bots\`\n` +
                               `• \`--humanos\` - Apaga apenas mensagens de usuários humanos.\n   *Ex:* \`${currentPrefix}clear 30 --humanos\`\n` +
                               `• \`--texto "sua frase aqui"\` - Apaga mensagens que contenham a frase especificada. **Use aspas duplas se a frase tiver espaços.**\n   *Ex:* \`${currentPrefix}clear 15 --texto "olá a todos"\`\n` +
                               `• \`--anexos\` - Apaga mensagens que contenham arquivos ou anexos.\n   *Ex:* \`${currentPrefix}clear 10 --anexos\`\n` +
                               `• \`--embeds\` - Apaga mensagens que contenham embeds (ex: prévias de links, mensagens de bots formatadas).\n   *Ex:* \`${currentPrefix}clear 20 --embeds\`\n`
                    },
                    { name: 'Combinando Usuário e Filtro de Conteúdo:', value: `*Exemplo:* \`${currentPrefix}clear 15 @${message.author.username} --texto "importante"\`\n(Apaga até 15 mensagens do usuário ${message.author.username} que contenham "importante")`},
                    { name: 'Importante (Limites):', value: '• Você pode processar e apagar no máximo **100 mensagens** por vez.\n• Mensagens com mais de **14 dias** não podem ser apagadas em massa.'}
                )
                .setFooter({text: `Lembre-se de usar o prefixo correto: ${currentPrefix}`});
            return message.reply({ embeds: [usageEmbed] });
        }

        let amount = parseInt(args.shift());

        // ... (resto da lógica do comando clear que você já tem, para processar os args e apagar as mensagens) ...
        // A lógica de parseamento de args, filtragem e deleção permanece a mesma da versão anterior.
        // O foco desta alteração é apenas no embed de ajuda.


        if (amount <= 0) return message.reply({ content: "O número de mensagens para apagar deve ser maior que zero." });
        if (amount > 100) {
            message.reply({ content: "Eu só consigo processar no máximo 100 mensagens de uma vez para filtrar. O limite de deleção em massa também é 100." });
            amount = 100;
        }

        let targetUser = null;
        let filterType = null;
        let filterText = null;

        if (args.length > 0) {
            const potentialUser = message.mentions.users.first() || await client.users.fetch(args[0]).catch(() => null);
            if (potentialUser) {
                targetUser = potentialUser;
                args.shift();
            }
        }
        if (args.length > 0) {
            const flag = args[0].toLowerCase();
            if (flag === '--bots') { filterType = 'bots'; args.shift(); }
            else if (flag === '--humanos' || flag === '--users') { filterType = 'humans'; args.shift(); }
            else if (flag === '--anexos' || flag === '--files') { filterType = 'attachments'; args.shift(); }
            else if (flag === '--embeds') { filterType = 'embeds'; args.shift(); }
            else if (flag === '--texto') {
                args.shift();
                if (args.length > 0) {
                    filterType = 'text';
                    let textArg = args.join(" ");
                    const matchQuoted = textArg.match(/^"([^"]+)"$/);
                    if (matchQuoted) {
                        filterText = matchQuoted[1].toLowerCase();
                    } else {
                        filterText = textArg.toLowerCase();
                    }
                } else {
                    return message.reply({ content: "Por favor, forneça o texto para filtrar após a flag `--texto`." });
                }
            }
        }

        try {
            await message.delete().catch(console.error);

            let fetchedMessages = await message.channel.messages.fetch({ limit: amount, before: message.id });

            if (targetUser) fetchedMessages = fetchedMessages.filter(m => m.author.id === targetUser.id);
            if (filterType === 'bots') fetchedMessages = fetchedMessages.filter(m => m.author.bot);
            else if (filterType === 'humans') fetchedMessages = fetchedMessages.filter(m => !m.author.bot);
            else if (filterType === 'attachments') fetchedMessages = fetchedMessages.filter(m => m.attachments.size > 0);
            else if (filterType === 'embeds') fetchedMessages = fetchedMessages.filter(m => m.embeds.length > 0);
            else if (filterType === 'text' && filterText) fetchedMessages = fetchedMessages.filter(m => m.content.toLowerCase().includes(filterText));

            if (fetchedMessages.size === 0) {
                return message.channel.send({ content: "ℹ️ Nenhuma mensagem encontrada para apagar com os critérios fornecidos." }).then(msg => {
                    setTimeout(() => msg.delete().catch(console.error), 7000);
                });
            }

            const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const recentMessages = fetchedMessages.filter(m => m.createdTimestamp > fourteenDaysAgo);
            const oldMessagesCount = fetchedMessages.size - recentMessages.size;

            let deletedCount = 0;
            if (recentMessages.size > 0) {
                const deleted = await message.channel.bulkDelete(recentMessages, true);
                deletedCount = deleted.size;
            }

            let filterDescription = "";
            if (targetUser) filterDescription += ` de ${targetUser.tag}`;
            if (filterType) {
                if (targetUser) filterDescription += " e"; else filterDescription += " com filtro";
                if (filterType === 'text' && filterText) filterDescription += ` contendo "${filterText.length > 20 ? filterText.substring(0,20)+'...' : filterText }"`;
                else filterDescription += ` (${filterType})`;
            }

            let responseMessage = `✅ **${deletedCount} mensagem(ns)${filterDescription} foram apagadas com sucesso!**`;
            if (oldMessagesCount > 0) {
                responseMessage += `\n⚠️ ${oldMessagesCount} mensagem(ns) encontradas tinham mais de 14 dias e não puderam ser apagadas em massa.`;
            }
            if (deletedCount === 0 && oldMessagesCount > 0) {
                 responseMessage = `⚠️ Todas as ${oldMessagesCount} mensagens encontradas${filterDescription} tinham mais de 14 dias e não puderam ser apagadas em massa.`;
            } else if (deletedCount === 0 && oldMessagesCount === 0 && fetchedMessages.size > 0) {
                 responseMessage = `ℹ️ Nenhuma mensagem recente foi encontrada para apagar com os filtros aplicados.`;
            } else if (deletedCount === 0 && fetchedMessages.size === 0) { // Redundante, já coberto acima
                 responseMessage = "ℹ️ Nenhuma mensagem foi encontrada para apagar.";
            }


            await message.channel.send({ content: responseMessage }).then(msg => {
                setTimeout(() => msg.delete().catch(console.error), 10000);
            });

            const logChannelId = process.env.MOD_LOG_CHANNEL_ID;
            if (logChannelId && deletedCount > 0) {
                const logChannel = client.channels.cache.get(logChannelId);
                if (logChannel && logChannel.type === ChannelType.GuildText) {
                    const logEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('🧹 Limpeza de Mensagens Executada')
                        .addFields(
                            { name: 'Canal', value: `${message.channel.name} (\`${message.channel.id}\`)` },
                            { name: 'Moderador', value: `${message.author.tag} (\`${message.author.id}\`)` },
                            { name: 'Mensagens Apagadas', value: `${deletedCount}` }
                        )
                        .setTimestamp();
                    if (filterDescription.trim()) {
                        logEmbed.addFields({ name: 'Filtros Aplicados', value: filterDescription.trim() });
                    }
                    if (oldMessagesCount > 0) {
                        logEmbed.addFields({ name: 'Obs', value: `${oldMessagesCount} mensagens com mais de 14 dias não foram apagadas.`})
                    }
                    try {
                        await logChannel.send({ embeds: [logEmbed] });
                    } catch (logError) {
                        console.error(`[ClearCmd] Falha ao enviar log de moderação:`, logError);
                    }
                }
            }

        } catch (error) {
            console.error(`[ClearCmd] Erro ao tentar apagar mensagens em #${message.channel.name}:`, error);
            message.channel.send({ content: `❌ Ocorreu um erro ao tentar apagar as mensagens. Verifique os logs do bot.` }).then(msg => {
                setTimeout(() => msg.delete().catch(console.error), 10000);
            });
        }
    }
};