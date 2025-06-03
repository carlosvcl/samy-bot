// src/commands/ia/generatetext.js
const { EmbedBuilder } = require('discord.js');
// A importação do GoogleGenerativeAI pode não ser necessária aqui se o client.geminiTextModel já estiver configurado
// const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

module.exports = {
    name: 'generatetext',
    aliases: ['gentext', 'ia-gentext', 'creatext'],
    description: 'Pede à IA Gemini para gerar um texto criativo (história, poema, ideias, etc.).',
    category: 'ia',
    args: true,
    usage: '"<seu prompt criativo aqui>"',
    cooldown: 15, // Cooldown um pouco maior para geração de texto
    async execute({ client, message, args }) {
        if (!client.geminiTextModel) {
            return message.reply("Desculpe, o módulo de Inteligência Artificial não está disponível no momento. Avise um administrador.");
        }

        let userPrompt = args.join(' ');
        // Remover aspas do início e fim, se presentes
        if (userPrompt.startsWith('"') && userPrompt.endsWith('"')) {
            userPrompt = userPrompt.substring(1, userPrompt.length - 1);
        }
        if (userPrompt.startsWith("'") && userPrompt.endsWith("'")) {
            userPrompt = userPrompt.substring(1, userPrompt.length - 1);
        }


        if (!userPrompt || userPrompt.length < 10) { // Exige um prompt com um mínimo de caracteres
            return message.reply(`Por favor, forneça um prompt descritivo para a geração de texto. Uso: \`${process.env.PREFIX || 's!'}generatetext "<seu prompt criativo>"\``);
        }

        try {
            const thinkingMessage = await message.reply("<a:loading:1246072052350124032> Gerando seu texto... Isso pode levar alguns instantes.");

            // Você pode adicionar um prefixo ao prompt do usuário para guiar melhor a IA, se desejar.
            // Ex: const fullPrompt = `Escreva uma pequena história criativa baseada no seguinte tema: ${userPrompt}`;
            // Ou: const fullPrompt = `Crie um poema sobre: ${userPrompt}`;
            // Por enquanto, usaremos o prompt do usuário diretamente.
            const fullPrompt = userPrompt;
            
            const result = await client.geminiTextModel.generateContent(fullPrompt);
            const response = await result.response;
            let text = response.text();

            if (!text || text.trim() === "") {
                let reason = "A IA não conseguiu gerar um texto para este prompt.";
                if (response.promptFeedback && response.promptFeedback.blockReason) {
                    reason = `A geração foi bloqueada devido a: ${response.promptFeedback.blockReason}.`;
                     if (response.promptFeedback.blockReason === 'SAFETY') {
                        reason += " Verifique se seu prompt está de acordo com as políticas de segurança.";
                     }
                } else if (response.candidates && response.candidates[0] && response.candidates[0].finishReason !== 'STOP') {
                    reason = `A geração de conteúdo foi interrompida por: ${response.candidates[0].finishReason}.`;
                     if (response.candidates[0].finishReason === 'SAFETY') {
                         reason += " Verifique as políticas de segurança.";
                     }
                }
                text = `*${reason}*`;
            }
            
            await thinkingMessage.delete().catch(console.error);

            const MAX_LENGTH = 1980;
            if (text.length > MAX_LENGTH) {
                message.channel.send(`**📝 Texto Gerado para seu Prompt:**\n_"${userPrompt.substring(0,100)}${userPrompt.length > 100 ? '...' : ''}"_`);
                const parts = [];
                for (let i = 0; i < text.length; i += MAX_LENGTH) {
                    parts.push(text.substring(i, i + MAX_LENGTH));
                }
                for (const part of parts) {
                    await message.channel.send(part);
                }
            } else {
                const generatedTextEmbed = new EmbedBuilder()
                    .setColor('#FF69B4') // Sua cor padrão
                    .setTitle('🖋️ Texto Gerado por IA')
                    .setAuthor({ name: `Prompt de: ${message.author.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true })})
                    .addFields({ name: "📝 Seu Prompt:", value: userPrompt.substring(0, 1020) })
                    .addFields({ name: "✨ Texto Gerado:", value: text.substring(0,1020) })
                    .setTimestamp()
                    .setFooter({ text: `Powered by Gemini | ${client.user.username}`, iconURL: client.user.displayAvatarURL({ dynamic: true }) });
                await message.channel.send({ embeds: [generatedTextEmbed] });
            }

        } catch (error) {
            console.error("Erro ao gerar texto com Gemini:", error);
            message.channel.messages.fetch({ limit: 10 }).then(messages => {
                const botThinkingMsg = messages.find(msg => msg.author.id === client.user.id && msg.content.includes("Gerando seu texto..."));
                if (botThinkingMsg) botThinkingMsg.delete().catch(console.error);
            }).catch(console.error);

            let errorMessage = "Ocorreu um erro ao tentar gerar o texto com a IA.";
            if (error.message && error.message.includes("DEADLINE_EXCEEDED")) {
                errorMessage = "A IA demorou muito para responder. Tente novamente mais tarde ou com um prompt mais simples.";
            }
            await message.channel.send(errorMessage);
        }
    }
};