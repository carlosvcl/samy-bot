// src/commands/ia/chat.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'chat',
    aliases: ['converse', 'ia-chat'],
    description: 'Inicia ou termina uma sessão de chat contínuo com a IA Gemini.',
    category: 'ia',
    usage: '<start [personalidade opcional] | end>',
    cooldown: 5,
    async execute({ client, message, args }) {
        if (!client.geminiTextModel) {
            return message.reply("Desculpe, o módulo de Inteligência Artificial não está disponível no momento.");
        }

        const subCommand = args[0] ? args[0].toLowerCase() : null;
        const sessionKey = `${message.guild.id}-${message.channel.id}-${message.author.id}`;

        if (subCommand === 'start') {
            if (client.chatSessions.has(sessionKey)) {
                return message.reply("Você já tem uma sessão de chat ativa neste canal! Use `s!chat end` para terminar a atual primeiro.");
            }

            let personality = args.slice(1).join(' ');
            let initialHistory = [];
            if (personality) {
                initialHistory.push(
                    { role: "user", parts: [{ text: `Vamos ter uma conversa. Quero que você aja como: ${personality}` }] },
                    { role: "model", parts: [{ text: `Entendido! A partir de agora, atuarei como ${personality}. O que você gostaria de dizer ou perguntar?` }] }
                );
            } else {
                 initialHistory.push(
                    { role: "user", parts: [{ text: "Olá!" }]}, // Mensagem inicial para o modelo responder
                    { role: "model", parts: [{ text: "Olá! Como posso ajudar você hoje?" }] }
                 );
            }
            
            const modelChatSession = client.geminiTextModel.startChat({
                history: initialHistory,
                // generationConfig: { maxOutputTokens: 200 }, // Opcional
            });

            client.chatSessions.set(sessionKey, { 
                history: initialHistory, 
                modelChatSession: modelChatSession,
                personality: personality || "assistente padrão"
            });

            const startEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('💬 Sessão de Chat Iniciada!')
                .setDescription(`Conectado com Gemini (personalidade: ${personality || 'padrão'}).\nAgora você pode conversar comigo diretamente neste canal (sem prefixo).\nUse \`${process.env.PREFIX}chat end\` para terminar a sessão.`)
                .setTimestamp()
                .setFooter({ text: `Sessão de ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [startEmbed] });

        } else if (subCommand === 'end') {
            if (!client.chatSessions.has(sessionKey)) {
                return message.reply("Você não tem uma sessão de chat ativa para terminar.");
            }
            client.chatSessions.delete(sessionKey);
            const endEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('💬 Sessão de Chat Encerrada')
                .setDescription('Sua conversa com Gemini foi finalizada.')
                .setTimestamp()
                .setFooter({ text: `Sessão de ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [endEmbed] });
        } else {
            const usageEmbed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('Uso Incorreto do Comando Chat')
                .setDescription(`Use \`${process.env.PREFIX}chat start [personalidade]\` para iniciar ou \`${process.env.PREFIX}chat end\` para terminar.`)
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            return message.channel.send({ embeds: [usageEmbed] });
        }
    }
};