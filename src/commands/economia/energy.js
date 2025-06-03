// src/commands/economia/energy.js
const { EmbedBuilder } = require('discord.js');
const { updateUserEnergy, ENERGY_REGEN_RATE_PER_MINUTE } = require('../../utils/energyHelper');
const ms = require('ms');

module.exports = {
    name: 'energy',
    aliases: ['energia', 'stamina'],
    description: 'Mostra sua energia atual e tempo para regeneração total.',
    category: 'economia',
    async execute({ client, message, args }) {
        const User = client.models.User;
        let userProfile = await User.findOrCreate(message.author.id, message.author.tag);

        if (typeof updateUserEnergy !== 'function') { /* ... (erro) ... */ }
        userProfile = await updateUserEnergy(userProfile);
        await userProfile.save(); 

        const energyPercentage = Math.floor((userProfile.energy.current / userProfile.energy.max) * 100);
        const progressBarLength = 10;
        const filledLength = Math.round(progressBarLength * (energyPercentage / 100));
        const emptyLength = progressBarLength - filledLength;
        const progressBar = '⚡'.repeat(filledLength) + '🖤'.repeat(emptyLength);

        let timeToFull = 'Energia Cheia!';
        if (userProfile.energy.current < userProfile.energy.max) {
            const energyNeeded = userProfile.energy.max - userProfile.energy.current;
            const minutesToFull = Math.ceil(energyNeeded / ENERGY_REGEN_RATE_PER_MINUTE);
            timeToFull = ms(minutesToFull * 60 * 1000, { long: true });
        }

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`⚡ Energia de ${message.author.username}`)
            .setThumbnail(message.author.displayAvatarURL({dynamic: true}))
            .setDescription(`Sua energia atual é: **${userProfile.energy.current} / ${userProfile.energy.max}** (${energyPercentage}%)`)
            .addFields(
                { name: "🔋 Barra de Energia", value: progressBar },
                { name: "🔄 Regeneração", value: `Ganha **${ENERGY_REGEN_RATE_PER_MINUTE}** de energia por minuto.`},
                { name: "🕒 Tempo para Cheia", value: timeToFull }
            )
            .setTimestamp()
            .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        message.channel.send({ embeds: [embed] });
    }
};