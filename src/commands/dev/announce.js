// src/commands/dev/announce.js
const { EmbedBuilder, PermissionsBitField, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ownerIdsString = process.env.OWNER_IDS || "SEU_ID_DE_PROPRIETARIO_AQUI_COMO_FALLBACK";
const ownerIds = ownerIdsString.split(',').map(id => id.trim()).filter(id => id);

module.exports = {
    name: 'announce',
    aliases: ['postar', 'anunciar', 'aviso'],
    description: 'Envia uma mensagem ou embed customizado para um canal específico.',
    category: 'dev',
    usage: '<#canal> ["título do embed" (opcional)] "mensagem" [--cor #hex (opcional)] [--cargo @cargo (opcional)]',
    devOnly: true,
    // filePath: __filename,

    async execute({ client, message, args, prefix }) {
        // Verificação de Desenvolvedor
        if (ownerIds.length > 0 && !ownerIds.includes(message.author.id)) {
            return;
        }
        if (ownerIds.length === 0 && message.author.id !== (await client.application.fetch()).owner.id) {
            console.warn("OWNER_IDS não configurado, apenas o dono da aplicação pode usar 'announce'.");
            return;
        }

        // Define currentPrefix para garantir que temos um valor
        const currentPrefix = prefix || client.prefix || process.env.PREFIX || "s!";

        if (args.length < 2) {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle(`💡 Como usar o Comando \`${currentPrefix}announce\``) // CORRIGIDO
                .setDescription("Este comando permite enviar anúncios formatados ou mensagens simples para um canal específico do servidor.")
                .addFields(
                    {
                        name: '1️⃣ Sintaxe Principal',
                        // CORRIGIDO
                        value: `\`\`\`${currentPrefix}announce <#canal_destino> ["título_opcional_para_embed"] "sua mensagem aqui"\`\`\``
                    },
                    {
                        name: '▶️ Exemplo (Embed Simples)',
                        // CORRIGIDO
                        value: `\`\`\`${currentPrefix}announce #geral "📢 Comunicado Importante" "Olá a todos! Teremos um evento especial no próximo sábado. Não percam!"\`\`\``
                    },
                    {
                        name: '▶️ Exemplo (Mensagem de Texto Simples)',
                        // CORRIGIDO
                        value: `\`\`\`${currentPrefix}announce #avisos "Manutenção rápida programada para as 03:00."\`\`\`\n*(Se não houver um segundo argumento entre aspas, a mensagem inteira será enviada como texto simples).*`
                    },
                    {
                        name: '⚙️ Opções Adicionais (para Embeds)',
                        value: "Adicione ao final do comando:\n" +
                               "• ` --cor #codigoHex` - Define a cor da barra lateral do embed (ex: `--cor #3498DB`).\n" +
                               "• ` --cargo @nomeDoCargo` - Menciona um cargo *antes* da mensagem/embed (ping).\n" +
                               "• ` --imagem URL_DA_IMAGEM` - Adiciona uma imagem grande ao embed.\n" +
                               "• ` --thumbnail URL_DA_MINIATURA` - Adiciona uma miniatura ao embed."
                    },
                    {
                        name: '✨ Exemplo Completo com Opções',
                        // CORRIGIDO
                        value: `\`\`\`${currentPrefix}announce #eventos "🎉 Novo Evento!" "Preparem-se para a nossa caça ao tesouro! Mais detalhes em breve." --cor #FFD700 --cargo @Participantes --imagem https://i.imgur.com/linkDaImagem.png\`\`\``
                    }
                )
                .setFooter({ text: "Dica: Coloque títulos e mensagens com espaços sempre entre aspas duplas \" \"." });
            return message.reply({ embeds: [usageEmbed] });
        }

        // 1. Parsear o canal
        // ... (resto da lógica como antes) ...
        const targetChannelMention = args.shift();
        const channelIdMatch = targetChannelMention.match(/^<#(\d+)>$/);
        if (!channelIdMatch) {
            return message.reply({ content: "❌ O primeiro argumento deve ser a menção de um canal de texto válido (ex: #geral)." });
        }
        const targetChannelId = channelIdMatch[1];
        const targetChannel = message.guild.channels.cache.get(targetChannelId);

        if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
            return message.reply({ content: "❌ Canal não encontrado ou não é um canal de texto." });
        }

        if (!targetChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages) ||
            !targetChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.EmbedLinks)) {
            return message.reply({ content: `❌ Eu não tenho permissão para enviar mensagens ou embeds no canal ${targetChannel.toString()}.` });
        }

        let embedColor = '#FF69B4';
        let roleToMention = null;
        let imageUrl = null;
        let thumbnailUrl = null;
        let remainingArgs = [...args];

        function extractOption(flag, requiresValue = true) {
            const flagIndex = remainingArgs.findIndex(arg => arg.toLowerCase() === flag);
            if (flagIndex > -1) {
                if (requiresValue && remainingArgs[flagIndex + 1]) {
                    const value = remainingArgs[flagIndex + 1];
                    remainingArgs.splice(flagIndex, 2);
                    return value;
                } else if (!requiresValue) {
                    remainingArgs.splice(flagIndex, 1);
                    return true;
                }
            }
            return null;
        }

        const customColor = extractOption('--cor');
        if (customColor) embedColor = customColor.startsWith('#') ? customColor : `#${customColor}`;

        const roleInput = extractOption('--cargo');
        if (roleInput) {
            const roleIdMatch = roleInput.match(/^<@&(\d+)>$/);
            if (roleIdMatch) roleToMention = message.guild.roles.cache.get(roleIdMatch[1]);
            else roleToMention = message.guild.roles.cache.find(r => r.name.toLowerCase() === roleInput.toLowerCase() || r.id === roleInput);
            if (!roleToMention) await message.reply(`⚠️ Cargo "${roleInput}" não encontrado. Menção de cargo ignorada.`);
        }

        imageUrl = extractOption('--imagem');
        thumbnailUrl = extractOption('--thumbnail');

        let embedTitle = null;
        let messageContent;

        if (remainingArgs.length === 0) {
            return message.reply({ content: "❌ Você precisa fornecer a mensagem para o anúncio!" });
        }

        let potentialTitle = "";
        let titleFoundInQuotes = false;

        if (remainingArgs[0].startsWith('"')) {
            let currentPart = "";
            let inQuotes = false;
            let titleEndIndex = -1;
            for (let i = 0; i < remainingArgs.length; i++) {
                const arg = remainingArgs[i];
                if (arg.startsWith('"') && !inQuotes) {
                    inQuotes = true;
                    currentPart = arg.substring(1);
                     if (arg.endsWith('"') && arg.length > 1) {
                        potentialTitle = currentPart.slice(0, -1);
                        titleEndIndex = i;
                        titleFoundInQuotes = true;
                        break;
                    }
                } else if (arg.endsWith('"') && inQuotes) {
                    currentPart += " " + arg.slice(0, -1);
                    potentialTitle = currentPart.trim();
                    titleEndIndex = i;
                    titleFoundInQuotes = true;
                    break;
                } else if (inQuotes) {
                    currentPart += " " + arg;
                } else {
                    break;
                }
            }
            if (titleFoundInQuotes) {
                const nextArgsAfterTitle = remainingArgs.slice(titleEndIndex + 1);
                if (nextArgsAfterTitle.length > 0) {
                    embedTitle = potentialTitle;
                    messageContent = nextArgsAfterTitle.join(' ');
                } else {
                    messageContent = potentialTitle;
                    embedTitle = null;
                }
            } else {
                messageContent = remainingArgs.join(' ');
            }
        } else {
            messageContent = remainingArgs.join(' ');
        }
        
        if (messageContent.startsWith('"') && messageContent.endsWith('"')) {
            messageContent = messageContent.substring(1, messageContent.length - 1);
        }

        if (!messageContent || messageContent.trim() === "") {
            return message.reply({ content: "❌ A mensagem do anúncio não pode estar vazia." });
        }

        try {
            let contentToSend = "";
            if (roleToMention) {
                contentToSend += `${roleToMention.toString()} `;
            }

            const announcementEmbed = new EmbedBuilder().setColor(embedColor);
            if (embedTitle) announcementEmbed.setTitle(embedTitle);
            if (messageContent.trim()) announcementEmbed.setDescription(messageContent.substring(0, 4090));
            if (imageUrl && imageUrl.startsWith('http')) announcementEmbed.setImage(imageUrl);
            if (thumbnailUrl && thumbnailUrl.startsWith('http')) announcementEmbed.setThumbnail(thumbnailUrl);
            announcementEmbed.setTimestamp()
                             .setFooter({ text: `Anunciado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            
            const hasEmbedContent = announcementEmbed.data.title || announcementEmbed.data.description || announcementEmbed.data.image || announcementEmbed.data.thumbnail || (announcementEmbed.data.fields && announcementEmbed.data.fields.length > 0);

            if (hasEmbedContent) {
                 if (contentToSend.trim() === "" && !hasEmbedContent && messageContent.trim()) {
                     await targetChannel.send({ content: messageContent.substring(0, 2000) });
                 } else if (contentToSend.trim() === "" && !hasEmbedContent) {
                     return message.reply({content: "Você precisa fornecer um título ou mensagem para o anúncio."});
                 }
                 else {
                    await targetChannel.send({ content: contentToSend.trim() || null, embeds: [announcementEmbed] });
                 }
            } else if (messageContent.trim()) {
                contentToSend += messageContent;
                if (contentToSend.length > 2000) {
                    return message.reply({ content: "⚠️ Sua mensagem é muito longa para um anúncio sem embed (limite de 2000 caracteres). Tente usar um título ou divida a mensagem."});
                }
                await targetChannel.send({ content: contentToSend.trim() });
            } else {
                return message.reply({content: "Você precisa fornecer um título ou mensagem para o anúncio."});
            }

            await message.reply({ content: `✅ Anúncio enviado para o canal ${targetChannel.toString()}!` });
        } catch (error) {
            console.error("[AnnounceCmd] Erro ao enviar anúncio:", error);
            message.reply({ content: "❌ Ocorreu um erro ao tentar enviar seu anúncio." });
        }
    }
};