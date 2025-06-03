// src/commands/moderacao/ban.js
const { EmbedBuilder, PermissionsBitField, GuildMember } = require('discord.js'); // Adicionado GuildMember
const { logModerationAction } = require('../../utils/modLogHelper'); // Ajuste o caminho se necessário

module.exports = {
    name: 'ban',
    description: 'Bane um usuário do servidor permanentemente.',
    aliases: ['banir', 'martelodonada'],
    category: 'moderação',
    args: true,
    usage: '<@usuário ou ID> [razão] [dias_mensagens_deletar (0-7)]',
    permissionsUser: [PermissionsBitField.Flags.BanMembers],
    permissionsBot: [PermissionsBitField.Flags.BanMembers],
    async execute({ client, message, args }) {
        // Etapa 1: Obter a entidade alvo (usuário/membro)
        const fetchedEntity = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);

        // Etapa 2: Verificar se alguma entidade foi encontrada
        if (!fetchedEntity) {
            return message.reply('Usuário não encontrado. Por favor, mencione um usuário ou forneça um ID válido.');
        }

        // Etapa 3: Garantir que a entidade é um GuildMember
        // Esta é a verificação crucial para prevenir o erro original.
        // message.mentions.members.first() já retorna GuildMember.
        // message.guild.members.fetch() DEVE retornar GuildMember ou rejeitar (resultando em null).
        // Esta verificação é uma salvaguarda extra para casos inesperados.
        if (!(fetchedEntity instanceof GuildMember)) {
            console.error(`[BAN COMMAND DEBUG] A entidade buscada para "${args[0]}" não é um GuildMember. Tipo: ${typeof fetchedEntity}. É User? ${fetchedEntity instanceof require('discord.js').User}`);
            return message.reply('Não foi possível obter informações de membro completas para este usuário. Verifique se o ID/menção é de um membro atual do servidor.');
        }
        
        // Se passou na verificação, podemos seguramente chamar de targetMember
        const targetMember = fetchedEntity;

        // Etapa 4: Verificações de auto-banimento e banimento do bot
        if (targetMember.id === message.author.id) {
            return message.reply('Você não pode se banir.');
        }
        if (targetMember.id === client.user.id) {
            return message.reply('Eu não posso me banir.');
        }

        // Etapa 5: Verificar se o alvo é banível pelo bot
        // Com targetMember garantido como GuildMember, targetMember.user.tag aqui deve ser seguro.
        if (!targetMember.bannable) {
            return message.reply(`Não posso banir ${targetMember.user.tag}. Eles podem ter um cargo superior ao meu, ser o dono do servidor, ou eu não tenho permissões suficientes.`);
        }
        
        // Etapa 6: Verificar hierarquia de cargos entre autor e alvo
        // targetMember.roles.highest.position é seguro pois targetMember é GuildMember.
        if (message.member.roles.highest.position <= targetMember.roles.highest.position && message.guild.ownerId !== message.author.id) {
            return message.reply('Você não pode banir um membro com cargo igual ou superior ao seu, a menos que você seja o dono do servidor.');
        }
        
        // Etapa 7: Processar razão e dias para deletar mensagens
        let reason = args.slice(1).join(' ');
        let deleteMessageDays = 0; // Dias de mensagens para deletar (0 a 7)

        const lastArg = args[args.length - 1];
        // Verifica se o último argumento é um número (para dias) e se há argumentos suficientes para a razão
        if (args.length > 1) { // Precisa de pelo menos um ID/menção e um número, ou ID/menção, razão e número
            const potentialDaysArgIndex = reason.lastIndexOf(' ');
            let potentialDaysString = reason;
            if (potentialDaysArgIndex !== -1 && args.length > 2) { // Se houver espaços, pegue a última palavra da razão
                 potentialDaysString = reason.substring(potentialDaysArgIndex + 1);
            } else if (args.length === 2 && !message.mentions.members.first() && args[0].length > 15) { // Caso de !ban ID dias (sem razão)
                 potentialDaysString = args[1]; // O segundo argumento é os dias
            }


            if (!isNaN(parseInt(potentialDaysString))) {
                const potentialDays = parseInt(potentialDaysString);
                if (potentialDays >= 0 && potentialDays <= 7) {
                    deleteMessageDays = potentialDays;
                    if (args.length > 2 && potentialDaysArgIndex !== -1) { // Se pegamos os dias do final da razão
                        reason = reason.substring(0, potentialDaysArgIndex).trim();
                    } else if (args.length === 2 && !message.mentions.members.first() && args[0].length > 15) { // Caso de !ban ID dias (sem razão)
                         reason = ""; // Nenhuma razão explícita
                    } else if (args.length -1 === args.indexOf(potentialDaysString) ) {
                         // Se os dias eram o único "argumento de razão"
                         reason = args.slice(1, args.indexOf(potentialDaysString)).join(' ');
                    }
                }
            }
        }
        
        if (!reason || reason.trim() === '' || (args.length === 2 && !isNaN(parseInt(args[1])) && deleteMessageDays === parseInt(args[1]))) {
            reason = 'Nenhuma razão fornecida.';
        }


        // Etapa 8: Executar o banimento e enviar logs/mensagens
        try {
            await targetMember.ban({ 
                deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60, // API espera segundos
                reason: `Banido por ${message.author.tag}: ${reason}` 
            });

            const caseId = await logModerationAction(client, message.guild, 'ban', message.author, targetMember.user, reason).catch(err => {
                console.error("Erro ao logar ação de ban:", err);
                return "ERRO_LOG";
            });

            const banEmbed = new EmbedBuilder()
                .setColor('#FF69B4') // Rosa
                .setTitle('🔨 Usuário Banido do Servidor')
                .setDescription(`O usuário **${targetMember.user.tag}** foi banido permanentemente.`)
                .addFields(
                    { name: '🎯 Usuário Alvo', value: `${targetMember.user.tag} (\`${targetMember.id}\`)` },
                    { name: '🛡️ Moderador Responsável', value: `${message.author.tag} (\`${message.author.id}\`)` },
                    { name: '📖 Razão Fornecida', value: reason.substring(0, 1000) },
                    { name: '🗑️ Mensagens Apagadas', value: `Equivalente a ${deleteMessageDays} dia(s) de mensagens do usuário.` },
                    { name: '📄 ID do Caso de Moderação', value: `\`${caseId}\`` }
                )
                .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
                .setTimestamp()
                .setFooter({ text: `Ação de moderação por: ${message.author.tag} | ${client.user.username}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) });
            
            message.channel.send({ embeds: [banEmbed] });

            try {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🔨 Você foi BANIDO!')
                    .setDescription(`Você foi **permanentemente banido** do servidor **${message.guild.name}**. Esta é uma decisão final.`)
                    .addFields(
                        { name: '🛡️ Moderador', value: message.author.tag },
                        { name: '📖 Razão', value: reason.substring(0, 1000) }
                    )
                    .setTimestamp()
                    .setFooter({text: `Servidor: ${message.guild.name} | ${client.user.username}`});
                await targetMember.user.send({ embeds: [dmEmbed] }); // Enviar DM para targetMember.user
            } catch (dmError) {
                console.log(`Não foi possível enviar DM para ${targetMember.user.tag} após banimento.`);
            }

        } catch (error) {
            console.error('Erro ao banir membro:', error);
            message.reply('Ocorreu um erro ao tentar banir o membro. Verifique minhas permissões (Ban Members) e a hierarquia de cargos.');
        }
    }
};