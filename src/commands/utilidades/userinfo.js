// src/commands/utilidades/userinfo.js
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    name: 'userinfo',
    aliases: ['ui', 'whois', 'perfil', 'memberinfo'],
    description: 'Mostra informações detalhadas sobre um usuário ou você mesmo.',
    category: 'utilidades',
    usage: '[@usuário ou ID]',
    async execute({ client, message, args }) {
        const targetUser = message.mentions.users.first() || 
                         (args.length > 0 ? await client.users.fetch(args[0]).catch(() => null) : null) || 
                         message.author;

        if (!targetUser) { /* ... (usuário não encontrado) ... */ }

        const member = message.guild ? await message.guild.members.fetch(targetUser.id).catch(() => null) : null;
        const userFlags = targetUser.flags ? targetUser.flags.toArray() : [];
        const flagEmojis = { /* ... (mapeamento de flags como antes) ... */ };
        const badges = userFlags.map(flag => flagEmojis[flag] || flag).join(' ') || 'Nenhuma badge notável';

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle(`👤 Informações de ${targetUser.username}`)
            .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true })})
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '🏷️ Tag Completa', value: `\`${targetUser.tag}\``, inline: true },
                { name: '🆔 ID do Usuário', value: `\`${targetUser.id}\``, inline: true },
                { name: '🤖 É um Bot?', value: targetUser.bot ? '✅ Sim' : '❌ Não', inline: true },
                { name: '📅 Conta Criada em', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:F> (<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>)`, inline: false },
                { name: '🌟 Badges do Discord', value: badges, inline: false}
            );

        if (member) {
            embed.addFields(
                { name: '👋 Entrou neste Servidor em', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`, inline: false },
                { name: '🗣️ Apelido no Servidor', value: member.nickname || 'Nenhum', inline: true },
                { name: '🎨 Cor do Cargo Principal', value: member.displayHexColor.toUpperCase(), inline: true },
                { name: '🌟 Cargo Mais Alto', value: `${member.roles.highest.name} (\`${member.roles.highest.id}\`)`, inline: false }
            );
            const roles = member.roles.cache
                .filter(role => role.id !== message.guild.id)
                .sort((a, b) => b.position - a.position)
                .map(role => role.name);
            const rolesDisplay = roles.length > 0 ? roles.slice(0, 5).join(', ') + (roles.length > 5 ? ` e mais ${roles.length - 5}...` : '') : 'Nenhum cargo específico';
            embed.addFields({ name: `📜 Cargos (${roles.length})`, value: rolesDisplay, inline: false });
            
            if (member.premiumSinceTimestamp) {
                embed.addFields({ name: ' Boosting Server Since', value: `<t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`, inline: true });
            }
            if (member.permissions) {
                const keyPermissions = [];
                if (member.permissions.has(PermissionsBitField.Flags.Administrator)) keyPermissions.push('Administrador');
                if (member.permissions.has(PermissionsBitField.Flags.KickMembers)) keyPermissions.push('Expulsar Membros');
                if (member.permissions.has(PermissionsBitField.Flags.BanMembers)) keyPermissions.push('Banir Membros');
                if (member.permissions.has(PermissionsBitField.Flags.ManageChannels)) keyPermissions.push('Gerenciar Canais');
                if (member.permissions.has(PermissionsBitField.Flags.ManageGuild)) keyPermissions.push('Gerenciar Servidor');
                if (keyPermissions.length > 0) {
                    embed.addFields({ name: '🔑 Permissões Chave', value: keyPermissions.join(', '), inline: false });
                }
            }
             if (member.presence) { /* ... (status e atividade como antes) ... */ }
        }
        
        const userFetched = await targetUser.fetch({ force: true }).catch(() => null); // Force fetch para banner
        if (userFetched && userFetched.bannerURL()) {
            embed.setImage(userFetched.bannerURL({ dynamic: true, size: 1024 }));
        }

        embed.setTimestamp()
             .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
        message.channel.send({ embeds: [embed] });
    }
};