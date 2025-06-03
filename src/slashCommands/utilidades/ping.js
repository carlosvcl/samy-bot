const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Definição do comando
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Verifica a latência do bot e responde com Pong!'),

    // Função que será executada quando o comando for usado
    async execute(interaction, client) { // Adicionamos 'client' caso você precise dele
        const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        await interaction.editReply(`Pong! 🏓 Latência da API: ${latency}ms. Latência do WebSocket: ${client.ws.ping}ms.`);
    },
    // cooldown: 5, // Exemplo de cooldown em segundos (opcional)
};