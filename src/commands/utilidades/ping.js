// src/commands/utilidades/ping.js
const { EmbedBuilder } = require('discord.js'); // Adicionada a importação do EmbedBuilder

module.exports = {
    name: 'ping',
    description: 'Verifica a latência do bot.',
    aliases: ['latencia'],
    category: 'utilidades',
    async execute({ client, message, args }) {
        // Envia uma mensagem inicial para poder calcular o roundtrip e depois editá-la
        const sentMessage = await message.channel.send({ content: 'Calculando ping...' });

        // Calcula as latências
        // Latência da mensagem (Roundtrip): Tempo entre o envio da sua mensagem e a resposta do bot.
        const roundtripLatency = sentMessage.createdTimestamp - message.createdTimestamp;
        // Latência da API (WebSocket): Ping do bot com os servidores do Discord.
        const apiLatency = Math.round(client.ws.ping);

        const embed = new EmbedBuilder()
            .setColor('#FF69B4') // Sua cor rosa
            .setTitle('🏓 Pong!')
            .setDescription('Aqui estão as minhas latências atuais:')
            .addFields(
                { name: '📡 Latência da Mensagem (Roundtrip)', value: `**${roundtripLatency}ms**` },
                { name: '🌐 Latência da API (WebSocket)', value: `**${apiLatency}ms**` }
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        // Edita a mensagem inicial ("Calculando ping...") com o embed final
        try {
            await sentMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            console.error("Erro ao editar a mensagem de ping:", error);
            // Se a edição falhar (ex: mensagem deletada rapidamente), envia uma nova mensagem.
            // Isso é opcional, mas bom para robustez.
            try {
                await message.channel.send({ embeds: [embed] });
            } catch (sendError) {
                console.error("Erro ao enviar nova mensagem de ping após falha na edição:", sendError);
            }
        }
    }
};