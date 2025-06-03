// src/commands/utilidades/serverinfo.js
const { EmbedBuilder, ChannelType, GuildVerificationLevel, GuildExplicitContentFilter, GuildMFALevel } = require('discord.js');

module.exports = {
    name: 'serverinfo',
    description: 'Mostra informações detalhadas sobre o servidor atual.',
    aliases: ['si', 'guildinfo', 'servidorinfo', 'infoserver'], // Adicionei mais aliases
    category: 'utilidades', // Categoria definida
    // cooldown: 10, // Exemplo de cooldown de comando, se desejar
    // permissionsUser: [], // Exemplo: [PermissionsBitField.Flags.ManageGuild] se fosse restrito
    // permissionsBot: [], // Exemplo: [PermissionsBitField.Flags.EmbedLinks]
    async execute({ client, message, args }) {
        const guild = message.guild;
        if (!guild) return message.reply("Este comando só pode ser usado dentro de um servidor.");

        try {
            // Fetch para garantir dados atualizados (usar com moderação em servidores muito grandes)
            await guild.members.fetch({ force: false }).catch(() => console.log("Não foi possível fazer fetch de todos os membros para serverinfo."));
            await guild.channels.fetch().catch(() => console.log("Não foi possível fazer fetch de todos os canais para serverinfo."));
            const owner = await guild.fetchOwner();

            const verificationLevels = {
                [GuildVerificationLevel.None]: '🔓 Nenhum (Sem restrições)',
                [GuildVerificationLevel.Low]: '✉️ Baixo (Email verificado)',
                [GuildVerificationLevel.Medium]: '🕰️ Médio (Registrado no Discord por >5 min)',
                [GuildVerificationLevel.High]: '🔟 Alto (Membro do servidor por >10 min)',
                [GuildVerificationLevel.VeryHigh]: '📱 Muito Alto (Telefone verificado)'
            };
            const contentFilterLevels = {
                [GuildExplicitContentFilter.Disabled]: '🚫 Desativado',
                [GuildExplicitContentFilter.MembersWithoutRoles]: '👤 Membros sem cargos',
                [GuildExplicitContentFilter.AllMembers]: '👥 Todos os membros'
            };
            const mfaLevels = {
                [GuildMFALevel.None]: '❌ Desativado',
                [GuildMFALevel.Elevated]: '✅ Ativado (2FA para Moderadores)'
            };

            const embed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle(`ℹ️ Informações do Servidor: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: '👑 Dono do Servidor', value: `${owner.user.tag} (\`${owner.id}\`)`, inline: false },
                    { name: '🆔 ID do Servidor', value: `\`${guild.id}\``, inline: true },
                    { name: '🌍 Região (Preferida)', value: guild.preferredLocale || 'Automática', inline: true },
                    { name: '📅 Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`, inline: false },
                    
                    { name: '👥 Membros', value: `**Total:** ${guild.memberCount.toLocaleString()}\n**Humanos:** ${guild.members.cache.filter(member => !member.user.bot).size.toLocaleString()}\n**Bots:** ${guild.members.cache.filter(member => member.user.bot).size.toLocaleString()}`, inline: false },
                    { name: '🟢 Online / 🔰 Total de Cargos', value: `${guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size.toLocaleString()} Online / ${guild.roles.cache.size.toLocaleString()} Cargos`, inline: false},
                    
                    { name: '💬 Canais', value: `**Texto:** ${guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size}\n**Voz:** ${guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size}\n**Categorias:** ${guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size}\n**Outros (Stages, Fóruns, etc.):** ${guild.channels.cache.filter(c => ![ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildCategory].includes(c.type)).size}`, inline: false },

                    { name: '✨ Nível de Boost', value: `Nível ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} Boosts)`, inline: true },
                    { name: '🛡️ Nível de Verificação', value: verificationLevels[guild.verificationLevel], inline: true },
                    { name: '🔞 Filtro de Conteúdo Explícito', value: contentFilterLevels[guild.explicitContentFilter], inline: true },
                    { name: '🔐 Nível de Autenticação 2FA (Moderação)', value: mfaLevels[guild.mfaLevel], inline: true},

                    { name: '😃 Emojis (Total / Animados / Disponíveis)', value: `${guild.emojis.cache.size} / ${guild.emojis.cache.filter(e => e.animated).size} / ${guild.emojis.cache.filter(e => e.available).size}`, inline: false },
                    { name: '🎨 Stickers (Total)', value: `${guild.stickers.cache.size}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
                
            if (guild.bannerURL()) {
                embed.setImage(guild.bannerURL({ size: 1024, format: 'png' })); // Adicionado format
            }

            message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error("Erro ao buscar informações do servidor:", error);
            message.reply("Ocorreu um erro ao tentar obter as informações do servidor. Tente novamente mais tarde.");
        }
    }
};