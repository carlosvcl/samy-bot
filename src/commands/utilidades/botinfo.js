// src/commands/utilidades/botinfo.js
const { EmbedBuilder, version: djsVersion, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js'); // Removido ActivityType, não usado aqui
const os = require('os');
const packageJson = require('../../../package.json'); // Certifique-se que o caminho está correto (../..)

module.exports = {
    name: 'botinfo',
    aliases: ['info', 'bi', 'statusbot', 'sobre', 'samyinfo'],
    description: 'Mostra informações detalhadas sobre mim, o Samy Bot!',
    category: 'utilidades',
    cooldown: 10,
    // filePath: __filename, // Seu handler pode adicionar isso

    async execute({ client, message, args }) {
        const prettyMs = (await import('pretty-ms')).default;

        // --- Informações do Desenvolvedor ---
        const ownerIds = (process.env.OWNER_IDS || "SEU_ID_DE_DONO_AQUI").split(',').map(id => id.trim()).filter(id => id);
        let developerDisplay = `<@${ownerIds[0]}>`;
        let developerUser = null; // Para pegar o avatar do dev
        if (ownerIds[0] && ownerIds[0] !== "SEU_ID_DE_DONO_AQUI" && ownerIds[0].match(/^\d{17,19}$/)) {
            try {
                developerUser = await client.users.fetch(ownerIds[0]);
                developerDisplay = developerUser ? `[${developerUser.tag}](https://discord.com/users/${ownerIds[0]})` : `<@${ownerIds[0]}>`;
            } catch (err) {
                console.warn(`Botinfo: Não foi possível buscar o desenvolvedor principal pelo ID ${ownerIds[0]}.`);
                // Se não encontrar o usuário, developerDisplay continua como <@ID>
            }
        } else if (process.env.DEVELOPER_TAG) {
            developerDisplay = process.env.DEVELOPER_TAG;
        }

        // --- Informações e Estatísticas do Bot ---
        const botVersion = packageJson.version || "N/A";
        const uptime = prettyMs(client.uptime, { verbose: true, secondsDecimalDigits: 0 });
        const guildsCount = client.guilds.cache.size;
        const usersCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
        const prefixCommandsCount = client.prefixCommands ? client.prefixCommands.size : 0;
        const slashCommandsCount = client.commands ? client.commands.size : 0;
        const totalCommandsCount = prefixCommandsCount + slashCommandsCount;

        // --- Informações Técnicas ---
        const ramUsageBot = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
        const ping = Math.round(client.ws.ping);
        const nodeVersion = process.version;
        const platform = os.platform().replace('win32', 'Windows').replace('darwin', 'macOS');

        // --- Links ---
        const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot%20applications.commands`;
        const supportServerInvite = process.env.SUPPORT_SERVER_INVITE || null;
        const websiteUrl = process.env.WEBSITE_URL || null; // Ex: "https://carlosvc1.github.io/samy-bot-site/"
        const githubRepoUrl = process.env.GITHUB_REPO_URL || null;

        // --- Seção de Doação ---
        const donationText = "Manter um bot de qualidade online 24/7 envolve custos. Se você gosta do Samy e quer ajudar, considere uma doação voluntária.\nQualquer valor é muito apreciado! ❤️";
        const pixKey = process.env.PIX_KEY || null; // Ex: "aee28b1c-b5de-41bb-b886-75e5a52cc212"
        const payPalUser = process.env.PAYPAL_USERNAME || null;
        let payPalDisplay = null;
        if (payPalUser && payPalUser !== "SEUUSERNAMEPAYPAL") {
            payPalDisplay = process.env.PAYPAL_STATUS === 'MAINTENANCE' ?
                `[Doe via PayPal](https://paypal.me/${payPalUser}) (MANUTENÇÃO)` :
                `[Doe via PayPal](https://paypal.me/${payPalUser})`;
        }

        const embed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setAuthor({ name: `Informações sobre ${client.user.username}`, iconURL: client.user.displayAvatarURL() })
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setDescription(`Olá! Sou o **Samy**, seu assistente multifuncional para Discord!\nFui criado para ajudar e entreter seu servidor com uma variedade de comandos e recursos.\n\u200B`) // \u200B para uma linha de espaço
            .addFields(
                { name: '✨ Criador', value: developerDisplay, inline: true },
                { name: '🎉 Versão', value: `\`v${botVersion}\``, inline: true },
                { name: '🎂 Minha Data de Criação', value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:D>`, inline: true },

                { name: '🌐 Servidores', value: `\`${guildsCount.toLocaleString('pt-BR')}\``, inline: true },
                { name: '🫂 Usuários Totais', value: `\`${usersCount.toLocaleString('pt-BR')}\``, inline: true },
                { name: '⚙️ Comandos', value: `\`${totalCommandsCount}\``, inline: true },

                { name: '⏱️ Tempo Online', value: `\`${uptime}\``, inline: false }, // Uptime sozinho em uma linha

                { name: '🧠 Memória (Uso)', value: `\`${ramUsageBot} MB\``, inline: true },
                { name: '📶 Latência API', value: `\`${ping}ms\``, inline: true },
                { name: '🟩 Node.js', value: `\`${nodeVersion}\``, inline: true },

                { name: '📚 Biblioteca', value: `\`Discord.js v${djsVersion}\``, inline: true },
                { name: '💻 Plataforma Host', value: `\`${platform}\``, inline: true },
                 // Adicionar um campo vazio para tentar forçar a próxima linha se houver apenas 2 itens acima
                { name: '\u200B', value: '\u200B', inline: true }
            );

        if (pixKey || payPalDisplay) {
            embed.addFields({ name: '\u200B', value: '__**💖 Apoie o Desenvolvimento!**__\n' + donationText });
            const donationFieldsToAdd = [];
            if (pixKey && pixKey !== "SUA_CHAVE_PIX_AQUI_OU_DEIXE_VAZIO_NO_ENV") {
                donationFieldsToAdd.push({ name: '💸 Pix (Chave Aleatória)', value: `\`\`\`${pixKey}\`\`\``, inline: true });
            }
            if (payPalDisplay) { // payPalDisplay já lida com o "(MANUTENÇÃO)"
                donationFieldsToAdd.push({ name: '💳 PayPal', value: payPalDisplay, inline: true });
            }
             if (donationFieldsToAdd.length === 1) { // Se só tiver um método, deixa ele ocupar mais espaço
                donationFieldsToAdd[0].inline = false;
            }
            if (donationFieldsToAdd.length > 0) {
                 embed.addFields(...donationFieldsToAdd);
            }
        }

        let usefulLinksValue = `[**Me Adicione ao seu Servidor!**](${inviteLink})`;
        if (supportServerInvite && supportServerInvite !== "[Configure SUPPORT_SERVER_INVITE no .env]") {
            usefulLinksValue += `\n[Servidor de Suporte](${supportServerInvite})`;
        }
        if (websiteUrl && websiteUrl !== "URL_DO_SEU_SITE_PLACEHOLDER") {
            usefulLinksValue += `\n[Nosso Website](${websiteUrl})`;
        }
        if (githubRepoUrl && githubRepoUrl !== "LINK_GITHUB_PLACEHOLDER") {
            usefulLinksValue += `\n [Código Fonte (GitHub)](${githubRepoUrl})`;
        }
        embed.addFields({ name: '\u200B', value: '\u200B' }); // Espaçador
        embed.addFields({ name: '🔗 Links Importantes', value: usefulLinksValue });

        embed.setTimestamp()
             .setFooter({ text: `Solicitado por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });

        // Botões
        const row = new ActionRowBuilder();
        row.addComponents(
            new ButtonBuilder().setLabel(`Convidar Samy`).setStyle(ButtonStyle.Link).setURL(inviteLink).setEmoji('➕') // Adicionando emoji ao botão
        );

        if (supportServerInvite && supportServerInvite !== "[Configure SUPPORT_SERVER_INVITE no .env]") {
            row.addComponents(new ButtonBuilder().setLabel('Servidor de Suporte').setStyle(ButtonStyle.Link).setURL(supportServerInvite).setEmoji('🤝'));
        }

        // Adiciona o BOTÃO do Website AQUI, garantindo que haja no máximo 5 botões por ActionRow
        if (websiteUrl && websiteUrl !== "https://carlosvcl.github.io/samy-bot-site/" && row.components.length < 5) {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Nosso Site') // Texto um pouco menor
                    .setStyle(ButtonStyle.Link)
                    .setURL(websiteUrl)
                    .setEmoji('🌐')
            );
        }
        
        // Opcional: Botão do GitHub se couber
        if (githubRepoUrl && githubRepoUrl !== "https://carlosvcl.github.io/samy-bot-site/" && row.components.length < 5) {
             row.addComponents(new ButtonBuilder().setLabel('GitHub').setStyle(ButtonStyle.Link).setURL(githubRepoUrl).setEmoji('🐙'));
        }


        await message.channel.send({ embeds: [embed], components: row.components.length > 0 ? [row] : [] });
    }
};