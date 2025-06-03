// src/commands/economia/daily.js
const { EmbedBuilder } = require('discord.js');
const ms = require('ms');

module.exports = {
    name: 'daily',
    description: 'Coleta sua recompensa diária.',
    aliases: ['diario'],
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        const userProfile = await User.findOrCreate(message.author.id, message.author.tag);
        const dailyCooldownMs = 24 * 60 * 60 * 1000;
        const lastDailyMs = userProfile.dailyLastClaimed ? userProfile.dailyLastClaimed.getTime() : 0;
        const nextDailyAvailableMs = lastDailyMs + dailyCooldownMs;

        if (Date.now() > nextDailyAvailableMs) {
            const dailyAmount = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
            const oldBalance = userProfile.balance;
            userProfile.balance += dailyAmount;
            userProfile.dailyLastClaimed = new Date();
            await userProfile.save();

            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('💸 Recompensa Diária Coletada!')
                .setDescription(`${message.author.toString()}, você coletou sua recompensa diária com sucesso!`)
                .addFields(
                    { name: 'Valor Coletado', value: `🪙 **${dailyAmount.toLocaleString()}** moedas` },
                    { name: 'Saldo Anterior', value: `🪙 ${oldBalance.toLocaleString()}` },
                    { name: 'Novo Saldo', value: `🪙 **${userProfile.balance.toLocaleString()}** moedas` },
                    { name: 'Próxima Coleta', value: `<t:${Math.floor((Date.now() + dailyCooldownMs) / 1000)}:R>` }
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });
        } else {
            const timeLeft = nextDailyAvailableMs - Date.now();
            const embed = new EmbedBuilder()
                .setColor('#FF69B4')
                .setTitle('⏳ Cooldown Diário Ativo')
                .setDescription(`${message.author.toString()}, você já coletou sua recompensa diária hoje.`)
                .addFields(
                    { name: 'Próxima Coleta em', value: `**${ms(timeLeft, { long: true })}**` },
                    { name: 'Horário Exato', value: `<t:${Math.floor(nextDailyAvailableMs / 1000)}:F>` }
                )
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [embed] });
        }
    }
};