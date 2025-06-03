// src/commands/economia/balance.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'balance',
    aliases: ['bal', 'saldo', 'dinheiro'],
    description: 'Mostra seu saldo ou o saldo de outro usuário.',
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const targetMember = message.mentions.members.first() || message.guild.members.cache.get(args[0]) || message.member;
        const targetUser = targetMember.user;

        const userProfile = await User.findOrCreate(targetUser.id, targetUser.tag);
        const totalBalance = userProfile.balance + userProfile.bank;

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`💰 Saldo de ${targetUser.username}`)
            .setDescription(`Aqui estão os detalhes financeiros de ${targetUser.toString()} (ID: \`${targetUser.id}\`):`)
            .addFields(
                { name: '💳 Carteira', value: `🪙 ${userProfile.balance.toLocaleString()}`, inline: true },
                { name: '🏦 Banco', value: `🪙 ${userProfile.bank.toLocaleString()}`, inline: true },
                { name: 'Total', value: `🪙 **${totalBalance.toLocaleString()}**`, inline: true },
                { name: '✨ Nível Atual', value: `🏆 ${userProfile.level}`, inline: true },
                { name: '⚡ Energia', value: `${userProfile.energy.current}/${userProfile.energy.max}`, inline: true },
                { name: '🗓️ Perfil Criado em', value: `<t:${Math.floor(userProfile.createdAt.getTime() / 1000)}:R>`, inline: true }
            )
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        message.channel.send({ embeds: [embed] });
    }
};