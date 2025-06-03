// src/commands/moderacao/kick.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const { logModerationAction } = require('../../utils/modLogHelper'); // Ajuste o caminho se necessário

module.exports = {
    name: 'kick',
    description: 'Expulsa um usuário do servidor.',
    aliases: ['expulsar'],
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> [razão]',
    permissionsUser: [PermissionsBitField.Flags.KickMembers],
    permissionsBot: [PermissionsBitField.Flags.KickMembers],
    async execute({ client, message, args }) {
        const targetMember = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);

        if (!targetMember) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }
        if (targetMember.id === message.author.id) {
            return message.reply('Você não pode se expulsar.');
        }
        if (targetMember.id === client.user.id) {
            return message.reply('Eu não posso me expulsar.');
        }
        if (!targetMember.kickable) { 
            return message.reply(`Não posso expulsar ${targetMember.user.tag}. Eles podem ter um cargo superior ao meu, ser o dono do servidor, ou eu não tenho permissões suficientes.`);
        }
        if (message.member.roles.highest.position <= targetMember.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply('Você não pode expulsar um membro com cargo igual ou superior ao seu, a menos que você seja o dono do servidor.');
        }

        const reason = args.slice(1).join(' ') || 'Nenhuma razão fornecida.';

        try {
            // DM antes de kickar, pois após o kick o bot pode não conseguir mais enviar DM se não compartilhar outros servidores.
            let dmSent = false;
            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#FF69B4') // Rosa
                    .setTitle('👢 Você foi expulso!')
                    .setDescription(`Você foi expulso do servidor **${message.guild.name}**. Esta é uma ação administrativa.`)
                    .addFields(
                        { name: '🛡️ Moderador', value: message.author.tag },
                        { name: '📖 Razão', value: reason.substring(0, 1000) }
                    )
                    .setTimestamp()
                    .setFooter({text: `Servidor: ${message.guild.name} | ${client.user.username}`});
                await targetMember.send({ embeds: [dmEmbed] });
                dmSent = true;
            } catch (dmError) {
                console.log(`Não foi possível enviar DM para ${targetMember.user.tag} antes da expulsão.`);
            }

            await targetMember.kick(`Expulso por ${message.author.tag}: ${reason}`);
            
            const caseId = await logModerationAction(client, message.guild, 'kick', message.author, targetMember.user, reason).catch(err => {
                console.error("Erro ao logar ação de kick:", err);
                return "ERRO_LOG";
            });

            const kickEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('👢 Usuário Expulso do Servidor')
                .setDescription(`O usuário **${targetMember.user.tag}** foi expulso com sucesso.`)
                .addFields(
                    { name: '🎯 Usuário Alvo', value: `${targetMember.user.tag} (\`${targetMember.id}\`)` },
                    { name: '🛡️ Moderador Responsável', value: `${message.author.tag} (\`${message.author.id}\`)` },
                    { name: '📖 Razão Fornecida', value: reason.substring(0, 1000) },
                    { name: '📄 ID do Caso de Moderação', value: `\`${caseId}\`` },
                    { name: '📨 Notificação DM', value: dmSent ? 'Enviada com sucesso ✅' : 'Falha ao enviar ❌'}
                )
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Ação de moderação por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            message.channel.send({ embeds: [kickEmbed] });

        } catch (error) {
            console.error('Erro ao expulsar membro:', error);
            message.reply('Ocorreu um erro ao tentar expulsar o membro. Verifique minhas permissões e a hierarquia de cargos.');
        }
    }
};