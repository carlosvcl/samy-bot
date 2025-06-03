// src/events/guilds/guildMemberAdd.js
const { Events, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
    name: Events.GuildMemberAdd, // Evento que estamos ouvindo
    async execute(member, client) { // 'member' é o GuildMember que acabou de entrar
        // 'client' é a instância do seu bot, passada pelo eventHandler

        // Pega os IDs configurados no .env
        const targetGuildId = process.env.WELCOME_GUILD_ID;
        const welcomeChannelId = process.env.WELCOME_CHANNEL_ID;

        // Verifica se o evento ocorreu no servidor configurado
        if (member.guild.id !== targetGuildId) {
            return; // Se não for o servidor alvo, não faz nada
        }

        // Verifica se o canal de boas-vindas está configurado
        if (!welcomeChannelId) {
            console.warn("[WelcomeMsg] ID do canal de boas-vindas (WELCOME_CHANNEL_ID) não está configurado no .env.");
            return;
        }

        // Encontra o canal de boas-vindas
        const welcomeChannel = client.channels.cache.get(welcomeChannelId);

        if (!welcomeChannel) {
            console.error(`[WelcomeMsg] Canal de boas-vindas com ID ${welcomeChannelId} não encontrado.`);
            return;
        }

        // Verifica se é um canal de texto e se o bot pode enviar mensagens
        if (welcomeChannel.type !== ChannelType.GuildText || !welcomeChannel.permissionsFor(client.user).has('SendMessages') || !welcomeChannel.permissionsFor(client.user).has('EmbedLinks')) {
            console.error(`[WelcomeMsg] Não consigo enviar mensagens ou embeds no canal ${welcomeChannel.name} (ID: ${welcomeChannelId}). Verifique as permissões.`);
            return;
        }

        console.log(`[WelcomeMsg] Novo membro ${member.user.tag} (ID: ${member.user.id}) entrou no servidor ${member.guild.name}. Enviando boas-vindas...`);

        // --- Criação da Mensagem de Boas-Vindas ---
        const welcomeEmbed = new EmbedBuilder()
            .setColor('#FF69B4') // Sua cor padrão
            .setTitle(`👋 Bem-vindo(a) ao ${member.guild.name}, ${member.user.username}!`)
            .setDescription(`Olá ${member.toString()}! Estamos muito felizes em ter você por aqui. Esperamos que você aproveite sua estadia e todas as funcionalidades que o **Samy Bot** e nossa comunidade têm a oferecer!`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields(
                { name: '📜 Primeiros Passos', value: "Não se esqueça de ler nossas `#regras` para uma boa convivência e explore os canais para conhecer mais sobre o bot e interagir conosco!" },
                { name: '✨ Dica', value: `Use \`${client.prefix || 's!'}help\` para descobrir todos os comandos do Samy Bot.` },
                { name: '🫂 Você é o membro de número', value: `\`${member.guild.memberCount.toLocaleString('pt-BR')}\`!` }
            )
            .setImage(member.guild.bannerURL({ dynamic: true, size: 512, format: 'png' }) || member.guild.iconURL({ dynamic: true, size: 512 })) // Tenta usar o banner do servidor ou o ícone
            .setTimestamp()
            .setFooter({ text: `${member.user.tag} acabou de chegar!`, iconURL: member.user.displayAvatarURL({ dynamic: true }) });

        try {
            await welcomeChannel.send({ embeds: [welcomeEmbed] });
        } catch (error) {
            console.error("[WelcomeMsg] Falha ao enviar a mensagem de boas-vindas:", error);
        }
    }
};