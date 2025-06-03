// src/commands/ia/ask.js
const { EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai"); // Pode ser necessário para tipos de erro

module.exports = {
    name: 'ask',
    aliases: ['perguntar', 'gemini', 'ia'],
    description: 'Faça uma pergunta para a Inteligência Artificial Gemini!',
    category: 'ia',
    args: true,
    usage: '<sua pergunta aqui>',
    cooldown: 10, // Cooldown de 10 segundos por usuário para este comando
    async execute({ client, message, args }) {
        if (!client.geminiTextModel) {
            return message.reply("Desculpe, o módulo de Inteligência Artificial não está disponível no momento. Avise um administrador.");
        }

        const question = args.join(' ');
        if (!question) {
            return message.reply(`Por favor, forneça uma pergunta após o comando. Uso: \`${process.env.PREFIX}ask <sua pergunta>\``);
        }

        try {
            const thinkingMessage = await message.reply("🧠 Pensando... Por favor, aguarde um momento.");

            const prompt = question; // Você pode adicionar um pre-prompt aqui se quiser, ex: "Responda como um assistente prestativo: " + question
            
            const result = await client.geminiTextModel.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            // Tratamento de resposta vazia ou bloqueada por segurança
            if (!text || text.trim() === "") {
                let reason = "A IA não forneceu uma resposta.";
                if (response.promptFeedback && response.promptFeedback.blockReason) {
                    reason = `A resposta foi bloqueada devido a: ${response.promptFeedback.blockReason}.`;
                    if (response.promptFeedback.blockReason === 'SAFETY') {
                        reason += " Isso geralmente acontece por causa das configurações de segurança (conteúdo potencialmente prejudicial, discurso de ódio, etc.).";
                    }
                } else if (response.candidates && response.candidates[0] && response.candidates[0].finishReason !== 'STOP') {
                    reason = `A geração de conteúdo foi interrompida por: ${response.candidates[0].finishReason}.`;
                     if (response.candidates[0].finishReason === 'SAFETY') {
                         reason += " Isso geralmente acontece por causa das configurações de segurança.";
                     }
                }
                text = `*${reason}*`;
            }
            
            await thinkingMessage.delete().catch(console.error); // Deleta a mensagem "Pensando..."

            // Lidar com respostas longas (Discord tem limite de 2000 caracteres por mensagem e 4096 para descrição de embed)
            const MAX_LENGTH = 1980; // Um pouco menos para dar margem
            if (text.length > MAX_LENGTH) {
                // Opção 1: Enviar em partes
                message.channel.send(`**🤖 Resposta da IA para "${question.substring(0,100)}${question.length > 100 ? '...' : ''}":**`);
                const parts = [];
                for (let i = 0; i < text.length; i += MAX_LENGTH) {
                    parts.push(text.substring(i, i + MAX_LENGTH));
                }
                for (const part of parts) {
                    await message.channel.send(part);
                }
            } else {
                // Opção 2: Enviar em um embed
                const answerEmbed = new EmbedBuilder()
                    .setColor('#FF69B4') // Rosa
                    .setTitle(`💬 Pergunta para ${client.user.username}`)
                    .setAuthor({ name: message.author.username, iconURL: message.author.displayAvatarURL({ dynamic: true })})
                    .addFields({ name: "❓ Sua Pergunta:", value: question.substring(0, 1020) })
                    .addFields({ name: "🤖 Resposta da IA:", value: text.substring(0,1020) }) // Limita o campo do embed
                    .setTimestamp()
                    .setFooter({ text: `Powered by Gemini | ${client.user.username}`, iconURL: client.user.displayAvatarURL({ dynamic: true }) });
                await message.channel.send({ embeds: [answerEmbed] });
            }

        } catch (error) {
            console.error("Erro ao gerar conteúdo com Gemini:", error);
            // Tentar deletar a mensagem "Pensando..." mesmo em caso de erro
            message.channel.messages.fetch({ limit: 10 }).then(messages => {
                const botThinkingMsg = messages.find(msg => msg.author.id === client.user.id && msg.content.includes("🧠 Pensando..."));
                if (botThinkingMsg) botThinkingMsg.delete().catch(console.error);
            }).catch(console.error);

            let errorMessage = "Ocorreu um erro ao tentar processar sua pergunta com a IA.";
            if (error.message && error.message.includes("DEADLINE_EXCEEDED")) {
                errorMessage = "A IA demorou muito para responder. Tente novamente mais tarde ou com uma pergunta mais simples.";
            } else if (error.message && error.message.toLowerCase().includes("api key not valid")) {
                errorMessage = "A configuração da chave da API de Inteligência Artificial parece estar inválida. Avise um administrador.";
            }
            // Adicionar mais tratamentos de erro específicos da API Gemini conforme necessário

            const errorEmbed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle("❌ Erro na IA")
                .setDescription(errorMessage)
                .addFields({name: "Pergunta Original:", value: question.substring(0,1000)})
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            await message.channel.send({ embeds: [errorEmbed] });
        }
    }
};