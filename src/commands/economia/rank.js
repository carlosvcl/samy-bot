// src/commands/economia/rank.js
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'nivel', 'progresso'],
    description: 'Mostra seu nível, XP e progresso ou de outro usuário.',
    category: 'economia',
    usage: '[@usuário ou ID]',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const targetMember = message.mentions.members.first() || 
                             (args.length > 0 ? await message.guild.members.fetch(args[0]).catch(() => null) : null) || 
                             message.member;

        if(!targetMember) return message.reply("Usuário não encontrado neste servidor.");
        const targetUser = targetMember.user;

        const userProfile = await User.findOrCreate(targetUser.id, targetUser.tag);
        const xpToNextLevelFormula = (level) => 5 * (level ** 2) + 50 * level + 100;
        const xpRequiredForNextLevel = xpToNextLevelFormula(userProfile.level);
        const xpRemainingForNextLevel = Math.max(0, xpRequiredForNextLevel - userProfile.xp);
        
        const progressPercent = xpRequiredForNextLevel > 0 ? Math.max(0, Math.min(100, Math.floor((userProfile.xp / xpRequiredForNextLevel) * 100))) : (userProfile.level > 0 ? 100 : 0) ;
        
        const progressBarLength = 10;
        const filledLength = Math.round(progressBarLength * (progressPercent / 100));
        const emptyLength = progressBarLength - filledLength;
        const progressBar = '🩷'.repeat(filledLength) + '🖤'.repeat(emptyLength);

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`🏆 Rank de ${targetUser.username}`)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🌟 Nível Atual', value: `**${userProfile.level}**`, inline: true },
                { name: '✨ XP Total Acumulado', value: `${userProfile.xp.toLocaleString()}`, inline: true }, // XP atual no nível
                { name: '🎯 Próximo Nível', value: `${xpRequiredForNextLevel.toLocaleString()} XP (Faltam ${xpRemainingForNextLevel.toLocaleString()} XP)`, inline: false },
                { name: '📊 Progresso para Nível Seguinte', value: `${progressBar} (${progressPercent}%)`, inline: false },
                { name: '💰 Saldo em Carteira', value: `🪙 ${userProfile.balance.toLocaleString()}`, inline: true},
                { name: '🏦 Saldo no Banco', value: `🪙 ${userProfile.bank.toLocaleString()}`, inline: true}
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        message.channel.send({ embeds: [embed] });
    }
};