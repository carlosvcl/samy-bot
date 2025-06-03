// src/commands/avancados/createembed.js
const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

const PROMPT_TIMEOUT = 60000; // 60 segundos para cada resposta

async function promptUser(message, question, options = { time: PROMPT_TIMEOUT, max: 1 }) {
    await message.channel.send(question);
    try {
        const filter = m => m.author.id === message.author.id;
        const collected = await message.channel.awaitMessages({ filter, ...options });
        const responseContent = collected.first().content.trim(); // .trim() para remover espaços extras
        if (responseContent.toLowerCase() === 'cancelar') {
            throw new Error('cancelled'); // Lança um erro para parar a execução
        }
        if (responseContent.toLowerCase() === 'pular' || responseContent === '') { // Trata string vazia como pular
            return null;
        }
        return responseContent;
    } catch (e) {
        if (e.message === 'cancelled') throw e; // Re-lança para o handler principal saber que foi cancelado
        return null; // Timeout ou outro erro de coleta
    }
}

module.exports = {
    name: 'createembed',
    aliases: ['embedbuilder', 'newembed'],
    description: 'Cria uma mensagem embed customizada de forma interativa.',
    category: 'avançados',
    // filePath: __filename,

    async execute({ client, message, args, prefix }) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            return message.reply({ content: "❌ Você não tem permissão para criar embeds customizados aqui." });
        }

        const embedData = {
            fields: []
        };
        let currentStep = 0;
        const steps = [
            { key: 'title', query: 'Qual será o título do embed? (Digite "pular" para não ter título, ou "cancelar" para parar)' },
            { key: 'description', query: 'Qual será a descrição principal? (Digite "pular" ou "cancelar")' },
            { key: 'color', query: 'Qual a cor do embed? (Ex: #FF0000, Red, Blue, ou "pular" para padrão, ou "cancelar")' },
            { key: 'authorName', query: 'Nome do autor do embed? (Opcional, digite "pular" ou "cancelar")' },
            // Removido authorIconURL daqui, será perguntado condicionalmente
            { key: 'footerText', query: 'Texto do rodapé? (Opcional, digite "pular" ou "cancelar")' },
            // Removido footerIconURL daqui, será perguntado condicionalmente
            { key: 'imageURL', query: 'URL da imagem principal do embed? (Opcional, digite "pular" ou "cancelar")' },
            { key: 'thumbnailURL', query: 'URL da miniatura (thumbnail)? (Opcional, digite "pular" ou "cancelar")' },
        ];

        let interactiveMessage = await message.reply({ content: "Iniciando o criador de embeds! Responda às perguntas a seguir. Digite `cancelar` a qualquer momento para parar, ou `pular` para omitir um campo opcional." });

        try {
            for (const step of steps) {
                const response = await promptUser(message, `📝 **Passo ${currentStep + 1}**: ${step.query}`);
                if (response === null) {
                    embedData[step.key] = null;
                    await message.channel.send(`➡️ Passo "${step.key}" pulado.`).catch(console.error);
                } else {
                    embedData[step.key] = response;
                    await message.channel.send(`✅ "${step.key}" definido para: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`).catch(console.error);
                }

                // Perguntar por URLs de ícone condicionalmente
                if (step.key === 'authorName' && embedData.authorName) {
                    const iconResponse = await promptUser(message, `🖼️ URL do ícone para o autor "${embedData.authorName}"? (Opcional, digite "pular" ou "cancelar")`);
                    if (iconResponse) embedData.authorIconURL = iconResponse;
                    else embedData.authorIconURL = null;
                     if (iconResponse) await message.channel.send(`✅ Ícone do autor definido.`).catch(console.error);

                } else if (step.key === 'footerText' && embedData.footerText) {
                    const iconResponse = await promptUser(message, `🖼️ URL do ícone para o rodapé "${embedData.footerText.substring(0,30)}..."? (Opcional, digite "pular" ou "cancelar")`);
                    if (iconResponse) embedData.footerIconURL = iconResponse;
                    else embedData.footerIconURL = null;
                    if (iconResponse) await message.channel.send(`✅ Ícone do rodapé definido.`).catch(console.error);
                }
                currentStep++;
            }

            // Adicionar Campos (Fields)
            let addMoreFields = true;
            let fieldCount = 0;
            while (addMoreFields && fieldCount < 5) { // Limite de 5 campos
                const addFieldResponse = await promptUser(message, `➕ **Adicionar Campo ${fieldCount + 1}**: Você quer adicionar um campo (título/valor) ao embed? (sim/não, ou "cancelar")`);
                if (addFieldResponse && addFieldResponse.toLowerCase() === 'sim') {
                    const fieldName = await promptUser(message, `Qual o **nome (título)** do Campo ${fieldCount + 1}? (Ou "cancelar")`);
                    if (!fieldName) { addMoreFields = false; break; }
                    const fieldValue = await promptUser(message, `Qual o **valor (conteúdo)** do Campo ${fieldCount + 1}? (Ou "cancelar")`);
                    if (!fieldValue) { addMoreFields = false; break; }
                    const inlineResponse = await promptUser(message, `Este campo deve ser "inline" (lado a lado com outros, se possível)? (sim/não, ou "cancelar")`);
                    embedData.fields.push({ name: fieldName, value: fieldValue, inline: (inlineResponse && inlineResponse.toLowerCase() === 'sim') });
                    fieldCount++;
                    await message.channel.send(`✅ Campo ${fieldCount} adicionado!`).catch(console.error);
                } else {
                    addMoreFields = false;
                }
            }

            const channelResponse = await promptUser(message, `➡️ **Passo Final**: Em qual canal você gostaria de enviar este embed? (Mencione o canal, ex: <#${message.channel.id}>, ou digite "aqui" para este canal, ou "cancelar")`);
            if (!channelResponse) throw new Error('cancelled'); // Se pulou ou timeout no passo final, considera cancelado

            let targetChannel = message.channel;
            if (channelResponse.toLowerCase() !== 'aqui') {
                const channelIdMatch = channelResponse.match(/^<#(\d+)>$/);
                if (channelIdMatch) {
                    const foundChannel = message.guild.channels.cache.get(channelIdMatch[1]);
                    if (foundChannel && foundChannel.type === ChannelType.GuildText && foundChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages)) {
                        targetChannel = foundChannel;
                    } else {
                        await message.channel.send("Canal inválido ou não tenho permissão para enviar lá. Enviando aqui mesmo.").catch(console.error);
                    }
                } else {
                     await message.channel.send("Menção de canal inválida. Enviando aqui mesmo.").catch(console.error);
                }
            }

            const finalEmbed = new EmbedBuilder();
            if (embedData.title) finalEmbed.setTitle(embedData.title);
            if (embedData.description) finalEmbed.setDescription(embedData.description);

            if (embedData.color) {
                try { finalEmbed.setColor(embedData.color.toUpperCase()); }
                catch (e) { finalEmbed.setColor("Random"); } // Cor padrão se inválida
            } else {
                finalEmbed.setColor("Random");
            }

            // CORREÇÃO AQUI:
            if (embedData.authorName) {
                finalEmbed.setAuthor({
                    name: embedData.authorName,
                    iconURL: embedData.authorIconURL && embedData.authorIconURL.startsWith('http') ? embedData.authorIconURL : undefined
                    // Só define iconURL se for uma URL válida, caso contrário, deixa undefined (o EmbedBuilder ignora)
                });
            }
            if (embedData.footerText) {
                finalEmbed.setFooter({
                    text: embedData.footerText,
                    iconURL: embedData.footerIconURL && embedData.footerIconURL.startsWith('http') ? embedData.footerIconURL : undefined
                });
            }
            // FIM DA CORREÇÃO

            if (embedData.imageURL && embedData.imageURL.startsWith('http')) finalEmbed.setImage(embedData.imageURL);
            if (embedData.thumbnailURL && embedData.thumbnailURL.startsWith('http')) finalEmbed.setThumbnail(embedData.thumbnailURL);

            if (embedData.fields.length > 0) {
                finalEmbed.addFields(embedData.fields.map(f => ({ name: f.name, value: f.value, inline: f.inline })));
            }
            
            // Verifica se o embed tem algum conteúdo visual para enviar
            const hasContent = finalEmbed.data.title || finalEmbed.data.description || (finalEmbed.data.fields && finalEmbed.data.fields.length > 0) || finalEmbed.data.image || finalEmbed.data.thumbnail;
            if (!hasContent) {
                 return interactiveMessage.edit({ content: "❌ Criação de embed cancelada ou nenhum conteúdo visual fornecido para o embed."}).catch(console.error);
            }

            await targetChannel.send({ embeds: [finalEmbed] });
            await interactiveMessage.edit({ content: `✅ Embed enviado com sucesso para ${targetChannel}!`}).catch(console.error);

        } catch (error) {
            if (error.message === 'cancelled') {
                await interactiveMessage.edit({ content: "Criação de embed cancelada pelo usuário." }).catch(console.error);
            } else {
                console.error("[CreateEmbed] Erro durante o processo interativo:", error);
                await interactiveMessage.edit({ content: "❌ Ocorreu um erro durante a criação do embed ou o tempo para resposta esgotou." }).catch(console.error);
            }
        }
    }
};