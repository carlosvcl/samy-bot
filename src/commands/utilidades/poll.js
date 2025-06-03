// src/commands/utilidades/poll.js
const { EmbedBuilder } = require('discord.js');
const EMOJI_OPTIONS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟']; // Limite de 10 opções

module.exports = {
    name: 'poll',
    aliases: ['enquete'],
    category: 'utilidades',
    description: 'Cria uma enquete simples com reações. Separe pergunta e opções com "|".',
    args: true,
    usage: '<pergunta> | <opção1> | <opção2> ... [máx 10 opções]',
   async execute({ client, message, args }) {
        const pollArgs = args.join(' ').split('|').map(s => s.trim());
        if (pollArgs.length < 2) { // Precisa de pergunta + pelo menos 1 opção
            return message.reply('Formato inválido. Use: `s!poll Pergunta? | Opção A | Opção B`');
        }

        const question = pollArgs.shift();
        const options = pollArgs;

        if (options.length > EMOJI_OPTIONS.length) {
            return message.reply(`Muitas opções! O máximo é ${EMOJI_OPTIONS.length}.`);
        }
        if (options.length === 0) {
            return message.reply('Você precisa fornecer pelo menos uma opção para a enquete.');
        }


        let description = '';
        for (let i = 0; i < options.length; i++) {
            description += `${EMOJI_OPTIONS[i]} ${options[i]}\n\n`;
        }

        const pollEmbed = new EmbedBuilder()
            .setColor('#FF69B4') // Rosa
            .setTitle(`📊 Enquete de ${message.author.username}`)
            .setDescription(`**${question}**\n\n${description}`) // description é gerada com emojis e opções
            .setTimestamp()
            .setFooter({ text: `Vote reagindo abaixo! | Criada por: ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        try {
            const pollMessage = await message.channel.send({ embeds: [pollEmbed] });
            for (let i = 0; i < options.length; i++) {
                await pollMessage.react(EMOJI_OPTIONS[i]);
            }
        } catch (error) {
            console.error('Erro ao criar enquete:', error);
            message.reply('Não consegui criar a enquete. Verifique minhas permissões de adicionar reações.');
        }
    }
};