// src/commands/moderação/postrules.js
const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

const ownerIdsString = process.env.OWNER_IDS || "SEU_ID_DE_PROPRIETARIO_AQUI_COMO_FALLBACK";
const ownerIds = ownerIdsString.split(',').map(id => id.trim()).filter(id => id);

module.exports = {
    name: 'postrules',
    aliases: ['regraservidor', 'enviarregras', 'mostrarregras'],
    description: 'Envia as regras do servidor para o canal atual ou um canal especificado.',
    category: 'moderação',
    usage: '[#canal_opcional]',

    async execute({ client, message, args, prefix }) {
        if (
            !ownerIds.includes(message.author.id) &&
            !message.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
            !message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
        ) {
            return message.reply({ content: "❌ Você não tem permissão para usar este comando." });
        }

        let targetChannel = message.channel;
        // ... (lógica para pegar targetChannel dos args como antes) ...
        if (args.length > 0) {
            const channelMention = args[0];
            const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
            if (channelIdMatch) {
                const foundChannel = message.guild.channels.cache.get(channelIdMatch[1]);
                if (foundChannel && foundChannel.type === ChannelType.GuildText && foundChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.SendMessages) && foundChannel.permissionsFor(client.user).has(PermissionsBitField.Flags.EmbedLinks)) {
                    targetChannel = foundChannel;
                } else {
                    return message.reply({ content: "❌ Canal não encontrado, não é um canal de texto, ou não tenho permissão para enviar embeds lá." });
                }
            } else {
                return message.reply({ content: `Uso incorreto. Se for especificar um canal, mencione-o corretamente (ex: <#${message.channel.id}>).` });
            }
        }

        const introEmbed = new EmbedBuilder()
            .setColor('#FF69B4')
            .setTitle('📜 Regras do Servidor Bot Samy 📜')
            .setDescription("Olá! Para garantir que nossa comunidade seja um espaço acolhedor, respeitoso e focado no suporte e desenvolvimento do Bot Samy, pedimos que todos sigam as regras abaixo. O descumprimento pode resultar em advertências, silenciamento, expulsão ou banimento.\n\n---");


        // Embed 1: Seções 1 e 2
        const embed1 = new EmbedBuilder()
            .setColor('#FF69B4')
            // .setTitle("Regras Essenciais") // Título opcional para o embed em si
            .addFields(
                {
                    name: "1. Respeito e Conduta Geral",
                    value: "1.1. **Respeito Acima de Tudo:** Trate todos os membros, moderadores e desenvolvedores com respeito. Não toleramos qualquer forma de assédio, bullying, discurso de ódio (racismo, sexismo, homofobia, etc.), ameaças ou qualquer comportamento que crie um ambiente hostil.\n" +
                           "1.2. **Sem Conteúdo Ofensivo ou NSFW:** É estritamente proibido compartilhar conteúdo pornográfico, excessivamente violento, chocante, ou qualquer material que seja ilegal ou inapropriado para todas as idades (Not Safe For Work - NSFW).\n" +
                           "1.3. **Mantenha a Identidade Segura:** Não compartilhe informações pessoais suas ou de terceiros (doxxing). Evite se passar por outros membros, moderadores ou pelo Bot Samy.\n" +
                           "1.4. **Linguagem Apropriada:** Evite o uso excessivo de palavrões ou linguagem vulgar. Lembre-se que temos membros de diversas idades e sensibilidades."
                },
                { name: '\u200B', value: '---\n\n**2. Uso dos Canais e Interação**' }, // Título da seção dentro de um campo
                {
                    name: "Canais Corretos (2.1)", // Nome do campo mais curto
                    value: "Utilize os canais para seus devidos propósitos. Por exemplo:\n" +
                           "   • `#comandos-do-samy` (ou similar): Testar e usar comandos.\n" +
                           "   • `#suporte-geral`: Dúvidas gerais.\n" +
                           "   • `#relatar-bugs`: Reportar falhas do Bot.\n" +
                           "   • `#sugestoes-para-o-samy`: Ideias para o Bot.\n" +
                           "   • `#chat-da-comunidade`: Conversas gerais (bom senso)."
                },
                {
                    name: "Restrições de Interação (2.2 - 2.4)",
                    value: "2.2. **Sem Spam ou Flood:** Não envie mensagens repetidas, excesso de emojis/CAPS, ou \"flood\". Inclui spam de comandos.\n" +
                           "2.3. **Sem Auto-Promoção Excessiva:** Não divulgue outros servidores, links de afiliados, canais, etc., sem permissão prévia, especialmente fora de canais designados. Foco é o Bot Samy.\n" +
                           "2.4. **Sem Menções Desnecessárias:** Evite @pingar membros, cargos (especialmente `@everyone`/`@here`) ou equipe sem motivo importante."
                }
            );

        // Embed 2: Seções 3, 4, 5 e 6
        const embed2 = new EmbedBuilder()
            .setColor('#FF69B4')
            // .setTitle("Regras Adicionais e Diretrizes")
            .addFields(
                { name: '\u200B', value: '---\n\n**3. Interação com o Bot Samy**' },
                {
                    name: "Uso do Bot (3.1 - 3.3)",
                    value: "3.1. **Uso Consciente:** Evite sobrecarregar o Bot com comandos repetitivos.\n" +
                           "3.2. **Canais de Comando:** Use canais designados para comandos.\n" +
                           "3.3. **Não Tente Burlar:** Não explore falhas ou use comandos maliciosamente. Reporte bugs em `#relatar-bugs`."
                },
                { name: '\u200B', value: '---\n\n**4. Suporte, Bugs e Sugestões**' },
                {
                    name: "Procedimentos (4.1 - 4.3)",
                    value: "4.1. **Detalhe seu Problema/Sugestão:** Seja claro e detalhado. Forneça comando usado, o que esperava, o que aconteceu, e prints (se aplicável).\n" +
                           "4.2. **Paciência com o Suporte:** A equipe e comunidade ajudarão o mais rápido possível (suporte voluntário).\n" +
                           "4.3. **Verifique Antes de Postar:** Use a busca para evitar duplicidade de bugs/sugestões."
                },
                { name: '\u200B', value: '---\n\n**5. Interação com a Equipe**' },
                {
                    name: "Comunicação (5.1 - 5.2)",
                    value: "5.1. **Respeite as Decisões da Equipe:** Decisões da moderação/administração visam o bem da comunidade. Queixas sobre moderação, procure um admin em DM educadamente.\n" +
                           "5.2. **Não Envie DMs Desnecessárias à Equipe:** Use canais públicos para suporte/dúvidas. DMs para equipe são para questões sensíveis ou quando instruído."
                },
                { name: '\u200B', value: '---\n\n**6. Diretrizes do Discord**' },
                {
                    name: "Termos do Discord (6.1)",
                    value: "6.1. **Siga os Termos de Serviço e Diretrizes da Comunidade do Discord:** Além destas regras, todos devem aderir às políticas do Discord. Violações graves podem ser reportadas ao Discord."
                }
            )
            .setTimestamp()
            .setFooter({ text: `Equipe de Moderação Samy Bot | Última atualização: ${new Date().toLocaleDateString('pt-BR')}` });


        try {
            await targetChannel.send({ embeds: [introEmbed] });
            await targetChannel.send({ embeds: [embed1] });
            await targetChannel.send({ embeds: [embed2] });

            if (message.channel.id !== targetChannel.id) {
                await message.reply({ content: `✅ Regras enviadas com sucesso para o canal ${targetChannel.toString()}!` });
            } else {
                await message.react('👍').catch(console.error);
            }

        } catch (error) {
            console.error("[PostRulesCmd] Erro ao enviar as regras:", error);
            message.reply({ content: "❌ Ocorreu um erro ao tentar postar as regras. Verifique minhas permissões no canal de destino." });
        }
    }
};