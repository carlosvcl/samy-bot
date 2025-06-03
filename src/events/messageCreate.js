// src/events/messageCreate.js
const { Events, EmbedBuilder, Collection } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot) return;

        // --- INÍCIO DA LÓGICA PARA CHAT CONTÍNUO ---
        const sessionKey = `${message.guild.id}-${message.channel.id}-${message.author.id}`;
        if (client.chatSessions && client.chatSessions.has(sessionKey)) {
            if (!message.content.startsWith(process.env.PREFIX)) {
                const session = client.chatSessions.get(sessionKey);
                if (!session || !session.modelChatSession) {
                    console.warn(`[Chat] Sessão inválida encontrada e removida para: ${sessionKey}`);
                    client.chatSessions.delete(sessionKey);
                    return;
                }

                try {
                    await message.channel.sendTyping();
                    const userMessageContent = message.content;
                    
                    session.history.push({ role: "user", parts: [{text: userMessageContent}] });

                    const result = await session.modelChatSession.sendMessage(userMessageContent);
                    const response = await result.response;
                    let text = response.text();

                    if (!text || text.trim() === "") {
                        let reason = "A IA não forneceu uma resposta.";
                        if (response.promptFeedback && response.promptFeedback.blockReason) {
                            reason = `A resposta foi bloqueada devido a: ${response.promptFeedback.blockReason}.`;
                            if (response.promptFeedback.blockReason === 'SAFETY') {
                                reason += " Isso geralmente acontece por causa das configurações de segurança.";
                            }
                        } else if (response.candidates && response.candidates[0] && response.candidates[0].finishReason !== 'STOP') {
                            reason = `A geração de conteúdo foi interrompida por: ${response.candidates[0].finishReason}.`;
                             if (response.candidates[0].finishReason === 'SAFETY') {
                                 reason += " Isso geralmente acontece por causa das configurações de segurança.";
                             }
                        }
                        text = `*${reason} Tente reformular sua pergunta ou verifique as diretrizes de conteúdo.*`;
                    }
                    
                    session.history.push({ role: "model", parts: [{text: text}] });

                    const MAX_HISTORY_TURNS = 10; 
                    if (session.history.length > MAX_HISTORY_TURNS * 2) {
                        const personalityPrompt = session.history.length > 2 && session.history[0].role === "user" && session.history[1].role === "model" ? session.history.slice(0,2) : [];
                        const recentHistory = session.history.slice(session.history.length - (MAX_HISTORY_TURNS * 2));
                        session.history = [...personalityPrompt, ...recentHistory];
                        console.log(`[Chat] Histórico truncado para a sessão: ${sessionKey}`);
                    }
                    client.chatSessions.set(sessionKey, session); 

                    const MAX_LENGTH = 1980;
                    if (text.length > MAX_LENGTH) {
                        for (let i = 0; i < text.length; i += MAX_LENGTH) {
                            await message.reply({ content: text.substring(i, i + MAX_LENGTH), allowedMentions: { repliedUser: false } }).catch(console.error);
                        }
                    } else {
                        await message.reply({ content: text, allowedMentions: { repliedUser: false } }).catch(console.error);
                    }
                } catch (error) {
                    console.error(`[Chat] Erro durante sessão com Gemini (${sessionKey}):`, error);
                    const chatErrorEmbed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle("⚠️ Erro na Sessão de Chat com IA")
                        .setDescription("Ocorreu um problema ao processar sua mensagem na conversa com a IA. Por favor, tente novamente ou use `s!chat end` e `s!chat start` para reiniciar a sessão se o problema persistir.")
                        .setTimestamp();
                    message.reply({ embeds: [chatErrorEmbed], allowedMentions: { repliedUser: false } }).catch(console.error);
                }
                return; 
            }
        }
        // --- FIM DA LÓGICA PARA CHAT CONTÍNUO ---

        const prefix = process.env.PREFIX;
        if (!prefix || !message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // <<< MUDANÇA PRINCIPAL AQUI >>>
        // Busca o comando na coleção de comandos de prefixo
        const command = client.prefixCommands.get(commandName) ||
                        client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

        if (!command) {
            // Opcional: Adicionar uma mensagem se o comando de prefixo não for encontrado
            // console.log(`Comando de prefixo não encontrado: ${commandName}`);
            return;
        }
        
        // Esta verificação abaixo para ignorar slash commands não é mais estritamente necessária aqui,
        // pois o commandHandler de prefixo já deve filtrar para não carregar arquivos de slash command.
        // Mas, por segurança extra, pode ficar.
        if (command.data && typeof command.data.toJSON === 'function') {
            // Este caso não deveria acontecer se o commandHandler de prefixo estiver correto
            console.log(`[MessageCreate] Tentativa de executar o slash command '${command.data.name}' com prefixo (deveria ter sido pego pelo prefixCommands). Ignorando.`);
            return; 
        }

        // Cooldown para comandos de prefixo
        if (command.cooldown) {
            // client.commandCooldowns já é inicializado no index.js
            if (!client.commandCooldowns.has(command.name)) {
                client.commandCooldowns.set(command.name, new Collection()); // Usando Collection do discord.js
            }
            const now = Date.now();
            const timestamps = client.commandCooldowns.get(command.name);
            const cooldownAmount = (command.cooldown || 3) * 1000;

            if (timestamps.has(message.author.id)) {
                const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    message.reply(`Por favor, espere ${timeLeft.toFixed(1)} segundo(s) antes de usar o comando \`${command.name}\` novamente.`).catch(console.error);
                    return;
                }
            }
            timestamps.set(message.author.id, now);
            setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);
        }

        try {
            await command.execute({ client, message, args });
        } catch (error) {
            console.error(`Erro executando o comando de prefixo ${commandName}:`, error);
            message.reply('Houve um erro ao tentar executar esse comando de prefixo!').catch(console.error);
        }
    },
};