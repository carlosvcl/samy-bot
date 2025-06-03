// src/commands/utilidades/avatar.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'avatar',
    description: 'Mostra o avatar de um usuário.',
    aliases: ['pfp', 'icon'],
    category: 'utilidades',
    async execute({ client, message, args }) {
        const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
        const avatarURL = user.displayAvatarURL({ dynamic: true, size: 4096 });

        const embed = new EmbedBuilder()
            .setColor('#FF69B4') // Rosa
            .setTitle(`🖼️ Avatar de ${user.username}`)
            .setDescription(`[Link Direto do Avatar](${avatarURL})`)
            .setImage(avatarURL)
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        message.channel.send({ embeds: [embed] });
    }
};